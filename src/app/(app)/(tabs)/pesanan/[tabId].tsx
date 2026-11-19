import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Calculator,
  ChevronLeft,
  Pencil,
  ReceiptText,
  Trash2,
} from "lucide-react-native";
import { EmptyStateCard } from "@/components/common/EmptyStateCard";
import {
  InputField,
  PrimaryButton,
  SecondaryButton,
  SurfaceCard,
} from "@/components/ui/VelocityPrimitives";
import { formatRupiah, formatWibDateTime } from "@/domain/format";
import { calculateCartSummary } from "@/domain/pricing";
import { usePosCartStore } from "@/store/posCartStore";
import { FONT_FAMILY, TOKENS } from "@/theme/tokens";

export default function PesananDetailScreen() {
  const router = useRouter();
  const { tabId } = useLocalSearchParams<{ tabId: string }>();
  const tabs = usePosCartStore((s) => s.tabs);
  const renameTab = usePosCartStore((s) => s.renameTab);
  const switchTab = usePosCartStore((s) => s.switchTab);
  const removeTab = usePosCartStore((s) => s.removeTab);

  const tab = useMemo(
    () => tabs.find((t) => t.id === tabId) ?? null,
    [tabId, tabs]
  );

  const [labelDraft, setLabelDraft] = useState<string>(tab?.label ?? "");
  const [prevLabel, setPrevLabel] = useState<string>(tab?.label ?? "");
  const [editingName, setEditingName] = useState<boolean>(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState<boolean>(false);

  if (tab && tab.label !== prevLabel) {
    setPrevLabel(tab.label);
    setLabelDraft(tab.label);
  }

  const summary = useMemo(
    () => calculateCartSummary(tab?.items ?? [], tab?.discount ?? 0),
    [tab]
  );

  const handleResumeInKasir = () => {
    if (!tab) {
      return;
    }
    switchTab(tab.id);
    router.navigate("/kasir");
  };

  const handleSaveRename = () => {
    if (!tab) {
      return;
    }
    if (labelDraft.trim().length > 0) {
      renameTab(tab.id, labelDraft);
    }
    setEditingName(false);
  };

  const handleConfirmDelete = () => {
    if (!tab) {
      return;
    }
    removeTab(tab.id);
    setConfirmDeleteOpen(false);
    router.back();
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={["top"]} style={styles.topBar}>
        <Pressable
          testID="pesanan-detail-back"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <ChevronLeft size={22} color={TOKENS.colors.onSurface} />
        </Pressable>
        <Text numberOfLines={1} style={styles.topTitle}>
          Detail Pesanan Tertunda
        </Text>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {!tab ? (
          <EmptyStateCard
            testID="pesanan-detail-not-found"
            icon={<ReceiptText size={24} color={TOKENS.colors.primary} />}
            title="Nota Tidak Ditemukan"
            description="Nota tertunda ini mungkin sudah diselesaikan atau dihapus."
          />
        ) : (
          <>
            <SurfaceCard style={styles.card}>
              <View style={styles.headerLine}>
                <View style={styles.titleCol}>
                  <Text testID="pesanan-detail-label" style={styles.notaHeading}>
                    {tab.label}
                  </Text>
                  <Text style={styles.metaText}>
                    {`Dibuat: ${formatWibDateTime(tab.createdAt)}`}
                  </Text>
                </View>
                <Pressable
                  testID="pesanan-detail-rename-toggle"
                  accessibilityRole="button"
                  onPress={() => setEditingName((prev) => !prev)}
                  style={styles.renameBtn}
                >
                  <Pencil size={18} color={TOKENS.colors.primary} />
                </Pressable>
              </View>

              {editingName ? (
                <View style={styles.renameBox}>
                  <InputField
                    testID="pesanan-detail-rename-input"
                    label="Label Nota Lokal"
                    value={labelDraft}
                    onChangeText={setLabelDraft}
                    placeholder="Contoh: Nota Pak Budi"
                  />
                  <SecondaryButton
                    testID="pesanan-detail-rename-save"
                    variant="tonal"
                    label="Simpan Label"
                    onPress={handleSaveRename}
                  />
                </View>
              ) : null}
            </SurfaceCard>

            <SurfaceCard style={styles.card}>
              <Text style={styles.sectionHeading}>
                {`Daftar Barang (${summary.itemCount} jenis)`}
              </Text>
              {tab.items.map((item) => (
                <View
                  key={`${item.productId}::${item.unitId}`}
                  style={styles.lineItemRow}
                >
                  <View style={styles.lineInfo}>
                    <Text style={styles.itemName}>{item.productName}</Text>
                    <View style={styles.badgesRow}>
                      <Text style={styles.metaText}>
                        {`${item.quantity} ${item.unitName} x ${formatRupiah(item.effectiveUnitPrice)}`}
                      </Text>
                      {item.wholesaleSavings > 0 ? (
                        <Text style={styles.wholesaleBadge}>
                          {`Grosir · Hemat ${formatRupiah(item.wholesaleSavings)}`}
                        </Text>
                      ) : null}
                      {item.isCustomPrice ? (
                        <Text style={styles.customPriceBadge}>
                          Harga Khusus
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <Text style={styles.lineSubtotal}>
                    {formatRupiah(item.subtotal)}
                  </Text>
                </View>
              ))}
            </SurfaceCard>

            <SurfaceCard style={styles.card}>
              <Text style={styles.sectionHeading}>Ringkasan Nota</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.metaText}>Subtotal</Text>
                <Text style={styles.monoText}>
                  {formatRupiah(summary.subtotal)}
                </Text>
              </View>
              {summary.totalWholesaleSavings > 0 ? (
                <View style={styles.summaryRow}>
                  <Text style={styles.savingsText}>Hemat Harga Grosir</Text>
                  <Text style={styles.savingsText}>
                    {`-${formatRupiah(summary.totalWholesaleSavings)}`}
                  </Text>
                </View>
              ) : null}
              <View style={styles.summaryRow}>
                <Text style={styles.metaText}>Potongan Harga</Text>
                <Text style={styles.monoText}>
                  {summary.discount > 0
                    ? `-${formatRupiah(summary.discount)}`
                    : "Rp 0"}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.grandTotalLabel}>TOTAL BAYAR</Text>
                <Text
                  testID="pesanan-detail-grand-total"
                  style={styles.grandTotalValue}
                >
                  {formatRupiah(summary.grandTotal)}
                </Text>
              </View>
            </SurfaceCard>

            <View style={styles.actionsCol}>
              <PrimaryButton
                testID="pesanan-detail-resume-button"
                label="Lanjutkan di Kasir"
                icon={<Calculator size={18} color={TOKENS.colors.onPrimary} />}
                onPress={handleResumeInKasir}
              />
              <SecondaryButton
                testID="pesanan-detail-delete-button"
                variant="danger-outline"
                label="Hapus Nota"
                icon={<Trash2 size={18} color={TOKENS.colors.destructive} />}
                onPress={() => setConfirmDeleteOpen(true)}
              />
            </View>
          </>
        )}
      </ScrollView>

      <Modal
        testID="pesanan-delete-confirm-modal"
        visible={confirmDeleteOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setConfirmDeleteOpen(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionHeading}>
              {`Hapus ${tab?.label ?? "Nota"}?`}
            </Text>
            <Text style={styles.metaText}>
              Semua item di nota tertunda ini akan dihapus dari perangkat.
            </Text>
            <SecondaryButton
              testID="pesanan-delete-confirm-button"
              variant="danger"
              label="Ya, Hapus Nota"
              onPress={handleConfirmDelete}
            />
            <SecondaryButton
              variant="tonal"
              label="Batal"
              onPress={() => setConfirmDeleteOpen(false)}
            />
          </View>
        </View>
      </Modal>
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
  card: {
    gap: TOKENS.spacing.sm,
  },
  headerLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: TOKENS.spacing.sm,
  },
  titleCol: {
    flex: 1,
    gap: 2,
  },
  notaHeading: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: TOKENS.typography.heading,
    lineHeight: TOKENS.lineHeight.heading,
    color: TOKENS.colors.onSurface,
  },
  renameBtn: {
    width: TOKENS.spacing.touchTarget,
    height: TOKENS.spacing.touchTarget,
    borderRadius: TOKENS.radii.sm,
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    alignItems: "center",
    justifyContent: "center",
  },
  renameBox: {
    gap: TOKENS.spacing.sm,
    paddingTop: TOKENS.spacing.xs,
  },
  sectionHeading: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: TOKENS.typography.body,
    lineHeight: TOKENS.lineHeight.body,
    color: TOKENS.colors.onSurface,
  },
  lineItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: TOKENS.spacing.sm,
    paddingVertical: TOKENS.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: TOKENS.colors.borderSubtle,
  },
  lineInfo: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.body,
    lineHeight: TOKENS.lineHeight.body,
    color: TOKENS.colors.onSurface,
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: TOKENS.spacing.xs,
  },
  wholesaleBadge: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.successText,
    backgroundColor: TOKENS.colors.successBg,
    paddingHorizontal: TOKENS.spacing.xs,
    borderRadius: TOKENS.radii.sm,
  },
  customPriceBadge: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.warningText,
    backgroundColor: TOKENS.colors.warningBg,
    paddingHorizontal: TOKENS.spacing.xs,
    borderRadius: TOKENS.radii.sm,
  },
  lineSubtotal: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: TOKENS.typography.body,
    lineHeight: TOKENS.lineHeight.body,
    color: TOKENS.colors.onSurface,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaText: {
    fontFamily: FONT_FAMILY.body,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurfaceVariant,
  },
  monoText: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: TOKENS.typography.body,
    lineHeight: TOKENS.lineHeight.body,
    color: TOKENS.colors.onSurface,
  },
  savingsText: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.successText,
  },
  grandTotalLabel: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: TOKENS.typography.body,
    lineHeight: TOKENS.lineHeight.body,
    color: TOKENS.colors.onSurface,
  },
  grandTotalValue: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: TOKENS.typography.display,
    lineHeight: TOKENS.lineHeight.display,
    color: TOKENS.colors.primary,
  },
  actionsCol: {
    gap: TOKENS.spacing.sm,
  },
  backdrop: {
    flex: 1,
    backgroundColor: TOKENS.colors.modalBackdrop,
    justifyContent: "center",
    padding: TOKENS.spacing.lg,
  },
  modalCard: {
    backgroundColor: TOKENS.colors.surfaceCard,
    borderRadius: TOKENS.radii.lg,
    padding: TOKENS.spacing.lg,
    gap: TOKENS.spacing.md,
  },
});
