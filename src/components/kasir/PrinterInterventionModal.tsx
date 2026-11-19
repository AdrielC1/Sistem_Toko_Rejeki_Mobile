import React from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  Printer,
  RefreshCw,
  Smartphone,
  TriangleAlert,
} from "lucide-react-native";
import type { PrintDiagnosticInfo } from "@/services/api/printApi";
import {
  FeedbackBanner,
  PrimaryButton,
  SecondaryButton,
} from "@/components/ui/VelocityPrimitives";
import { FONT_FAMILY, TOKENS } from "@/theme/tokens";

export interface PrinterInterventionModalProps {
  visible: boolean;
  errorMessage: string;
  diagnostic?: PrintDiagnosticInfo | null;
  paperNearEnd?: boolean;
  isRetrying: boolean;
  isFlushing: boolean;
  onRetryPrint: () => void;
  onFlushQueue: () => void;
  onFallbackSystemPrint?: () => void;
  onClose: () => void;
}

export function PrinterInterventionModal({
  visible,
  errorMessage,
  diagnostic,
  paperNearEnd,
  isRetrying,
  isFlushing,
  onRetryPrint,
  onFlushQueue,
  onFallbackSystemPrint,
  onClose,
}: PrinterInterventionModalProps) {
  const busy = isRetrying || isFlushing;

  return (
    <Modal
      testID="printer-intervention-modal"
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (!busy) {
          onClose();
        }
      }}
    >
      <View style={styles.backdrop}>
        <View accessibilityViewIsModal style={styles.card}>
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            <View style={styles.headerRow}>
              <View style={styles.iconBadge}>
                <TriangleAlert size={20} color={TOKENS.colors.warningText} />
              </View>
              <Text accessibilityRole="header" style={styles.titleText}>
                Printer Memerlukan Tindakan
              </Text>
            </View>

            <FeedbackBanner
              testID="printer-intervention-error-banner"
              variant="error"
              title={
                diagnostic?.errorCode
                  ? `Kode Printer: ${diagnostic.errorCode}`
                  : "Cetak Struk Gagal"
              }
              message={errorMessage}
            />

            {paperNearEnd ? (
              <FeedbackBanner
                testID="printer-paper-near-end-warning"
                variant="warning"
                title="Kertas Hampir Habis"
                message="Sensor printer mendeteksi gulungan kertas thermal menipis. Segera siapkan gulungan kertas cadangan."
              />
            ) : null}

            <View style={styles.actionsStack}>
              <PrimaryButton
                testID="printer-retry-button"
                label="Coba Cetak Ulang"
                loading={isRetrying}
                loadingLabel="Mencetak Ulang..."
                disabled={busy}
                icon={<Printer size={18} color={TOKENS.colors.onPrimary} />}
                onPress={onRetryPrint}
              />

              <SecondaryButton
                testID="printer-flush-button"
                variant="tonal"
                label="Bersihkan Antrean Spooler Server"
                loading={isFlushing}
                loadingLabel="Membersihkan Antrean..."
                disabled={busy}
                icon={
                  <RefreshCw size={16} color={TOKENS.colors.onPrimaryFixed} />
                }
                onPress={onFlushQueue}
              />

              {onFallbackSystemPrint ? (
                <SecondaryButton
                  testID="printer-fallback-system-button"
                  variant="outlined"
                  label="Cetak via Sistem HP / PDF"
                  disabled={busy}
                  icon={<Smartphone size={16} color={TOKENS.colors.primary} />}
                  onPress={onFallbackSystemPrint}
                />
              ) : null}

              <SecondaryButton
                testID="printer-intervention-close-button"
                variant="danger-outline"
                label="Tutup & Kembali ke Kasir"
                disabled={busy}
                onPress={onClose}
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
  content: {
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
    backgroundColor: TOKENS.colors.warningBg,
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
  actionsStack: {
    gap: TOKENS.spacing.sm,
  },
});
