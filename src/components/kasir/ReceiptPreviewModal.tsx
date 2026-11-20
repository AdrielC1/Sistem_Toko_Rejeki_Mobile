import React, { useMemo } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CheckCircle2, Printer, X } from "lucide-react-native";
import type { CompletedOrder } from "@/domain/pricing";
import { buildReceiptRenderLines } from "@/domain/receiptLayout";
import {
  PrimaryButton,
  SecondaryButton,
} from "@/components/ui/VelocityPrimitives";
import type { PrinterDeviceMode } from "@/store/printerPrefsStore";
import { FONT_FAMILY, TOKENS } from "@/theme/tokens";

export interface ReceiptPreviewModalProps {
  visible: boolean;
  order: CompletedOrder | null;
  paperWidthMm?: number;
  copies: 1 | 2;
  printerMode: PrinterDeviceMode;
  isSubmitting: boolean;
  printSuccess?: boolean;
  onChangeCopies?: (copies: 1 | 2) => void;
  onChangePaperWidth?: (width: 58 | 80) => void;
  onClose: () => void;
  onConfirmPrint: () => void;
}

export function ReceiptPreviewModal({
  visible,
  order,
  paperWidthMm = 58,
  copies,
  isSubmitting,
  printSuccess = false,
  onClose,
  onConfirmPrint,
}: ReceiptPreviewModalProps) {
  const lines = useMemo(
    () => (order ? buildReceiptRenderLines(order) : []),
    [order]
  );

  const isWidePaper = paperWidthMm >= 80;

  return (
    <Modal
      testID="receipt-preview-modal"
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (!isSubmitting && !printSuccess) {
          onClose();
        }
      }}
    >
      <View style={styles.backdrop}>
        <View
          accessibilityViewIsModal
          testID="receipt-preview-card"
          style={styles.sheet}
        >
          {printSuccess ? (
            <View testID="receipt-print-success" style={styles.successStateWrap}>
              <View style={styles.successCircle}>
                <CheckCircle2 size={54} color={TOKENS.colors.successText} />
              </View>
              <Text style={styles.successTitle}>Struk Berhasil Dicetak</Text>
            </View>
          ) : (
            <>
              <View style={styles.topBar}>
                <View style={styles.titleRow}>
                  <Printer size={18} color={TOKENS.colors.primary} />
                  <Text accessibilityRole="header" style={styles.titleText}>
                    {`Pratinjau Struk (${isWidePaper ? "80mm" : "58mm"} · ${copies}x)`}
                  </Text>
                </View>
                <Pressable
                  testID="receipt-preview-close"
                  accessibilityRole="button"
                  accessibilityLabel="Tutup pratinjau struk"
                  disabled={isSubmitting}
                  onPress={onClose}
                  style={styles.closeBtn}
                >
                  <X size={20} color={TOKENS.colors.onSurfaceVariant} />
                </Pressable>
              </View>

              <ScrollView
                style={styles.paperScroll}
                contentContainerStyle={styles.paperScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View
                  testID="receipt-paper-frame"
                  style={[
                    styles.paperFrame,
                    isWidePaper ? styles.paper80 : styles.paper58,
                  ]}
                >
                  {lines.map((line) => {
                    if (line.kind === "divider") {
                      return <View key={line.key} style={styles.paperDivider} />;
                    }
                    const isLg =
                      line.size === "large" || line.fontSize === "lg";
                    const isMd = line.size === "medium";
                    const isSm =
                      line.size === "small" || line.fontSize === "sm";

                    if (line.kind === "kv") {
                      return (
                        <View key={line.key} style={styles.paperKvRow}>
                          <Text
                            style={[
                              styles.paperText,
                              styles.paperKvLeft,
                              line.bold && styles.paperBold,
                              isSm && styles.paperSm,
                              isMd && styles.paperMd,
                              isLg && styles.paperLg,
                            ]}
                          >
                            {line.leftText}
                          </Text>
                          <Text
                            style={[
                              styles.paperText,
                              styles.paperKvRight,
                              line.bold && styles.paperBold,
                              isSm && styles.paperSm,
                              isMd && styles.paperMd,
                              isLg && styles.paperLg,
                            ]}
                          >
                            {line.rightText}
                          </Text>
                        </View>
                      );
                    }
                    return (
                      <Text
                        key={line.key}
                        style={[
                          styles.paperText,
                          line.align === "center" && styles.alignCenter,
                          line.align === "right" && styles.alignRight,
                          line.bold && styles.paperBold,
                          isSm && styles.paperSm,
                          isMd && styles.paperMd,
                          isLg && styles.paperLg,
                        ]}
                      >
                        {line.text}
                      </Text>
                    );
                  })}
                </View>
              </ScrollView>

              <View style={styles.controlsArea}>
                <View style={styles.actionsRow}>
                  <SecondaryButton
                    testID="receipt-preview-cancel-button"
                    variant="tonal"
                    label="Batal"
                    disabled={isSubmitting}
                    onPress={onClose}
                    style={styles.actionBtn}
                  />
                  <PrimaryButton
                    testID="receipt-preview-confirm-button"
                    label="Cetak"
                    loading={isSubmitting}
                    loadingLabel="Mencetak..."
                    disabled={isSubmitting || !order}
                    icon={<Printer size={18} color={TOKENS.colors.onPrimary} />}
                    onPress={onConfirmPrint}
                    style={styles.actionBtn}
                  />
                </View>
              </View>
            </>
          )}
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
    padding: TOKENS.spacing.md,
  },
  sheet: {
    backgroundColor: TOKENS.colors.surfaceCard,
    borderRadius: TOKENS.radii.lg,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    maxHeight: "90%",
    overflow: "hidden",
  },
  successStateWrap: {
    paddingVertical: 40,
    paddingHorizontal: TOKENS.spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: TOKENS.spacing.md,
  },
  successCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: TOKENS.colors.successBg,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: TOKENS.typography.heading,
    color: TOKENS.colors.onSurface,
    textAlign: "center",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: TOKENS.spacing.md,
    paddingVertical: TOKENS.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.colors.borderSubtle,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: TOKENS.spacing.sm,
  },
  titleText: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: TOKENS.typography.heading,
    lineHeight: TOKENS.lineHeight.heading,
    color: TOKENS.colors.onSurface,
  },
  closeBtn: {
    width: TOKENS.spacing.touchTarget,
    height: TOKENS.spacing.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  paperScroll: {
    backgroundColor: TOKENS.colors.surfaceContainer,
  },
  paperScrollContent: {
    padding: TOKENS.spacing.md,
    alignItems: "center",
  },
  paperFrame: {
    backgroundColor: TOKENS.colors.surfaceCard,
    borderWidth: 1,
    borderColor: TOKENS.colors.outline,
    borderRadius: TOKENS.radii.sm,
    padding: TOKENS.spacing.md,
    gap: TOKENS.spacing.xs,
  },
  paper58: {
    width: "84%",
  },
  paper80: {
    width: "100%",
  },
  paperDivider: {
    borderTopWidth: 1,
    borderStyle: "dashed",
    borderTopColor: TOKENS.colors.outline,
    marginVertical: TOKENS.spacing.xs,
  },
  paperKvRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: TOKENS.spacing.sm,
  },
  paperKvLeft: {
    flex: 1,
  },
  paperKvRight: {
    flexShrink: 0,
    textAlign: "right",
  },
  paperText: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurface,
  },
  paperBold: {
    fontFamily: FONT_FAMILY.monoSemiBold,
  },
  paperSm: {
    fontSize: 11,
    lineHeight: 15,
  },
  paperMd: {
    fontSize: 14,
    lineHeight: 19,
  },
  paperLg: {
    fontSize: 16,
    lineHeight: 22,
  },
  alignCenter: {
    textAlign: "center",
  },
  alignRight: {
    textAlign: "right",
  },
  controlsArea: {
    padding: TOKENS.spacing.md,
    borderTopWidth: 1,
    borderTopColor: TOKENS.colors.borderSubtle,
  },
  actionsRow: {
    flexDirection: "row",
    gap: TOKENS.spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
});
