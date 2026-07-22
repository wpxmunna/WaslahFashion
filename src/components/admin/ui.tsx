import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------
   Shared admin building blocks.
   Every admin module composes these so the panel stays visually consistent.
   ------------------------------------------------------------------------- */

export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
}: {
  title: string;
  description?: string;
  breadcrumb?: { href: string; label: string }[];
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-3">
          <ol className="flex flex-wrap items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {breadcrumb.map((crumb, i) => (
              <li key={crumb.href} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden>/</span>}
                <Link href={crumb.href} className="link-wipe">
                  {crumb.label}
                </Link>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display-title text-[clamp(1.6rem,2.6vw,2.35rem)]">{title}</h1>
          <div className="rule-gold mt-3.5" />
          {description && (
            <p className="mt-3 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border border-border bg-card shadow-sm", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            {title && (
              <h2 className="font-display text-base font-bold tracking-tight">{title}</h2>
            )}
            {description && (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="kicker text-muted-foreground">{label}</p>
        {icon && (
          <span className="text-muted-foreground transition-colors group-hover/stat:text-[color:var(--accent)]">
            {icon}
          </span>
        )}
      </div>
      <p className="mt-3 font-display text-[1.75rem] font-bold leading-none tabular-nums">
        {value}
      </p>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </>
  );

  // A gold rail on the left edge grounds each stat in the brand accent and
  // brightens on hover for the clickable cards.
  const className =
    "group/stat relative block overflow-hidden rounded-lg border border-border bg-card p-5 pl-6 shadow-sm transition-colors before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-[var(--accent)]/50 before:transition-colors hover:border-[var(--accent)]/50 hover:before:bg-[var(--accent)]";

  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** Tone-mapped pill. Mirrors the legacy `statusBadge()` helper's colour map. */
const TONES = {
  neutral: "bg-secondary text-secondary-foreground",
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  info: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  danger: "bg-destructive/15 text-destructive",
  accent: "bg-accent/25 text-accent-foreground",
} as const;

export type BadgeTone = keyof typeof TONES;

const STATUS_TONES: Record<string, BadgeTone> = {
  // Orders
  PENDING: "warning",
  PROCESSING: "info",
  SHIPPED: "info",
  DELIVERED: "success",
  CANCELLED: "danger",
  REFUNDED: "neutral",
  // Payments
  PAID: "success",
  FAILED: "danger",
  // Generic
  ACTIVE: "success",
  INACTIVE: "neutral",
  DRAFT: "neutral",
  APPROVED: "success",
  REJECTED: "danger",
  COMPLETED: "success",
  PARTIAL: "warning",
  OPEN: "success",
  CLOSED: "neutral",
  VOID: "danger",
  HELD: "warning",
  NOT_REQUIRED: "neutral",
  // HR — employees
  ON_LEAVE: "warning",
  TERMINATED: "danger",
  RESIGNED: "neutral",
  // HR — attendance
  PRESENT: "success",
  ABSENT: "danger",
  LATE: "warning",
  HALF_DAY: "warning",
  LEAVE: "info",
  HOLIDAY: "neutral",
  // HR — payroll component types
  EARNING: "success",
  DEDUCTION: "danger",
  // Purchasing / accounting
  ORDERED: "info",
  RECEIVED: "success",
  POSTED: "success",
  REVERSED: "neutral",
  // Shipments
  PICKED_UP: "info",
  IN_TRANSIT: "info",
  OUT_FOR_DELIVERY: "info",
  RECALLED: "neutral",
  EXPIRED: "neutral",
};

export function StatusBadge({
  status,
  label,
  tone,
}: {
  status?: string;
  label?: string;
  tone?: BadgeTone;
}) {
  const resolved = tone ?? (status ? (STATUS_TONES[status] ?? "neutral") : "neutral");
  const text = label ?? status?.replace(/_/g, " ").toLowerCase() ?? "";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.06em]",
        TONES[resolved],
      )}
    >
      {text}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-6 py-16 text-center">
      <p className="font-display text-lg font-bold tracking-tight">{title}</p>
      {description && (
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

/** Scroll container so wide admin tables never blow out the page width. */
export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="w-full overflow-x-auto">{children}</div>;
}

export function Th({
  children,
  className,
  align = "left",
  colSpan,
}: {
  children?: ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  colSpan?: number;
}) {
  return (
    <th
      scope="col"
      colSpan={colSpan}
      className={cn(
        "whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  align = "left",
  colSpan,
}: {
  children?: ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        "px-4 py-3 align-middle text-sm",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function DataTable({ children }: { children: ReactNode }) {
  return (
    <TableWrap>
      <table className="w-full border-collapse">{children}</table>
    </TableWrap>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-border">{children}</tbody>;
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-border bg-secondary/40">
      <tr>{children}</tr>
    </thead>
  );
}
