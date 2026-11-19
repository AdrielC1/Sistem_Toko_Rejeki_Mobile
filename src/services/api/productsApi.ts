import {
  removeLocalProductById,
  upsertLocalProduct,
} from "@/db/catalogRepo";
import { apiRequestWithFailover } from "@/services/api/apiClient";
import { emitCatalogChanged } from "@/sync/catalogEvents";
import {
  normalizeProductForRole,
  normalizeServerProduct,
} from "@/sync/productNormalizer";
import type { Product, ServerUrlConfig, UserRole } from "@/types";

export interface ProductMutationPayload {
  sku: string;
  barcode?: string | null;
  name: string;
  description?: string | null;
  categoryId: string;
  categoryName?: string;
  unitId: string;
  unitName?: string;
  costPrice: number;
  sellingPrice: number;
  isOpenPrice: boolean;
  sellBaseUnit: boolean;
  stock: number;
  imageUrl?: string | null;
  isActive: boolean;
  unitConversions: {
    id?: string;
    unitId: string;
    unitName?: string;
    conversionFactor: number;
    costPrice?: number;
    sellingPrice: number;
    isActive?: boolean;
    wholesaleTiers?: {
      minQty: number;
      price: number;
      specialPrice?: number;
      unitName?: string;
    }[];
  }[];
  wholesaleTiers: {
    minQty: number;
    price: number;
    specialPrice?: number;
    unitName?: string;
  }[];
}

export async function fetchServerProductDetail(
  config: ServerUrlConfig,
  id: string,
  role: UserRole | null
): Promise<{ ok: boolean; product: Product | null; error?: string }> {
  const res = await apiRequestWithFailover<Record<string, unknown>>(
    config,
    `/api/products/${encodeURIComponent(id)}?scope=mini`,
    { method: "GET", timeoutMs: 8000 }
  );

  if (!res.ok || !res.data) {
    return {
      ok: false,
      product: null,
      error: res.error ?? "Gagal memuat detail produk dari server.",
    };
  }

  const canonical = normalizeServerProduct(res.data);
  const roleScoped = normalizeProductForRole(canonical, role);
  return {
    ok: true,
    product: roleScoped,
  };
}

export async function createServerProduct(
  config: ServerUrlConfig,
  payload: ProductMutationPayload,
  role: UserRole | null
): Promise<{ ok: boolean; product: Product | null; error?: string }> {
  const res = await apiRequestWithFailover<Record<string, unknown>>(
    config,
    `/api/products?scope=mini`,
    {
      method: "POST",
      timeoutMs: 12000,
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok || !res.data) {
    return {
      ok: false,
      product: null,
      error: res.error ?? "Gagal menambahkan produk baru.",
    };
  }

  const canonical = normalizeServerProduct(res.data);
  await upsertLocalProduct(canonical);
  emitCatalogChanged();
  return {
    ok: true,
    product: normalizeProductForRole(canonical, role),
  };
}

export async function updateServerProduct(
  config: ServerUrlConfig,
  id: string,
  payload: ProductMutationPayload,
  role: UserRole | null
): Promise<{ ok: boolean; product: Product | null; error?: string }> {
  const res = await apiRequestWithFailover<Record<string, unknown>>(
    config,
    `/api/products/${encodeURIComponent(id)}?scope=mini`,
    {
      method: "PUT",
      timeoutMs: 12000,
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok || !res.data) {
    return {
      ok: false,
      product: null,
      error: res.error ?? "Gagal memperbarui data produk.",
    };
  }

  const canonical = normalizeServerProduct(res.data);
  await upsertLocalProduct(canonical);
  emitCatalogChanged();
  return {
    ok: true,
    product: normalizeProductForRole(canonical, role),
  };
}

export async function softDeleteServerProduct(
  config: ServerUrlConfig,
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiRequestWithFailover<unknown>(
    config,
    `/api/products/${encodeURIComponent(id)}?scope=mini`,
    {
      method: "DELETE",
      timeoutMs: 10000,
    }
  );

  if (!res.ok) {
    return {
      ok: false,
      error: res.error ?? "Gagal memindahkan produk ke tong sampah.",
    };
  }

  await removeLocalProductById(id);
  emitCatalogChanged();
  return { ok: true };
}

export async function fetchTrashedProducts(
  config: ServerUrlConfig,
  role: UserRole | null
): Promise<{ ok: boolean; products: Product[]; error?: string }> {
  const res = await apiRequestWithFailover<Record<string, unknown>[]>(
    config,
    `/api/products/trash?scope=mini`,
    { method: "GET", timeoutMs: 10000 }
  );

  if (!res.ok || !Array.isArray(res.data)) {
    return {
      ok: false,
      products: [],
      error: res.error ?? "Gagal memuat daftar tong sampah produk.",
    };
  }

  return {
    ok: true,
    products: res.data.map((raw) =>
      normalizeProductForRole(normalizeServerProduct(raw), role)
    ),
  };
}

export async function restoreTrashedProduct(
  config: ServerUrlConfig,
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiRequestWithFailover<Record<string, unknown>>(
    config,
    `/api/products/trash?scope=mini`,
    {
      method: "POST",
      timeoutMs: 10000,
      body: JSON.stringify({ id }),
    }
  );

  if (!res.ok) {
    return {
      ok: false,
      error: res.error ?? "Gagal memulihkan produk dari tong sampah.",
    };
  }

  if (res.data && typeof res.data === "object") {
    await upsertLocalProduct(normalizeServerProduct(res.data));
  }
  emitCatalogChanged();
  return { ok: true };
}

export async function deleteTrashedProductPermanently(
  config: ServerUrlConfig,
  params: { id?: string; emptyAll?: boolean }
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiRequestWithFailover<unknown>(
    config,
    `/api/products/trash?scope=mini`,
    {
      method: "DELETE",
      timeoutMs: 10000,
      body: JSON.stringify(params),
    }
  );

  if (!res.ok) {
    return {
      ok: false,
      error: res.error ?? "Gagal menghapus permanen produk dari tong sampah.",
    };
  }
  return { ok: true };
}
