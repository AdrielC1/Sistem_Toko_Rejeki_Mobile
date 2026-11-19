import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { RefreshCw, TriangleAlert } from "lucide-react-native";
import { SecondaryButton } from "@/components/ui/VelocityPrimitives";
import { useSyncEngine } from "@/context/SyncEngineContext";
import { FONT_FAMILY, TOKENS } from "@/theme/tokens";

export interface InitialSyncBannerProps {
  testID?: string;
}

export function InitialSyncBanner({ testID }: InitialSyncBannerProps) {
  const { catalogReady, isSyncing, lastError, triggerSyncNow } =
    useSyncEngine();

  if (catalogReady) {
    return null;
  }

  if (isSyncing) {
    return (
      <View
        testID={testID ?? "initial-sync-banner-loading"}
        style={[styles.banner, styles.bannerSyncing]}
      >
        <RefreshCw size={16} color={TOKENS.colors.onPrimaryFixed} />
        <View style={styles.textWrap}>
          <Text style={styles.titleText}>Menyiapkan Katalog Awal</Text>
          <Text style={styles.subtitleText}>
            Mengunduh produk, kategori, dan satuan dari server...
          </Text>
        </View>
      </View>
    );
  }

  if (!lastError) {
    return null;
  }

  return (
    <View
      testID={testID ?? "initial-sync-banner-error"}
      style={[styles.banner, styles.bannerError]}
    >
      <View style={styles.errorHeader}>
        <TriangleAlert size={16} color={TOKENS.colors.warningText} />
        <Text style={styles.errorTitle}>Katalog Awal Belum Tersedia</Text>
      </View>
      <Text style={styles.errorMessage}>{lastError}</Text>
      <SecondaryButton
        testID="initial-sync-retry-button"
        variant="tonal"
        label="Coba Sinkronisasi Lagi"
        onPress={() => {
          void triggerSyncNow({ forceFull: true });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: TOKENS.spacing.md,
    marginTop: TOKENS.spacing.sm,
    padding: TOKENS.spacing.md,
    borderRadius: TOKENS.radii.md,
    borderWidth: 1,
  },
  bannerSyncing: {
    backgroundColor: TOKENS.colors.primaryFixed,
    borderColor: TOKENS.colors.borderSubtle,
    flexDirection: "row",
    alignItems: "center",
    gap: TOKENS.spacing.sm,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  titleText: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onPrimaryFixed,
  },
  subtitleText: {
    fontFamily: FONT_FAMILY.body,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurfaceVariant,
  },
  bannerError: {
    backgroundColor: TOKENS.colors.warningBg,
    borderColor: TOKENS.colors.warningBorder,
    gap: TOKENS.spacing.sm,
  },
  errorHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: TOKENS.spacing.xs,
  },
  errorTitle: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.warningText,
  },
  errorMessage: {
    fontFamily: FONT_FAMILY.body,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.warningText,
  },
});
