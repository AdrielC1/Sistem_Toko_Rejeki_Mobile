import React, { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  CheckCircle2,
  ChevronRight,
  Info,
  LogOut,
  Printer,
  Settings,
  ShieldCheck,
  Store,
  Tags,
  User,
  Users,
} from "lucide-react-native";
import { InitialSyncBanner } from "@/components/common/InitialSyncBanner";
import { LogoutConfirmModal } from "@/components/common/LogoutConfirmModal";
import { RoleBadge } from "@/components/common/RoleBadge";
import { ServerUrlPanel } from "@/components/common/ServerUrlPanel";
import { TabScreenHeader } from "@/components/common/TabScreenHeader";
import { SyncControlCard } from "@/components/pengaturan/SyncControlCard";
import {
  SecondaryButton,
  SurfaceCard,
} from "@/components/ui/VelocityPrimitives";
import { useAuth } from "@/context/AuthContext";
import { usePrinterPrefsStore } from "@/store/printerPrefsStore";
import { FONT_FAMILY, ROLE_STYLES, TOKENS } from "@/theme/tokens";

const PRINTER_MODE_SHORT = {
  server: "Server Toko",
  bluetooth: "Bluetooth ESC/POS",
  system: "HP / Sistem",
} as const;

export default function PengaturanScreen() {
  const router = useRouter();
  const {
    user,
    role,
    roleCapabilities,
    isLoggingOut,
    serverConfig,
    logout,
    saveServerConfig,
    testDualServerUrl,
  } = useAuth();
  const printerMode = usePrinterPrefsStore((s) => s.mode);
  const paperWidth = usePrinterPrefsStore((s) => s.bluetoothPaperWidth);

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const activeRole = role ?? "kasir";
  const roleStyle = ROLE_STYLES[activeRole];
  const displayFullName = user?.fullName?.trim() || "Staf Toko Rejeki";
  const displayUsername = user?.username?.trim() || "staf";

  const handleConfirmLogout = async () => {
    try {
      await logout();
    } finally {
      if (isMountedRef.current) {
        setShowLogoutModal(false);
      }
    }
  };

  return (
    <View style={styles.screen}>
      <TabScreenHeader
        testID="pengaturan-header"
        title="Pengaturan"
        icon={<Settings size={20} color={TOKENS.colors.primary} />}
        bannerSlot={<InitialSyncBanner />}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SurfaceCard testID="pengaturan-profile-card" style={styles.card}>
          <View style={styles.profileRow}>
            <View
              testID="pengaturan-profile-avatar"
              style={[
                styles.avatarBox,
                { backgroundColor: roleStyle.avatarBg },
              ]}
            >
              {roleStyle.icon === "shield-check" ? (
                <ShieldCheck size={30} color={TOKENS.colors.onPrimary} />
              ) : (
                <User size={30} color={TOKENS.colors.onPrimary} />
              )}
            </View>

            <View style={styles.profileDetails}>
              <Text
                testID="pengaturan-user-fullname"
                style={styles.profileFullName}
              >
                {displayFullName}
              </Text>
              <Text
                testID="pengaturan-user-username"
                style={styles.profileUsername}
              >
                {`@${displayUsername}`}
              </Text>
              <RoleBadge
                role={activeRole}
                testID="pengaturan-role-badge"
                style={styles.roleBadgeSpacing}
              />
            </View>
          </View>
        </SurfaceCard>

        <SurfaceCard testID="pengaturan-device-menu-card" style={styles.card}>
          <Text style={styles.cardHeading}>Perangkat &amp; Informasi</Text>

          <Pressable
            testID="pengaturan-nav-printer"
            accessibilityRole="button"
            onPress={() => router.push("/pengaturan/printer")}
            style={({ pressed }) => [
              styles.menuItemRow,
              pressed && styles.menuItemPressed,
            ]}
          >
            <View style={styles.menuItemLeft}>
              <Printer size={18} color={TOKENS.colors.primary} />
              <View style={styles.menuTextCol}>
                <Text style={styles.menuTitle}>Printer &amp; Metode Cetak</Text>
                <Text style={styles.menuSubtitle}>
                  {`Aktif: ${PRINTER_MODE_SHORT[printerMode]} · Kertas ${paperWidth}mm`}
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color={TOKENS.colors.outline} />
          </Pressable>
        </SurfaceCard>

        {roleCapabilities.canManageStore ? (
          <SurfaceCard testID="pengaturan-owner-menu-card" style={styles.card}>
            <Text style={styles.cardHeading}>Manajemen Toko (Owner)</Text>

            <Pressable
              testID="pengaturan-nav-store-profile"
              accessibilityRole="button"
              onPress={() => router.push("/pengaturan/store-profile")}
              style={({ pressed }) => [
                styles.menuItemRow,
                pressed && styles.menuItemPressed,
              ]}
            >
              <View style={styles.menuItemLeft}>
                <Store size={18} color={TOKENS.colors.primary} />
                <View style={styles.menuTextCol}>
                  <Text style={styles.menuTitle}>Profil &amp; Logo Toko</Text>
                  <Text style={styles.menuSubtitle}>
                    Ubah nama toko, alamat, nomor HP, &amp; logo struk
                  </Text>
                </View>
              </View>
              <ChevronRight size={18} color={TOKENS.colors.outline} />
            </Pressable>

            <Pressable
              testID="pengaturan-nav-accounts"
              accessibilityRole="button"
              onPress={() => router.push("/pengaturan/accounts")}
              style={({ pressed }) => [
                styles.menuItemRow,
                pressed && styles.menuItemPressed,
              ]}
            >
              <View style={styles.menuItemLeft}>
                <Users size={18} color={TOKENS.colors.primary} />
                <View style={styles.menuTextCol}>
                  <Text style={styles.menuTitle}>Akun &amp; Peran Staf</Text>
                  <Text style={styles.menuSubtitle}>
                    Kelola pengguna kasir/admin dan reset kata sandi
                  </Text>
                </View>
              </View>
              <ChevronRight size={18} color={TOKENS.colors.outline} />
            </Pressable>

            <Pressable
              testID="pengaturan-nav-categories-units"
              accessibilityRole="button"
              onPress={() => router.push("/pengaturan/categories-units")}
              style={({ pressed }) => [
                styles.menuItemRow,
                pressed && styles.menuItemPressed,
              ]}
            >
              <View style={styles.menuItemLeft}>
                <Tags size={18} color={TOKENS.colors.primary} />
                <View style={styles.menuTextCol}>
                  <Text style={styles.menuTitle}>
                    Kategori &amp; Satuan Produk
                  </Text>
                  <Text style={styles.menuSubtitle}>
                    Tambah, migrasi produk, dan tong sampah 30 hari
                  </Text>
                </View>
              </View>
              <ChevronRight size={18} color={TOKENS.colors.outline} />
            </Pressable>
          </SurfaceCard>
        ) : null}

        <SurfaceCard testID="pengaturan-server-card" style={styles.card}>
          <View style={styles.serverHeaderRow}>
            <Text style={styles.cardHeading}>Koneksi Server</Text>
            <View
              testID="pengaturan-local-session-badge"
              style={styles.sessionBadge}
            >
              <CheckCircle2 size={14} color={TOKENS.colors.successText} />
              <Text style={styles.sessionBadgeText}>Sesi Lokal Aktif</Text>
            </View>
          </View>

          <View style={styles.savedUrlBox}>
            <Text style={styles.savedUrlLabel}>Server LAN Utama</Text>
            <Text
              testID="pengaturan-saved-server-url"
              numberOfLines={2}
              ellipsizeMode="tail"
              style={styles.savedUrlValue}
            >
              {serverConfig.primaryUrl ??
                serverConfig.fallbackUrl ??
                "Belum diatur"}
            </Text>
            {serverConfig.fallbackUrl ? (
              <>
                <Text style={styles.savedUrlLabel}>Server Cloud Cadangan</Text>
                <Text
                  testID="pengaturan-saved-cloud-url"
                  numberOfLines={2}
                  ellipsizeMode="tail"
                  style={styles.savedUrlValue}
                >
                  {serverConfig.fallbackUrl}
                </Text>
              </>
            ) : null}
          </View>

          <ServerUrlPanel
            savedServerConfig={serverConfig}
            onSaveConfig={saveServerConfig}
            onTestDualConnection={testDualServerUrl}
          />
        </SurfaceCard>

        <SyncControlCard />

        <SurfaceCard testID="pengaturan-logout-card" style={styles.card}>
          <Text style={styles.cardHeading}>Sesi Perangkat</Text>
          <Text style={styles.cardDescription}>
            Akhiri sesi akun aktif pada perangkat ini untuk berganti kasir atau
            mengamankan terminal.
          </Text>
          <Pressable
            testID="pengaturan-nav-about"
            accessibilityRole="button"
            onPress={() => router.push("/pengaturan/about")}
            style={({ pressed }) => [
              styles.menuItemRow,
              pressed && styles.menuItemPressed,
            ]}
          >
            <View style={styles.menuItemLeft}>
              <Info size={18} color={TOKENS.colors.primary} />
              <View style={styles.menuTextCol}>
                <Text style={styles.menuTitle}>
                  Profil Toko &amp; Tentang Aplikasi
                </Text>
                <Text style={styles.menuSubtitle}>
                  Identitas toko, versi aplikasi, &amp; status API
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color={TOKENS.colors.outline} />
          </Pressable>
          <SecondaryButton
            testID="pengaturan-logout-button"
            variant="danger-outline"
            label="Keluar dari Akun"
            icon={<LogOut size={18} color={TOKENS.colors.destructive} />}
            onPress={() => {
              setShowLogoutModal(true);
            }}
          />
        </SurfaceCard>
      </ScrollView>

      <LogoutConfirmModal
        visible={showLogoutModal}
        username={displayUsername}
        isSubmitting={isLoggingOut}
        onCancel={() => {
          if (!isLoggingOut) {
            setShowLogoutModal(false);
          }
        }}
        onConfirm={() => {
          void handleConfirmLogout();
        }}
      />
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
  card: {
    gap: TOKENS.spacing.md,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: TOKENS.spacing.md,
  },
  avatarBox: {
    width: 68,
    height: 68,
    borderRadius: TOKENS.radii.lg,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  profileDetails: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    gap: 3,
  },
  profileFullName: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: TOKENS.typography.heading,
    lineHeight: TOKENS.lineHeight.heading,
    color: TOKENS.colors.onSurface,
  },
  profileUsername: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurfaceVariant,
  },
  roleBadgeSpacing: {
    marginTop: TOKENS.spacing.xs,
  },
  menuItemRow: {
    minHeight: TOKENS.spacing.touchTarget,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: TOKENS.spacing.sm,
    paddingHorizontal: TOKENS.spacing.sm,
    borderRadius: TOKENS.radii.sm,
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    gap: TOKENS.spacing.sm,
  },
  menuItemPressed: {
    opacity: 0.78,
  },
  menuItemLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: TOKENS.spacing.sm,
  },
  menuTextCol: {
    flex: 1,
    gap: 2,
  },
  menuTitle: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.body,
    lineHeight: TOKENS.lineHeight.body,
    color: TOKENS.colors.onSurface,
  },
  menuSubtitle: {
    fontFamily: FONT_FAMILY.body,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurfaceVariant,
  },
  serverHeaderRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: TOKENS.spacing.sm,
  },
  cardHeading: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: TOKENS.typography.heading,
    lineHeight: TOKENS.lineHeight.heading,
    color: TOKENS.colors.onSurface,
  },
  sessionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: TOKENS.spacing.xs,
    backgroundColor: TOKENS.colors.successBg,
    paddingHorizontal: TOKENS.spacing.sm,
    paddingVertical: TOKENS.spacing.xs,
    borderRadius: TOKENS.radii.sm,
  },
  sessionBadgeText: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.successText,
  },
  savedUrlBox: {
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    borderRadius: TOKENS.radii.sm,
    padding: TOKENS.spacing.md,
    gap: TOKENS.spacing.xs,
  },
  savedUrlLabel: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurfaceVariant,
  },
  savedUrlValue: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurface,
  },
  cardDescription: {
    fontFamily: FONT_FAMILY.body,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurfaceVariant,
  },
});
