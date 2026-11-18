import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Package, Settings, ShieldCheck } from "lucide-react-native";
import { EmptyStateCard } from "@/components/common/EmptyStateCard";
import { TabScreenHeader } from "@/components/common/TabScreenHeader";
import { SecondaryButton } from "@/components/ui/VelocityPrimitives";
import { useAuth } from "@/context/AuthContext";
import { FONT_FAMILY, TOKENS } from "@/theme/tokens";

export default function ProdukScreen() {
  const router = useRouter();
  const { roleCapabilities } = useAuth();

  return (
    <View style={styles.screen}>
      <TabScreenHeader
        testID="produk-header"
        title="Produk"
        icon={<Package size={24} color={TOKENS.colors.primary} />}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {roleCapabilities.isReadOnlyCatalog ? (
          <View
            testID="produk-kasir-readonly-banner"
            accessibilityRole="alert"
            style={styles.kasirPolicyBanner}
          >
            <ShieldCheck
              size={20}
              color={TOKENS.colors.warningText}
              style={styles.policyIcon}
            />
            <View style={styles.policyTextGroup}>
              <Text style={styles.kasirPolicyHeading}>
                Mode Baca Saja (Kasir)
              </Text>
              <Text style={styles.kasirPolicyBody}>
                Akun Kasir hanya dapat melihat daftar produk dan harga jual.
                Harga modal dan aksi ubah produk disembunyikan.
              </Text>
            </View>
          </View>
        ) : roleCapabilities.canEditProducts ? (
          <View
            testID="produk-manage-policy-pill"
            style={styles.managePolicyPill}
          >
            <View style={styles.managePolicyHeader}>
              <ShieldCheck size={18} color={TOKENS.colors.onPrimaryFixed} />
              <Text style={styles.managePolicyTitle}>
                Mode Kelola Katalog Aktif
              </Text>
            </View>
            <Text style={styles.managePolicySubtext}>
              Izin tambah, ubah, dan kelola produk akan tersedia setelah
              sinkronisasi katalog lokal aktif.
            </Text>
          </View>
        ) : null}

        <EmptyStateCard
          testID="produk-empty-card"
          icon={<Package size={24} color={TOKENS.colors.primary} />}
          title="Katalog Produk Belum Tersinkronisasi"
          description="Daftar barang dan harga grosir akan tampil di sini setelah sinkronisasi SQLite aktif. Ketuk Periksa Koneksi di Pengaturan untuk melihat status server."
          action={
            <SecondaryButton
              testID="produk-open-settings-button"
              variant="outlined"
              label="Periksa Koneksi di Pengaturan"
              icon={<Settings size={18} color={TOKENS.colors.primary} />}
              onPress={() => {
                router.push("/pengaturan");
              }}
            />
          }
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: TOKENS.colors.background,
  },
  scrollContent: {
    paddingHorizontal: TOKENS.spacing.md,
    paddingTop: TOKENS.spacing.md,
    paddingBottom: TOKENS.spacing.lg,
    gap: TOKENS.spacing.md,
  },
  kasirPolicyBanner: {
    backgroundColor: TOKENS.colors.warningBg,
    borderWidth: 1,
    borderColor: TOKENS.colors.warning,
    borderRadius: TOKENS.radii.md,
    padding: TOKENS.spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: TOKENS.spacing.sm,
  },
  policyIcon: {
    marginTop: 2,
    flexShrink: 0,
  },
  policyTextGroup: {
    flex: 1,
    minWidth: 0,
    gap: TOKENS.spacing.xs,
  },
  kasirPolicyHeading: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.body,
    lineHeight: TOKENS.lineHeight.body,
    color: TOKENS.colors.warningText,
  },
  kasirPolicyBody: {
    fontFamily: FONT_FAMILY.body,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.warningText,
  },
  managePolicyPill: {
    backgroundColor: TOKENS.colors.primaryFixed,
    borderRadius: TOKENS.radii.md,
    padding: TOKENS.spacing.md,
    gap: TOKENS.spacing.xs,
  },
  managePolicyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: TOKENS.spacing.sm,
  },
  managePolicyTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.body,
    lineHeight: TOKENS.lineHeight.body,
    color: TOKENS.colors.onPrimaryFixed,
  },
  managePolicySubtext: {
    fontFamily: FONT_FAMILY.body,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onPrimaryFixed,
  },
});
