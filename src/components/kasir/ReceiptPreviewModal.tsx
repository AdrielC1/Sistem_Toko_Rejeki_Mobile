import React, { useMemo } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Printer, X } from "lucide-react-native";
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
  copies: 2 | 3;
  printerMode: PrinterDeviceMode;
  isSubmitting: boolean;
  onChangeCopies: (copies: 2 | 3) => void;
  onClose: () => void;
  onConfirmPrint: () => void;
}

const MODE_LABELS: Record<PrinterDeviceMode, string> = {
  server: "Printer Server Toko",
  bluetooth: "Thermal Bluetooth",
  system: "Cetak Sistem HP",
};

export function ReceiptPreviewModal({
  visible,
  order,
  paperWidthMm = 58,
  copies,
  printerMode,
  isSubmitting,
  onChangeCopies,
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
        if (!isSubmitting) {
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
          <View style={styles.topBar}>
            <View style={styles.titleRow}>
              <Printer size={18} color={TOKENS.colors.primary} />
              <Text accessibilityRole="header" style={styles.titleText}>
                Pratinjau Struk ({isWidePaper ? "80mm" : "58mm"})
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
                if (line.kind === "kv") {
                  return (
                    <View key={line.key} style={styles.paperKvRow}>
                      <Text
                        style={[
                          styles.paperText,
                          styles.paperKvLeft,
                          line.bold && styles.paperBold,
                          line.fontSize === "lg" && styles.paperLg,
                        ]}
                      >
                        {line.leftText}
                      </Text>
                      <Text
                        style={[
                          styles.paperText,
                          styles.paperKvRight,
                          line.bold && styles.paperBold,
                          line.fontSize === "lg" && styles.paperLg,
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
                      line.fontSize === "lg" && styles.paperLg,
                    ]}
                  >
                    {line.text}
                  </Text>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.controlsArea}>
            <View style={styles.metaBar}>
              <Text style={styles.metaLabel}>
                {`Mode: ${MODE_LABELS[printerMode]}`}
              </Text>
              <View style={styles.copiesGroup}>
                <Text style={styles.metaLabel}>Salinan:</Text>
                {([2, 3] as const).map((val) => {
                  const selected = copies === val;
                  return (
                    <Pressable
                      key={val}
                      testID={`receipt-copies-${val}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      disabled={isSubmitting}
                      onPress={() => onChangeCopies(val)}
                      style={[
                        styles.copyChip,
                        selected && styles.copyChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.copyChipText,
                          selected && styles.copyChipTextSelected,
                        ]}
                      >
                        {`${val}x`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

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
                label={`Cetak ${copies}x`}
                loading={isSubmitting}
                loadingLabel="Mencetak..."
                disabled={isSubmitting || !order}
                icon={<Printer size={18} color={TOKENS.colors.onPrimary} />}
                onPress={onConfirmPrint}
                style={styles.actionBtn}
              />
            </View>
          </View>
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
  paperLg: {
    fontSize: TOKENS.typography.body,
    lineHeight: TOKENS.lineHeight.body,
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
    gap: TOKENS.spacing.md,
  },
  metaBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: TOKENS.spacing.sm,
  },
  metaLabel: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurfaceVariant,
  },
  copiesGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: TOKENS.spacing.xs,
  },
  copyChip: {
    minWidth: TOKENS.spacing.touchTarget,
    minHeight: TOKENS.spacing.touchTarget,
    borderRadius: TOKENS.radii.sm,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: TOKENS.spacing.sm,
  },
  copyChipSelected: {
    backgroundColor: TOKENS.colors.primary,
    borderColor: TOKENS.colors.primary,
  },
  copyChipText: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurface,
  },
  copyChipTextSelected: {
    color: TOKENS.colors.onPrimary,
  },
  actionsRow: {
    flexDirection: "row",
    gap: TOKENS.spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
});
