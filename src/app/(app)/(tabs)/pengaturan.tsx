import React, { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  CheckCircle2,
  LogOut,
  Settings,
  ShieldCheck,
  User,
} from "lucide-react-native";
import { LogoutConfirmModal } from "@/components/common/LogoutConfirmModal";
import { RoleBadge } from "@/components/common/RoleBadge";
import { ServerUrlPanel } from "@/components/common/ServerUrlPanel";
import { TabScreenHeader } from "@/components/common/TabScreenHeader";
import {
  SecondaryButton,
  SurfaceCard,
} from "@/components/ui/VelocityPrimitives";
import { useAuth } from "@/context/AuthContext";
import { FONT_FAMILY, ROLE_STYLES, TOKENS } from "@/theme/tokens";

export default function PengaturanScreen() {
  const {
    user,
    role,
    isLoggingOut,
    serverUrl,
    logout,
    saveServerUrl,
    testServerUrl,
  } = useAuth();

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
        icon={<Settings size={24} color={TOKENS.colors.primary} />}
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
                <ShieldCheck size={24} color={TOKENS.colors.onPrimary} />
              ) : (
                <User size={24} color={TOKENS.colors.onPrimary} />
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
            <Text style={styles.savedUrlLabel}>Alamat Server API</Text>
            <Text
              testID="pengaturan-saved-server-url"
              numberOfLines={2}
              ellipsizeMode="tail"
              style={styles.savedUrlValue}
            >
              {serverUrl || "Belum diatur"}
            </Text>
          </View>

          <ServerUrlPanel
            savedServerUrl={serverUrl}
            onSaveUrl={saveServerUrl}
            onTestConnection={testServerUrl}
          />
        </SurfaceCard>

        <SurfaceCard testID="pengaturan-logout-card" style={styles.card}>
          <Text style={styles.cardHeading}>Sesi Perangkat</Text>
          <Text style={styles.cardDescription}>
            Akhiri sesi akun aktif pada perangkat ini untuk berganti kasir atau
            mengamankan terminal.
          </Text>
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
    alignItems: "flex-start",
    gap: TOKENS.spacing.md,
  },
  avatarBox: {
    width: TOKENS.spacing.touchTarget,
    height: TOKENS.spacing.touchTarget,
    borderRadius: TOKENS.radii.md,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  profileDetails: {
    flex: 1,
    minWidth: 0,
    gap: TOKENS.spacing.xs,
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
