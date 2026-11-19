import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, Info, Server, Smartphone } from "lucide-react-native";
import { RoleBadge } from "@/components/common/RoleBadge";
import { SurfaceCard } from "@/components/ui/VelocityPrimitives";
import { useAuth } from "@/context/AuthContext";
import { useSyncEngine } from "@/context/SyncEngineContext";
import { useSystemStatus } from "@/context/SystemStatusContext";
import { FONT_FAMILY, TOKENS } from "@/theme/tokens";

export default function PengaturanAboutScreen() {
  const router = useRouter();
  const { user, role, storeSettings, serverConfig } = useAuth();
  const { healthState, activeRoute, latencyMs } = useSystemStatus();
  const { catalogCounts } = useSyncEngine();

  const appVersion = Constants.expoConfig?.version ?? "1.0.0";
  const storeName = storeSettings?.storeName?.trim() || "Toko Rejeki";
  const storeLogo = storeSettings?.storeLogo?.trim() || "";

  const statusText =
    healthState === "online"
      ? activeRoute === "cloud"
        ? `Cloud Online (${latencyMs ?? "-"} ms)`
        : `LAN Online (${latencyMs ?? "-"} ms)`
      : healthState === "read_only"
        ? "Standby Baca Saja (DB Offline)"
        : "Offline";

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={["top"]} style={styles.topBar}>
        <Pressable
          testID="about-back-button"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <ChevronLeft size={22} color={TOKENS.colors.onSurface} />
        </Pressable>
        <Text style={styles.topTitle}>Profil Toko &amp; Tentang Aplikasi</Text>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <SurfaceCard testID="about-store-card" style={styles.storeCard}>
          <View style={styles.logoFrame}>
            {storeLogo ? (
              <Image
                source={{ uri: storeLogo }}
                style={styles.logoImage}
                resizeMode="cover"
              />
            ) : (
              <Text style={styles.logoMonogram}>TR</Text>
            )}
          </View>
          <Text testID="about-store-name" style={styles.storeHeading}>
            {storeName}
          </Text>
          {storeSettings?.storeAddress ? (
            <Text style={styles.storeMeta}>{storeSettings.storeAddress}</Text>
          ) : null}
          {storeSettings?.storePhone ? (
            <Text style={styles.storeMeta}>
              {`Telp: ${storeSettings.storePhone}`}
            </Text>
          ) : null}
          {role ? <RoleBadge role={role} /> : null}
          {user ? (
            <Text style={styles.operatorText}>
              {`Masuk sebagai ${user.fullName} (@${user.username})`}
            </Text>
          ) : null}
        </SurfaceCard>

        <SurfaceCard testID="about-app-info-card" style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Smartphone size={18} color={TOKENS.colors.primary} />
            <Text style={styles.sectionHeading}>Tentang Aplikasi Mobile</Text>
          </View>

          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Nama Aplikasi</Text>
            <Text style={styles.kvValue}>Apps Toko Rejeki Mobile POS</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Versi Rilis</Text>
            <Text testID="about-app-version" style={styles.kvMono}>
              {`v${appVersion}`}
            </Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Arsitektur</Text>
            <Text style={styles.kvValue}>
              Expo SDK 58 · Router · TypeScript
            </Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Pengembang</Text>
            <Text style={styles.kvValue}>Tim Pengembang Toko Rejeki</Text>
          </View>
        </SurfaceCard>

        <SurfaceCard testID="about-connection-card" style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Server size={18} color={TOKENS.colors.primary} />
            <Text style={styles.sectionHeading}>Status Layanan API</Text>
          </View>

          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Status Koneksi</Text>
            <Text style={styles.kvMono}>{statusText}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>LAN Utama</Text>
            <Text style={styles.kvMono}>
              {serverConfig.primaryUrl || "Tidak diset"}
            </Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Cloud Cadangan</Text>
            <Text style={styles.kvMono}>
              {serverConfig.fallbackUrl || "Tidak diset"}
            </Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Data Katalog Lokal</Text>
            <Text style={styles.kvMono}>
              {`${catalogCounts.products} produk · ${catalogCounts.categories} kategori`}
            </Text>
          </View>
        </SurfaceCard>

        <SurfaceCard style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Info size={18} color={TOKENS.colors.primary} />
            <Text style={styles.sectionHeading}>Ketahanan Offline</Text>
          </View>
          <Text style={styles.storeMeta}>
            Katalog barang, harga grosir, multi-satuan, dan nota tertunda tetap
            dapat diakses penuh melalui SQLite lokal saat koneksi LAN/Cloud
            terputus.
          </Text>
        </SurfaceCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: TOKENS.colors.background,
  },
  topBar: {
    backgroundColor: TOKENS.colors.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.colors.borderSubtle,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: TOKENS.spacing.sm,
    paddingBottom: TOKENS.spacing.sm,
    gap: TOKENS.spacing.sm,
  },
  backBtn: {
    width: TOKENS.spacing.touchTarget,
    height: TOKENS.spacing.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    flex: 1,
    fontFamily: FONT_FAMILY.heading,
    fontSize: TOKENS.typography.heading,
    lineHeight: TOKENS.lineHeight.heading,
    color: TOKENS.colors.onSurface,
  },
  scrollContent: {
    padding: TOKENS.spacing.md,
    gap: TOKENS.spacing.md,
  },
  storeCard: {
    alignItems: "center",
    gap: TOKENS.spacing.xs,
  },
  logoFrame: {
    width: TOKENS.spacing.logoBox,
    height: TOKENS.spacing.logoBox,
    borderRadius: TOKENS.radii.md,
    backgroundColor: TOKENS.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: TOKENS.spacing.xs,
  },
  logoImage: {
    width: TOKENS.spacing.logoBox,
    height: TOKENS.spacing.logoBox,
  },
  logoMonogram: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: TOKENS.typography.display,
    color: TOKENS.colors.onPrimary,
  },
  storeHeading: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: TOKENS.typography.heading,
    lineHeight: TOKENS.lineHeight.heading,
    color: TOKENS.colors.onSurface,
    textAlign: "center",
  },
  storeMeta: {
    fontFamily: FONT_FAMILY.body,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurfaceVariant,
    textAlign: "center",
  },
  operatorText: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurface,
    marginTop: TOKENS.spacing.xs,
  },
  card: {
    gap: TOKENS.spacing.sm,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: TOKENS.spacing.sm,
  },
  sectionHeading: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: TOKENS.typography.body,
    lineHeight: TOKENS.lineHeight.body,
    color: TOKENS.colors.onSurface,
  },
  kvRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: TOKENS.spacing.sm,
    paddingVertical: TOKENS.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: TOKENS.colors.borderSubtle,
  },
  kvLabel: {
    fontFamily: FONT_FAMILY.body,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurfaceVariant,
  },
  kvValue: {
    flexShrink: 1,
    textAlign: "right",
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurface,
  },
  kvMono: {
    flexShrink: 1,
    textAlign: "right",
    fontFamily: FONT_FAMILY.mono,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurface,
  },
});
