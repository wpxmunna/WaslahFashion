import "server-only";

import { Prisma } from "@/generated/prisma";
import { DEFAULT_STORE_ID, PRODUCTS_PER_PAGE, type SortValue } from "@/lib/config";
import { prisma } from "@/lib/prisma";

/**
 * SQL for the effective selling price.
 *
 * Legacy used `COALESCE(sale_price, price)`, which treats a stored `0.00` as a
 * valid free sale price. We require the sale price to be a real discount, and
 * the same rule is mirrored in `effectivePrice()` in lib/money.ts so sorting
 * and display never disagree.
 */
const EFFECTIVE_PRICE = Prisma.sql`
  CASE
    WHEN p.sale_price IS NOT NULL AND p.sale_price > 0 AND p.sale_price < p.price
      THEN p.sale_price
    ELSE p.price
  END
`;

export const productCardSelect = {
  id: true,
  name: true,
  slug: true,
  price: true,
  salePrice: true,
  stockQuantity: true,
  isFeatured: true,
  createdAt: true,
  category: { select: { name: true, slug: true } },
  images: {
    select: { path: true, altText: true },
    orderBy: [{ isPrimary: "desc" as const }, { sortOrder: "asc" as const }],
    take: 2,
  },
} satisfies Prisma.ProductSelect;

export type ProductCard = Prisma.ProductGetPayload<{
  select: typeof productCardSelect;
}>;

export type ProductFilters = {
  page?: number;
  perPage?: number;
  sort?: SortValue;
  categoryId?: number;
  /** Includes the category's direct children, matching legacy behaviour. */
  includeChildCategories?: boolean;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  storeId?: number;
};

export type Paginated<T> = {
  items: T[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

function orderByFragment(sort: SortValue | undefined): Prisma.Sql {
  switch (sort) {
    case "price_low":
      return Prisma.sql`${EFFECTIVE_PRICE} ASC, p.id DESC`;
    case "price_high":
      return Prisma.sql`${EFFECTIVE_PRICE} DESC, p.id DESC`;
    case "popular":
      return Prisma.sql`p.views DESC, p.id DESC`;
    case "name_asc":
      return Prisma.sql`p.name ASC, p.id DESC`;
    case "name_desc":
      return Prisma.sql`p.name DESC, p.id DESC`;
    case "newest":
    default:
      return Prisma.sql`p.created_at DESC, p.id DESC`;
  }
}

/**
 * Paginated product listing.
 *
 * Resolves ordered ids in SQL (so ordering and filtering can use the effective
 * price expression, which Prisma's `orderBy` cannot express) and then hydrates
 * fully-typed rows, preserving that order.
 *
 * Legacy note: the shop page collected `min_price`/`max_price` and then never
 * applied them, and `name_asc`/`name_desc` silently fell through to
 * `created_at` on category pages. Both are fixed — one code path for every
 * entry point.
 */
export async function listProducts(filters: ProductFilters = {}): Promise<Paginated<ProductCard>> {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.max(1, Math.min(60, filters.perPage ?? PRODUCTS_PER_PAGE));
  const storeId = filters.storeId ?? DEFAULT_STORE_ID;
  const offset = (page - 1) * perPage;

  const where: Prisma.Sql[] = [
    Prisma.sql`p.store_id = ${storeId}`,
    Prisma.sql`p.status = 'ACTIVE'`,
  ];

  if (filters.categoryId !== undefined) {
    if (filters.includeChildCategories) {
      const children = await prisma.category.findMany({
        where: { parentId: filters.categoryId },
        select: { id: true },
      });
      const ids = [filters.categoryId, ...children.map((c) => c.id)];
      where.push(Prisma.sql`p.category_id IN (${Prisma.join(ids)})`);
    } else {
      where.push(Prisma.sql`p.category_id = ${filters.categoryId}`);
    }
  }

  // `>= 0` is meaningful, so check against undefined rather than falsiness —
  // legacy used PHP `!empty()` and so ignored a min price of 0.
  if (filters.minPrice !== undefined) {
    where.push(Prisma.sql`${EFFECTIVE_PRICE} >= ${filters.minPrice}`);
  }
  if (filters.maxPrice !== undefined) {
    where.push(Prisma.sql`${EFFECTIVE_PRICE} <= ${filters.maxPrice}`);
  }

  const search = filters.search?.trim();
  if (search) {
    const like = `%${search}%`;
    where.push(
      Prisma.sql`(p.name LIKE ${like} OR p.description LIKE ${like} OR p.sku LIKE ${like})`,
    );
  }

  const whereSql = Prisma.join(where, " AND ");

  // Compose with `Prisma.sql` and hand the finished object to `$queryRaw()`.
  // Interpolating a `Prisma.Sql` directly into a `$queryRaw` *tagged template*
  // binds it as a query parameter rather than splicing it in as SQL, which
  // silently produces a WHERE clause that matches nothing.
  const idsQuery = Prisma.sql`
    SELECT p.id
    FROM products p
    WHERE ${whereSql}
    ORDER BY ${orderByFragment(filters.sort)}
    LIMIT ${perPage} OFFSET ${offset}
  `;

  const countQuery = Prisma.sql`
    SELECT COUNT(*) AS total FROM products p WHERE ${whereSql}
  `;

  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<{ id: number }[]>(idsQuery),
    prisma.$queryRaw<{ total: bigint }[]>(countQuery),
  ]);

  const total = Number(countRows[0]?.total ?? 0);
  const ids = rows.map((r) => r.id);

  if (ids.length === 0) {
    return { items: [], page, perPage, total, totalPages: Math.ceil(total / perPage) };
  }

  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: productCardSelect,
  });

  // findMany does not honour the `in` order — restore the SQL ordering.
  const byId = new Map(products.map((p) => [p.id, p]));
  const items = ids.map((id) => byId.get(id)).filter((p): p is ProductCard => !!p);

  return { items, page, perPage, total, totalPages: Math.ceil(total / perPage) };
}

export async function getProductBySlug(slug: string, storeId = DEFAULT_STORE_ID) {
  return prisma.product.findFirst({
    where: { slug, storeId, status: "ACTIVE" },
    include: {
      category: { select: { id: true, name: true, slug: true, parentId: true } },
      sizeChart: { select: { data: true } },
      images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
      variants: {
        where: { isActive: true },
        orderBy: [{ size: "asc" }, { colorName: "asc" }],
        include: { color: { select: { name: true, hex: true } } },
      },
    },
  });
}

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProductBySlug>>>;

/** Fire-and-forget view counter; never blocks or fails a page render. */
export async function incrementProductViews(id: number): Promise<void> {
  try {
    await prisma.product.update({ where: { id }, data: { views: { increment: 1 } } });
  } catch {
    // A failed analytics increment must not take down the product page.
  }
}

/**
 * Related products from the same category.
 * Legacy used `ORDER BY RAND()` — non-deterministic and unindexed, so it broke
 * caching and paged badly. Ordered by popularity instead.
 */
export async function getRelatedProducts(
  productId: number,
  categoryId: number | null,
  take = 4,
): Promise<ProductCard[]> {
  if (!categoryId) return [];

  return prisma.product.findMany({
    where: { categoryId, status: "ACTIVE", id: { not: productId } },
    select: productCardSelect,
    orderBy: [{ views: "desc" }, { createdAt: "desc" }],
    take,
  });
}

export async function getFeaturedProducts(take = 8, storeId = DEFAULT_STORE_ID) {
  return prisma.product.findMany({
    where: { storeId, status: "ACTIVE", isFeatured: true },
    select: productCardSelect,
    orderBy: { createdAt: "desc" },
    take,
  });
}

/** Legacy ignored the `is_new` flag entirely here; we honour it, newest first. */
export async function getNewArrivals(take = 8, storeId = DEFAULT_STORE_ID) {
  return prisma.product.findMany({
    where: { storeId, status: "ACTIVE" },
    select: productCardSelect,
    orderBy: [{ isNew: "desc" }, { createdAt: "desc" }],
    take,
  });
}

export async function getCategoryBySlug(slug: string, storeId = DEFAULT_STORE_ID) {
  return prisma.category.findFirst({
    where: { slug, storeId, isActive: true },
    include: {
      parent: { select: { id: true, name: true, slug: true } },
      children: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, slug: true },
      },
    },
  });
}

/** Top-level categories with their children, for nav and the homepage. */
export async function getCategoryTree(storeId = DEFAULT_STORE_ID) {
  return prisma.category.findMany({
    where: { storeId, isActive: true, parentId: null },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      image: true,
      children: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, slug: true },
      },
      _count: { select: { products: { where: { status: "ACTIVE" } } } },
    },
  });
}

export type CategoryTreeNode = Awaited<ReturnType<typeof getCategoryTree>>[number];
