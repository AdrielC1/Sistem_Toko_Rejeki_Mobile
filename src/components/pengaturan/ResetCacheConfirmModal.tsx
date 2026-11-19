import React from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { Trash2, TriangleAlert } from "lucide-react-native";
import { SecondaryButton } from "@/components/ui/VelocityPrimitives";
import { FONT_FAMILY, TOKENS } from "@/theme/tokens";

export interface ResetCacheConfirmModalProps {
  visible: boolean;
  productCount: number;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ResetCacheConfirmModal({
  visible,
  productCount,
  isSubmitting,
  onCancel,
  onConfirm,
}: ResetCacheConfirmModalProps) {
  return (
    <Modal
      testID="reset-cache-confirm-modal"
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
          testID="reset-cache-confirm-card"
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
                <Trash2 size={18} color={TOKENS.colors.destructive} />
              </View>
              <Text accessibilityRole="header" style={styles.titleText}>
                Reset Cache Katalog Lokal?
              </Text>
            </View>

            <Text style={styles.bodyText}>
              {`Sebanyak ${productCount} produk beserta kategori, satuan, dan penanda sinkronisasi lokal akan dihapus dari perangkat ini, lalu diunduh ulang penuh dari server.`}
            </Text>

            <View style={styles.cautionBox}>
              <TriangleAlert
                size={18}
                color={TOKENS.colors.warningText}
                style={styles.cautionIcon}
              />
              <Text style={styles.cautionText}>
                Akun login, alamat server LAN/Cloud, dan nota tertunda di
                Pesanan Aktif tetap aman dan tidak akan terhapus.
              </Text>
            </View>

            <View style={styles.actionsRow}>
              <SecondaryButton
                testID="reset-cache-cancel-button"
                variant="tonal"
                label="Batal"
                disabled={isSubmitting}
                onPress={onCancel}
                style={styles.actionBtnHalf}
              />
              <SecondaryButton
                testID="reset-cache-confirm-button"
                variant="danger"
                label="Ya, Reset Cache"
                loading={isSubmitting}
                loadingLabel="Mereset Cache..."
                disabled={isSubmitting}
                onPress={onConfirm}
                style={styles.actionBtnHalf}
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
    padding: TOKENS.spacing.lg,
  },
  card: {
    backgroundColor: TOKENS.colors.surfaceCard,
    borderRadius: TOKENS.radii.lg,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    maxHeight: "88%",
  },
  cardScrollContent: {
    padding: TOKENS.spacing.lg,
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
    borderRadius: 999,
    backgroundColor: TOKENS.colors.errorContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  titleText: {
    flex: 1,
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
    flexDirection: "row",
    alignItems: "flex-start",
    gap: TOKENS.spacing.sm,
    padding: TOKENS.spacing.md,
    backgroundColor: TOKENS.colors.warningBg,
    borderRadius: TOKENS.radii.md,
    borderWidth: 1,
    borderColor: TOKENS.colors.warningBorder,
  },
  cautionIcon: {
    marginTop: 2,
    flexShrink: 0,
  },
  cautionText: {
    flex: 1,
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.warningText,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: TOKENS.spacing.xs,
  },
  actionBtnHalf: {
    flex: 1,
  },
});
