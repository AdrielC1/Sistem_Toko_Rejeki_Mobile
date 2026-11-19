import {
  getCatalogDatabase,
  resetCatalogTables,
  runInCatalogWriteTransaction,
} from "@/db/sqlite";
import { emitCatalogChanged } from "@/sync/catalogEvents";
import type { ServerRoute, SyncAuditRecord } from "@/types";

const META_KEYS = {
  LAST_SYNC_AT: "last_sync_at",
  LAST_FULL_SYNC_AT: "last_full_sync_at",
  LAST_FULL_SYNC_WIB_DATE: "last_full_sync_wib_date",
  LAST_SYNC_ROUTE: "last_sync_route",
  LAST_SYNC_ERROR: "last_sync_error",
  CATALOG_READY: "catalog_ready",
} as const;

export interface SyncMetaState {
  lastSyncAt: string | null;
  lastFullSyncAt: string | null;
  lastFullSyncWibDate: string | null;
  lastSyncRoute: ServerRoute | null;
  lastSyncError: string | null;
  catalogReady: boolean;
}

interface MetaRow {
  key: string;
  value: string;
}

interface AuditRow {
  id: number;
  sync_type: "full" | "delta";
  trigger_source: SyncAuditRecord["triggerSource"];
  used_route: ServerRoute | null;
  product_count: number;
  deleted_count: number;
  server_time: string | null;
  status: "success" | "skipped" | "error";
  error_message: string | null;
  created_at: string;
}

export async function getSyncMetaState(): Promise<SyncMetaState> {
  const db = await getCatalogDatabase();
  const rows = await db.getAllAsync<MetaRow>(`SELECT key, value FROM sync_meta`);
  const map = new Map<string, string>();
  for (const r of rows) {
    map.set(r.key, r.value);
  }

  const route = map.get(META_KEYS.LAST_SYNC_ROUTE);
  const normalizedRoute: ServerRoute | null =
    route === "lan" || route === "cloud" ? route : null;

  const rawError = map.get(META_KEYS.LAST_SYNC_ERROR);

  return {
    lastSyncAt: map.get(META_KEYS.LAST_SYNC_AT) || null,
    lastFullSyncAt: map.get(META_KEYS.LAST_FULL_SYNC_AT) || null,
    lastFullSyncWibDate: map.get(META_KEYS.LAST_FULL_SYNC_WIB_DATE) || null,
    lastSyncRoute: normalizedRoute,
    lastSyncError: rawError && rawError.length > 0 ? rawError : null,
    catalogReady: map.get(META_KEYS.CATALOG_READY) === "1",
  };
}

async function upsertMetaKey(
  txn: Awaited<ReturnType<typeof getCatalogDatabase>>,
  key: string,
  value: string,
  nowIso: string
): Promise<void> {
  await txn.runAsync(
    `INSERT INTO sync_meta (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`,
    key,
    value,
    nowIso
  );
}

export async function recordSyncSuccess(params: {
  syncType: "full" | "delta";
  triggerSource: SyncAuditRecord["triggerSource"];
  usedRoute: ServerRoute;
  productCount: number;
  deletedCount: number;
  serverTime: string;
  fullSyncWibDate?: string;
  fullSyncIso?: string;
  writeAuditRow?: boolean;
}): Promise<void> {
  const nowIso = new Date().toISOString();
  await runInCatalogWriteTransaction(async (txn) => {
    await upsertMetaKey(txn, META_KEYS.LAST_SYNC_AT, params.serverTime, nowIso);
    await upsertMetaKey(txn, META_KEYS.LAST_SYNC_ROUTE, params.usedRoute, nowIso);
    await upsertMetaKey(txn, META_KEYS.LAST_SYNC_ERROR, "", nowIso);
    await upsertMetaKey(txn, META_KEYS.CATALOG_READY, "1", nowIso);

    if (params.syncType === "full") {
      await upsertMetaKey(
        txn,
        META_KEYS.LAST_FULL_SYNC_AT,
        params.fullSyncIso ?? nowIso,
        nowIso
      );
      if (params.fullSyncWibDate) {
        await upsertMetaKey(
          txn,
          META_KEYS.LAST_FULL_SYNC_WIB_DATE,
          params.fullSyncWibDate,
          nowIso
        );
      }
    }

    if (params.writeAuditRow !== false) {
      await txn.runAsync(
        `INSERT INTO sync_audit (
           sync_type, trigger_source, used_route,
           product_count, deleted_count, server_time,
           status, error_message, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, 'success', NULL, ?)`,
        params.syncType,
        params.triggerSource,
        params.usedRoute,
        params.productCount,
        params.deletedCount,
        params.serverTime,
        nowIso
      );

      await txn.runAsync(
        `DELETE FROM sync_audit
         WHERE id NOT IN (
           SELECT id FROM sync_audit ORDER BY id DESC LIMIT 50
         )`
      );
    }
  });
}

export async function recordSyncError(params: {
  syncType: "full" | "delta";
  triggerSource: SyncAuditRecord["triggerSource"];
  errorMessage: string;
}): Promise<void> {
  const nowIso = new Date().toISOString();
  await runInCatalogWriteTransaction(async (txn) => {
    await upsertMetaKey(
      txn,
      META_KEYS.LAST_SYNC_ERROR,
      params.errorMessage,
      nowIso
    );

    await txn.runAsync(
      `INSERT INTO sync_audit (
         sync_type, trigger_source, used_route,
         product_count, deleted_count, server_time,
         status, error_message, created_at
       ) VALUES (?, ?, NULL, 0, 0, NULL, 'error', ?, ?)`,
      params.syncType,
      params.triggerSource,
      params.errorMessage,
      nowIso
    );

    await txn.runAsync(
      `DELETE FROM sync_audit
       WHERE id NOT IN (
         SELECT id FROM sync_audit ORDER BY id DESC LIMIT 50
       )`
    );
  });
}

export async function getRecentSyncAudits(
  limit = 10
): Promise<SyncAuditRecord[]> {
  const db = await getCatalogDatabase();
  const rows = await db.getAllAsync<AuditRow>(
    `SELECT * FROM sync_audit ORDER BY id DESC LIMIT ?`,
    Math.max(1, limit)
  );
  return rows.map((row) => ({
    id: row.id,
    syncType: row.sync_type,
    triggerSource: row.trigger_source,
    usedRoute: row.used_route,
    productCount: Number(row.product_count ?? 0),
    deletedCount: Number(row.deleted_count ?? 0),
    serverTime: row.server_time,
    status: row.status,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  }));
}

/**
 * Resets only the local catalog SQLite tables (`products`, `categories`, `units`,
 * `sync_meta`, `sync_audit`), intentionally leaving auth session, dual server URLs,
 * and held orders in `SecureStore` / `kv-store` untouched (`D-10`).
 */
export async function resetCatalogCache(): Promise<void> {
  await resetCatalogTables();
  emitCatalogChanged();
}
