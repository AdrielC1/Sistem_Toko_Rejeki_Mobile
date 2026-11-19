import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  Check,
  Database,
  Layers,
  RefreshCw,
  Smartphone,
  Store,
  Trash2,
} from "lucide-react-native";
import {
  FeedbackBanner,
  SecondaryButton,
  SurfaceCard,
} from "@/components/ui/VelocityPrimitives";
import { ResetCacheConfirmModal } from "@/components/pengaturan/ResetCacheConfirmModal";
import { useSyncEngine } from "@/context/SyncEngineContext";
import { useSystemStatus } from "@/context/SystemStatusContext";
import {
  useCatalogScopeStore,
  type CatalogScope,
} from "@/store/catalogScopeStore";
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
  const wib = new Date(ms + 7 * 60 * 60 * 1000);
  const dd = String(wib.getUTCDate()).padStart(2, "0");
  const mm = String(wib.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = wib.getUTCFullYear();
  const hh = String(wib.getUTCHours()).padStart(2, "0");
  const min = String(wib.getUTCMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min} WIB`;
}

const CATALOG_SCOPE_OPTIONS: {
  id: CatalogScope;
  title: string;
  subtitle: string;
}[] = [
  {
    id: "main",
    title: "Katalog Utama",
    subtitle: "Basis data produk utama toko",
  },
  {
    id: "mini",
    title: "Katalog Mini",
    subtitle: "Katalog ringkas khusus perangkat mobile",
  },
];

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

  const activeScope = useCatalogScopeStore((s) => s.scope);
  const setScope = useCatalogScopeStore((s) => s.setScope);

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

  const handleSelectScope = async (nextScope: CatalogScope) => {
    if (nextScope === activeScope || isSyncing || isResetting) {
      return;
    }
    setScope(nextScope);
    setActionBanner(null);
    setIsResetting(true);
    try {
      await resetLocalCache();
      const res = await triggerSyncNow({ forceFull: true, trigger: "manual" });
      const scopeName =
        nextScope === "main" ? "Katalog Utama" : "Katalog Mini";
      if (res.synced) {
        setActionBanner({
          variant: "success",
          message: `Beralih ke ${scopeName} (${res.upsertedProducts} produk disinkronkan).`,
        });
      } else {
        setActionBanner({
          variant: "error",
          message:
            res.error ??
            `Sumber diubah ke ${scopeName}. Katalog akan diunduh saat server online.`,
        });
      }
    } finally {
      setIsResetting(false);
    }
  };

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
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <View style={styles.headerIconBox}>
            <Database size={18} color={TOKENS.colors.primary} />
          </View>
          <View style={styles.headerTitleCol}>
            <Text accessibilityRole="header" style={styles.titleText}>
              Sinkronisasi &amp; Cache Katalog
            </Text>
            <Text testID="sync-card-counts" style={styles.countsSubText}>
              {`${catalogCounts.products} produk · ${catalogCounts.categories} kategori · ${catalogCounts.units} satuan`}
            </Text>
          </View>
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

      {/* Pilihan Sumber Katalog Aktif (Utama vs Mini) */}
      <View style={styles.scopeSection}>
        <View style={styles.scopeHeaderRow}>
          <Layers size={14} color={TOKENS.colors.primary} />
          <Text style={styles.scopeSectionTitle}>
            Sumber Katalog yang Digunakan
          </Text>
        </View>
        <View style={styles.scopeOptionsRow}>
          {CATALOG_SCOPE_OPTIONS.map((opt) => {
            const isSelected = activeScope === opt.id;
            return (
              <Pressable
                key={opt.id}
                testID={`catalog-scope-${opt.id}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                disabled={isSyncing || isResetting}
                onPress={() => {
                  void handleSelectScope(opt.id);
                }}
                style={({ pressed }) => [
                  styles.scopeOptionCard,
                  isSelected && styles.scopeOptionCardActive,
                  (isSyncing || isResetting) && styles.disabledControl,
                  pressed && styles.pressedItem,
                ]}
              >
                <View style={styles.scopeOptionTop}>
                  <View
                    style={[
                      styles.scopeIconCircle,
                      isSelected && styles.scopeIconCircleActive,
                    ]}
                  >
                    {opt.id === "main" ? (
                      <Store
                        size={15}
                        color={
                          isSelected
                            ? TOKENS.colors.onPrimary
                            : TOKENS.colors.onSurfaceVariant
                        }
                      />
                    ) : (
                      <Smartphone
                        size={15}
                        color={
                          isSelected
                            ? TOKENS.colors.onPrimary
                            : TOKENS.colors.onSurfaceVariant
                        }
                      />
                    )}
                  </View>
                  {isSelected ? (
                    <View style={styles.scopeCheckBadge}>
                      <Check size={12} color={TOKENS.colors.onPrimary} />
                    </View>
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.scopeOptionTitle,
                    isSelected && styles.scopeOptionTitleActive,
                  ]}
                >
                  {opt.title}
                </Text>
                <Text
                  style={[
                    styles.scopeOptionSub,
                    isSelected && styles.scopeOptionSubActive,
                  ]}
                >
                  {opt.subtitle}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* 3-Column Metrics Grid + Detail Metadata (Tidak Mentok / Terpotong) */}
      <View style={styles.statsContainer}>
        <View style={styles.metricsGrid}>
          <View style={styles.metricTile}>
            <Text style={styles.metricNumber}>{catalogCounts.products}</Text>
            <Text style={styles.metricLabel}>Produk</Text>
          </View>
          <View style={styles.metricTile}>
            <Text style={styles.metricNumber}>{catalogCounts.categories}</Text>
            <Text style={styles.metricLabel}>Kategori</Text>
          </View>
          <View style={styles.metricTile}>
            <Text style={styles.metricNumber}>{catalogCounts.units}</Text>
            <Text style={styles.metricLabel}>Satuan</Text>
          </View>
        </View>

        <View style={styles.metaRowsWrap}>
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
            <Text style={styles.statValue}>
              {formatIsoTimestamp(lastSyncAt)}
            </Text>
          </View>
          <View style={styles.statLine}>
            <Text style={styles.statLabel}>Full Sync Terakhir</Text>
            <Text style={styles.statValue}>
              {formatIsoTimestamp(lastFullSyncAt)}
            </Text>
          </View>
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

      {/* Tombol Aksi Sinkronisasi & Reset Cache */}
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
          variant="danger-outline"
          label="Reset Cache Lokal"
          disabled={isSyncing || isResetting}
          icon={<Trash2 size={16} color={TOKENS.colors.destructive} />}
          onPress={() => setConfirmResetOpen(true)}
        />
      </View>

      {audits.length > 0 ? (
        <View style={styles.auditWrap}>
          <Text style={styles.auditHeading}>Riwayat Sinkronisasi Terbaru</Text>
          <View style={styles.auditList}>
            {audits.map((row) => (
              <View key={row.id} style={styles.auditRow}>
                <Text style={styles.auditType}>
                  {`${row.syncType.toUpperCase()} (${row.triggerSource})`}
                </Text>
                <Text style={styles.auditDetail}>
                  {row.status === "success"
                    ? `${row.productCount} item · ${row.usedRoute?.toUpperCase() ?? "-"}`
                    : (row.errorMessage ?? "Error")}
                </Text>
              </View>
            ))}
          </View>
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
    gap: 14,
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
    gap: 10,
  },
  headerIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: TOKENS.colors.primaryFixed,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  headerTitleCol: {
    flex: 1,
    gap: 2,
  },
  titleText: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: 16,
    lineHeight: 20,
    color: TOKENS.colors.onSurface,
  },
  countsSubText: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 12,
    lineHeight: 16,
    color: TOKENS.colors.onSurfaceVariant,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    flexShrink: 0,
  },
  statusBadgeText: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  scopeSection: {
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    padding: 12,
    gap: 10,
  },
  scopeHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  scopeSectionTitle: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: TOKENS.colors.onSurface,
  },
  scopeOptionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  scopeOptionCard: {
    flex: 1,
    backgroundColor: TOKENS.colors.surfaceCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    padding: 10,
    gap: 4,
  },
  scopeOptionCardActive: {
    backgroundColor: TOKENS.colors.primaryFixed,
    borderColor: TOKENS.colors.primary,
  },
  scopeOptionTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  scopeIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: TOKENS.colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  scopeIconCircleActive: {
    backgroundColor: TOKENS.colors.primary,
  },
  scopeCheckBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: TOKENS.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  scopeOptionTitle: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: 13,
    lineHeight: 17,
    color: TOKENS.colors.onSurface,
  },
  scopeOptionTitleActive: {
    color: TOKENS.colors.onPrimaryFixed,
  },
  scopeOptionSub: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 11,
    lineHeight: 15,
    color: TOKENS.colors.onSurfaceVariant,
  },
  scopeOptionSubActive: {
    color: TOKENS.colors.onPrimaryFixed,
  },
  disabledControl: {
    opacity: 0.5,
  },
  pressedItem: {
    opacity: 0.84,
  },
  statsContainer: {
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    padding: 12,
    gap: 12,
  },
  metricsGrid: {
    flexDirection: "row",
    gap: 8,
  },
  metricTile: {
    flex: 1,
    backgroundColor: TOKENS.colors.surfaceCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 2,
  },
  metricNumber: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: 16,
    lineHeight: 20,
    color: TOKENS.colors.primary,
  },
  metricLabel: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 11,
    lineHeight: 15,
    color: TOKENS.colors.onSurfaceVariant,
  },
  metaRowsWrap: {
    gap: 8,
    paddingHorizontal: 2,
  },
  statLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: TOKENS.spacing.sm,
  },
  statLabel: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 12,
    lineHeight: 16,
    color: TOKENS.colors.onSurfaceVariant,
  },
  statValue: {
    flexShrink: 1,
    textAlign: "right",
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: TOKENS.colors.onSurface,
  },
  actionsStack: {
    gap: 10,
  },
  auditWrap: {
    borderTopWidth: 1,
    borderTopColor: TOKENS.colors.borderSubtle,
    paddingTop: 12,
    gap: 8,
  },
  auditHeading: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: TOKENS.colors.onSurfaceVariant,
  },
  auditList: {
    gap: 6,
  },
  auditRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: TOKENS.spacing.sm,
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  auditType: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: TOKENS.colors.onSurface,
  },
  auditDetail: {
    flexShrink: 1,
    textAlign: "right",
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: TOKENS.colors.onSurfaceVariant,
  },
});
