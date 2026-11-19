import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Check, Hash, Layers, Tag, Trash2, X } from "lucide-react-native";
import { formatRupiah } from "@/domain/format";
import type { CartItem, SelectableProductUnit } from "@/domain/pricing";
import {
  FeedbackBanner,
  InputField,
  PrimaryButton,
  SecondaryButton,
} from "@/components/ui/VelocityPrimitives";
import { FONT_FAMILY, TOKENS } from "@/theme/tokens";
import type { Product } from "@/types";

function formatThousandDots(raw: string | number): string {
  const digits = String(raw).replace(/[^0-9]/g, "");
  if (!digits) {
    return "";
  }
  const num = Number(digits);
  if (!Number.isFinite(num)) {
    return "";
  }
  return String(Math.floor(num)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function ProductUnitPickerModal({
  visible,
  product,
  units,
  selectedUnitId,
  onSelectUnit,
  onClose,
}: {
  visible: boolean;
  product: Product | null;
  units: SelectableProductUnit[];
  selectedUnitId?: string;
  onSelectUnit: (unit: SelectableProductUnit) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      testID="kasir-unit-picker-modal"
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.headerTitleGroup}>
              <Layers size={18} color={TOKENS.colors.primary} />
              <Text numberOfLines={1} style={styles.titleText}>
                {product ? `Pilih Satuan · ${product.name}` : "Pilih Satuan"}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tutup pilihan satuan"
              onPress={onClose}
              style={styles.closeBtn}
            >
              <X size={20} color={TOKENS.colors.onSurfaceVariant} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.listBody}>
            {units.map((unit) => {
              const isSelected = Boolean(
                selectedUnitId && unit.unitId === selectedUnitId
              );
              return (
                <Pressable
                  key={unit.unitId}
                  testID={`unit-option-${unit.unitId}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => onSelectUnit(unit)}
                  style={({ pressed }) => [
                    styles.unitOptionRow,
                    isSelected && styles.unitOptionRowSelected,
                    pressed && styles.pressedRow,
                  ]}
                >
                  <View style={styles.unitMeta}>
                    <Text
                      style={[
                        styles.unitName,
                        isSelected && styles.unitNameSelected,
                      ]}
                    >
                      {unit.unitName}
                    </Text>
                    <Text
                      style={[
                        styles.unitSub,
                        isSelected && styles.unitSubSelected,
                      ]}
                    >
                      {unit.isBaseUnit
                        ? "Satuan Dasar"
                        : `Isi ${unit.conversionFactor} satuan dasar`}
                    </Text>
                  </View>
                  <View style={styles.unitOptionRight}>
                    <Text
                      style={[
                        styles.unitPrice,
                        isSelected && styles.unitPriceSelected,
                      ]}
                    >
                      {formatRupiah(unit.sellingPrice)}
                    </Text>
                    {isSelected ? (
                      <Check size={18} color={TOKENS.colors.onPrimary} />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function CartItemPriceModal({
  visible,
  item,
  onSavePrice,
  onResetPrice,
  onClose,
}: {
  visible: boolean;
  item: CartItem | null;
  onSavePrice: (customPrice: number) => void;
  onResetPrice: () => void;
  onClose: () => void;
}) {
  const openKey =
    visible && item
      ? `${item.productId}:${item.unitId}:${item.effectiveUnitPrice}`
      : "closed";
  const [prevKey, setPrevKey] = useState<string>(openKey);
  const [priceText, setPriceText] = useState<string>(
    item ? formatThousandDots(item.effectiveUnitPrice) : ""
  );
  const [error, setError] = useState<string | null>(null);

  if (openKey !== prevKey) {
    setPrevKey(openKey);
    if (visible && item) {
      setPriceText(formatThousandDots(item.effectiveUnitPrice));
      setError(null);
    }
  }

  const handleConfirm = () => {
    const digits = priceText.replace(/[^0-9]/g, "");
    const cleaned = Number(digits);
    if (!Number.isFinite(cleaned) || cleaned < 0 || digits === "") {
      setError("Masukkan nominal harga yang valid (minimal Rp 0).");
      return;
    }
    onSavePrice(cleaned);
  };

  return (
    <Modal
      testID="kasir-open-price-modal"
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.headerTitleGroup}>
              <Tag size={18} color={TOKENS.colors.primary} />
              <Text style={styles.titleText}>Harga Khusus (Open Price)</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={styles.closeBtn}
            >
              <X size={20} color={TOKENS.colors.onSurfaceVariant} />
            </Pressable>
          </View>
          <View style={styles.modalBody}>
            {item ? (
              <Text style={styles.itemHint}>
                {`${item.productName} (${item.unitName}) · Harga normal: ${formatRupiah(item.baseUnitPrice)}`}
              </Text>
            ) : null}
            <InputField
              testID="open-price-input"
              label="Harga Satuan Baru (Rp)"
              value={priceText}
              onChangeText={(txt) => {
                setPriceText(formatThousandDots(txt));
                setError(null);
              }}
              keyboardType="numeric"
              selectTextOnFocus
              monospace
              invalid={Boolean(error)}
            />
            {error ? <FeedbackBanner variant="error" message={error} /> : null}
            <View style={styles.actionsCol}>
              {item?.isCustomPrice ? (
                <SecondaryButton
                  testID="open-price-reset-button"
                  variant="tonal"
                  label="Kembalikan ke Harga Normal / Grosir"
                  onPress={onResetPrice}
                />
              ) : null}
              <View style={styles.actionsRow}>
                <SecondaryButton
                  variant="tonal"
                  label="Batal"
                  onPress={onClose}
                  style={styles.actionBtnHalf}
                />
                <PrimaryButton
                  testID="open-price-save-button"
                  label="Terapkan"
                  onPress={handleConfirm}
                  style={styles.actionBtnHalf}
                />
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function CartItemQuantityModal({
  visible,
  item,
  onSaveQuantity,
  onClose,
}: {
  visible: boolean;
  item: CartItem | null;
  onSaveQuantity: (quantity: number) => void;
  onClose: () => void;
}) {
  const openKey =
    visible && item
      ? `${item.productId}:${item.unitId}:${item.quantity}`
      : "closed";
  const [prevKey, setPrevKey] = useState<string>(openKey);
  const [qtyText, setQtyText] = useState<string>(
    item ? String(item.quantity) : "1"
  );
  const [error, setError] = useState<string | null>(null);

  if (openKey !== prevKey) {
    setPrevKey(openKey);
    if (visible && item) {
      setQtyText(String(item.quantity));
      setError(null);
    }
  }

  const handleConfirm = () => {
    const cleaned = Number(qtyText.replace(/[^0-9]/g, ""));
    if (!Number.isFinite(cleaned) || cleaned < 1 || qtyText.trim() === "") {
      setError("Masukkan jumlah barang minimal 1.");
      return;
    }
    onSaveQuantity(Math.floor(cleaned));
  };

  return (
    <Modal
      testID="kasir-qty-modal"
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.headerTitleGroup}>
              <Hash size={18} color={TOKENS.colors.primary} />
              <Text style={styles.titleText}>Ubah Jumlah Barang</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={styles.closeBtn}
            >
              <X size={20} color={TOKENS.colors.onSurfaceVariant} />
            </Pressable>
          </View>
          <View style={styles.modalBody}>
            {item ? (
              <Text style={styles.itemHint}>
                {`${item.productName} · Satuan: ${item.unitName} (${formatRupiah(item.effectiveUnitPrice)})`}
              </Text>
            ) : null}
            <InputField
              testID="qty-modal-input"
              label={`Jumlah (${item?.unitName ?? "Item"})`}
              value={qtyText}
              onChangeText={(txt) => {
                setQtyText(txt.replace(/[^0-9]/g, ""));
                setError(null);
              }}
              keyboardType="numeric"
              selectTextOnFocus
              monospace
              invalid={Boolean(error)}
            />
            {error ? <FeedbackBanner variant="error" message={error} /> : null}
            <View style={styles.actionsRow}>
              <SecondaryButton
                variant="tonal"
                label="Batal"
                onPress={onClose}
                style={styles.actionBtnHalf}
              />
              <PrimaryButton
                testID="qty-modal-save-button"
                label="Terapkan"
                onPress={handleConfirm}
                style={styles.actionBtnHalf}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function DiscountModal({
  visible,
  currentDiscount,
  subtotal,
  onSaveDiscount,
  onClose,
}: {
  visible: boolean;
  currentDiscount: number;
  subtotal: number;
  onSaveDiscount: (amount: number) => void;
  onClose: () => void;
}) {
  const openKey = visible ? `open:${currentDiscount}` : "closed";
  const [prevKey, setPrevKey] = useState<string>(openKey);
  const [discountText, setDiscountText] = useState<string>(
    currentDiscount > 0 ? formatThousandDots(currentDiscount) : ""
  );
  const [error, setError] = useState<string | null>(null);

  if (openKey !== prevKey) {
    setPrevKey(openKey);
    if (visible) {
      setDiscountText(
        currentDiscount > 0 ? formatThousandDots(currentDiscount) : ""
      );
      setError(null);
    }
  }

  const handleApply = () => {
    const digits = discountText.replace(/[^0-9]/g, "");
    const clean = digits === "" ? 0 : Number(digits);
    if (!Number.isFinite(clean) || clean < 0) {
      setError("Potongan harga harus berupa angka valid minimal 0.");
      return;
    }
    if (clean > subtotal) {
      setError(
        `Potongan tidak boleh melebihi subtotal (${formatRupiah(subtotal)}).`
      );
      return;
    }
    onSaveDiscount(Math.round(clean));
  };

  return (
    <Modal
      testID="kasir-discount-modal"
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.titleText}>Atur Potongan Harga</Text>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={styles.closeBtn}
            >
              <X size={20} color={TOKENS.colors.onSurfaceVariant} />
            </Pressable>
          </View>
          <View style={styles.modalBody}>
            <Text style={styles.itemHint}>
              {`Maksimal potongan: ${formatRupiah(subtotal)}`}
            </Text>
            <InputField
              testID="discount-input"
              label="Nominal Potongan (Rp)"
              value={discountText}
              onChangeText={(txt) => {
                setDiscountText(formatThousandDots(txt));
                setError(null);
              }}
              placeholder="0"
              keyboardType="numeric"
              selectTextOnFocus
              monospace
              invalid={Boolean(error)}
            />
            {error ? <FeedbackBanner variant="error" message={error} /> : null}
            <View style={styles.actionsCol}>
              {currentDiscount > 0 ? (
                <SecondaryButton
                  testID="discount-clear-button"
                  variant="tonal"
                  label="Hapus Potongan"
                  onPress={() => onSaveDiscount(0)}
                />
              ) : null}
              <View style={styles.actionsRow}>
                <SecondaryButton
                  variant="tonal"
                  label="Batal"
                  onPress={onClose}
                  style={styles.actionBtnHalf}
                />
                <PrimaryButton
                  testID="discount-save-button"
                  label="Terapkan"
                  onPress={handleApply}
                  style={styles.actionBtnHalf}
                />
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function RemoveTabConfirmModal({
  visible,
  tabLabel,
  itemCount = 0,
  grandTotal = 0,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  tabLabel: string;
  itemCount?: number;
  grandTotal?: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      testID="kasir-remove-tab-modal"
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={styles.card}>
          <View style={styles.modalBody}>
            <View style={styles.confirmTitleRow}>
              <View style={styles.confirmIconBadge}>
                <Trash2 size={20} color={TOKENS.colors.destructive} />
              </View>
              <Text style={styles.confirmTitleText}>
                {`Hapus ${tabLabel}?`}
              </Text>
            </View>

            <Text style={styles.itemHint}>
              {itemCount > 0
                ? `Nota ini berisi ${itemCount} item (${formatRupiah(grandTotal)}). Seluruh barang dalam nota tertunda ini akan dihapus dari perangkat.`
                : "Seluruh barang dalam nota tertunda ini akan dihapus dari perangkat."}
            </Text>

            <View style={styles.actionsRow}>
              <SecondaryButton
                testID="remove-tab-cancel-button"
                variant="tonal"
                label="Batal"
                onPress={onCancel}
                style={styles.actionBtnHalf}
              />
              <SecondaryButton
                testID="remove-tab-confirm-button"
                variant="danger"
                label="Ya, Hapus Nota"
                onPress={onConfirm}
                style={styles.actionBtnHalf}
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
  card: {
    backgroundColor: TOKENS.colors.surfaceCard,
    borderRadius: TOKENS.radii.lg,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    maxHeight: "84%",
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: TOKENS.spacing.md,
    paddingVertical: TOKENS.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.colors.borderSubtle,
  },
  headerTitleGroup: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: TOKENS.spacing.sm,
  },
  titleText: {
    flex: 1,
    fontFamily: FONT_FAMILY.heading,
    fontSize: TOKENS.typography.body,
    lineHeight: TOKENS.lineHeight.body,
    color: TOKENS.colors.onSurface,
  },
  confirmTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  confirmIconBadge: {
    width: 38,
    height: 38,
    borderRadius: TOKENS.radii.md,
    backgroundColor: TOKENS.colors.errorContainer,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  confirmTitleText: {
    flex: 1,
    fontFamily: FONT_FAMILY.heading,
    fontSize: 17,
    lineHeight: 22,
    color: TOKENS.colors.onSurface,
  },
  closeBtn: {
    width: TOKENS.spacing.touchTarget,
    height: TOKENS.spacing.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  listBody: {
    padding: TOKENS.spacing.md,
    gap: TOKENS.spacing.sm,
  },
  unitOptionRow: {
    minHeight: TOKENS.spacing.touchTarget,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: TOKENS.spacing.md,
    paddingVertical: 12,
    borderRadius: TOKENS.radii.md,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    gap: TOKENS.spacing.sm,
  },
  unitOptionRowSelected: {
    backgroundColor: TOKENS.colors.primary,
    borderColor: TOKENS.colors.primary,
  },
  pressedRow: {
    opacity: 0.78,
  },
  unitMeta: {
    flex: 1,
    gap: 2,
  },
  unitName: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.body,
    lineHeight: TOKENS.lineHeight.body,
    color: TOKENS.colors.onSurface,
  },
  unitNameSelected: {
    color: TOKENS.colors.onPrimary,
  },
  unitSub: {
    fontFamily: FONT_FAMILY.body,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurfaceVariant,
  },
  unitSubSelected: {
    color: TOKENS.colors.primaryFixed,
  },
  unitOptionRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  unitPrice: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: TOKENS.typography.body,
    lineHeight: TOKENS.lineHeight.body,
    color: TOKENS.colors.primary,
  },
  unitPriceSelected: {
    color: TOKENS.colors.onPrimary,
  },
  modalBody: {
    padding: TOKENS.spacing.md,
    gap: TOKENS.spacing.md,
  },
  itemHint: {
    fontFamily: FONT_FAMILY.body,
    fontSize: TOKENS.typography.label,
    lineHeight: 19,
    color: TOKENS.colors.onSurfaceVariant,
  },
  actionsCol: {
    gap: TOKENS.spacing.sm,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 4,
  },
  actionBtnHalf: {
    flex: 1,
  },
});
