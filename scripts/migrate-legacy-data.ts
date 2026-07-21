/**
 * Legacy data migration: `waslah_ecom` (PHP/MySQL, 64 snake_case tables)
 * -> `waslah_fashion` (Next.js/Prisma, clean camelCase schema).
 *
 *   npm run migrate:data            # additive, idempotent (createMany + skipDuplicates)
 *   npm run migrate:data -- --fresh # TRUNCATE every target table first, then load
 *
 * Requires LEGACY_DATABASE_URL (source, read-only) and DATABASE_URL (target).
 *
 * Design notes
 * ------------
 * - Original integer primary keys are preserved on every table so all legacy
 *   foreign keys stay intact. The one exception is `Setting`, which merges two
 *   legacy tables whose id spaces overlap; nothing references settings by id.
 * - Legacy rows are read with keyset pagination (id > lastId LIMIT n) and
 *   written in chunks, so a large table never lands in memory all at once.
 * - `dateStrings: true` on the source connection means every DATE/DATETIME/
 *   TIMESTAMP arrives as a raw string, so '0000-00-00' is coerced to null here
 *   instead of becoming an Invalid Date.
 * - Self-referencing columns (categories.parent_id, chart_of_accounts.parent_id,
 *   journal_entries.reversed_by_id) are applied in a second pass, so row order
 *   within the source table can never trip an FK check.
 */

import "dotenv/config";
import { randomBytes } from "node:crypto";

import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import {
  AccountType,
  AttendanceStatus,
  CampaignEventType,
  CampaignGoalType,
  CampaignMessageType,
  CampaignNoteType,
  CampaignPlatform,
  CouponType,
  EmployeeStatus,
  EmploymentType,
  ExpensePaymentMethod,
  ExpensePaymentStatus,
  Gender,
  IconStyle,
  JournalReferenceType,
  JournalStatus,
  LeaveStatus,
  MetaInsightPeriod,
  MetaMessageStatus,
  MetaMessageType,
  MetaPlatform,
  MetaTemplateCategory,
  MetaTemplateStatus,
  NormalBalance,
  OrderStatus,
  PayrollPaymentMethod,
  PayrollPaymentStatus,
  PayrollPeriodStatus,
  PaymentStatus,
  PosCashLogType,
  PosHeldOrderStatus,
  PosPaymentMethod,
  PosRefundMethod,
  PosRefundStatus,
  PosShiftStatus,
  PosTransactionStatus,
  Prisma,
  PrismaClient,
  ProductStatus,
  PurchaseOrderStatus,
  PurchasePaymentStatus,
  RefundStatus,
  ReturnReason,
  ReviewStatus,
  SalaryCalculationType,
  SalaryComponentType,
  ShipmentStatus,
  SupplierPaymentMethod,
  SupplierStatus,
  TextPosition,
  UserRole,
} from "../src/generated/prisma";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CHUNK = 500;
const FRESH = process.argv.includes("--fresh");
const EPOCH = new Date("1970-01-01T00:00:00.000Z");

/** Every target table, children before parents (used by --fresh). */
const TARGET_TABLES = [
  "meta_message_templates",
  "meta_page_insights",
  "meta_messages",
  "meta_integrations",
  "campaign_notes",
  "campaign_goals",
  "campaign_daily_stats",
  "campaign_analytics",
  "campaign_messages",
  "journal_entry_lines",
  "journal_entries",
  "chart_of_accounts",
  "supplier_payments",
  "purchase_order_items",
  "purchase_orders",
  "suppliers",
  "expenses",
  "expense_categories",
  "payroll_detail_components",
  "payroll_details",
  "payroll_periods",
  "employee_salary_structure",
  "salary_components",
  "leave_requests",
  "leave_types",
  "attendance",
  "employees",
  "departments",
  "pos_split_payments",
  "pos_refunds",
  "pos_held_orders",
  "pos_cash_logs",
  "pos_transaction_items",
  "pos_transactions",
  "pos_shifts",
  "pos_terminals",
  "social_media",
  "lookbook",
  "sliders",
  "return_items",
  "returns",
  "shipment_tracking",
  "shipments",
  "couriers",
  "payments",
  "order_items",
  "orders",
  "coupons",
  "reviews",
  "wishlist",
  "cart_items",
  "carts",
  "product_variants",
  "product_sizes",
  "product_colors",
  "product_images",
  "products",
  "categories",
  "user_addresses",
  "users",
  "settings",
  "stores",
] as const;

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

interface TableStat {
  table: string;
  read: number;
  written: number;
  skipped: number;
  errors: string[];
}

const stats: TableStat[] = [];

function newStat(table: string): TableStat {
  const stat: TableStat = { table, read: 0, written: 0, skipped: 0, errors: [] };
  stats.push(stat);
  return stat;
}

/** Keeps the summary readable when one bad column poisons thousands of rows. */
function note(stat: TableStat, message: string): void {
  if (stat.errors.length < 25) stat.errors.push(message);
  else if (stat.errors.length === 25) stat.errors.push("... (further messages suppressed)");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// ---------------------------------------------------------------------------
// Cell coercion helpers
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

/** Optional string; empty strings stay as-is, only null/undefined become null. */
function str(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? value : String(value);
}

function strReq(value: unknown, fallback = ""): string {
  const out = str(value);
  return out === null || out === "" ? fallback : out;
}

/** Trims a value down to a column's VARCHAR length so MySQL never rejects it. */
function clip(value: string | null, max: number): string | null {
  if (value === null) return null;
  return value.length > max ? value.slice(0, max) : value;
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const out = typeof value === "number" ? value : Number(value);
  return Number.isFinite(out) ? out : null;
}

function numReq(value: unknown, fallback = 0): number {
  return num(value) ?? fallback;
}

/** Decimal columns arrive from mysql2 as strings; Prisma accepts them as-is. */
function dec(value: unknown, fallback = "0"): string {
  if (value === null || value === undefined || value === "") return fallback;
  return typeof value === "string" ? value : String(value);
}

function decOpt(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "string" ? value : String(value);
}

/** tinyint(1), '1'/'0', true/false, and the ENUM('active','inactive') style. */
function flag(value: unknown, fallback = false): boolean {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const text = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "active", "enabled", "on"].includes(text)) return true;
  if (["0", "false", "no", "n", "inactive", "disabled", "off", ""].includes(text)) return false;
  return fallback;
}

const ZERO_DATE = /^0{4}-0{2}-0{2}/;

/** DATETIME/TIMESTAMP -> Date, coercing '0000-00-00 00:00:00' and junk to null. */
function dt(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = String(value).trim();
  if (text === "" || ZERO_DATE.test(text)) return null;
  const parsed = new Date(text.includes("T") ? text : `${text.replace(" ", "T")}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dtReq(value: unknown, fallback: Date): Date {
  return dt(value) ?? fallback;
}

/** DATE -> midnight UTC Date, which is what Prisma's @db.Date expects. */
function dateOnly(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = String(value).trim().slice(0, 10);
  if (text === "" || ZERO_DATE.test(text)) return null;
  const parsed = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateOnlyReq(value: unknown, fallback: Date): Date {
  return dateOnly(value) ?? fallback;
}

/** TIME ('HH:MM:SS') -> Date on the epoch day, matching Prisma's @db.Time. */
function timeOnly(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = String(value).trim();
  const match = /^(\d{1,3}):(\d{2})(?::(\d{2}))?/.exec(text);
  if (!match) return null;
  const hours = Number(match[1]);
  if (hours > 23) return null; // MySQL TIME can exceed a day; Prisma's cannot.
  const iso = `1970-01-01T${String(hours).padStart(2, "0")}:${match[2]}:${match[3] ?? "00"}.000Z`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** JSON / LONGTEXT-holding-JSON -> a Prisma Json input, or DbNull. */
function jsonOpt(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (value === null || value === undefined || value === "") return Prisma.DbNull;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Prisma.InputJsonValue;
    } catch {
      return value;
    }
  }
  return value as Prisma.InputJsonValue;
}

function jsonReq(value: unknown): Prisma.InputJsonValue {
  const out = jsonOpt(value);
  return out === Prisma.DbNull ? [] : (out as Prisma.InputJsonValue);
}

// ---------------------------------------------------------------------------
// Enum mapping
// ---------------------------------------------------------------------------

/**
 * Builds a mapper from the legacy ENUM's lowercase members to a Prisma enum.
 * Lookup keys are lowercased, so tables that already store uppercase values
 * (meta_message_templates.category / .status) map without a special case.
 */
function enumMapper<T extends string>(
  label: string,
  table: Readonly<Record<string, T>>,
  fallback: T,
): (value: unknown, stat?: TableStat) => T {
  return (value, stat) => {
    if (value === null || value === undefined || value === "") return fallback;
    const key = String(value).trim().toLowerCase();
    const hit = table[key];
    if (hit !== undefined) return hit;
    if (stat) note(stat, `unknown ${label} ${JSON.stringify(value)} -> ${fallback}`);
    return fallback;
  };
}

/** Same, but an absent legacy value stays null instead of taking a default. */
function nullableEnumMapper<T extends string>(
  label: string,
  table: Readonly<Record<string, T>>,
): (value: unknown, stat?: TableStat) => T | null {
  const inner = enumMapper<T | "">(label, table, "");
  return (value, stat) => {
    if (value === null || value === undefined || value === "") return null;
    const out = inner(value, stat);
    return out === "" ? null : (out as T);
  };
}

const mapUserRole = enumMapper<UserRole>(
  "users.role",
  { customer: UserRole.CUSTOMER, manager: UserRole.MANAGER, admin: UserRole.ADMIN },
  UserRole.CUSTOMER,
);

const mapProductStatus = enumMapper<ProductStatus>(
  "products.status",
  {
    active: ProductStatus.ACTIVE,
    inactive: ProductStatus.INACTIVE,
    draft: ProductStatus.DRAFT,
  },
  ProductStatus.ACTIVE,
);

const mapOrderStatus = enumMapper<OrderStatus>(
  "orders.status",
  {
    pending: OrderStatus.PENDING,
    processing: OrderStatus.PROCESSING,
    shipped: OrderStatus.SHIPPED,
    delivered: OrderStatus.DELIVERED,
    cancelled: OrderStatus.CANCELLED,
    refunded: OrderStatus.REFUNDED,
  },
  OrderStatus.PENDING,
);

const mapOrderPaymentStatus = enumMapper<PaymentStatus>(
  "orders.payment_status",
  {
    pending: PaymentStatus.PENDING,
    paid: PaymentStatus.PAID,
    failed: PaymentStatus.FAILED,
    refunded: PaymentStatus.REFUNDED,
  },
  PaymentStatus.PENDING,
);

/**
 * The gateway table's ENUM says 'completed' where the new PaymentStatus says
 * PAID; both spellings are accepted so a partially-migrated legacy DB works.
 */
const mapGatewayPaymentStatus = enumMapper<PaymentStatus>(
  "payments.status",
  {
    pending: PaymentStatus.PENDING,
    completed: PaymentStatus.PAID,
    paid: PaymentStatus.PAID,
    failed: PaymentStatus.FAILED,
    refunded: PaymentStatus.REFUNDED,
  },
  PaymentStatus.PENDING,
);

const mapShipmentStatus = enumMapper<ShipmentStatus>(
  "shipments.status",
  {
    pending: ShipmentStatus.PENDING,
    picked_up: ShipmentStatus.PICKED_UP,
    in_transit: ShipmentStatus.IN_TRANSIT,
    out_for_delivery: ShipmentStatus.OUT_FOR_DELIVERY,
    delivered: ShipmentStatus.DELIVERED,
    failed: ShipmentStatus.FAILED,
  },
  ShipmentStatus.PENDING,
);

const mapReviewStatus = enumMapper<ReviewStatus>(
  "reviews.status",
  {
    pending: ReviewStatus.PENDING,
    approved: ReviewStatus.APPROVED,
    rejected: ReviewStatus.REJECTED,
  },
  ReviewStatus.PENDING,
);

const mapReturnReason = enumMapper<ReturnReason>(
  "returns.reason",
  {
    defective: ReturnReason.DEFECTIVE,
    damaged: ReturnReason.DAMAGED,
    wrong_item: ReturnReason.WRONG_ITEM,
    not_as_described: ReturnReason.NOT_AS_DESCRIBED,
    changed_mind: ReturnReason.CHANGED_MIND,
    customer_refused: ReturnReason.CUSTOMER_REFUSED,
    undelivered: ReturnReason.UNDELIVERED,
    other: ReturnReason.OTHER,
  },
  ReturnReason.OTHER,
);

const mapRefundStatus = enumMapper<RefundStatus>(
  "returns.refund_status",
  {
    not_required: RefundStatus.NOT_REQUIRED,
    pending: RefundStatus.PENDING,
    completed: RefundStatus.COMPLETED,
  },
  RefundStatus.NOT_REQUIRED,
);

const mapCouponType = enumMapper<CouponType>(
  "coupons.type",
  {
    fixed: CouponType.FIXED,
    percentage: CouponType.PERCENTAGE,
    free_shipping: CouponType.FREE_SHIPPING,
    gift_item: CouponType.GIFT_ITEM,
    buy_x_get_y: CouponType.BUY_X_GET_Y,
  },
  CouponType.FIXED,
);

const mapTextPosition = enumMapper<TextPosition>(
  "sliders.text_position",
  { left: TextPosition.LEFT, center: TextPosition.CENTER, right: TextPosition.RIGHT },
  TextPosition.LEFT,
);

const mapIconStyle = enumMapper<IconStyle>(
  "social_media.icon_style",
  { brands: IconStyle.BRANDS, solid: IconStyle.SOLID, regular: IconStyle.REGULAR },
  IconStyle.BRANDS,
);

const mapPosShiftStatus = enumMapper<PosShiftStatus>(
  "pos_shifts.status",
  { open: PosShiftStatus.OPEN, closed: PosShiftStatus.CLOSED },
  PosShiftStatus.OPEN,
);

const mapPosPaymentMethod = enumMapper<PosPaymentMethod>(
  "pos_transactions.payment_method",
  {
    cash: PosPaymentMethod.CASH,
    card: PosPaymentMethod.CARD,
    mobile_banking: PosPaymentMethod.MOBILE_BANKING,
    mixed: PosPaymentMethod.MIXED,
  },
  PosPaymentMethod.CASH,
);

const mapPosTransactionStatus = enumMapper<PosTransactionStatus>(
  "pos_transactions.status",
  {
    completed: PosTransactionStatus.COMPLETED,
    refunded: PosTransactionStatus.REFUNDED,
    void: PosTransactionStatus.VOID,
  },
  PosTransactionStatus.COMPLETED,
);

const mapPosCashLogType = enumMapper<PosCashLogType>(
  "pos_cash_logs.log_type",
  {
    cash_in: PosCashLogType.CASH_IN,
    cash_out: PosCashLogType.CASH_OUT,
    adjustment: PosCashLogType.ADJUSTMENT,
  },
  PosCashLogType.ADJUSTMENT,
);

const mapPosHeldOrderStatus = enumMapper<PosHeldOrderStatus>(
  "pos_held_orders.status",
  {
    held: PosHeldOrderStatus.HELD,
    recalled: PosHeldOrderStatus.RECALLED,
    expired: PosHeldOrderStatus.EXPIRED,
  },
  PosHeldOrderStatus.HELD,
);

const mapPosRefundMethod = enumMapper<PosRefundMethod>(
  "pos_refunds.refund_method",
  {
    cash: PosRefundMethod.CASH,
    card: PosRefundMethod.CARD,
    store_credit: PosRefundMethod.STORE_CREDIT,
    original_method: PosRefundMethod.ORIGINAL_METHOD,
  },
  PosRefundMethod.CASH,
);

const mapPosRefundStatus = enumMapper<PosRefundStatus>(
  "pos_refunds.status",
  {
    pending: PosRefundStatus.PENDING,
    completed: PosRefundStatus.COMPLETED,
    cancelled: PosRefundStatus.CANCELLED,
  },
  PosRefundStatus.COMPLETED,
);

const mapGender = nullableEnumMapper<Gender>("employees.gender", {
  male: Gender.MALE,
  female: Gender.FEMALE,
  other: Gender.OTHER,
});

const mapEmploymentType = enumMapper<EmploymentType>(
  "employees.employment_type",
  {
    full_time: EmploymentType.FULL_TIME,
    part_time: EmploymentType.PART_TIME,
    contract: EmploymentType.CONTRACT,
    intern: EmploymentType.INTERN,
  },
  EmploymentType.FULL_TIME,
);

const mapEmployeeStatus = enumMapper<EmployeeStatus>(
  "employees.status",
  {
    active: EmployeeStatus.ACTIVE,
    on_leave: EmployeeStatus.ON_LEAVE,
    terminated: EmployeeStatus.TERMINATED,
    resigned: EmployeeStatus.RESIGNED,
  },
  EmployeeStatus.ACTIVE,
);

const mapAttendanceStatus = enumMapper<AttendanceStatus>(
  "attendance.status",
  {
    present: AttendanceStatus.PRESENT,
    absent: AttendanceStatus.ABSENT,
    late: AttendanceStatus.LATE,
    half_day: AttendanceStatus.HALF_DAY,
    leave: AttendanceStatus.LEAVE,
    holiday: AttendanceStatus.HOLIDAY,
  },
  AttendanceStatus.PRESENT,
);

const mapLeaveStatus = enumMapper<LeaveStatus>(
  "leave_requests.status",
  {
    pending: LeaveStatus.PENDING,
    approved: LeaveStatus.APPROVED,
    rejected: LeaveStatus.REJECTED,
    cancelled: LeaveStatus.CANCELLED,
  },
  LeaveStatus.PENDING,
);

const mapSalaryComponentType = enumMapper<SalaryComponentType>(
  "salary_components.type",
  { earning: SalaryComponentType.EARNING, deduction: SalaryComponentType.DEDUCTION },
  SalaryComponentType.EARNING,
);

const mapSalaryCalculationType = enumMapper<SalaryCalculationType>(
  "salary_components.calculation_type",
  { fixed: SalaryCalculationType.FIXED, percentage: SalaryCalculationType.PERCENTAGE },
  SalaryCalculationType.FIXED,
);

const mapPayrollPeriodStatus = enumMapper<PayrollPeriodStatus>(
  "payroll_periods.status",
  {
    draft: PayrollPeriodStatus.DRAFT,
    processing: PayrollPeriodStatus.PROCESSING,
    approved: PayrollPeriodStatus.APPROVED,
    paid: PayrollPeriodStatus.PAID,
    cancelled: PayrollPeriodStatus.CANCELLED,
  },
  PayrollPeriodStatus.DRAFT,
);

const mapPayrollPaymentMethod = enumMapper<PayrollPaymentMethod>(
  "payroll_details.payment_method",
  {
    bank: PayrollPaymentMethod.BANK,
    cash: PayrollPaymentMethod.CASH,
    mobile_banking: PayrollPaymentMethod.MOBILE_BANKING,
  },
  PayrollPaymentMethod.BANK,
);

const mapPayrollPaymentStatus = enumMapper<PayrollPaymentStatus>(
  "payroll_details.payment_status",
  { pending: PayrollPaymentStatus.PENDING, paid: PayrollPaymentStatus.PAID },
  PayrollPaymentStatus.PENDING,
);

const mapExpensePaymentMethod = enumMapper<ExpensePaymentMethod>(
  "expenses.payment_method",
  {
    cash: ExpensePaymentMethod.CASH,
    bank_transfer: ExpensePaymentMethod.BANK_TRANSFER,
    mobile_banking: ExpensePaymentMethod.MOBILE_BANKING,
    card: ExpensePaymentMethod.CARD,
    other: ExpensePaymentMethod.OTHER,
  },
  ExpensePaymentMethod.CASH,
);

const mapExpensePaymentStatus = enumMapper<ExpensePaymentStatus>(
  "expenses.payment_status",
  {
    pending: ExpensePaymentStatus.PENDING,
    paid: ExpensePaymentStatus.PAID,
    partial: ExpensePaymentStatus.PARTIAL,
  },
  ExpensePaymentStatus.PENDING,
);

const mapSupplierStatus = enumMapper<SupplierStatus>(
  "suppliers.status",
  { active: SupplierStatus.ACTIVE, inactive: SupplierStatus.INACTIVE },
  SupplierStatus.ACTIVE,
);

const mapPurchaseOrderStatus = enumMapper<PurchaseOrderStatus>(
  "purchase_orders.status",
  {
    draft: PurchaseOrderStatus.DRAFT,
    pending: PurchaseOrderStatus.PENDING,
    approved: PurchaseOrderStatus.APPROVED,
    ordered: PurchaseOrderStatus.ORDERED,
    partial: PurchaseOrderStatus.PARTIAL,
    received: PurchaseOrderStatus.RECEIVED,
    cancelled: PurchaseOrderStatus.CANCELLED,
  },
  PurchaseOrderStatus.DRAFT,
);

const mapPurchasePaymentStatus = enumMapper<PurchasePaymentStatus>(
  "purchase_orders.payment_status",
  {
    pending: PurchasePaymentStatus.PENDING,
    partial: PurchasePaymentStatus.PARTIAL,
    paid: PurchasePaymentStatus.PAID,
  },
  PurchasePaymentStatus.PENDING,
);

const mapSupplierPaymentMethod = enumMapper<SupplierPaymentMethod>(
  "supplier_payments.payment_method",
  {
    cash: SupplierPaymentMethod.CASH,
    bank_transfer: SupplierPaymentMethod.BANK_TRANSFER,
    check: SupplierPaymentMethod.CHECK,
    mobile_banking: SupplierPaymentMethod.MOBILE_BANKING,
    other: SupplierPaymentMethod.OTHER,
  },
  SupplierPaymentMethod.BANK_TRANSFER,
);

const mapAccountType = enumMapper<AccountType>(
  "chart_of_accounts.account_type",
  {
    asset: AccountType.ASSET,
    liability: AccountType.LIABILITY,
    equity: AccountType.EQUITY,
    revenue: AccountType.REVENUE,
    expense: AccountType.EXPENSE,
    cogs: AccountType.COGS,
  },
  AccountType.ASSET,
);

const mapNormalBalance = enumMapper<NormalBalance>(
  "chart_of_accounts.normal_balance",
  { debit: NormalBalance.DEBIT, credit: NormalBalance.CREDIT },
  NormalBalance.DEBIT,
);

const mapJournalReferenceType = enumMapper<JournalReferenceType>(
  "journal_entries.reference_type",
  {
    manual: JournalReferenceType.MANUAL,
    order: JournalReferenceType.ORDER,
    expense: JournalReferenceType.EXPENSE,
    purchase: JournalReferenceType.PURCHASE,
    return: JournalReferenceType.RETURN,
    payment: JournalReferenceType.PAYMENT,
    adjustment: JournalReferenceType.ADJUSTMENT,
  },
  JournalReferenceType.MANUAL,
);

const mapJournalStatus = enumMapper<JournalStatus>(
  "journal_entries.status",
  {
    draft: JournalStatus.DRAFT,
    posted: JournalStatus.POSTED,
    reversed: JournalStatus.REVERSED,
  },
  JournalStatus.DRAFT,
);

const mapCampaignPlatform = enumMapper<CampaignPlatform>(
  "campaign_messages.platform",
  {
    all: CampaignPlatform.ALL,
    facebook: CampaignPlatform.FACEBOOK,
    instagram: CampaignPlatform.INSTAGRAM,
    whatsapp: CampaignPlatform.WHATSAPP,
    telegram: CampaignPlatform.TELEGRAM,
    twitter: CampaignPlatform.TWITTER,
  },
  CampaignPlatform.ALL,
);

const mapCampaignMessageType = enumMapper<CampaignMessageType>(
  "campaign_messages.message_type",
  {
    promotion: CampaignMessageType.PROMOTION,
    announcement: CampaignMessageType.ANNOUNCEMENT,
    greeting: CampaignMessageType.GREETING,
    offer: CampaignMessageType.OFFER,
    event: CampaignMessageType.EVENT,
    custom: CampaignMessageType.CUSTOM,
  },
  CampaignMessageType.PROMOTION,
);

const mapCampaignEventType = enumMapper<CampaignEventType>(
  "campaign_analytics.event_type",
  {
    view: CampaignEventType.VIEW,
    copy: CampaignEventType.COPY,
    click: CampaignEventType.CLICK,
    share: CampaignEventType.SHARE,
    engagement: CampaignEventType.ENGAGEMENT,
  },
  CampaignEventType.VIEW,
);

const mapCampaignGoalType = enumMapper<CampaignGoalType>(
  "campaign_goals.goal_type",
  {
    views: CampaignGoalType.VIEWS,
    copies: CampaignGoalType.COPIES,
    clicks: CampaignGoalType.CLICKS,
    shares: CampaignGoalType.SHARES,
    engagements: CampaignGoalType.ENGAGEMENTS,
  },
  CampaignGoalType.VIEWS,
);

const mapCampaignNoteType = enumMapper<CampaignNoteType>(
  "campaign_notes.note_type",
  {
    general: CampaignNoteType.GENERAL,
    performance: CampaignNoteType.PERFORMANCE,
    issue: CampaignNoteType.ISSUE,
    idea: CampaignNoteType.IDEA,
  },
  CampaignNoteType.GENERAL,
);

const mapMetaPlatform = enumMapper<MetaPlatform>(
  "meta.platform",
  {
    facebook: MetaPlatform.FACEBOOK,
    instagram: MetaPlatform.INSTAGRAM,
    whatsapp: MetaPlatform.WHATSAPP,
  },
  MetaPlatform.FACEBOOK,
);

const mapMetaMessageType = enumMapper<MetaMessageType>(
  "meta_messages.message_type",
  {
    text: MetaMessageType.TEXT,
    image: MetaMessageType.IMAGE,
    video: MetaMessageType.VIDEO,
    audio: MetaMessageType.AUDIO,
    file: MetaMessageType.FILE,
    sticker: MetaMessageType.STICKER,
    template: MetaMessageType.TEMPLATE,
    interactive: MetaMessageType.INTERACTIVE,
  },
  MetaMessageType.TEXT,
);

const mapMetaMessageStatus = enumMapper<MetaMessageStatus>(
  "meta_messages.status",
  {
    sent: MetaMessageStatus.SENT,
    delivered: MetaMessageStatus.DELIVERED,
    read: MetaMessageStatus.READ,
    failed: MetaMessageStatus.FAILED,
  },
  MetaMessageStatus.SENT,
);

const mapMetaInsightPeriod = enumMapper<MetaInsightPeriod>(
  "meta_page_insights.period",
  {
    day: MetaInsightPeriod.DAY,
    week: MetaInsightPeriod.WEEK,
    month: MetaInsightPeriod.MONTH,
    lifetime: MetaInsightPeriod.LIFETIME,
  },
  MetaInsightPeriod.DAY,
);

// meta_message_templates already stores uppercase values; keys are lowercased
// by enumMapper before lookup, so these tables need no special casing.
const mapMetaTemplateCategory = enumMapper<MetaTemplateCategory>(
  "meta_message_templates.category",
  {
    marketing: MetaTemplateCategory.MARKETING,
    utility: MetaTemplateCategory.UTILITY,
    authentication: MetaTemplateCategory.AUTHENTICATION,
  },
  MetaTemplateCategory.MARKETING,
);

const mapMetaTemplateStatus = enumMapper<MetaTemplateStatus>(
  "meta_message_templates.status",
  {
    pending: MetaTemplateStatus.PENDING,
    approved: MetaTemplateStatus.APPROVED,
    rejected: MetaTemplateStatus.REJECTED,
  },
  MetaTemplateStatus.PENDING,
);

// ---------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

// Prisma 7 requires a driver adapter; the MariaDB adapter speaks MySQL.
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(requireEnv("DATABASE_URL")),
  log: ["error"],
});

let legacy: Connection;

async function tableExists(table: string): Promise<boolean> {
  const [rows] = await legacy.query<RowDataPacket[]>(
    "SELECT 1 AS ok FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1",
    [table],
  );
  return rows.length > 0;
}

/** Keyset pagination on the integer PK every legacy table has. */
async function* readChunks(table: string): AsyncGenerator<Row[]> {
  let lastId = 0;
  for (;;) {
    const [rows] = await legacy.query<RowDataPacket[]>(
      `SELECT * FROM \`${table}\` WHERE id > ? ORDER BY id ASC LIMIT ?`,
      [lastId, CHUNK],
    );
    if (rows.length === 0) return;
    yield rows as Row[];
    lastId = numReq((rows[rows.length - 1] as Row).id, lastId + CHUNK);
  }
}

async function readAll(table: string): Promise<Row[]> {
  const out: Row[] = [];
  for await (const chunk of readChunks(table)) out.push(...chunk);
  return out;
}

// ---------------------------------------------------------------------------
// Generic table runner
// ---------------------------------------------------------------------------

type Mapper<T> = (row: Row, stat: TableStat) => T | null;
type Inserter<T> = (rows: T[]) => Promise<{ count: number }>;

/**
 * Streams a legacy table through `map` and writes it with `insert`, chunk by
 * chunk. A chunk that fails is retried row by row so one bad record does not
 * cost the other 499.
 */
async function migrateTable<T>(
  legacyTable: string,
  targetLabel: string,
  map: Mapper<T>,
  insert: Inserter<T>,
): Promise<TableStat> {
  const stat = newStat(`${legacyTable} -> ${targetLabel}`);
  process.stdout.write(`  ${legacyTable} ... `);

  if (!(await tableExists(legacyTable))) {
    note(stat, "legacy table does not exist — nothing to migrate");
    console.log("absent");
    return stat;
  }

  try {
    for await (const chunk of readChunks(legacyTable)) {
      stat.read += chunk.length;
      const payload: T[] = [];
      for (const row of chunk) {
        const mapped = map(row, stat);
        if (mapped === null) stat.skipped += 1;
        else payload.push(mapped);
      }
      if (payload.length === 0) continue;
      stat.written += await writeChunk(payload, insert, stat);
    }
  } catch (error) {
    note(stat, `read failed: ${errorMessage(error)}`);
  }

  console.log(`read ${stat.read}, wrote ${stat.written}, skipped ${stat.skipped}`);
  return stat;
}

async function writeChunk<T>(payload: T[], insert: Inserter<T>, stat: TableStat): Promise<number> {
  try {
    const { count } = await insert(payload);
    return count;
  } catch (error) {
    note(stat, `chunk insert failed (${errorMessage(error)}) — retrying row by row`);
    let written = 0;
    for (const row of payload) {
      try {
        const { count } = await insert([row]);
        written += count;
      } catch (rowError) {
        stat.skipped += 1;
        note(stat, `row rejected: ${errorMessage(rowError)}`);
      }
    }
    return written;
  }
}

/** `--fresh` starts from empty tables, otherwise re-runs must be no-ops. */
const SKIP_DUPES = !FRESH;

/**
 * Applies a self-referencing FK in a second pass, so the parent row is
 * guaranteed to exist regardless of insertion order.
 */
async function applySelfReference(
  legacyTable: string,
  refColumn: string,
  update: (parentId: number, childIds: number[]) => Promise<unknown>,
): Promise<void> {
  const stat = newStat(`${legacyTable}.${refColumn} (2nd pass)`);
  if (!(await tableExists(legacyTable))) {
    note(stat, "legacy table does not exist");
    return;
  }

  const groups = new Map<number, number[]>();
  for await (const chunk of readChunks(legacyTable)) {
    for (const row of chunk) {
      const id = num(row.id);
      const ref = num(row[refColumn]);
      stat.read += 1;
      if (id === null || ref === null || ref === id) continue;
      const bucket = groups.get(ref);
      if (bucket) bucket.push(id);
      else groups.set(ref, [id]);
    }
  }

  for (const [parentId, childIds] of groups) {
    try {
      await update(parentId, childIds);
      stat.written += childIds.length;
    } catch (error) {
      stat.skipped += childIds.length;
      note(stat, `parent ${parentId}: ${errorMessage(error)}`);
    }
  }
  console.log(`  ${legacyTable}.${refColumn} ... linked ${stat.written}`);
}

// ---------------------------------------------------------------------------
// Per-table mappers
// ---------------------------------------------------------------------------

function mapStore(row: Row): Prisma.StoreCreateManyInput {
  // currency_code / currency_symbol and the stores.settings JSON blob are
  // deliberately dropped (dead per 16-cleanup-currency.sql).
  return {
    id: numReq(row.id),
    name: strReq(row.name, "Store"),
    slug: strReq(row.slug, `store-${numReq(row.id)}`),
    description: str(row.description),
    logo: str(row.logo),
    email: str(row.email),
    phone: str(row.phone),
    address: str(row.address),
    taxRate: dec(row.tax_rate),
    isActive: flag(row.status, true),
    isDefault: flag(row.is_default),
    createdAt: dtReq(row.created_at, EPOCH),
    updatedAt: dtReq(row.updated_at, dtReq(row.created_at, EPOCH)),
  };
}

function mapUser(row: Row, stat: TableStat): Prisma.UserCreateManyInput {
  return {
    id: numReq(row.id),
    storeId: num(row.store_id),
    name: strReq(row.name, "Unnamed"),
    email: strReq(row.email, `user-${numReq(row.id)}@invalid.local`),
    passwordHash: strReq(row.password),
    phone: str(row.phone),
    avatar: str(row.avatar),
    role: mapUserRole(row.role, stat),
    isActive: flag(row.status, true),
    emailVerifiedAt: dt(row.email_verified_at),
    lastLoginAt: dt(row.last_login),
    createdAt: dtReq(row.created_at, EPOCH),
    updatedAt: dtReq(row.updated_at, dtReq(row.created_at, EPOCH)),
  };
}

function mapAddress(row: Row): Prisma.AddressCreateManyInput {
  return {
    id: numReq(row.id),
    userId: numReq(row.user_id),
    label: strReq(row.label, "Home"),
    name: strReq(row.name),
    phone: str(row.phone),
    addressLine1: strReq(row.address_line1),
    addressLine2: str(row.address_line2),
    city: strReq(row.city),
    state: str(row.state),
    postalCode: str(row.postal_code),
    country: strReq(row.country, "Bangladesh"),
    isDefault: flag(row.is_default),
    createdAt: dtReq(row.created_at, EPOCH),
    updatedAt: dtReq(row.updated_at, dtReq(row.created_at, EPOCH)),
  };
}

/** parent_id is applied in a second pass (see applySelfReference). */
function mapCategory(row: Row): Prisma.CategoryCreateManyInput {
  return {
    id: numReq(row.id),
    storeId: numReq(row.store_id, 1),
    parentId: null,
    name: strReq(row.name),
    slug: strReq(row.slug, `category-${numReq(row.id)}`),
    description: str(row.description),
    image: str(row.image),
    icon: str(row.icon),
    sortOrder: numReq(row.sort_order),
    isActive: flag(row.status, true),
    createdAt: dtReq(row.created_at, EPOCH),
    updatedAt: dtReq(row.updated_at, dtReq(row.created_at, EPOCH)),
  };
}

function mapProduct(row: Row, stat: TableStat): Prisma.ProductCreateManyInput {
  return {
    id: numReq(row.id),
    storeId: numReq(row.store_id, 1),
    categoryId: num(row.category_id),
    name: strReq(row.name),
    slug: strReq(row.slug, `product-${numReq(row.id)}`),
    description: str(row.description),
    shortDescription: clip(str(row.short_description), 500),
    price: dec(row.price),
    salePrice: decOpt(row.sale_price),
    costPrice: decOpt(row.cost_price),
    sku: clip(str(row.sku), 50),
    // 09-pos-enhancements widened barcode to VARCHAR(100); the new column is 50.
    barcode: clip(str(row.barcode), 50),
    stockQuantity: numReq(row.stock_quantity),
    lowStockThreshold: numReq(row.low_stock_threshold, 5),
    weight: decOpt(row.weight),
    isFeatured: flag(row.is_featured),
    isNew: flag(row.is_new),
    status: mapProductStatus(row.status, stat),
    metaTitle: clip(str(row.meta_title), 255),
    metaDescription: clip(str(row.meta_description), 500),
    views: numReq(row.views),
    createdAt: dtReq(row.created_at, EPOCH),
    updatedAt: dtReq(row.updated_at, dtReq(row.created_at, EPOCH)),
  };
}

function mapProductImage(row: Row): Prisma.ProductImageCreateManyInput {
  return {
    id: numReq(row.id),
    productId: numReq(row.product_id),
    path: strReq(row.image_path),
    altText: clip(str(row.alt_text), 255),
    sortOrder: numReq(row.sort_order),
    isPrimary: flag(row.is_primary),
    createdAt: dtReq(row.created_at, EPOCH),
  };
}

function mapColor(row: Row): Prisma.ColorCreateManyInput {
  return {
    id: numReq(row.id),
    storeId: numReq(row.store_id, 1),
    name: strReq(row.name),
    hex: clip(strReq(row.color_code, "#000000"), 7) ?? "#000000",
    sortOrder: numReq(row.sort_order),
    isActive: flag(row.status, true),
    createdAt: dtReq(row.created_at, EPOCH),
  };
}

function mapSize(row: Row): Prisma.SizeCreateManyInput {
  return {
    id: numReq(row.id),
    storeId: numReq(row.store_id, 1),
    name: strReq(row.name),
    sortOrder: numReq(row.sort_order),
    isActive: flag(row.status, true),
    createdAt: dtReq(row.created_at, EPOCH),
  };
}

function mapProductVariant(row: Row): Prisma.ProductVariantCreateManyInput {
  return {
    id: numReq(row.id),
    productId: numReq(row.product_id),
    colorId: num(row.color_id),
    size: clip(str(row.size), 20),
    colorName: clip(str(row.color), 50),
    colorHex: clip(str(row.color_code), 7),
    sku: clip(str(row.sku), 50),
    priceModifier: dec(row.price_modifier),
    stockQuantity: numReq(row.stock_quantity),
    isActive: flag(row.status, true),
    createdAt: dtReq(row.created_at, EPOCH),
    updatedAt: dtReq(row.updated_at, dtReq(row.created_at, EPOCH)),
  };
}

function mapCartItem(row: Row): Prisma.CartItemCreateManyInput {
  return {
    id: numReq(row.id),
    cartId: numReq(row.cart_id),
    productId: numReq(row.product_id),
    variantId: num(row.variant_id),
    quantity: numReq(row.quantity, 1),
    unitPrice: dec(row.price),
    createdAt: dtReq(row.created_at, EPOCH),
    updatedAt: dtReq(row.updated_at, dtReq(row.created_at, EPOCH)),
  };
}

function mapWishlistItem(row: Row): Prisma.WishlistItemCreateManyInput {
  return {
    id: numReq(row.id),
    userId: numReq(row.user_id),
    productId: numReq(row.product_id),
    createdAt: dtReq(row.created_at, EPOCH),
  };
}

/** reviews.rating carries a CHECK (1..5); out-of-range values are clamped. */
function mapReview(row: Row, stat: TableStat): Prisma.ReviewCreateManyInput | null {
  const raw = num(row.rating);
  if (raw === null) {
    note(stat, `review ${numReq(row.id)}: non-numeric rating — skipped`);
    return null;
  }
  const rating = Math.min(5, Math.max(1, Math.round(raw)));
  if (rating !== raw) note(stat, `review ${numReq(row.id)}: rating ${raw} clamped to ${rating}`);

  return {
    id: numReq(row.id),
    productId: numReq(row.product_id),
    userId: numReq(row.user_id),
    rating,
    title: clip(str(row.title), 255),
    comment: str(row.comment),
    status: mapReviewStatus(row.status, stat),
    createdAt: dtReq(row.created_at, EPOCH),
    updatedAt: dtReq(row.updated_at, dtReq(row.created_at, EPOCH)),
  };
}

function mapCoupon(row: Row, stat: TableStat): Prisma.CouponCreateManyInput {
  return {
    id: numReq(row.id),
    storeId: numReq(row.store_id, 1),
    code: strReq(row.code, `COUPON-${numReq(row.id)}`),
    type: mapCouponType(row.type, stat),
    value: dec(row.value),
    minimumAmount: dec(row.minimum_amount),
    maximumDiscount: decOpt(row.maximum_discount),
    giftProductId: num(row.gift_product_id),
    buyQuantity: num(row.buy_quantity),
    getQuantity: num(row.get_quantity),
    usageLimit: num(row.usage_limit),
    usedCount: numReq(row.used_count),
    startsAt: dt(row.starts_at),
    expiresAt: dt(row.expires_at),
    isActive: flag(row.status, true),
    createdAt: dtReq(row.created_at, EPOCH),
    updatedAt: dtReq(row.updated_at, dtReq(row.created_at, EPOCH)),
  };
}

/**
 * Collapses the redundant legacy address columns: 04-pathao.sql bolted a
 * freeform `shipping_address` and a `shipping_zip` onto the existing
 * line1/line2 + postal_code block. The structured column wins; the freeform
 * one is the fallback.
 */
function mapOrder(row: Row, stat: TableStat): Prisma.OrderCreateManyInput {
  const line1 = str(row.shipping_address_line1) ?? str(row.shipping_address);
  const postal = str(row.shipping_postal_code) ?? str(row.shipping_zip);

  return {
    id: numReq(row.id),
    storeId: numReq(row.store_id, 1),
    userId: num(row.user_id),
    orderNumber: strReq(row.order_number, `ORD-${numReq(row.id)}`),
    status: mapOrderStatus(row.status, stat),
    paymentStatus: mapOrderPaymentStatus(row.payment_status, stat),
    paymentMethod: clip(str(row.payment_method), 50),
    subtotal: dec(row.subtotal),
    couponId: num(row.coupon_id),
    couponCode: clip(str(row.coupon_code), 50),
    discountAmount: dec(row.discount_amount),
    taxAmount: dec(row.tax_amount),
    shippingAmount: dec(row.shipping_amount),
    totalAmount: dec(row.total_amount),

    shippingName: clip(str(row.shipping_name), 100),
    shippingPhone: clip(str(row.shipping_phone), 20),
    shippingLine1: clip(line1, 255),
    shippingLine2: clip(str(row.shipping_address_line2), 255),
    shippingCity: clip(str(row.shipping_city), 100),
    shippingState: clip(str(row.shipping_state), 100),
    shippingPostalCode: clip(postal, 20),
    shippingCountry: clip(str(row.shipping_country), 100),

    billingName: clip(str(row.billing_name), 100),
    billingPhone: clip(str(row.billing_phone), 20),
    billingLine1: clip(str(row.billing_address_line1), 255),
    billingLine2: clip(str(row.billing_address_line2), 255),
    billingCity: clip(str(row.billing_city), 100),
    billingState: clip(str(row.billing_state), 100),
    billingPostalCode: clip(str(row.billing_postal_code), 20),
    billingCountry: clip(str(row.billing_country), 100),

    notes: str(row.notes),
    adminNotes: str(row.admin_notes),
    createdAt: dtReq(row.created_at, EPOCH),
    updatedAt: dtReq(row.updated_at, dtReq(row.created_at, EPOCH)),
  };
}

/**
 * Legacy order_items has no is_gift column — coupon gift lines are tagged by
 * `variant_info = 'Gift Item'` (see models/Order.php::addGiftItem), so the flag
 * is reconstructed from that marker.
 */
function mapOrderItem(row: Row): Prisma.OrderItemCreateManyInput {
  const variantInfo = str(row.variant_info);
  const productName = strReq(row.product_name, "Unknown product");
  const isGift =
    variantInfo?.trim().toLowerCase() === "gift item" || productName.includes("(FREE Gift");

  return {
    id: numReq(row.id),
    orderId: numReq(row.order_id),
    productId: num(row.product_id),
    variantId: num(row.variant_id),
    productName: clip(productName, 255) ?? productName,
    productSku: clip(str(row.product_sku), 50),
    variantInfo: clip(variantInfo, 100),
    quantity: numReq(row.quantity, 1),
    unitPrice: dec(row.unit_price),
    totalPrice: dec(row.total_price),
    isGift,
    createdAt: dtReq(row.created_at, EPOCH),
  };
}

function mapPayment(row: Row, stat: TableStat): Prisma.PaymentCreateManyInput {
  return {
    id: numReq(row.id),
    orderId: numReq(row.order_id),
    transactionId: clip(str(row.transaction_id), 100),
    gateway: strReq(row.gateway, "unknown"),
    method: clip(str(row.method), 50),
    amount: dec(row.amount),
    currency: clip(strReq(row.currency, "BDT"), 3) ?? "BDT",
    status: mapGatewayPaymentStatus(row.status, stat),
    gatewayResponse: jsonOpt(row.gateway_response),
    createdAt: dtReq(row.created_at, EPOCH),
    updatedAt: dtReq(row.updated_at, dtReq(row.created_at, EPOCH)),
  };
}

function mapCourier(row: Row): Prisma.CourierCreateManyInput {
  return {
    id: numReq(row.id),
    storeId: numReq(row.store_id, 1),
    name: strReq(row.name),
    code: strReq(row.code, `courier-${numReq(row.id)}`),
    description: str(row.description),
    logo: str(row.logo),
    baseRate: dec(row.base_rate),
    perKgRate: dec(row.per_kg_rate),
    estimatedDays: clip(str(row.estimated_days), 20),
    trackingUrl: clip(str(row.tracking_url), 255),
    isActive: flag(row.status, true),
    createdAt: dtReq(row.created_at, EPOCH),
    updatedAt: dtReq(row.updated_at, dtReq(row.created_at, EPOCH)),
  };
}

function mapShipmentEvent(row: Row): Prisma.ShipmentEventCreateManyInput {
  return {
    id: numReq(row.id),
    shipmentId: numReq(row.shipment_id),
    status: strReq(row.status, "unknown"),
    location: clip(str(row.location), 255),
    description: str(row.description),
    trackedAt: dtReq(row.tracked_at, EPOCH),
  };
}

function mapReturn(row: Row, stat: TableStat): Prisma.ReturnCreateManyInput {
  return {
    id: numReq(row.id),
    storeId: numReq(row.store_id, 1),
    orderId: numReq(row.order_id),
    returnNumber: strReq(row.return_number, `RET-${numReq(row.id)}`),
    reason: mapReturnReason(row.reason, stat),
    reasonDetails: str(row.reason_details),
    refundAmount: dec(row.refund_amount),
    refundStatus: mapRefundStatus(row.refund_status, stat),
    adminNotes: str(row.admin_notes),
    returnedAt: dtReq(row.returned_at, dtReq(row.created_at, EPOCH)),
    createdAt: dtReq(row.created_at, EPOCH),
  };
}

function mapReturnItem(row: Row): Prisma.ReturnItemCreateManyInput {
  return {
    id: numReq(row.id),
    returnId: numReq(row.return_id),
    orderItemId: num(row.order_item_id),
    productId: num(row.product_id),
    variantId: num(row.variant_id),
    productName: clip(str(row.product_name), 255),
    variantInfo: clip(str(row.variant_info), 100),
    quantity: numReq(row.quantity, 1),
    unitPrice: decOpt(row.unit_price),
    stockRestored: flag(row.stock_restored, true),
    createdAt: dtReq(row.created_at, EPOCH),
  };
}

function mapSlider(row: Row, stat: TableStat): Prisma.SliderCreateManyInput {
  return {
    id: numReq(row.id),
    storeId: numReq(row.store_id, 1),
    title: strReq(row.title),
    subtitle: clip(str(row.subtitle), 255),
    description: str(row.description),
    buttonText: clip(str(row.button_text), 100),
    buttonLink: clip(str(row.button_link), 255),
    button2Text: clip(str(row.button2_text), 100),
    button2Link: clip(str(row.button2_link), 255),
    image: clip(str(row.image), 255),
    textPosition: mapTextPosition(row.text_position, stat),
    textColor: clip(strReq(row.text_color, "#ffffff"), 20) ?? "#ffffff",
    overlayOpacity: dec(row.overlay_opacity, "0.40"),
    sortOrder: numReq(row.sort_order),
    // sliders.status is ENUM('active','inactive'), not a tinyint.
    isActive: flag(row.status, true),
    createdAt: dtReq(row.created_at, EPOCH),
    updatedAt: dtReq(row.updated_at, dtReq(row.created_at, EPOCH)),
  };
}

function mapLookbookItem(row: Row): Prisma.LookbookItemCreateManyInput {
  return {
    id: numReq(row.id),
    storeId: numReq(row.store_id, 1),
    image: strReq(row.image),
    link: clip(str(row.link), 255),
    caption: clip(str(row.caption), 255),
    isFeatured: flag(row.is_featured),
    sortOrder: numReq(row.sort_order),
    isActive: flag(row.status, true),
    createdAt: dtReq(row.created_at, EPOCH),
    updatedAt: dtReq(row.updated_at, dtReq(row.created_at, EPOCH)),
  };
}

function mapSocialLink(row: Row, stat: TableStat): Prisma.SocialLinkCreateManyInput {
  return {
    id: numReq(row.id),
    storeId: numReq(row.store_id, 1),
    platform: strReq(row.platform, "other"),
    name: strReq(row.name),
    url: strReq(row.url),
    icon: strReq(row.icon),
    iconStyle: mapIconStyle(row.icon_style, stat),
    color: clip(strReq(row.color, "#000000"), 20) ?? "#000000",
    sortOrder: numReq(row.sort_order),
    isActive: flag(row.is_active, true),
    showInHeader: flag(row.show_in_header),
    showInFooter: flag(row.show_in_footer, true),
    openNewTab: flag(row.open_new_tab, true),
    createdAt: dtReq(row.created_at, EPOCH),
    updatedAt: dtReq(row.updated_at, dtReq(row.created_at, EPOCH)),
  };
}

function mapPosTerminal(row: Row): Prisma.PosTerminalCreateManyInput {
  return {
    id: numReq(row.id),
    storeId: numReq(row.store_id, 1),
    name: strReq(row.terminal_name),
    code: clip(strReq(row.terminal_code, `POS-${numReq(row.id)}`), 20) ?? "POS",
    location: clip(str(row.location), 255),
    isActive: flag(row.is_active, true),
    createdAt: dtReq(row.created_at, EPOCH),
  };
}

function mapPosShift(row: Row, stat: TableStat): Prisma.PosShiftCreateManyInput {
  return {
    id: numReq(row.id),
    storeId: numReq(row.store_id, 1),
    terminalId: numReq(row.terminal_id),
    userId: numReq(row.user_id),
    shiftNumber: strReq(row.shift_number, `SHIFT-${numReq(row.id)}`),
    openingTime: dtReq(row.opening_time, dtReq(row.created_at, EPOCH)),
    closingTime: dt(row.closing_time),
    openingCash: dec(row.opening_cash),
    expectedCash: dec(row.expected_cash),
    actualCash: dec(row.actual_cash),
    cashDifference: dec(row.cash_difference),
    totalSales: dec(row.total_sales),
    totalTransactions: numReq(row.total_transactions),
    totalRefunds: dec(row.total_refunds),
    status: mapPosShiftStatus(row.status, stat),
    notes: str(row.notes),
    createdAt: dtReq(row.created_at, EPOCH),
  };
}

function mapPosTransaction(row: Row, stat: TableStat): Prisma.PosTransactionCreateManyInput {
  return {
    id: numReq(row.id),
    storeId: numReq(row.store_id, 1),
    shiftId: num(row.shift_id),
    terminalId: num(row.terminal_id),
    transactionNumber: strReq(row.transaction_number, `POS-${numReq(row.id)}`),
    customerId: num(row.customer_id),
    customerName: clip(str(row.customer_name), 255),
    customerPhone: clip(str(row.customer_phone), 50),
    subtotal: dec(row.subtotal),
    discountAmount: dec(row.discount_amount),
    taxAmount: dec(row.tax_amount),
    totalAmount: dec(row.total_amount),
    paymentMethod: mapPosPaymentMethod(row.payment_method, stat),
    cashReceived: dec(row.cash_received),
    changeAmount: dec(row.change_amount),
    cardAmount: dec(row.card_amount),
    mobileAmount: dec(row.mobile_amount),
    status: mapPosTransactionStatus(row.status, stat),
    refundedAmount: dec(row.refunded_amount),
    notes: str(row.notes),
    createdById: num(row.created_by),
    createdAt: dtReq(row.created_at, EPOCH),
  };
}

function mapPosTransactionItem(row: Row): Prisma.PosTransactionItemCreateManyInput {
  return {
    id: numReq(row.id),
    transactionId: numReq(row.transaction_id),
    productId: num(row.product_id),
    productName: strReq(row.product_name, "Unknown product"),
    productSku: clip(str(row.product_sku), 100),
    variantId: num(row.variant_id),
    variantInfo: clip(str(row.variant_info), 255),
    quantity: numReq(row.quantity, 1),
    unitPrice: dec(row.unit_price),
    discount: dec(row.discount),
    totalPrice: dec(row.total_price),
    createdAt: dtReq(row.created_at, EPOCH),
  };
}

function mapPosCashLog(row: Row, stat: TableStat): Prisma.PosCashLogCreateManyInput {
  return {
    id: numReq(row.id),
    storeId: numReq(row.store_id, 1),
    shiftId: numReq(row.shift_id),
    type: mapPosCashLogType(row.log_type, stat),
    amount: dec(row.amount),
    reason: clip(str(row.reason), 255),
    reference: clip(str(row.reference), 100),
    createdById: num(row.created_by),
    createdAt: dtReq(row.created_at, EPOCH),
  };
}

function mapPosHeldOrder(row: Row, stat: TableStat): Prisma.PosHeldOrderCreateManyInput {
  return {
    id: numReq(row.id),
    storeId: numReq(row.store_id, 1),
    shiftId: num(row.shift_id),
    terminalId: num(row.terminal_id),
    holdNumber: strReq(row.hold_number, `HOLD-${numReq(row.id)}`),
    customerId: num(row.customer_id),
    customerName: clip(str(row.customer_name), 255),
    customerPhone: clip(str(row.customer_phone), 50),
    // items_json is LONGTEXT in the legacy schema, Json in the new one.
    items: jsonReq(row.items_json),
    note: str(row.note),
    status: mapPosHeldOrderStatus(row.status, stat),
    heldById: num(row.held_by),
    recalledAt: dt(row.recalled_at),
    expiresAt: dt(row.expires_at),
    createdAt: dtReq(row.created_at, EPOCH),
  };
}

function mapPosRefund(row: Row, stat: TableStat): Prisma.PosRefundCreateManyInput {
  return {
    id: numReq(row.id),
    storeId: numReq(row.store_id, 1),
    shiftId: num(row.shift_id),
    terminalId: num(row.terminal_id),
    transactionId: numReq(row.transaction_id),
    refundNumber: strReq(row.refund_number, `REF-${numReq(row.id)}`),
    customerId: num(row.customer_id),
    customerName: clip(str(row.customer_name), 255),
    refundAmount: dec(row.refund_amount),
    refundMethod: mapPosRefundMethod(row.refund_method, stat),
    reason: clip(str(row.reason), 100),
    items: jsonOpt(row.items_json),
    notes: str(row.notes),
    status: mapPosRefundStatus(row.status, stat),
    createdById: num(row.created_by),
    createdAt: dtReq(row.created_at, EPOCH),
  };
}

function mapPosSplitPayment(row: Row, stat: TableStat): Prisma.PosSplitPaymentCreateManyInput {
  return {
    id: numReq(row.id),
    transactionId: numReq(row.transaction_id),
    // Legacy ENUM here is cash/card/mobile_banking only — 'mixed' never occurs.
    paymentMethod: mapPosPaymentMethod(row.payment_method, stat),
    amount: dec(row.amount),
    referenceNumber: clip(str(row.reference_number), 100),
    createdAt: dtReq(row.created_at, EPOCH),
  };
}

function mapDepartment(row: Row): Prisma.DepartmentCreateManyInput {
  return {
    id: numReq(row.id),
    storeId: numReq(row.store_id, 1),
    name: strReq(row.name),
    code: clip(str(row.code), 20),
    description: str(row.description),
    managerId: num(row.manager_id),
    isActive: flag(row.is_active, true),
    createdAt: dtReq(row.created_at, EPOCH),
  };
}

function mapEmployee(row: Row, stat: TableStat): Prisma.EmployeeCreateManyInput {
  const created = dtReq(row.created_at, EPOCH);
  const hireDate = dateOnly(row.hire_date);
  if (hireDate === null) {
    note(stat, `employee ${numReq(row.id)}: missing hire_date — defaulted to created_at`);
  }

  return {
    id: numReq(row.id),
    storeId: numReq(row.store_id, 1),
    userId: num(row.user_id),
    code: clip(strReq(row.employee_id, `EMP-${numReq(row.id)}`), 20) ?? `EMP-${numReq(row.id)}`,
    firstName: strReq(row.first_name, "Unknown"),
    lastName: clip(str(row.last_name), 100),
    email: clip(str(row.email), 255),
    phone: clip(str(row.phone), 50),
    dateOfBirth: dateOnly(row.date_of_birth),
    gender: mapGender(row.gender, stat),
    nationalId: clip(str(row.national_id), 50),
    address: str(row.address),
    city: clip(str(row.city), 100),
    departmentId: num(row.department_id),
    designation: clip(str(row.designation), 100),
    employmentType: mapEmploymentType(row.employment_type, stat),
    hireDate: hireDate ?? created,
    terminationDate: dateOnly(row.termination_date),
    basicSalary: dec(row.basic_salary),
    bankName: clip(str(row.bank_name), 100),
    bankAccount: clip(str(row.bank_account), 50),
    mobileBanking: clip(str(row.mobile_banking), 50),
    emergencyContactName: clip(str(row.emergency_contact_name), 255),
    emergencyContactPhone: clip(str(row.emergency_contact_phone), 50),
    photo: clip(str(row.photo), 255),
    status: mapEmployeeStatus(row.status, stat),
    notes: str(row.notes),
    createdAt: created,
    updatedAt: dtReq(row.updated_at, created),
  };
}

function mapAttendance(row: Row, stat: TableStat): Prisma.AttendanceCreateManyInput | null {
  const date = dateOnly(row.attendance_date);
  if (date === null) {
    note(stat, `attendance ${numReq(row.id)}: invalid attendance_date — skipped`);
    return null;
  }
  return {
    id: numReq(row.id),
    storeId: numReq(row.store_id, 1),
    employeeId: numReq(row.employee_id),
    date,
    checkIn: timeOnly(row.check_in),
    checkOut: timeOnly(row.check_out),
    status: mapAttendanceStatus(row.status, stat),
    workHours: dec(row.work_hours),
    overtimeHours: dec(row.overtime_hours),
    notes: str(row.notes),
    createdAt: dtReq(row.created_at, EPOCH),
  };
}

function mapLeaveType(row: Row): Prisma.LeaveTypeCreateManyInput {
  return {
    id: numReq(row.id),
    storeId: numReq(row.store_id, 1),
    name: strReq(row.name),
    daysPerYear: numReq(row.days_per_year),
    isPaid: flag(row.is_paid, true),
    isActive: flag(row.is_active, true),
    createdAt: dtReq(row.created_at, EPOCH),
  };
}

function mapLeaveRequest(row: Row, stat: TableStat): Prisma.LeaveRequestCreateManyInput {
  return {
    id: numReq(row.id),
    storeId: numReq(row.store_id, 1),
    employeeId: numReq(row.employee_id),
    leaveTypeId: numReq(row.leave_type_id),
    startDate: dateOnlyReq(row.start_date, EPOCH),
    endDate: dateOnlyReq(row.end_date, EPOCH),
    days: numReq(row.days),
    reason: str(row.reason),
    status: mapLeaveStatus(row.status, stat),
    approvedById: num(row.approved_by),
    approvedAt: dt(row.approved_at),
    rejectionReason: str(row.rejection_reason),
    createdAt: dtReq(row.created_at, EPOCH),
  };
}

function mapSalaryComponent(row: Row, stat: TableStat): Prisma.SalaryComponentCreateManyInput {
  return {
    id: numReq(row.id),
    storeId: numReq(row.store_id, 1),
    name: strReq(row.name),
    type: mapSalaryComponentType(row.type, stat),
    calculationType: mapSalaryCalculationType(row.calculation_type, stat),
    defaultAmount: dec(row.default_amount),
    percentageOf: clip(str(row.percentage_of), 50),
    isTaxable: flag(row.is_taxable),
    isActive: flag(row.is_active, true),
    createdAt: dtReq(row.created_at, EPOCH),
  };
}

function mapEmployeeSalaryComponent(row: Row): Prisma.EmployeeSalaryComponentCreateManyInput {
  return {
    id: numReq(row.id),
    employeeId: numReq(row.employee_id),
    componentId: numReq(row.component_id),
    amount: dec(row.amount),
    effectiveFrom: dateOnlyReq(row.effective_from, EPOCH),
    effectiveTo: dateOnly(row.effective_to),
    createdAt: dtReq(row.created_at, EPOCH),
  };
}

function mapPayrollPeriod(row: Row, stat: TableStat): Prisma.PayrollPeriodCreateManyInput {
  return {
    id: numReq(row.id),
    storeId: numReq(row.store_id, 1),
    name: strReq(row.period_name, `Period ${numReq(row.id)}`),
    startDate: dateOnlyReq(row.start_date, EPOCH),
    endDate: dateOnlyReq(row.end_date, EPOCH),
    payDate: dateOnly(row.pay_date),
    status: mapPayrollPeriodStatus(row.status, stat),
    totalEmployees: numReq(row.total_employees),
    totalGross: dec(row.total_gross),
    totalDeductions: dec(row.total_deductions),
    totalNet: dec(row.total_net),
    processedById: num(row.processed_by),
    processedAt: dt(row.processed_at),
    approvedById: num(row.approved_by),
    approvedAt: dt(row.approved_at),
    createdAt: dtReq(row.created_at, EPOCH),
  };
}

function mapPayrollDetail(row: Row, stat: TableStat): Prisma.PayrollDetailCreateManyInput {
  return {
    id: numReq(row.id),
    payrollPeriodId: numReq(row.payroll_period_id),
    employeeId: numReq(row.employee_id),
    basicSalary: dec(row.basic_salary),
    workingDays: numReq(row.working_days),
    presentDays: numReq(row.present_days),
    absentDays: numReq(row.absent_days),
    leaveDays: numReq(row.leave_days),
    overtimeHours: dec(row.overtime_hours),
    overtimeAmount: dec(row.overtime_amount),
    grossEarnings: dec(row.gross_earnings),
    totalDeductions: dec(row.total_deductions),
    netSalary: dec(row.net_salary),
    paymentMethod: mapPayrollPaymentMethod(row.payment_method, stat),
    paymentStatus: mapPayrollPaymentStatus(row.payment_status, stat),
    paidAt: dt(row.paid_at),
    notes: str(row.notes),
    createdAt: dtReq(row.created_at, EPOCH),
  };
}

function mapPayrollDetailComponent(
  row: Row,
  stat: TableStat,
): Prisma.PayrollDetailComponentCreateManyInput {
  return {
    id: numReq(row.id),
    payrollDetailId: numReq(row.payroll_detail_id),
    componentId: numReq(row.component_id),
    componentName: strReq(row.component_name),
    componentType: mapSalaryComponentType(row.component_type, stat),
    amount: dec(row.amount),
    createdAt: dtReq(row.created_at, EPOCH),
  };
}

function mapExpenseCategory(row: Row): Prisma.ExpenseCategoryCreateManyInput {
  return {
    id: numReq(row.id),
    storeId: numReq(row.store_id, 1),
    name: strReq(row.name),
    slug: strReq(row.slug, `category-${numReq(row.id)}`),
    description: str(row.description),
    color: clip(strReq(row.color, "#6c757d"), 7) ?? "#6c757d",
    icon: clip(strReq(row.icon, "tag"), 50) ?? "tag",
    isActive: flag(row.is_active, true),
    createdAt: dtReq(row.created_at, EPOCH),
    updatedAt: dtReq(row.updated_at, dtReq(row.created_at, EPOCH)),
  };
}

function mapExpense(row: Row, stat: TableStat): Prisma.ExpenseCreateManyInput {
  return {
    id: numReq(row.id),
    storeId: numReq(row.store_id, 1),
    categoryId: num(row.category_id),
    expenseNumber: strReq(row.expense_number, `EXP-${numReq(row.id)}`),
    title: strReq(row.title),
    description: str(row.description),
    amount: dec(row.amount),
    taxAmount: dec(row.tax_amount),
    totalAmount: dec(row.total_amount),
    expenseDate: dateOnlyReq(row.expense_date, dtReq(row.created_at, EPOCH)),
    paymentMethod: mapExpensePaymentMethod(row.payment_method, stat),
    paymentStatus: mapExpensePaymentStatus(row.payment_status, stat),
    referenceNumber: clip(str(row.reference_number), 100),
    vendorName: clip(str(row.vendor_name), 255),
    receiptPath: clip(str(row.receipt_path), 255),
    notes: str(row.notes),
    createdById: num(row.created_by),
    createdAt: dtReq(row.created_at, EPOCH),
    updatedAt: dtReq(row.updated_at, dtReq(row.created_at, EPOCH)),
  };
}

function mapSupplier(row: Row, stat: TableStat): Prisma.SupplierCreateManyInput {
  return {
    id: numReq(row.id),
    storeId: numReq(row.store_id, 1),
    name: strReq(row.name),
    code: clip(str(row.code), 50),
    contactPerson: clip(str(row.contact_person), 255),
    email: clip(str(row.email), 255),
    phone: clip(str(row.phone), 50),
    address: str(row.address),
    city: clip(str(row.city), 100),
    country: clip(strReq(row.country, "Bangladesh"), 100) ?? "Bangladesh",
    paymentTerms: numReq(row.payment_terms, 30),
    notes: str(row.notes),
    status: mapSupplierStatus(row.status, stat),
    totalPurchases: dec(row.total_purchases),
    totalPaid: dec(row.total_paid),
    createdAt: dtReq(row.created_at, EPOCH),
    updatedAt: dtReq(row.updated_at, dtReq(row.created_at, EPOCH)),
  };
}

function mapPurchaseOrder(row: Row, stat: TableStat): Prisma.PurchaseOrderCreateManyInput {
  return {
    id: numReq(row.id),
    storeId: numReq(row.store_id, 1),
    supplierId: numReq(row.supplier_id),
    poNumber: strReq(row.po_number, `PO-${numReq(row.id)}`),
    status: mapPurchaseOrderStatus(row.status, stat),
    orderDate: dateOnlyReq(row.order_date, dtReq(row.created_at, EPOCH)),
    expectedDate: dateOnly(row.expected_date),
    receivedDate: dateOnly(row.received_date),
    subtotal: dec(row.subtotal),
    taxAmount: dec(row.tax_amount),
    shippingAmount: dec(row.shipping_amount),
    discountAmount: dec(row.discount_amount),
    totalAmount: dec(row.total_amount),
    paymentStatus: mapPurchasePaymentStatus(row.payment_status, stat),
    paidAmount: dec(row.paid_amount),
    notes: str(row.notes),
    createdById: num(row.created_by),
    approvedById: num(row.approved_by),
    approvedAt: dt(row.approved_at),
    createdAt: dtReq(row.created_at, EPOCH),
    updatedAt: dtReq(row.updated_at, dtReq(row.created_at, EPOCH)),
  };
}

function mapPurchaseOrderItem(row: Row): Prisma.PurchaseOrderItemCreateManyInput {
  return {
    id: numReq(row.id),
    purchaseOrderId: numReq(row.purchase_order_id),
    productId: num(row.product_id),
    productName: strReq(row.product_name, "Unknown product"),
    productSku: clip(str(row.product_sku), 100),
    variantId: num(row.variant_id),
    variantInfo: clip(str(row.variant_info), 255),
    quantityOrdered: numReq(row.quantity_ordered),
    quantityReceived: numReq(row.quantity_received),
    unitCost: dec(row.unit_cost),
    totalCost: dec(row.total_cost),
    notes: str(row.notes),
    createdAt: dtReq(row.created_at, EPOCH),
  };
}

function mapSupplierPayment(row: Row, stat: TableStat): Prisma.SupplierPaymentCreateManyInput {
  return {
    id: numReq(row.id),
    storeId: numReq(row.store_id, 1),
    supplierId: numReq(row.supplier_id),
    purchaseOrderId: num(row.purchase_order_id),
    paymentNumber: strReq(row.payment_number, `PAY-${numReq(row.id)}`),
    amount: dec(row.amount),
    paymentDate: dateOnlyReq(row.payment_date, dtReq(row.created_at, EPOCH)),
    paymentMethod: mapSupplierPaymentMethod(row.payment_method, stat),
    referenceNumber: clip(str(row.reference_number), 100),
    notes: str(row.notes),
    createdById: num(row.created_by),
    createdAt: dtReq(row.created_at, EPOCH),
  };
}

/** parent_id is applied in a second pass (see applySelfReference). */
function mapAccount(row: Row, stat: TableStat): Prisma.AccountCreateManyInput {
  return {
    id: numReq(row.id),
    storeId: numReq(row.store_id, 1),
    code: clip(strReq(row.account_code, String(numReq(row.id))), 20) ?? "0",
    name: strReq(row.account_name),
    type: mapAccountType(row.account_type, stat),
    parentId: null,
    description: str(row.description),
    isSystem: flag(row.is_system),
    isActive: flag(row.is_active, true),
    normalBalance: mapNormalBalance(row.normal_balance, stat),
    currentBalance: dec(row.current_balance),
    createdAt: dtReq(row.created_at, EPOCH),
    updatedAt: dtReq(row.updated_at, dtReq(row.created_at, EPOCH)),
  };
}

/** reversed_by_id is applied in a second pass (see applySelfReference). */
function mapJournalEntry(row: Row, stat: TableStat): Prisma.JournalEntryCreateManyInput {
  return {
    id: numReq(row.id),
    storeId: numReq(row.store_id, 1),
    entryNumber: strReq(row.entry_number, `JE-${numReq(row.id)}`),
    entryDate: dateOnlyReq(row.entry_date, dtReq(row.created_at, EPOCH)),
    description: strReq(row.description, ""),
    referenceType: mapJournalReferenceType(row.reference_type, stat),
    referenceId: num(row.reference_id),
    totalDebit: dec(row.total_debit),
    totalCredit: dec(row.total_credit),
    status: mapJournalStatus(row.status, stat),
    postedAt: dt(row.posted_at),
    postedById: num(row.posted_by),
    reversedById: null,
    notes: str(row.notes),
    createdById: num(row.created_by),
    createdAt: dtReq(row.created_at, EPOCH),
    updatedAt: dtReq(row.updated_at, dtReq(row.created_at, EPOCH)),
  };
}

function mapJournalEntryLine(row: Row): Prisma.JournalEntryLineCreateManyInput {
  return {
    id: numReq(row.id),
    journalEntryId: numReq(row.journal_entry_id),
    accountId: numReq(row.account_id),
    description: clip(str(row.description), 255),
    debitAmount: dec(row.debit_amount),
    creditAmount: dec(row.credit_amount),
    createdAt: dtReq(row.created_at, EPOCH),
  };
}

function mapCampaign(row: Row, stat: TableStat): Prisma.CampaignCreateManyInput {
  return {
    id: numReq(row.id),
    storeId: numReq(row.store_id, 1),
    title: strReq(row.title),
    platform: mapCampaignPlatform(row.platform, stat),
    messageType: mapCampaignMessageType(row.message_type, stat),
    content: strReq(row.content, ""),
    shortContent: clip(str(row.short_content), 500),
    hashtags: clip(str(row.hashtags), 500),
    callToAction: clip(str(row.call_to_action), 255),
    ctaUrl: clip(str(row.cta_url), 500),
    imagePath: clip(str(row.image_path), 255),
    scheduledAt: dt(row.scheduled_at),
    expiresAt: dt(row.expires_at),
    isActive: flag(row.is_active, true),
    isPinned: flag(row.is_pinned),
    copyCount: numReq(row.copy_count),
    totalViews: numReq(row.total_views),
    totalClicks: numReq(row.total_clicks),
    totalShares: numReq(row.total_shares),
    totalEngagements: numReq(row.total_engagements),
    conversionRate: dec(row.conversion_rate),
    lastActivityAt: dt(row.last_activity_at),
    createdById: num(row.created_by),
    createdAt: dtReq(row.created_at, EPOCH),
    updatedAt: dtReq(row.updated_at, dtReq(row.created_at, EPOCH)),
  };
}

function mapCampaignEvent(row: Row, stat: TableStat): Prisma.CampaignEventCreateManyInput {
  return {
    id: numReq(row.id),
    campaignId: numReq(row.campaign_id),
    type: mapCampaignEventType(row.event_type, stat),
    platform: clip(str(row.platform), 50),
    source: clip(str(row.source), 100),
    ipAddress: clip(str(row.ip_address), 45),
    userAgent: clip(str(row.user_agent), 500),
    referrer: clip(str(row.referrer), 500),
    metadata: jsonOpt(row.metadata),
    createdAt: dtReq(row.created_at, EPOCH),
  };
}

function mapCampaignDailyStat(
  row: Row,
  stat: TableStat,
): Prisma.CampaignDailyStatCreateManyInput | null {
  const date = dateOnly(row.stat_date);
  if (date === null) {
    note(stat, `campaign_daily_stats ${numReq(row.id)}: invalid stat_date — skipped`);
    return null;
  }
  return {
    id: numReq(row.id),
    campaignId: numReq(row.campaign_id),
    date,
    views: numReq(row.views),
    copies: numReq(row.copies),
    clicks: numReq(row.clicks),
    shares: numReq(row.shares),
    engagements: numReq(row.engagements),
    uniqueViews: numReq(row.unique_views),
    createdAt: dtReq(row.created_at, EPOCH),
    updatedAt: dtReq(row.updated_at, dtReq(row.created_at, EPOCH)),
  };
}

function mapCampaignGoal(row: Row, stat: TableStat): Prisma.CampaignGoalCreateManyInput {
  return {
    id: numReq(row.id),
    campaignId: numReq(row.campaign_id),
    type: mapCampaignGoalType(row.goal_type, stat),
    targetValue: numReq(row.target_value),
    currentValue: numReq(row.current_value),
    startDate: dateOnly(row.start_date),
    endDate: dateOnly(row.end_date),
    isAchieved: flag(row.is_achieved),
    achievedAt: dt(row.achieved_at),
    createdAt: dtReq(row.created_at, EPOCH),
  };
}

function mapCampaignNote(row: Row, stat: TableStat): Prisma.CampaignNoteCreateManyInput {
  return {
    id: numReq(row.id),
    campaignId: numReq(row.campaign_id),
    userId: num(row.user_id),
    note: strReq(row.note, ""),
    type: mapCampaignNoteType(row.note_type, stat),
    createdAt: dtReq(row.created_at, EPOCH),
  };
}

function mapMetaIntegration(row: Row, stat: TableStat): Prisma.MetaIntegrationCreateManyInput {
  return {
    id: numReq(row.id),
    storeId: numReq(row.store_id, 1),
    platform: mapMetaPlatform(row.platform, stat),
    pageId: clip(str(row.page_id), 100),
    pageName: clip(str(row.page_name), 255),
    pageAccessToken: str(row.page_access_token),
    userAccessToken: str(row.user_access_token),
    tokenExpiresAt: dt(row.token_expires_at),
    phoneNumberId: clip(str(row.phone_number_id), 100),
    whatsappBusinessId: clip(str(row.whatsapp_business_id), 100),
    isActive: flag(row.is_active, true),
    lastSyncAt: dt(row.last_sync_at),
    settings: jsonOpt(row.settings),
    createdAt: dtReq(row.created_at, EPOCH),
    updatedAt: dtReq(row.updated_at, dtReq(row.created_at, EPOCH)),
  };
}

function mapMetaMessage(row: Row, stat: TableStat): Prisma.MetaMessageCreateManyInput {
  return {
    id: numReq(row.id),
    storeId: numReq(row.store_id, 1),
    platform: mapMetaPlatform(row.platform, stat),
    externalId: strReq(row.message_id, `legacy-${numReq(row.id)}`),
    conversationId: clip(str(row.conversation_id), 255),
    senderId: clip(str(row.sender_id), 100),
    senderName: clip(str(row.sender_name), 255),
    senderProfilePic: clip(str(row.sender_profile_pic), 500),
    recipientId: clip(str(row.recipient_id), 100),
    type: mapMetaMessageType(row.message_type, stat),
    content: str(row.content),
    mediaUrl: clip(str(row.media_url), 500),
    isIncoming: flag(row.is_incoming, true),
    isRead: flag(row.is_read),
    status: mapMetaMessageStatus(row.status, stat),
    metadata: jsonOpt(row.metadata),
    createdAt: dtReq(row.created_at, EPOCH),
  };
}

function mapMetaPageInsight(
  row: Row,
  stat: TableStat,
): Prisma.MetaPageInsightCreateManyInput | null {
  const date = dateOnly(row.stat_date);
  if (date === null) {
    note(stat, `meta_page_insights ${numReq(row.id)}: invalid stat_date — skipped`);
    return null;
  }
  return {
    id: numReq(row.id),
    storeId: numReq(row.store_id, 1),
    platform: mapMetaPlatform(row.platform, stat),
    pageId: clip(strReq(row.page_id), 100) ?? "",
    metricName: clip(strReq(row.metric_name), 100) ?? "",
    metricValue: decOpt(row.metric_value),
    period: mapMetaInsightPeriod(row.period, stat),
    date,
    metadata: jsonOpt(row.metadata),
    createdAt: dtReq(row.created_at, EPOCH),
  };
}

function mapMetaMessageTemplate(
  row: Row,
  stat: TableStat,
): Prisma.MetaMessageTemplateCreateManyInput {
  return {
    id: numReq(row.id),
    storeId: numReq(row.store_id, 1),
    templateId: clip(str(row.template_id), 100),
    name: strReq(row.name),
    language: clip(strReq(row.language, "en"), 10) ?? "en",
    category: mapMetaTemplateCategory(row.category, stat),
    status: mapMetaTemplateStatus(row.status, stat),
    components: jsonOpt(row.components),
    createdAt: dtReq(row.created_at, EPOCH),
    updatedAt: dtReq(row.updated_at, dtReq(row.created_at, EPOCH)),
  };
}

// ---------------------------------------------------------------------------
// Special cases: carts, shipments, merged settings
// ---------------------------------------------------------------------------

/**
 * Legacy `cart.session_id` (the PHP session id) becomes the durable guest
 * `token`. The new column is UNIQUE, so blanks and duplicates get a fresh
 * random token rather than being dropped — dropping a cart would orphan its
 * cart_items rows.
 */
async function migrateCarts(): Promise<void> {
  const seenTokens = new Set<string>();
  let generatedForBlank = 0;
  let generatedForDuplicate = 0;
  let loggedIn = 0;

  const stat = await migrateTable(
    "cart",
    "Cart",
    (row): Prisma.CartCreateManyInput => {
      const userId = num(row.user_id);
      if (userId !== null) {
        loggedIn += 1;
        return {
          id: numReq(row.id),
          storeId: numReq(row.store_id, 1),
          userId,
          token: null,
          createdAt: dtReq(row.created_at, EPOCH),
          updatedAt: dtReq(row.updated_at, dtReq(row.created_at, EPOCH)),
        };
      }

      const session = str(row.session_id)?.trim() ?? "";
      let token: string;
      if (session === "") {
        token = randomBytes(24).toString("hex");
        generatedForBlank += 1;
      } else if (seenTokens.has(session)) {
        token = randomBytes(24).toString("hex");
        generatedForDuplicate += 1;
      } else {
        token = session.length > 64 ? session.slice(0, 64) : session;
      }
      seenTokens.add(token);

      return {
        id: numReq(row.id),
        storeId: numReq(row.store_id, 1),
        userId: null,
        token,
        createdAt: dtReq(row.created_at, EPOCH),
        updatedAt: dtReq(row.updated_at, dtReq(row.created_at, EPOCH)),
      };
    },
    (rows) => prisma.cart.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );

  note(
    stat,
    `${loggedIn} user carts (token null); ` +
      `${generatedForBlank} guest carts had no session_id and got a random token; ` +
      `${generatedForDuplicate} duplicate session_ids got a random token`,
  );
}

/**
 * Legacy `shipments` allows several rows per order; the new `Shipment.orderId`
 * is UNIQUE. The earliest shipment per order wins, the rest are logged.
 */
async function migrateShipments(): Promise<void> {
  const seenOrders = new Set<number>();

  await migrateTable(
    "shipments",
    "Shipment",
    (row, stat): Prisma.ShipmentCreateManyInput | null => {
      const orderId = numReq(row.order_id);
      if (seenOrders.has(orderId)) {
        note(stat, `shipment ${numReq(row.id)}: order ${orderId} already has one — skipped`);
        return null;
      }
      seenOrders.add(orderId);

      return {
        id: numReq(row.id),
        orderId,
        courierId: num(row.courier_id),
        courierName: clip(str(row.courier_name), 100),
        trackingNumber: clip(str(row.tracking_number), 100),
        status: mapShipmentStatus(row.status, stat),
        deliveryFee: dec(row.delivery_fee),
        externalStatus: clip(str(row.pathao_status), 100),
        shippedAt: dt(row.shipped_at),
        deliveredAt: dt(row.delivered_at),
        notes: str(row.notes),
        createdAt: dtReq(row.created_at, EPOCH),
        updatedAt: dtReq(row.updated_at, dtReq(row.created_at, EPOCH)),
      };
    },
    (rows) => prisma.shipment.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
}

/** Best-effort grouping for legacy `settings` rows, which carry no group. */
function deriveSettingGroup(key: string): string {
  const k = key.toLowerCase();
  if (k.startsWith("pathao_") || k.includes("shipping") || k.includes("courier")) return "shipping";
  if (/(facebook|instagram|twitter|youtube|tiktok|linkedin|pinterest|social)/.test(k))
    return "social";
  if (/(contact|email|phone|whatsapp|address)/.test(k)) return "contact";
  if (k.includes("payment") || k.includes("gateway")) return "payment";
  return "general";
}

function looksSecret(key: string): boolean {
  return /(secret|password|token|api_key|client_id|private)/i.test(key);
}

/**
 * Merges the two legacy EAV tables into `Setting`. `business_settings` is the
 * newer table, so it wins on a (store_id, setting_key) collision. Ids are not
 * preserved here — the two source id spaces overlap and nothing FKs to
 * settings.
 */
async function migrateSettings(): Promise<void> {
  const stat = newStat("settings + business_settings -> Setting");
  process.stdout.write("  settings + business_settings ... ");

  const merged = new Map<string, Prisma.SettingCreateManyInput>();

  // business_settings first so it holds the winning entry on collision.
  if (await tableExists("business_settings")) {
    for (const row of await readAll("business_settings")) {
      stat.read += 1;
      const storeId = numReq(row.store_id, 1);
      const key = strReq(row.setting_key);
      if (key === "") {
        stat.skipped += 1;
        continue;
      }
      merged.set(`${storeId}::${key}`, {
        storeId,
        key: clip(key, 100) ?? key,
        value: str(row.setting_value),
        group: clip(strReq(row.setting_group, "general"), 50) ?? "general",
        description: clip(str(row.description), 255),
        isSecret: flag(row.is_encrypted) || looksSecret(key),
        createdAt: dtReq(row.created_at, EPOCH),
        updatedAt: dtReq(row.updated_at, dtReq(row.created_at, EPOCH)),
      });
    }
  } else {
    note(stat, "business_settings does not exist");
  }

  if (await tableExists("settings")) {
    for (const row of await readAll("settings")) {
      stat.read += 1;
      const storeId = numReq(row.store_id, 1);
      const key = strReq(row.setting_key);
      if (key === "") {
        stat.skipped += 1;
        continue;
      }
      const mapKey = `${storeId}::${key}`;
      if (merged.has(mapKey)) {
        stat.skipped += 1;
        note(stat, `collision on (store ${storeId}, "${key}") — business_settings wins`);
        continue;
      }
      // setting_type is intentionally ignored: the new column is plain TEXT and
      // the app parses on read, matching the legacy PHP behaviour.
      merged.set(mapKey, {
        storeId,
        key: clip(key, 100) ?? key,
        value: str(row.setting_value),
        group: deriveSettingGroup(key),
        description: null,
        isSecret: looksSecret(key),
        createdAt: dtReq(row.created_at, EPOCH),
        updatedAt: dtReq(row.updated_at, dtReq(row.created_at, EPOCH)),
      });
    }
  } else {
    note(stat, "settings does not exist");
  }

  const payload = [...merged.values()];
  for (let i = 0; i < payload.length; i += CHUNK) {
    stat.written += await writeChunk(
      payload.slice(i, i + CHUNK),
      (rows) => prisma.setting.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
      stat,
    );
  }

  console.log(`read ${stat.read}, wrote ${stat.written}, skipped ${stat.skipped}`);
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

async function truncateTargets(): Promise<void> {
  console.log("--fresh: truncating target tables\n");
  // A dedicated raw connection guarantees the FOREIGN_KEY_CHECKS session
  // variable applies to the same session that runs the TRUNCATEs.
  const target = await mysql.createConnection({ uri: requireEnv("DATABASE_URL") });
  try {
    await target.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const table of TARGET_TABLES) {
      await target.query(`TRUNCATE TABLE \`${table}\``);
    }
    await target.query("SET FOREIGN_KEY_CHECKS = 1");
  } finally {
    await target.end();
  }
}

async function run(): Promise<void> {
  legacy = await mysql.createConnection({
    uri: requireEnv("LEGACY_DATABASE_URL"),
    // Hand back raw strings for temporal types so '0000-00-00' is detectable
    // rather than silently becoming an Invalid Date.
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
  });

  if (FRESH) await truncateTargets();

  console.log("Stores & users");
  await migrateTable("stores", "Store", mapStore, (rows) =>
    prisma.store.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateSettings();
  await migrateTable("users", "User", mapUser, (rows) =>
    prisma.user.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("user_addresses", "Address", mapAddress, (rows) =>
    prisma.address.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );

  console.log("\nCatalog");
  await migrateTable("categories", "Category", mapCategory, (rows) =>
    prisma.category.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await applySelfReference("categories", "parent_id", (parentId, childIds) =>
    prisma.category.updateMany({ where: { id: { in: childIds } }, data: { parentId } }),
  );
  await migrateTable("products", "Product", mapProduct, (rows) =>
    prisma.product.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("product_images", "ProductImage", mapProductImage, (rows) =>
    prisma.productImage.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("product_colors", "Color", mapColor, (rows) =>
    prisma.color.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("product_sizes", "Size", mapSize, (rows) =>
    prisma.size.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("product_variants", "ProductVariant", mapProductVariant, (rows) =>
    prisma.productVariant.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );

  console.log("\nCart, wishlist & reviews");
  await migrateCarts();
  await migrateTable("cart_items", "CartItem", mapCartItem, (rows) =>
    prisma.cartItem.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("wishlist", "WishlistItem", mapWishlistItem, (rows) =>
    prisma.wishlistItem.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("reviews", "Review", mapReview, (rows) =>
    prisma.review.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );

  console.log("\nOrders, payments & shipping");
  // Coupons before orders: orders.coupon_id references coupons.
  await migrateTable("coupons", "Coupon", mapCoupon, (rows) =>
    prisma.coupon.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("orders", "Order", mapOrder, (rows) =>
    prisma.order.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("order_items", "OrderItem", mapOrderItem, (rows) =>
    prisma.orderItem.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("payments", "Payment", mapPayment, (rows) =>
    prisma.payment.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("couriers", "Courier", mapCourier, (rows) =>
    prisma.courier.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateShipments();
  await migrateTable("shipment_tracking", "ShipmentEvent", mapShipmentEvent, (rows) =>
    prisma.shipmentEvent.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("returns", "Return", mapReturn, (rows) =>
    prisma.return.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("return_items", "ReturnItem", mapReturnItem, (rows) =>
    prisma.returnItem.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );

  console.log("\nContent");
  await migrateTable("sliders", "Slider", mapSlider, (rows) =>
    prisma.slider.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("lookbook", "LookbookItem", mapLookbookItem, (rows) =>
    prisma.lookbookItem.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("social_media", "SocialLink", mapSocialLink, (rows) =>
    prisma.socialLink.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );

  console.log("\nPOS");
  await migrateTable("pos_terminals", "PosTerminal", mapPosTerminal, (rows) =>
    prisma.posTerminal.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("pos_shifts", "PosShift", mapPosShift, (rows) =>
    prisma.posShift.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("pos_transactions", "PosTransaction", mapPosTransaction, (rows) =>
    prisma.posTransaction.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("pos_transaction_items", "PosTransactionItem", mapPosTransactionItem, (rows) =>
    prisma.posTransactionItem.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("pos_cash_logs", "PosCashLog", mapPosCashLog, (rows) =>
    prisma.posCashLog.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("pos_held_orders", "PosHeldOrder", mapPosHeldOrder, (rows) =>
    prisma.posHeldOrder.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("pos_refunds", "PosRefund", mapPosRefund, (rows) =>
    prisma.posRefund.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("pos_split_payments", "PosSplitPayment", mapPosSplitPayment, (rows) =>
    prisma.posSplitPayment.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );

  console.log("\nHR & payroll");
  await migrateTable("departments", "Department", mapDepartment, (rows) =>
    prisma.department.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("employees", "Employee", mapEmployee, (rows) =>
    prisma.employee.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("attendance", "Attendance", mapAttendance, (rows) =>
    prisma.attendance.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("leave_types", "LeaveType", mapLeaveType, (rows) =>
    prisma.leaveType.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("leave_requests", "LeaveRequest", mapLeaveRequest, (rows) =>
    prisma.leaveRequest.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("salary_components", "SalaryComponent", mapSalaryComponent, (rows) =>
    prisma.salaryComponent.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable(
    "employee_salary_structure",
    "EmployeeSalaryComponent",
    mapEmployeeSalaryComponent,
    (rows) => prisma.employeeSalaryComponent.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("payroll_periods", "PayrollPeriod", mapPayrollPeriod, (rows) =>
    prisma.payrollPeriod.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("payroll_details", "PayrollDetail", mapPayrollDetail, (rows) =>
    prisma.payrollDetail.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable(
    "payroll_detail_components",
    "PayrollDetailComponent",
    mapPayrollDetailComponent,
    (rows) => prisma.payrollDetailComponent.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );

  console.log("\nExpenses & purchasing");
  await migrateTable("expense_categories", "ExpenseCategory", mapExpenseCategory, (rows) =>
    prisma.expenseCategory.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("expenses", "Expense", mapExpense, (rows) =>
    prisma.expense.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("suppliers", "Supplier", mapSupplier, (rows) =>
    prisma.supplier.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("purchase_orders", "PurchaseOrder", mapPurchaseOrder, (rows) =>
    prisma.purchaseOrder.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("purchase_order_items", "PurchaseOrderItem", mapPurchaseOrderItem, (rows) =>
    prisma.purchaseOrderItem.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("supplier_payments", "SupplierPayment", mapSupplierPayment, (rows) =>
    prisma.supplierPayment.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );

  console.log("\nAccounting");
  await migrateTable("chart_of_accounts", "Account", mapAccount, (rows) =>
    prisma.account.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await applySelfReference("chart_of_accounts", "parent_id", (parentId, childIds) =>
    prisma.account.updateMany({ where: { id: { in: childIds } }, data: { parentId } }),
  );
  await migrateTable("journal_entries", "JournalEntry", mapJournalEntry, (rows) =>
    prisma.journalEntry.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await applySelfReference("journal_entries", "reversed_by_id", (reversedById, childIds) =>
    prisma.journalEntry.updateMany({ where: { id: { in: childIds } }, data: { reversedById } }),
  );
  await migrateTable("journal_entry_lines", "JournalEntryLine", mapJournalEntryLine, (rows) =>
    prisma.journalEntryLine.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );

  console.log("\nCampaigns & Meta");
  await migrateTable("campaign_messages", "Campaign", mapCampaign, (rows) =>
    prisma.campaign.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("campaign_analytics", "CampaignEvent", mapCampaignEvent, (rows) =>
    prisma.campaignEvent.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("campaign_daily_stats", "CampaignDailyStat", mapCampaignDailyStat, (rows) =>
    prisma.campaignDailyStat.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("campaign_goals", "CampaignGoal", mapCampaignGoal, (rows) =>
    prisma.campaignGoal.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("campaign_notes", "CampaignNote", mapCampaignNote, (rows) =>
    prisma.campaignNote.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("meta_integrations", "MetaIntegration", mapMetaIntegration, (rows) =>
    prisma.metaIntegration.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("meta_messages", "MetaMessage", mapMetaMessage, (rows) =>
    prisma.metaMessage.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable("meta_page_insights", "MetaPageInsight", mapMetaPageInsight, (rows) =>
    prisma.metaPageInsight.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
  await migrateTable(
    "meta_message_templates",
    "MetaMessageTemplate",
    mapMetaMessageTemplate,
    (rows) => prisma.metaMessageTemplate.createMany({ data: rows, skipDuplicates: SKIP_DUPES }),
  );
}

function printSummary(): void {
  const nameWidth = Math.max(28, ...stats.map((s) => s.table.length));
  const line = "-".repeat(nameWidth + 30);

  console.log(`\n${line}`);
  console.log(
    `${"TABLE".padEnd(nameWidth)}  ${"READ".padStart(8)}  ${"WROTE".padStart(8)}  ${"SKIP".padStart(8)}`,
  );
  console.log(line);

  let read = 0;
  let written = 0;
  let skipped = 0;
  for (const stat of stats) {
    read += stat.read;
    written += stat.written;
    skipped += stat.skipped;
    console.log(
      `${stat.table.padEnd(nameWidth)}  ${String(stat.read).padStart(8)}  ` +
        `${String(stat.written).padStart(8)}  ${String(stat.skipped).padStart(8)}`,
    );
  }

  console.log(line);
  console.log(
    `${"TOTAL".padEnd(nameWidth)}  ${String(read).padStart(8)}  ` +
      `${String(written).padStart(8)}  ${String(skipped).padStart(8)}`,
  );

  const withMessages = stats.filter((s) => s.errors.length > 0);
  if (withMessages.length > 0) {
    console.log("\nNotes & errors");
    console.log(line);
    for (const stat of withMessages) {
      console.log(`\n  ${stat.table}`);
      for (const message of stat.errors) console.log(`    - ${message}`);
    }
  }

  console.log(
    `\n${stats.length} steps, ${read} rows read, ${written} rows written, ${skipped} skipped.`,
  );
}

async function main(): Promise<void> {
  const started = Date.now();
  console.log(`Legacy data migration${FRESH ? " (--fresh)" : ""}\n`);

  let failure: unknown = null;
  try {
    await run();
  } catch (error) {
    failure = error;
    console.error(`\nMigration aborted: ${errorMessage(error)}`);
  } finally {
    if (legacy) await legacy.end().catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
  }

  printSummary();
  console.log(`Finished in ${((Date.now() - started) / 1000).toFixed(1)}s.`);

  if (failure) process.exitCode = 1;
}

void main();
