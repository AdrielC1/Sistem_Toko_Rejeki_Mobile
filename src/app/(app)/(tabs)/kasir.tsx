import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Calculator, Settings } from "lucide-react-native";
import { RoleBadge } from "@/components/common/RoleBadge";
import { TabScreenHeader } from "@/components/common/TabScreenHeader";
import {
  FeedbackBanner,
  PrimaryButton,
  SurfaceCard,
} from "@/components/ui/VelocityPrimitives";
import { useAuth } from "@/context/AuthContext";
import { FONT_FAMILY, TOKENS } from "@/theme/tokens";

export default function KasirScreen() {
  const router = useRouter();
  const { user, role, storeSettings } = useAuth();

  const activeRole = role ?? "kasir";
  const displayFullName = user?.fullName?.trim() || "Staf Kasir";
  const storeName = storeSettings?.storeName?.trim() || "Toko Rejeki";

  return (
    <View style={styles.screen}>
      <TabScreenHeader
        testID="kasir-header"
        title="Kasir"
        icon={<Calculator size={24} color={TOKENS.colors.primary} />}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SurfaceCard testID="kasir-welcome-card" style={styles.focalCard}>
          <View style={styles.greetingHeader}>
            <View style={styles.greetingTextGroup}>
              <Text style={styles.storeLabel}>{storeName}</Text>
              <Text testID="kasir-greeting-text" style={styles.greetingHeading}>
                {`Halo, ${displayFullName}`}
              </Text>
            </View>
            <RoleBadge role={activeRole} testID="kasir-role-badge" />
          </View>

          <FeedbackBanner
            testID="kasir-phase1-status"
            variant="info"
            title="Sesi Kasir Siap Offline"
            message="Autentikasi dan identitas kasir tersimpan lokal di perangkat sehingga terminal tetap terbuka saat jaringan toko terputus. Modul katalog dan nota kasir akan aktif setelah sinkronisasi lokal selesai dibangun."
          />

          <PrimaryButton
            testID="kasir-open-settings-button"
            label="Buka Pengaturan Server"
            icon={<Settings size={18} color={TOKENS.colors.onPrimary} />}
            onPress={() => {
              router.push("/pengaturan");
            }}
          />
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
  scrollContent: {
    paddingHorizontal: TOKENS.spacing.md,
    paddingTop: TOKENS.spacing.md,
    paddingBottom: TOKENS.spacing.lg,
    gap: TOKENS.spacing.md,
  },
  focalCard: {
    gap: TOKENS.spacing.md,
  },
  greetingHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: TOKENS.spacing.sm,
  },
  greetingTextGroup: {
    flex: 1,
    minWidth: 180,
    gap: TOKENS.spacing.xs,
  },
  storeLabel: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.primary,
  },
  greetingHeading: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: TOKENS.typography.heading,
    lineHeight: TOKENS.lineHeight.heading,
    color: TOKENS.colors.onSurface,
  },
});
