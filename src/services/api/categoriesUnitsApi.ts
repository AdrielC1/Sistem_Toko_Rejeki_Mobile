import {
  removeLocalCategoryById,
  removeLocalUnitById,
  upsertLocalCategory,
  upsertLocalUnit,
} from "@/db/catalogRepo";
import { apiRequestWithFailover } from "@/services/api/apiClient";
import { emitCatalogChanged } from "@/sync/catalogEvents";
import {
  normalizeCategoryRecord,
  normalizeUnitRecord,
} from "@/sync/productNormalizer";
import type { Category, ServerUrlConfig, Unit } from "@/types";

export interface ConnectedProductSummary {
  id: string;
  sku: string;
  name: string;
}

export async function fetchCategoriesServer(config: ServerUrlConfig): Promise<{
  ok: boolean;
  categories: Category[];
  error?: string;
}> {
  const res = await apiRequestWithFailover<Record<string, unknown>[]>(
    config,
    "/api/categories?scope=mini",
    { method: "GET", timeoutMs: 8000 }
  );
  if (!res.ok || !Array.isArray(res.data)) {
    return {
      ok: false,
      categories: [],
      error: res.error ?? "Gagal memuat daftar kategori.",
    };
  }
  return {
    ok: true,
    categories: res.data.map(normalizeCategoryRecord),
  };
}

export async function fetchCategoryDetailServer(
  config: ServerUrlConfig,
  id: string
): Promise<{
  ok: boolean;
  category: Category | null;
  connectedProducts: ConnectedProductSummary[];
  error?: string;
}> {
  const res = await apiRequestWithFailover<
    Record<string, unknown> & { products?: ConnectedProductSummary[] }
  >(config, `/api/categories/${encodeURIComponent(id)}?scope=mini`, {
    method: "GET",
    timeoutMs: 8000,
  });
  if (!res.ok || !res.data) {
    return {
      ok: false,
      category: null,
      connectedProducts: [],
      error: res.error ?? "Gagal memuat detail kategori.",
    };
  }
  return {
    ok: true,
    category: normalizeCategoryRecord(res.data),
    connectedProducts: Array.isArray(res.data.products) ? res.data.products : [],
  };
}

export async function createCategoryServer(
  config: ServerUrlConfig,
  payload: { name: string; description?: string }
): Promise<{ ok: boolean; category: Category | null; error?: string }> {
  const res = await apiRequestWithFailover<Record<string, unknown>>(
    config,
    "/api/categories?scope=mini",
    {
      method: "POST",
      timeoutMs: 10000,
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok || !res.data) {
    return {
      ok: false,
      category: null,
      error: res.error ?? "Gagal membuat kategori.",
    };
  }
  const normalized = normalizeCategoryRecord(res.data);
  await upsertLocalCategory(normalized);
  emitCatalogChanged();
  return { ok: true, category: normalized };
}

export async function updateCategoryServer(
  config: ServerUrlConfig,
  id: string,
  payload: { name: string; description?: string }
): Promise<{ ok: boolean; category: Category | null; error?: string }> {
  const res = await apiRequestWithFailover<Record<string, unknown>>(
    config,
    `/api/categories/${encodeURIComponent(id)}?scope=mini`,
    {
      method: "PUT",
      timeoutMs: 10000,
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok || !res.data) {
    return {
      ok: false,
      category: null,
      error: res.error ?? "Gagal memperbarui kategori.",
    };
  }
  const normalized = normalizeCategoryRecord(res.data);
  await upsertLocalCategory(normalized);
  emitCatalogChanged();
  return { ok: true, category: normalized };
}

export async function softDeleteCategoryServer(
  config: ServerUrlConfig,
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiRequestWithFailover<unknown>(
    config,
    `/api/categories/${encodeURIComponent(id)}?scope=mini`,
    { method: "DELETE", timeoutMs: 10000 }
  );
  if (!res.ok) {
    return {
      ok: false,
      error: res.error ?? "Gagal memindahkan kategori ke tong sampah.",
    };
  }
  await removeLocalCategoryById(id);
  emitCatalogChanged();
  return { ok: true };
}

export async function migrateCategoryProductsServer(
  config: ServerUrlConfig,
  fromId: string,
  targetCategoryId: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiRequestWithFailover<unknown>(
    config,
    `/api/categories/${encodeURIComponent(fromId)}/migrate?scope=mini`,
    {
      method: "POST",
      timeoutMs: 10000,
      body: JSON.stringify({ targetCategoryId }),
    }
  );
  if (!res.ok) {
    return {
      ok: false,
      error: res.error ?? "Gagal memindahkan produk ke kategori tujuan.",
    };
  }
  emitCatalogChanged();
  return { ok: true };
}

export async function fetchTrashedCategoriesServer(
  config: ServerUrlConfig
): Promise<{ ok: boolean; items: Category[]; error?: string }> {
  const res = await apiRequestWithFailover<Record<string, unknown>[]>(
    config,
    "/api/categories/trash?scope=mini",
    { method: "GET", timeoutMs: 8000 }
  );
  if (!res.ok || !Array.isArray(res.data)) {
    return {
      ok: false,
      items: [],
      error: res.error ?? "Gagal memuat tong sampah kategori.",
    };
  }
  return { ok: true, items: res.data.map(normalizeCategoryRecord) };
}

export async function restoreTrashedCategoryServer(
  config: ServerUrlConfig,
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiRequestWithFailover<Record<string, unknown>>(
    config,
    "/api/categories/trash?scope=mini",
    {
      method: "POST",
      timeoutMs: 10000,
      body: JSON.stringify({ id }),
    }
  );
  if (!res.ok) {
    return { ok: false, error: res.error ?? "Gagal memulihkan kategori." };
  }
  if (res.data) {
    await upsertLocalCategory(normalizeCategoryRecord(res.data));
  }
  emitCatalogChanged();
  return { ok: true };
}

export async function purgeTrashedCategoryServer(
  config: ServerUrlConfig,
  params: { id?: string; emptyAll?: boolean }
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiRequestWithFailover<unknown>(
    config,
    "/api/categories/trash?scope=mini",
    {
      method: "DELETE",
      timeoutMs: 10000,
      body: JSON.stringify(params),
    }
  );
  if (!res.ok) {
    return { ok: false, error: res.error ?? "Gagal menghapus permanen kategori." };
  }
  return { ok: true };
}

export async function fetchUnitsServer(config: ServerUrlConfig): Promise<{
  ok: boolean;
  units: Unit[];
  error?: string;
}> {
  const res = await apiRequestWithFailover<Record<string, unknown>[]>(
    config,
    "/api/units?scope=mini",
    { method: "GET", timeoutMs: 8000 }
  );
  if (!res.ok || !Array.isArray(res.data)) {
    return {
      ok: false,
      units: [],
      error: res.error ?? "Gagal memuat daftar satuan.",
    };
  }
  return { ok: true, units: res.data.map(normalizeUnitRecord) };
}

export async function fetchUnitDetailServer(
  config: ServerUrlConfig,
  id: string
): Promise<{
  ok: boolean;
  unit: Unit | null;
  connectedProducts: ConnectedProductSummary[];
  error?: string;
}> {
  const res = await apiRequestWithFailover<
    Record<string, unknown> & { products?: ConnectedProductSummary[] }
  >(config, `/api/units/${encodeURIComponent(id)}?scope=mini`, {
    method: "GET",
    timeoutMs: 8000,
  });
  if (!res.ok || !res.data) {
    return {
      ok: false,
      unit: null,
      connectedProducts: [],
      error: res.error ?? "Gagal memuat detail satuan.",
    };
  }
  return {
    ok: true,
    unit: normalizeUnitRecord(res.data),
    connectedProducts: Array.isArray(res.data.products) ? res.data.products : [],
  };
}

export async function createUnitServer(
  config: ServerUrlConfig,
  payload: { name: string; symbol?: string; description?: string }
): Promise<{ ok: boolean; unit: Unit | null; error?: string }> {
  const res = await apiRequestWithFailover<Record<string, unknown>>(
    config,
    "/api/units?scope=mini",
    {
      method: "POST",
      timeoutMs: 10000,
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok || !res.data) {
    return {
      ok: false,
      unit: null,
      error: res.error ?? "Gagal membuat satuan baru.",
    };
  }
  const normalized = normalizeUnitRecord(res.data);
  await upsertLocalUnit(normalized);
  emitCatalogChanged();
  return { ok: true, unit: normalized };
}

export async function updateUnitServer(
  config: ServerUrlConfig,
  id: string,
  payload: { name: string; symbol?: string; description?: string }
): Promise<{ ok: boolean; unit: Unit | null; error?: string }> {
  const res = await apiRequestWithFailover<Record<string, unknown>>(
    config,
    `/api/units/${encodeURIComponent(id)}?scope=mini`,
    {
      method: "PUT",
      timeoutMs: 10000,
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok || !res.data) {
    return {
      ok: false,
      unit: null,
      error: res.error ?? "Gagal memperbarui satuan.",
    };
  }
  const normalized = normalizeUnitRecord(res.data);
  await upsertLocalUnit(normalized);
  emitCatalogChanged();
  return { ok: true, unit: normalized };
}

export async function softDeleteUnitServer(
  config: ServerUrlConfig,
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiRequestWithFailover<unknown>(
    config,
    `/api/units/${encodeURIComponent(id)}?scope=mini`,
    { method: "DELETE", timeoutMs: 10000 }
  );
  if (!res.ok) {
    return {
      ok: false,
      error: res.error ?? "Gagal memindahkan satuan ke tong sampah.",
    };
  }
  await removeLocalUnitById(id);
  emitCatalogChanged();
  return { ok: true };
}

export async function migrateUnitProductsServer(
  config: ServerUrlConfig,
  fromId: string,
  targetUnitId: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiRequestWithFailover<unknown>(
    config,
    `/api/units/${encodeURIComponent(fromId)}/migrate?scope=mini`,
    {
      method: "POST",
      timeoutMs: 10000,
      body: JSON.stringify({ targetUnitId }),
    }
  );
  if (!res.ok) {
    return {
      ok: false,
      error: res.error ?? "Gagal memindahkan produk ke satuan tujuan.",
    };
  }
  emitCatalogChanged();
  return { ok: true };
}

export async function fetchTrashedUnitsServer(
  config: ServerUrlConfig
): Promise<{ ok: boolean; items: Unit[]; error?: string }> {
  const res = await apiRequestWithFailover<Record<string, unknown>[]>(
    config,
    "/api/units/trash?scope=mini",
    { method: "GET", timeoutMs: 8000 }
  );
  if (!res.ok || !Array.isArray(res.data)) {
    return {
      ok: false,
      items: [],
      error: res.error ?? "Gagal memuat tong sampah satuan.",
    };
  }
  return { ok: true, items: res.data.map(normalizeUnitRecord) };
}

export async function restoreTrashedUnitServer(
  config: ServerUrlConfig,
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiRequestWithFailover<Record<string, unknown>>(
    config,
    "/api/units/trash?scope=mini",
    {
      method: "POST",
      timeoutMs: 10000,
      body: JSON.stringify({ id }),
    }
  );
  if (!res.ok) {
    return { ok: false, error: res.error ?? "Gagal memulihkan satuan." };
  }
  if (res.data) {
    await upsertLocalUnit(normalizeUnitRecord(res.data));
  }
  emitCatalogChanged();
  return { ok: true };
}

export async function purgeTrashedUnitServer(
  config: ServerUrlConfig,
  params: { id?: string; emptyAll?: boolean }
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiRequestWithFailover<unknown>(
    config,
    "/api/units/trash?scope=mini",
    {
      method: "DELETE",
      timeoutMs: 10000,
      body: JSON.stringify(params),
    }
  );
  if (!res.ok) {
    return { ok: false, error: res.error ?? "Gagal menghapus permanen satuan." };
  }
  return { ok: true };
}
