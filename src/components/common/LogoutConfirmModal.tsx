import React from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { LogOut, TriangleAlert } from "lucide-react-native";
import { SecondaryButton } from "@/components/ui/VelocityPrimitives";
import { FONT_FAMILY, TOKENS } from "@/theme/tokens";

export interface LogoutConfirmModalProps {
  visible: boolean;
  username: string;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function LogoutConfirmModal({
  visible,
  username,
  isSubmitting,
  onCancel,
  onConfirm,
}: LogoutConfirmModalProps) {
  const displayUsername = username.trim() || "staf";

  return (
    <Modal
      testID="logout-confirm-modal"
      transparent
      animationType="fade"
      visible={visible}
      statusBarTranslucent
      onRequestClose={() => {
        if (!isSubmitting) {
          onCancel();
        }
      }}
    >
      <View style={styles.backdrop}>
        <View
          testID="logout-confirm-modal-card"
          accessibilityViewIsModal
          style={styles.card}
        >
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.cardScrollContent}
          >
            <View style={styles.headerRow}>
              <View style={styles.iconBadge}>
                <LogOut size={18} color={TOKENS.colors.destructive} />
              </View>
              <Text accessibilityRole="header" style={styles.titleText}>
                Keluar dari Akun?
              </Text>
            </View>

            <Text style={styles.bodyText}>
              {`Sesi aktif akun ${displayUsername} akan diakhiri dari perangkat ini.`}
            </Text>

            <View style={styles.cautionBox}>
              <TriangleAlert
                size={18}
                color={TOKENS.colors.warningText}
                style={styles.cautionIcon}
              />
              <Text style={styles.cautionText}>
                Pastikan seluruh transaksi kasir yang berjalan sudah disimpan
                atau diselesaikan.
              </Text>
            </View>

            <View style={styles.actionsStack}>
              <SecondaryButton
                testID="logout-cancel-button"
                variant="tonal"
                label="Tetap Masuk"
                disabled={isSubmitting}
                onPress={onCancel}
              />
              <SecondaryButton
                testID="logout-confirm-button"
                variant="danger"
                label="Ya, Akhiri Sesi"
                loading={isSubmitting}
                loadingLabel="Mengakhiri Sesi..."
                disabled={isSubmitting}
                onPress={onConfirm}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: TOKENS.colors.modalBackdrop,
    justifyContent: "center",
    alignItems: "center",
    padding: TOKENS.spacing.md,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    maxHeight: "90%",
    backgroundColor: TOKENS.colors.surfaceCard,
    borderRadius: TOKENS.radii.lg,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    padding: TOKENS.spacing.lg,
    shadowColor: TOKENS.colors.onSurface,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  cardScrollContent: {
    gap: TOKENS.spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: TOKENS.spacing.sm,
  },
  iconBadge: {
    width: TOKENS.spacing.xl,
    height: TOKENS.spacing.xl,
    borderRadius: TOKENS.radii.sm,
    backgroundColor: TOKENS.colors.errorContainer,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  titleText: {
    flex: 1,
    minWidth: 0,
    fontFamily: FONT_FAMILY.heading,
    fontSize: TOKENS.typography.heading,
    lineHeight: TOKENS.lineHeight.heading,
    color: TOKENS.colors.onSurface,
  },
  bodyText: {
    fontFamily: FONT_FAMILY.body,
    fontSize: TOKENS.typography.body,
    lineHeight: TOKENS.lineHeight.body,
    color: TOKENS.colors.onSurfaceVariant,
  },
  cautionBox: {
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    borderRadius: TOKENS.radii.sm,
    padding: TOKENS.spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: TOKENS.spacing.sm,
  },
  cautionIcon: {
    marginTop: 2,
    flexShrink: 0,
  },
  cautionText: {
    flex: 1,
    minWidth: 0,
    fontFamily: FONT_FAMILY.body,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurfaceVariant,
  },
  actionsStack: {
    gap: TOKENS.spacing.sm,
  },
});
