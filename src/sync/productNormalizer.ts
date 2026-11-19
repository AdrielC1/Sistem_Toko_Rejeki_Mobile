import type {
  Category,
  Product,
  ProductUnit,
  Unit,
  UserRole,
  WholesaleTier,
} from "@/types";

function toFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") {
      return true;
    }
    if (normalized === "false" || normalized === "0") {
      return false;
    }
  }
  return fallback;
}

function normalizeWholesaleTiers(raw: unknown): WholesaleTier[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const result: WholesaleTier[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const tier = item as Record<string, unknown>;
    const minQty = Math.floor(
      toFiniteNumber(tier.minQty ?? tier.min_qty, 0)
    );
    // Apps_Toko_Rejeki production backend returns `specialPrice`, whereas local models use `price`.
    const price = toFiniteNumber(
      tier.price ?? tier.specialPrice ?? tier.special_price,
      -1
    );
    if (minQty > 0 && price >= 0) {
      result.push({
        ...(typeof tier.id === "string" ? { id: tier.id } : {}),
        minQty,
        price,
      });
    }
  }
  return result.sort((a, b) => a.minQty - b.minQty);
}

function normalizeUnitConversions(raw: unknown): ProductUnit[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const result: ProductUnit[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const row = item as Record<string, unknown>;
    const unitId = String(row.unitId ?? row.unit_id ?? "");
    const unitName = String(row.unitName ?? row.unit_name ?? "");
    if (!unitId) {
      continue;
    }
    const tiers = normalizeWholesaleTiers(
      row.wholesaleTiers ?? row.wholesale_tiers
    );
    const hasCost =
      row.costPrice !== undefined || row.cost_price !== undefined;
    result.push({
      id: String(row.id ?? unitId),
      unitId,
      unitName,
      conversionFactor: Math.max(
        1,
        toFiniteNumber(row.conversionFactor ?? row.conversion_factor, 1)
      ),
      ...(hasCost
        ? {
            costPrice: Math.max(
              0,
              toFiniteNumber(row.costPrice ?? row.cost_price, 0)
            ),
          }
        : {}),
      sellingPrice: Math.max(
        0,
        toFiniteNumber(row.sellingPrice ?? row.selling_price, 0)
      ),
      isActive: toBoolean(row.isActive ?? row.is_active, true),
      ...(tiers.length > 0 ? { wholesaleTiers: tiers } : {}),
    });
  }
  return result;
}

/**
 * Strips `costPrice` completely from product objects when the active role
 * is `kasir` or unauthenticated (`D-09`), preventing confidential cost leakage
 * across SQLite read paths and UI components.
 */
export function normalizeProductForRole(
  product: Product,
  role: UserRole | null
): Product {
  if (role === "admin" || role === "owner") {
    return product;
  }
  const { costPrice: _stripped, ...rest } = product;
  return {
    ...rest,
    unitConversions: rest.unitConversions.map((u) => {
      if (!("costPrice" in u)) {
        return u;
      }
      const { costPrice: _unitCostStripped, ...unitRest } = u;
      return unitRest;
    }),
  };
}

export function normalizeCategoryRecord(
  raw: Record<string, unknown>
): Category {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    description:
      typeof raw.description === "string" ? raw.description : null,
    isActive: toBoolean(raw.isActive ?? raw.is_active, true),
    ...(typeof (raw.productCount ?? raw.product_count) === "number" ||
    typeof (raw.productCount ?? raw.product_count) === "string"
      ? { productCount: toFiniteNumber(raw.productCount ?? raw.product_count, 0) }
      : {}),
    deletedAt:
      typeof (raw.deletedAt ?? raw.deleted_at) === "string"
        ? String(raw.deletedAt ?? raw.deleted_at)
        : null,
    createdAt:
      typeof (raw.createdAt ?? raw.created_at) === "string"
        ? String(raw.createdAt ?? raw.created_at)
        : undefined,
    updatedAt:
      typeof (raw.updatedAt ?? raw.updated_at) === "string"
        ? String(raw.updatedAt ?? raw.updated_at)
        : undefined,
  };
}

export function normalizeUnitRecord(raw: Record<string, unknown>): Unit {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    symbol: typeof raw.symbol === "string" ? raw.symbol : "",
    description:
      typeof raw.description === "string" ? raw.description : null,
    isActive: toBoolean(raw.isActive ?? raw.is_active, true),
    ...(typeof (raw.productCount ?? raw.product_count) === "number" ||
    typeof (raw.productCount ?? raw.product_count) === "string"
      ? { productCount: toFiniteNumber(raw.productCount ?? raw.product_count, 0) }
      : {}),
    deletedAt:
      typeof (raw.deletedAt ?? raw.deleted_at) === "string"
        ? String(raw.deletedAt ?? raw.deleted_at)
        : null,
    createdAt:
      typeof (raw.createdAt ?? raw.created_at) === "string"
        ? String(raw.createdAt ?? raw.created_at)
        : undefined,
    updatedAt:
      typeof (raw.updatedAt ?? raw.updated_at) === "string"
        ? String(raw.updatedAt ?? raw.updated_at)
        : undefined,
  };
}

/**
 * Normalizes either canonical camelCase `Product`, production `formatProductRow` payloads
 * (where base unit resides inside `unitConversions` with `conversionFactor: 1`), or
 * raw SQL snake_case rows into a clean `Product`.
 */
export function normalizeServerProduct(raw: Record<string, unknown>): Product {
  const createdAt = String(
    raw.createdAt ?? raw.created_at ?? new Date().toISOString()
  );
  const updatedAt = String(
    raw.updatedAt ?? raw.updated_at ?? createdAt
  );

  const allConversions = normalizeUnitConversions(
    raw.unitConversions ?? raw.unit_conversions
  );
  const rawRootTiers = normalizeWholesaleTiers(
    raw.wholesaleTiers ?? raw.wholesale_tiers
  );

  const hasExplicitRootUnitId =
    typeof (raw.unitId ?? raw.unit_id) === "string" &&
    String(raw.unitId ?? raw.unit_id).trim().length > 0;

  const baseConversion =
    allConversions.find((c) => c.conversionFactor === 1) ?? allConversions[0];

  const unitId = hasExplicitRootUnitId
    ? String(raw.unitId ?? raw.unit_id)
    : baseConversion?.unitId ?? "";

  const explicitUnitName = raw.unitName ?? raw.unit_name ?? raw.baseUnit;
  const unitName =
    typeof explicitUnitName === "string" && explicitUnitName.trim().length > 0
      ? explicitUnitName.trim()
      : baseConversion?.unitName?.trim() || undefined;

  const hasExplicitSellingPrice =
    raw.sellingPrice !== undefined || raw.selling_price !== undefined;
  const sellingPrice = hasExplicitSellingPrice
    ? toFiniteNumber(raw.sellingPrice ?? raw.selling_price, 0)
    : baseConversion?.sellingPrice ?? 0;

  const sellBaseUnit =
    raw.sellBaseUnit !== undefined || raw.sell_base_unit !== undefined
      ? toBoolean(raw.sellBaseUnit ?? raw.sell_base_unit, true)
      : baseConversion
        ? baseConversion.isActive !== false
        : true;

  const derivedConversions = allConversions.filter((c) => {
    if (unitId && c.unitId === unitId) {
      return false;
    }
    if (!hasExplicitRootUnitId && baseConversion && c.id === baseConversion.id) {
      return false;
    }
    return true;
  });

  const wholesaleTiers =
    !hasExplicitRootUnitId &&
    baseConversion?.wholesaleTiers &&
    baseConversion.wholesaleTiers.length > 0
      ? baseConversion.wholesaleTiers
      : rawRootTiers.length > 0
        ? rawRootTiers
        : baseConversion?.wholesaleTiers ?? [];

  const product: Product = {
    id: String(raw.id ?? ""),
    sku: String(raw.sku ?? ""),
    barcode:
      typeof raw.barcode === "string" && raw.barcode.trim().length > 0
        ? raw.barcode.trim()
        : null,
    name: String(raw.name ?? ""),
    description:
      typeof raw.description === "string" ? raw.description : null,
    categoryId: String(raw.categoryId ?? raw.category_id ?? ""),
    categoryName:
      typeof (raw.categoryName ?? raw.category_name) === "string"
        ? String(raw.categoryName ?? raw.category_name)
        : undefined,
    unitId,
    unitName,
    sellingPrice,
    isOpenPrice: toBoolean(raw.isOpenPrice ?? raw.is_open_price, false),
    sellBaseUnit,
    stock: toFiniteNumber(raw.stock, 0),
    imageUrl:
      typeof (raw.imageUrl ?? raw.image_url) === "string"
        ? String(raw.imageUrl ?? raw.image_url)
        : null,
    isActive: toBoolean(raw.isActive ?? raw.is_active, true),
    unitConversions: derivedConversions,
    wholesaleTiers,
    deletedAt:
      typeof (raw.deletedAt ?? raw.deleted_at) === "string"
        ? String(raw.deletedAt ?? raw.deleted_at)
        : null,
    createdAt,
    updatedAt,
  };

  if (raw.costPrice !== undefined || raw.cost_price !== undefined) {
    product.costPrice = toFiniteNumber(raw.costPrice ?? raw.cost_price, 0);
  }

  return product;
}
