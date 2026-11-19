import type { SQLiteDatabase } from "expo-sqlite";
import {
  getCatalogDatabase,
  runInCatalogWriteTransaction,
} from "@/db/sqlite";
import {
  normalizeCategoryRecord,
  normalizeProductForRole,
  normalizeServerProduct,
  normalizeUnitRecord,
} from "@/sync/productNormalizer";
import type {
  CatalogCounts,
  Category,
  Product,
  ProductUnit,
  SyncDeltaResponse,
  SyncFullResponse,
  Unit,
  UserRole,
  WholesaleTier,
} from "@/types";

const DELETE_CHUNK_SIZE = 500;

interface ProductRowSql {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  category_id: string;
  category_name: string | null;
  unit_id: string;
  unit_name: string | null;
  cost_price: number;
  selling_price: number;
  is_open_price: number;
  sell_base_unit: number;
  stock: number;
  image_url: string | null;
  is_active: number;
  unit_conversions_json: string;
  wholesale_tiers_json: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CategoryRowSql {
  id: string;
  name: string;
  description: string | null;
  is_active: number;
  deleted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface UnitRowSql {
  id: string;
  name: string;
  symbol: string;
  description: string | null;
  is_active: number;
  deleted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

function safeParseJsonArray<T>(raw: string | null | undefined): T[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function mapSqlRowToProduct(row: ProductRowSql, role: UserRole | null): Product {
  const product: Product = {
    id: row.id,
    sku: row.sku,
    barcode: row.barcode ?? null,
    name: row.name,
    description: row.description ?? null,
    categoryId: row.category_id,
    categoryName: row.category_name ?? undefined,
    unitId: row.unit_id,
    unitName: row.unit_name ?? undefined,
    costPrice: Number(row.cost_price ?? 0),
    sellingPrice: Number(row.selling_price ?? 0),
    isOpenPrice: row.is_open_price === 1,
    sellBaseUnit: row.sell_base_unit === 1,
    stock: Number(row.stock ?? 0),
    imageUrl: row.image_url ?? null,
    isActive: row.is_active === 1,
    unitConversions: safeParseJsonArray<ProductUnit>(row.unit_conversions_json),
    wholesaleTiers: safeParseJsonArray<WholesaleTier>(row.wholesale_tiers_json),
    deletedAt: row.deleted_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  return normalizeProductForRole(product, role);
}

function mapSqlRowToCategory(row: CategoryRowSql): Category {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    isActive: row.is_active === 1,
    deletedAt: row.deleted_at ?? null,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

function mapSqlRowToUnit(row: UnitRowSql): Unit {
  return {
    id: row.id,
    name: row.name,
    symbol: row.symbol,
    description: row.description ?? null,
    isActive: row.is_active === 1,
    deletedAt: row.deleted_at ?? null,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

async function upsertCategoryRow(
  txn: SQLiteDatabase,
  rawCat: Category
): Promise<void> {
  const cat = normalizeCategoryRecord(
    rawCat as unknown as Record<string, unknown>
  );
  await txn.runAsync(
    `INSERT INTO categories (id, name, description, is_active, deleted_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       is_active = excluded.is_active,
       deleted_at = excluded.deleted_at,
       created_at = excluded.created_at,
       updated_at = excluded.updated_at`,
    cat.id,
    cat.name,
    cat.description ?? null,
    cat.isActive === false ? 0 : 1,
    cat.deletedAt ?? null,
    cat.createdAt ?? null,
    cat.updatedAt ?? null
  );
}

async function upsertUnitRow(txn: SQLiteDatabase, rawUnit: Unit): Promise<void> {
  const unit = normalizeUnitRecord(
    rawUnit as unknown as Record<string, unknown>
  );
  await txn.runAsync(
    `INSERT INTO units (id, name, symbol, description, is_active, deleted_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       symbol = excluded.symbol,
       description = excluded.description,
       is_active = excluded.is_active,
       deleted_at = excluded.deleted_at,
       created_at = excluded.created_at,
       updated_at = excluded.updated_at`,
    unit.id,
    unit.name,
    unit.symbol ?? "",
    unit.description ?? null,
    unit.isActive === false ? 0 : 1,
    unit.deletedAt ?? null,
    unit.createdAt ?? null,
    unit.updatedAt ?? null
  );
}

async function upsertProductRow(
  txn: SQLiteDatabase,
  rawProduct: Product
): Promise<void> {
  const product = normalizeServerProduct(
    rawProduct as unknown as Record<string, unknown>
  );
  await txn.runAsync(
    `INSERT INTO products (
       id, sku, barcode, name, description,
       category_id, category_name, unit_id, unit_name,
       cost_price, selling_price, is_open_price, sell_base_unit,
       stock, image_url, is_active,
       unit_conversions_json, wholesale_tiers_json,
       deleted_at, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       sku = excluded.sku,
       barcode = excluded.barcode,
       name = excluded.name,
       description = excluded.description,
       category_id = excluded.category_id,
       category_name = excluded.category_name,
       unit_id = excluded.unit_id,
       unit_name = excluded.unit_name,
       cost_price = excluded.cost_price,
       selling_price = excluded.selling_price,
       is_open_price = excluded.is_open_price,
       sell_base_unit = excluded.sell_base_unit,
       stock = excluded.stock,
       image_url = excluded.image_url,
       is_active = excluded.is_active,
       unit_conversions_json = excluded.unit_conversions_json,
       wholesale_tiers_json = excluded.wholesale_tiers_json,
       deleted_at = excluded.deleted_at,
       created_at = excluded.created_at,
       updated_at = excluded.updated_at`,
    product.id,
    product.sku,
    product.barcode ?? null,
    product.name,
    product.description ?? null,
    product.categoryId,
    product.categoryName ?? null,
    product.unitId,
    product.unitName ?? null,
    product.costPrice ?? 0,
    product.sellingPrice,
    product.isOpenPrice ? 1 : 0,
    product.sellBaseUnit === false ? 0 : 1,
    product.stock ?? 0,
    product.imageUrl ?? null,
    product.isActive ? 1 : 0,
    JSON.stringify(product.unitConversions ?? []),
    JSON.stringify(product.wholesaleTiers ?? []),
    product.deletedAt ?? null,
    product.createdAt,
    product.updatedAt
  );
}

async function deleteByIdsChunked(
  txn: SQLiteDatabase,
  table: "products" | "categories" | "units",
  ids: string[]
): Promise<number> {
  if (!ids || ids.length === 0) {
    return 0;
  }
  let totalDeleted = 0;
  for (let i = 0; i < ids.length; i += DELETE_CHUNK_SIZE) {
    const chunk = ids.slice(i, i + DELETE_CHUNK_SIZE).filter(Boolean);
    if (chunk.length === 0) {
      continue;
    }
    const placeholders = chunk.map(() => "?").join(", ");
    const res = await txn.runAsync(
      `DELETE FROM ${table} WHERE id IN (${placeholders})`,
      ...chunk
    );
    totalDeleted += res.changes;
  }
  return totalDeleted;
}

export async function applyFullCatalogReplace(
  payload: SyncFullResponse
): Promise<{
  productCount: number;
  categoryCount: number;
  unitCount: number;
}> {
  return runInCatalogWriteTransaction(async (txn) => {
    await txn.execAsync(`
      DELETE FROM products;
      DELETE FROM categories;
      DELETE FROM units;
    `);

    for (const cat of payload.categories ?? []) {
      await upsertCategoryRow(txn, cat);
    }
    for (const unit of payload.units ?? []) {
      await upsertUnitRow(txn, unit);
    }
    for (const prod of payload.products ?? []) {
      await upsertProductRow(txn, prod);
    }

    return {
      productCount: payload.products?.length ?? 0,
      categoryCount: payload.categories?.length ?? 0,
      unitCount: payload.units?.length ?? 0,
    };
  });
}

export async function applyDeltaCatalogBatch(
  payload: SyncDeltaResponse
): Promise<{ upsertedProducts: number; deletedProducts: number }> {
  return runInCatalogWriteTransaction(async (txn) => {
    for (const cat of payload.categories ?? []) {
      await upsertCategoryRow(txn, cat);
    }
    for (const unit of payload.units ?? []) {
      await upsertUnitRow(txn, unit);
    }
    for (const prod of payload.products ?? []) {
      await upsertProductRow(txn, prod);
    }

    await deleteByIdsChunked(
      txn,
      "categories",
      payload.deletedCategoryIds ?? []
    );
    await deleteByIdsChunked(txn, "units", payload.deletedUnitIds ?? []);
    const deletedProducts = await deleteByIdsChunked(
      txn,
      "products",
      payload.deletedProductIds ?? []
    );

    return {
      upsertedProducts: payload.products?.length ?? 0,
      deletedProducts,
    };
  });
}

export async function upsertLocalProduct(product: Product): Promise<void> {
  await runInCatalogWriteTransaction(async (txn) => {
    await upsertProductRow(txn, product);
  });
}

export async function removeLocalProductById(productId: string): Promise<void> {
  await runInCatalogWriteTransaction(async (txn) => {
    await txn.runAsync(`DELETE FROM products WHERE id = ?`, productId);
  });
}

export async function upsertLocalCategory(category: Category): Promise<void> {
  await runInCatalogWriteTransaction(async (txn) => {
    await upsertCategoryRow(txn, category);
  });
}

export async function removeLocalCategoryById(categoryId: string): Promise<void> {
  await runInCatalogWriteTransaction(async (txn) => {
    await txn.runAsync(`DELETE FROM categories WHERE id = ?`, categoryId);
  });
}

export async function upsertLocalUnit(unit: Unit): Promise<void> {
  await runInCatalogWriteTransaction(async (txn) => {
    await upsertUnitRow(txn, unit);
  });
}

export async function removeLocalUnitById(unitId: string): Promise<void> {
  await runInCatalogWriteTransaction(async (txn) => {
    await txn.runAsync(`DELETE FROM units WHERE id = ?`, unitId);
  });
}

export async function getCatalogProducts(
  role: UserRole | null,
  options?: { includeInactive?: boolean }
): Promise<Product[]> {
  const db = await getCatalogDatabase();
  const includeInactive = options?.includeInactive ?? false;
  const rows = await db.getAllAsync<ProductRowSql>(
    includeInactive
      ? `SELECT * FROM products WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE ASC`
      : `SELECT * FROM products WHERE deleted_at IS NULL AND is_active = 1 ORDER BY name COLLATE NOCASE ASC`
  );
  return rows.map((row) => mapSqlRowToProduct(row, role));
}

export type ProductSortMode =
  | "az"
  | "za"
  | "price_asc"
  | "price_desc"
  | "newest";

export interface CatalogProductPageQuery {
  searchQuery?: string;
  categoryId?: string;
  sortMode?: ProductSortMode;
  includeInactive?: boolean;
  limit?: number;
  offset?: number;
}

export interface CatalogProductPageResult {
  items: Product[];
  totalCount: number;
  unfilteredTotalCount: number;
  hasMore: boolean;
}

function escapeSqlLikePattern(raw: string): string {
  return raw.replace(/[\\%_]/g, "\\$&");
}

/**
 * Lazy-loading paginated SQLite query (`LIMIT`/`OFFSET` + `COUNT(*)`) so
 * Kasir and Produk only read and deserialize active viewport slices.
 */
export async function queryCatalogProductsPage(
  role: UserRole | null,
  query: CatalogProductPageQuery = {}
): Promise<CatalogProductPageResult> {
  const db = await getCatalogDatabase();
  const includeInactive = query.includeInactive ?? false;
  const limit = Math.max(1, Math.min(200, Math.floor(query.limit ?? 50)));
  const offset = Math.max(0, Math.floor(query.offset ?? 0));

  const baseClauses: string[] = ["deleted_at IS NULL"];
  if (!includeInactive) {
    baseClauses.push("is_active = 1");
  }
  const baseWhere = baseClauses.join(" AND ");

  const filterClauses: string[] = [...baseClauses];
  const filterParams: (string | number)[] = [];

  if (query.categoryId && query.categoryId !== "all") {
    filterClauses.push("category_id = ?");
    filterParams.push(query.categoryId);
  }

  const normalizedQ = query.searchQuery?.trim().toLowerCase() ?? "";
  if (normalizedQ.length > 0) {
    const pattern = `%${escapeSqlLikePattern(normalizedQ)}%`;
    filterClauses.push(
      "(LOWER(name) LIKE ? ESCAPE '\\' OR LOWER(sku) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(barcode, '')) LIKE ? ESCAPE '\\')"
    );
    filterParams.push(pattern, pattern, pattern);
  }

  const filterWhere = filterClauses.join(" AND ");

  const orderByMap: Record<ProductSortMode, string> = {
    az: "name COLLATE NOCASE ASC",
    za: "name COLLATE NOCASE DESC",
    price_asc: "selling_price ASC, name COLLATE NOCASE ASC",
    price_desc: "selling_price DESC, name COLLATE NOCASE ASC",
    newest: "updated_at DESC, name COLLATE NOCASE ASC",
  };
  const orderBySql = orderByMap[query.sortMode ?? "az"] ?? orderByMap.az;

  const [unfilteredRow, countRow, rows] = await Promise.all([
    db.getFirstAsync<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM products WHERE ${baseWhere}`
    ),
    db.getFirstAsync<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM products WHERE ${filterWhere}`,
      ...filterParams
    ),
    db.getAllAsync<ProductRowSql>(
      `SELECT * FROM products WHERE ${filterWhere} ORDER BY ${orderBySql} LIMIT ? OFFSET ?`,
      ...filterParams,
      limit,
      offset
    ),
  ]);

  const unfilteredTotalCount = Number(unfilteredRow?.cnt ?? 0);
  const totalCount = Number(countRow?.cnt ?? 0);
  const items = rows.map((row) => mapSqlRowToProduct(row, role));

  return {
    items,
    totalCount,
    unfilteredTotalCount,
    hasMore: offset + items.length < totalCount,
  };
}

export async function getCatalogProductById(
  id: string,
  role: UserRole | null
): Promise<Product | null> {
  const db = await getCatalogDatabase();
  const row = await db.getFirstAsync<ProductRowSql>(
    `SELECT * FROM products WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    id
  );
  return row ? mapSqlRowToProduct(row, role) : null;
}

export async function getCatalogCategories(options?: {
  includeInactive?: boolean;
}): Promise<Category[]> {
  const db = await getCatalogDatabase();
  const includeInactive = options?.includeInactive ?? false;
  const rows = await db.getAllAsync<CategoryRowSql>(
    includeInactive
      ? `SELECT * FROM categories WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE ASC`
      : `SELECT * FROM categories WHERE deleted_at IS NULL AND is_active = 1 ORDER BY name COLLATE NOCASE ASC`
  );
  return rows.map(mapSqlRowToCategory);
}

export async function getCatalogUnits(options?: {
  includeInactive?: boolean;
}): Promise<Unit[]> {
  const db = await getCatalogDatabase();
  const includeInactive = options?.includeInactive ?? false;
  const rows = await db.getAllAsync<UnitRowSql>(
    includeInactive
      ? `SELECT * FROM units WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE ASC`
      : `SELECT * FROM units WHERE deleted_at IS NULL AND is_active = 1 ORDER BY name COLLATE NOCASE ASC`
  );
  return rows.map(mapSqlRowToUnit);
}

export async function getCatalogCounts(): Promise<CatalogCounts> {
  const db = await getCatalogDatabase();
  const [prodCount, catCount, unitCount] = await Promise.all([
    db.getFirstAsync<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM products WHERE deleted_at IS NULL`
    ),
    db.getFirstAsync<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM categories WHERE deleted_at IS NULL`
    ),
    db.getFirstAsync<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM units WHERE deleted_at IS NULL`
    ),
  ]);

  return {
    products: Number(prodCount?.cnt ?? 0),
    categories: Number(catCount?.cnt ?? 0),
    units: Number(unitCount?.cnt ?? 0),
  };
}
