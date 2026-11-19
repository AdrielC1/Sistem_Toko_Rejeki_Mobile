import {
  applyDeltaCatalogBatch,
  applyFullCatalogReplace,
} from "@/db/catalogRepo";
import {
  getSyncMetaState,
  recordSyncError,
  recordSyncSuccess,
} from "@/db/syncMetaRepo";
import {
  fetchDeltaCatalogSync,
  fetchFullCatalogSync,
  SyncTransportError,
  type SyncErrorCode,
} from "@/services/api/syncApi";
import { getOrCreateClientIdSync } from "@/services/storage/secureStorage";
import { emitCatalogChanged } from "@/sync/catalogEvents";
import { syncMutex } from "@/sync/syncMutex";
import type {
  ServerUrlConfig,
  SyncAuditRecord,
  SyncResult,
} from "@/types";

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const STALE_FULL_SYNC_THRESHOLD_MS = 48 * 60 * 60 * 1000;

export interface WibDateTime {
  dateStr: string;
  hour: number;
  minute: number;
  tenAmWibUtcMs: number;
}

/**
 * Pure UTC+7 (`Asia/Jakarta`) date & hour calculator without device timezone or Intl dependencies.
 */
export function getWIBDateTime(nowMs: number = Date.now()): WibDateTime {
  const shifted = new Date(nowMs + WIB_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const monthIdx = shifted.getUTCMonth();
  const dayNum = shifted.getUTCDate();
  const month = String(monthIdx + 1).padStart(2, "0");
  const day = String(dayNum).padStart(2, "0");
  // 10:00 WIB equals 03:00 UTC on the same calendar date in Jakarta.
  const tenAmWibUtcMs = Date.UTC(year, monthIdx, dayNum, 3, 0, 0, 0);
  return {
    dateStr: `${year}-${month}-${day}`,
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    tenAmWibUtcMs,
  };
}

function generateHermesUuidV4(): string {
  const gCrypto = (
    globalThis as unknown as {
      crypto?: {
        randomUUID?: () => string;
        getRandomValues?: (arr: Uint8Array) => Uint8Array;
      };
    }
  ).crypto;

  if (typeof gCrypto?.randomUUID === "function") {
    return gCrypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof gCrypto?.getRandomValues === "function") {
    gCrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
    .slice(6, 8)
    .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}

export function getMobileClientId(): string {
  return getOrCreateClientIdSync(generateHermesUuidV4);
}

export interface SyncPlan {
  mode: "full" | "delta";
  trigger: SyncAuditRecord["triggerSource"];
  since: string | null;
}

export async function evaluateSyncPlan(
  nowMs: number = Date.now(),
  defaultTrigger: SyncAuditRecord["triggerSource"] = "foreground"
): Promise<SyncPlan> {
  const meta = await getSyncMetaState();

  if (!meta.catalogReady || !meta.lastSyncAt) {
    return {
      mode: "full",
      trigger: defaultTrigger === "manual" ? "manual" : "boot",
      since: null,
    };
  }

  const wib = getWIBDateTime(nowMs);
  const lastFullMs = meta.lastFullSyncAt ? Date.parse(meta.lastFullSyncAt) : NaN;
  if (
    nowMs >= wib.tenAmWibUtcMs &&
    (!Number.isFinite(lastFullMs) || lastFullMs < wib.tenAmWibUtcMs)
  ) {
    return {
      mode: "full",
      trigger: "scheduled_10am_wib",
      since: null,
    };
  }

  if (
    !Number.isFinite(lastFullMs) ||
    nowMs - lastFullMs > STALE_FULL_SYNC_THRESHOLD_MS
  ) {
    return {
      mode: "full",
      trigger: "stale_48h",
      since: null,
    };
  }

  return {
    mode: "delta",
    trigger: defaultTrigger,
    since: meta.lastSyncAt,
  };
}

export interface ExtendedSyncResult extends SyncResult {
  errorCode?: SyncErrorCode;
}

export async function runSyncCycle(
  config: ServerUrlConfig,
  options?: {
    forceFull?: boolean;
    trigger?: SyncAuditRecord["triggerSource"];
    nowMs?: number;
  }
): Promise<ExtendedSyncResult> {
  return syncMutex.runExclusive(async () => {
    const nowMs = options?.nowMs ?? Date.now();
    const defaultTrigger = options?.trigger ?? "foreground";

    if (!config.primaryUrl && !config.fallbackUrl) {
      return {
        synced: false,
        mode: "skipped",
        trigger: defaultTrigger,
        upsertedProducts: 0,
        deletedProducts: 0,
        serverTime: null,
        usedRoute: null,
        error: "Alamat server belum dikonfigurasi.",
      };
    }

    const plan = await evaluateSyncPlan(nowMs, defaultTrigger);
    const mode: "full" | "delta" = options?.forceFull ? "full" : plan.mode;
    const trigger: SyncAuditRecord["triggerSource"] =
      options?.trigger ?? plan.trigger;
    const clientId = getMobileClientId();
    const wib = getWIBDateTime(nowMs);

    try {
      if (mode === "full") {
        const { data, usedRoute } = await fetchFullCatalogSync(config, clientId);
        const applied = await applyFullCatalogReplace(data);
        await recordSyncSuccess({
          syncType: "full",
          triggerSource: trigger,
          usedRoute,
          productCount: applied.productCount,
          deletedCount: 0,
          serverTime: data.serverTime,
          fullSyncWibDate: wib.dateStr,
          fullSyncIso: new Date(nowMs).toISOString(),
          writeAuditRow: true,
        });
        emitCatalogChanged();
        return {
          synced: true,
          mode: "full",
          trigger,
          upsertedProducts: applied.productCount,
          deletedProducts: 0,
          serverTime: data.serverTime,
          usedRoute,
        };
      }

      const since = plan.since ?? new Date(nowMs).toISOString();
      const { data, usedRoute } = await fetchDeltaCatalogSync(
        config,
        since,
        clientId
      );
      const hasChanges =
        Boolean(data.hasChanges) ||
        (data.products?.length ?? 0) > 0 ||
        (data.deletedProductIds?.length ?? 0) > 0 ||
        (data.categories?.length ?? 0) > 0 ||
        (data.deletedCategoryIds?.length ?? 0) > 0 ||
        (data.units?.length ?? 0) > 0 ||
        (data.deletedUnitIds?.length ?? 0) > 0;

      let upsertedProducts = 0;
      let deletedProducts = 0;

      if (hasChanges) {
        const applied = await applyDeltaCatalogBatch(data);
        upsertedProducts = applied.upsertedProducts;
        deletedProducts = applied.deletedProducts;
      }

      const hasEntityChanges =
        hasChanges &&
        (upsertedProducts > 0 ||
          deletedProducts > 0 ||
          (data.categories?.length ?? 0) > 0 ||
          (data.deletedCategoryIds?.length ?? 0) > 0 ||
          (data.units?.length ?? 0) > 0 ||
          (data.deletedUnitIds?.length ?? 0) > 0);

      await recordSyncSuccess({
        syncType: "delta",
        triggerSource: trigger,
        usedRoute,
        productCount: upsertedProducts,
        deletedCount: deletedProducts,
        serverTime: data.serverTime,
        writeAuditRow: hasEntityChanges || trigger !== "foreground",
      });

      if (hasEntityChanges) {
        emitCatalogChanged();
      }

      return {
        synced: true,
        mode: "delta",
        trigger,
        upsertedProducts,
        deletedProducts,
        serverTime: data.serverTime,
        usedRoute,
      };
    } catch (err) {
      const errorCode =
        err instanceof SyncTransportError ? err.code : "HTTP_ERROR";
      const message =
        err instanceof Error
          ? err.message
          : "Sinkronisasi katalog gagal.";

      try {
        await recordSyncError({
          syncType: mode,
          triggerSource: trigger,
          errorMessage: message,
        });
      } catch {
        // Ignore audit write failure when storage is locked
      }

      return {
        synced: false,
        mode,
        trigger,
        upsertedProducts: 0,
        deletedProducts: 0,
        serverTime: null,
        usedRoute: null,
        error: message,
        errorCode,
      };
    }
  });
}
