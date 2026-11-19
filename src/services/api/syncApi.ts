import {
  apiRequestWithFailover,
  type FailoverApiRequestResult,
} from "@/services/api/apiClient";
import {
  normalizeCategoryRecord,
  normalizeServerProduct,
  normalizeUnitRecord,
} from "@/sync/productNormalizer";
import type {
  Category,
  Product,
  ServerRoute,
  ServerUrlConfig,
  SyncDeltaResponse,
  SyncFullResponse,
  Unit,
} from "@/types";

export type SyncErrorCode = "NETWORK" | "AUTH" | "DB_OFFLINE" | "HTTP_ERROR";

export class SyncTransportError extends Error {
  readonly code: SyncErrorCode;
  readonly status: number;
  readonly offline: boolean;

  constructor(
    code: SyncErrorCode,
    message: string,
    status = 0,
    offline = false
  ) {
    super(message);
    this.name = "SyncTransportError";
    this.code = code;
    this.status = status;
    this.offline = offline;
  }
}

function unwrapSyncResult<T>(
  res: FailoverApiRequestResult<T>,
  fallbackMessage: string
): {
  data: T;
  rawBody: Record<string, unknown> | null;
  usedRoute: ServerRoute;
} {
  if (res.sessionRevoked || res.status === 401 || res.status === 403) {
    throw new SyncTransportError(
      "AUTH",
      res.error ?? "Sesi login berakhir. Silakan masuk kembali.",
      res.status
    );
  }

  if (res.offline || res.status === 503) {
    throw new SyncTransportError(
      "DB_OFFLINE",
      res.error ?? "Database toko sedang offline (mode standby baca-saja).",
      res.status || 503,
      true
    );
  }

  if (res.networkError) {
    throw new SyncTransportError(
      "NETWORK",
      res.error ?? "Server tidak dapat dijangkau.",
      res.status
    );
  }

  if (!res.ok || res.data === null || res.data === undefined) {
    throw new SyncTransportError(
      "HTTP_ERROR",
      res.error ?? fallbackMessage,
      res.status
    );
  }

  return {
    data: res.data,
    rawBody:
      res.rawBody && typeof res.rawBody === "object"
        ? (res.rawBody as unknown as Record<string, unknown>)
        : null,
    usedRoute: res.usedRoute ?? "lan",
  };
}

function unwrapDeltaEntityGroup(
  node: unknown,
  legacyDeleted: unknown
): { upserted: Record<string, unknown>[]; deleted: string[] } {
  if (Array.isArray(node)) {
    return {
      upserted: node.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object"
      ),
      deleted: Array.isArray(legacyDeleted)
        ? legacyDeleted.map((id) => String(id)).filter(Boolean)
        : [],
    };
  }

  if (node && typeof node === "object") {
    const group = node as Record<string, unknown>;
    return {
      upserted: Array.isArray(group.upserted)
        ? group.upserted.filter(
            (item): item is Record<string, unknown> =>
              Boolean(item) && typeof item === "object"
          )
        : [],
      deleted: Array.isArray(group.deleted)
        ? group.deleted.map((id) => String(id)).filter(Boolean)
        : [],
    };
  }

  return {
    upserted: [],
    deleted: Array.isArray(legacyDeleted)
      ? legacyDeleted.map((id) => String(id)).filter(Boolean)
      : [],
  };
}

export async function fetchFullCatalogSync(
  config: ServerUrlConfig,
  clientId?: string
): Promise<{ data: SyncFullResponse; usedRoute: ServerRoute }> {
  const res = await apiRequestWithFailover<Record<string, unknown>>(
    config,
    "/api/sync/full?scope=mini",
    {
      method: "GET",
      timeoutMs: 15000,
      headers: clientId ? { "X-Client-Id": clientId } : undefined,
    }
  );

  const unwrapped = unwrapSyncResult(
    res,
    "Gagal mengunduh katalog lengkap dari server."
  );

  const payload = unwrapped.data;
  const top = unwrapped.rawBody;

  const products: Product[] = (
    Array.isArray(payload.products) ? payload.products : []
  )
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object"
    )
    .map(normalizeServerProduct);

  const categories: Category[] = (
    Array.isArray(payload.categories) ? payload.categories : []
  )
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object"
    )
    .map(normalizeCategoryRecord);

  const units: Unit[] = (Array.isArray(payload.units) ? payload.units : [])
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object"
    )
    .map(normalizeUnitRecord);

  const serverTime = String(
    payload.serverTime ?? top?.server_time ?? new Date().toISOString()
  );
  const totalProducts = Number(
    payload.totalProducts ?? top?.total_products ?? products.length
  );

  return {
    data: {
      products,
      categories,
      units,
      serverTime,
      totalProducts: Number.isFinite(totalProducts)
        ? totalProducts
        : products.length,
    },
    usedRoute: unwrapped.usedRoute,
  };
}

export async function fetchDeltaCatalogSync(
  config: ServerUrlConfig,
  since: string,
  clientId?: string
): Promise<{ data: SyncDeltaResponse; usedRoute: ServerRoute }> {
  const res = await apiRequestWithFailover<Record<string, unknown>>(
    config,
    `/api/sync/delta?scope=mini&since=${encodeURIComponent(since)}`,
    {
      method: "GET",
      timeoutMs: 8000,
      headers: clientId ? { "X-Client-Id": clientId } : undefined,
    }
  );

  const unwrapped = unwrapSyncResult(
    res,
    "Gagal memeriksa pembaruan katalog."
  );

  const payload = unwrapped.data;
  const top = unwrapped.rawBody;

  const prodGroup = unwrapDeltaEntityGroup(
    payload.products,
    payload.deletedProductIds
  );
  const catGroup = unwrapDeltaEntityGroup(
    payload.categories,
    payload.deletedCategoryIds
  );
  const unitGroup = unwrapDeltaEntityGroup(
    payload.units,
    payload.deletedUnitIds
  );

  const products = prodGroup.upserted.map(normalizeServerProduct);
  const categories = catGroup.upserted.map(normalizeCategoryRecord);
  const units = unitGroup.upserted.map(normalizeUnitRecord);

  const totalCount =
    products.length +
    prodGroup.deleted.length +
    categories.length +
    catGroup.deleted.length +
    units.length +
    unitGroup.deleted.length;

  const serverTime = String(
    payload.serverTime ?? top?.server_time ?? new Date().toISOString()
  );
  const rawHasChanges = payload.hasChanges ?? top?.has_changes;
  const hasChanges =
    typeof rawHasChanges === "boolean" ? rawHasChanges : totalCount > 0;

  return {
    data: {
      products,
      deletedProductIds: prodGroup.deleted,
      categories,
      deletedCategoryIds: catGroup.deleted,
      units,
      deletedUnitIds: unitGroup.deleted,
      serverTime,
      hasChanges,
    },
    usedRoute: unwrapped.usedRoute,
  };
}
