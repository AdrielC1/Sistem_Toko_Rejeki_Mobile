import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Database, RefreshCw } from "lucide-react-native";
import {
  FeedbackBanner,
  SecondaryButton,
  SurfaceCard,
} from "@/components/ui/VelocityPrimitives";
import { ResetCacheConfirmModal } from "@/components/pengaturan/ResetCacheConfirmModal";
import { useSyncEngine } from "@/context/SyncEngineContext";
import { useSystemStatus } from "@/context/SystemStatusContext";
import { FONT_FAMILY, TOKENS } from "@/theme/tokens";
import type { SyncAuditRecord } from "@/types";

function formatIsoTimestamp(iso: string | null): string {
  if (!iso) {
    return "Belum pernah";
  }
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) {
    return iso;
  }
  // Format as WIB (UTC+7) DD/MM/YYYY HH:mm without Intl dependency
  const wib = new Date(ms + 7 * 60 * 60 * 1000);
  const dd = String(wib.getUTCDate()).padStart(2, "0");
  const mm = String(wib.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = wib.getUTCFullYear();
  const hh = String(wib.getUTCHours()).padStart(2, "0");
  const min = String(wib.getUTCMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min} WIB`;
}

export function SyncControlCard() {
  const { activeRoute, healthState } = useSystemStatus();
  const {
    isSyncing,
    syncStatus,
    lastSyncAt,
    lastFullSyncAt,
    lastSyncRoute,
    lastError,
    catalogCounts,
    catalogVersion,
    triggerSyncNow,
    resetLocalCache,
    loadRecentAudits,
  } = useSyncEngine();

  const [audits, setAudits] = useState<SyncAuditRecord[]>([]);
  const [confirmResetOpen, setConfirmResetOpen] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [actionBanner, setActionBanner] = useState<{
    variant: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    void loadRecentAudits(4)
      .then((rows) => {
        if (active) {
          setAudits(rows);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [catalogVersion, loadRecentAudits]);

  const handleFullSyncNow = async () => {
    setActionBanner(null);
    const res = await triggerSyncNow({ forceFull: true, trigger: "manual" });
    if (res.synced) {
      setActionBanner({
        variant: "success",
        message: `Sinkronisasi penuh selesai (${res.upsertedProducts} produk).`,
      });
    } else {
      setActionBanner({
        variant: "error",
        message: res.error ?? "Sinkronisasi penuh gagal dijalankan.",
      });
    }
  };

  const handleConfirmReset = async () => {
    setIsResetting(true);
    setActionBanner(null);
    try {
      await resetLocalCache();
      setConfirmResetOpen(false);
      const res = await triggerSyncNow({ forceFull: true, trigger: "manual" });
      if (res.synced) {
        setActionBanner({
          variant: "success",
          message: `Cache direset dan ${res.upsertedProducts} produk berhasil diunduh ulang.`,
        });
      } else {
        setActionBanner({
          variant: "error",
          message:
            res.error ??
            "Cache lokal direset. Katalog akan diunduh saat server online.",
        });
      }
    } finally {
      setIsResetting(false);
    }
  };

  const routeLabel =
    healthState === "offline"
      ? "Offline"
      : activeRoute === "cloud"
        ? "Cloud Standby"
        : "LAN Lokal";

  const statusMeta =
    syncStatus === "error"
      ? {
          bg: TOKENS.colors.errorContainer,
          color: TOKENS.colors.onErrorContainer,
          label: "Gagal Sinkron",
        }
      : syncStatus === "paused_offline"
        ? {
            bg: TOKENS.colors.warningBg,
            color: TOKENS.colors.warningText,
            label: "Jeda Offline",
          }
        : isSyncing
          ? {
              bg: TOKENS.colors.primaryFixed,
              color: TOKENS.colors.onPrimaryFixed,
              label: "Menyinkronkan...",
            }
          : {
              bg: TOKENS.colors.successBg,
              color: TOKENS.colors.successText,
              label: "Tersinkron",
            };

  return (
    <SurfaceCard testID="pengaturan-sync-control-card" style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Database size={18} color={TOKENS.colors.primary} />
          <Text accessibilityRole="header" style={styles.titleText}>
            Sinkronisasi & Cache Katalog
          </Text>
        </View>
        <View
          testID="sync-card-status-badge"
          style={[styles.statusBadge, { backgroundColor: statusMeta.bg }]}
        >
          <Text style={[styles.statusBadgeText, { color: statusMeta.color }]}>
            {statusMeta.label}
          </Text>
        </View>
      </View>

      <View style={styles.statsBox}>
        <View style={styles.statLine}>
          <Text style={styles.statLabel}>Katalog Lokal</Text>
          <Text testID="sync-card-counts" style={styles.statValue}>
            {`${catalogCounts.products} produk · ${catalogCounts.categories} kategori · ${catalogCounts.units} satuan`}
          </Text>
        </View>
        <View style={styles.statLine}>
          <Text style={styles.statLabel}>Rute Aktif / Terakhir</Text>
          <Text style={styles.statValue}>
            {lastSyncRoute
              ? `${routeLabel} (${lastSyncRoute.toUpperCase()})`
              : routeLabel}
          </Text>
        </View>
        <View style={styles.statLine}>
          <Text style={styles.statLabel}>Sinkron Terakhir</Text>
          <Text style={styles.statValue}>{formatIsoTimestamp(lastSyncAt)}</Text>
        </View>
        <View style={styles.statLine}>
          <Text style={styles.statLabel}>Full Sync Terakhir</Text>
          <Text style={styles.statValue}>
            {formatIsoTimestamp(lastFullSyncAt)}
          </Text>
        </View>
      </View>

      {lastError ? (
        <FeedbackBanner
          testID="sync-card-last-error"
          variant="error"
          title="Kendala Sinkronisasi Terakhir"
          message={lastError}
        />
      ) : null}

      {actionBanner ? (
        <FeedbackBanner
          testID="sync-card-action-feedback"
          variant={actionBanner.variant}
          message={actionBanner.message}
        />
      ) : null}

      <View style={styles.actionsStack}>
        <SecondaryButton
          testID="sync-full-now-button"
          variant="tonal"
          label="Sinkronisasi Penuh Sekarang"
          loading={isSyncing}
          loadingLabel="Menyinkronkan Katalog..."
          disabled={isSyncing || isResetting}
          icon={<RefreshCw size={16} color={TOKENS.colors.onPrimaryFixed} />}
          onPress={() => {
            void handleFullSyncNow();
          }}
        />
        <SecondaryButton
          testID="sync-reset-cache-button"
          variant="danger"
          label="Reset Cache Lokal"
          disabled={isSyncing || isResetting}
          onPress={() => setConfirmResetOpen(true)}
        />
      </View>

      {audits.length > 0 ? (
        <View style={styles.auditWrap}>
          <Text style={styles.auditHeading}>Riwayat Sinkronisasi Terbaru</Text>
          {audits.map((row) => (
            <View key={row.id} style={styles.auditRow}>
              <Text style={styles.auditType}>
                {`${row.syncType.toUpperCase()} (${row.triggerSource})`}
              </Text>
              <Text style={styles.auditDetail}>
                {row.status === "success"
                  ? `${row.productCount} item · ${row.usedRoute?.toUpperCase() ?? "-"}`
                  : row.errorMessage ?? "Error"}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <ResetCacheConfirmModal
        visible={confirmResetOpen}
        productCount={catalogCounts.products}
        isSubmitting={isResetting}
        onCancel={() => setConfirmResetOpen(false)}
        onConfirm={() => {
          void handleConfirmReset();
        }}
      />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: TOKENS.spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: TOKENS.spacing.sm,
  },
  titleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: TOKENS.spacing.sm,
  },
  titleText: {
    flexShrink: 1,
    fontFamily: FONT_FAMILY.heading,
    fontSize: TOKENS.typography.body,
    lineHeight: TOKENS.lineHeight.body,
    color: TOKENS.colors.onSurface,
  },
  statusBadge: {
    paddingHorizontal: TOKENS.spacing.sm,
    paddingVertical: TOKENS.spacing.xs,
    borderRadius: TOKENS.radii.sm,
  },
  statusBadgeText: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
  },
  statsBox: {
    backgroundColor: TOKENS.colors.surfaceContainer,
    borderRadius: TOKENS.radii.md,
    padding: TOKENS.spacing.md,
    gap: TOKENS.spacing.xs,
  },
  statLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: TOKENS.spacing.sm,
  },
  statLabel: {
    fontFamily: FONT_FAMILY.body,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurfaceVariant,
  },
  statValue: {
    flexShrink: 1,
    textAlign: "right",
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurface,
  },
  actionsStack: {
    gap: TOKENS.spacing.sm,
  },
  auditWrap: {
    borderTopWidth: 1,
    borderTopColor: TOKENS.colors.borderSubtle,
    paddingTop: TOKENS.spacing.sm,
    gap: TOKENS.spacing.xs,
  },
  auditHeading: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurfaceVariant,
  },
  auditRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: TOKENS.spacing.sm,
  },
  auditType: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurface,
  },
  auditDetail: {
    flexShrink: 1,
    textAlign: "right",
    fontFamily: FONT_FAMILY.body,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurfaceVariant,
  },
});
