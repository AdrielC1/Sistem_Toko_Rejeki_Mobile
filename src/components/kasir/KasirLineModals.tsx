import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Layers, Tag, Trash2, X } from "lucide-react-native";
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

export function ProductUnitPickerModal({
  visible,
  product,
  units,
  onSelectUnit,
  onClose,
}: {
  visible: boolean;
  product: Product | null;
  units: SelectableProductUnit[];
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
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.titleRow}>
              <Layers size={18} color={TOKENS.colors.primary} />
              <Text style={styles.titleText}>
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
            {units.map((unit) => (
              <Pressable
                key={unit.unitId}
                testID={`unit-option-${unit.unitId}`}
                accessibilityRole="button"
                onPress={() => onSelectUnit(unit)}
                style={({ pressed }) => [
                  styles.unitOptionRow,
                  pressed && styles.pressedRow,
                ]}
              >
                <View style={styles.unitMeta}>
                  <Text style={styles.unitName}>{unit.unitName}</Text>
                  <Text style={styles.unitSub}>
                    {unit.isBaseUnit
                      ? "Satuan Dasar"
                      : `Isi ${unit.conversionFactor} satuan dasar`}
                  </Text>
                </View>
                <Text style={styles.unitPrice}>
                  {formatRupiah(unit.sellingPrice)}
                </Text>
              </Pressable>
            ))}
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
  const openKey = visible && item ? `${item.productId}:${item.unitId}:${item.effectiveUnitPrice}` : "closed";
  const [prevKey, setPrevKey] = useState<string>(openKey);
  const [priceText, setPriceText] = useState<string>(
    item ? String(item.effectiveUnitPrice) : ""
  );
  const [error, setError] = useState<string | null>(null);

  if (openKey !== prevKey) {
    setPrevKey(openKey);
    if (visible && item) {
      setPriceText(String(item.effectiveUnitPrice));
      setError(null);
    }
  }

  const handleConfirm = () => {
    const cleaned = Number(priceText.replace(/[^0-9]/g, ""));
    if (!Number.isFinite(cleaned) || cleaned < 0 || priceText.trim() === "") {
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
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.titleRow}>
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
                setPriceText(txt.replace(/[^0-9]/g, ""));
                setError(null);
              }}
              keyboardType="numeric"
              monospace
              invalid={Boolean(error)}
            />
            {error ? <FeedbackBanner variant="error" message={error} /> : null}
            <View style={styles.actionsCol}>
              <PrimaryButton
                testID="open-price-save-button"
                label="Terapkan Harga Khusus"
                onPress={handleConfirm}
              />
              {item?.isCustomPrice ? (
                <SecondaryButton
                  testID="open-price-reset-button"
                  variant="tonal"
                  label="Kembalikan ke Harga Normal / Grosir"
                  onPress={onResetPrice}
                />
              ) : null}
              <SecondaryButton
                variant="outlined"
                label="Batal"
                onPress={onClose}
              />
            </View>
          </View>
        </View>
      </View>
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
    currentDiscount > 0 ? String(currentDiscount) : ""
  );
  const [error, setError] = useState<string | null>(null);

  if (openKey !== prevKey) {
    setPrevKey(openKey);
    if (visible) {
      setDiscountText(currentDiscount > 0 ? String(currentDiscount) : "");
      setError(null);
    }
  }

  const handleApply = () => {
    const clean = discountText.trim() === "" ? 0 : Number(discountText);
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
      <View style={styles.backdrop}>
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
                setDiscountText(txt.replace(/[^0-9]/g, ""));
                setError(null);
              }}
              placeholder="0"
              keyboardType="numeric"
              monospace
              invalid={Boolean(error)}
            />
            {error ? <FeedbackBanner variant="error" message={error} /> : null}
            <View style={styles.actionsCol}>
              <PrimaryButton
                testID="discount-save-button"
                label="Simpan Potongan"
                onPress={handleApply}
              />
              {currentDiscount > 0 ? (
                <SecondaryButton
                  testID="discount-clear-button"
                  variant="tonal"
                  label="Hapus Potongan"
                  onPress={() => onSaveDiscount(0)}
                />
              ) : null}
              <SecondaryButton
                variant="outlined"
                label="Batal"
                onPress={onClose}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function RemoveTabConfirmModal({
  visible,
  tabLabel,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  tabLabel: string;
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
        <View style={styles.card}>
          <View style={styles.modalBody}>
            <View style={styles.titleRow}>
              <Trash2 size={18} color={TOKENS.colors.destructive} />
              <Text style={styles.titleText}>{`Hapus ${tabLabel}?`}</Text>
            </View>
            <Text style={styles.itemHint}>
              Seluruh barang dalam nota tertunda ini akan dihapus dari perangkat.
            </Text>
            <View style={styles.actionsCol}>
              <SecondaryButton
                testID="remove-tab-confirm-button"
                variant="danger"
                label="Ya, Hapus Nota"
                onPress={onConfirm}
              />
              <SecondaryButton
                testID="remove-tab-cancel-button"
                variant="tonal"
                label="Batal"
                onPress={onCancel}
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
  titleRow: {
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
    padding: TOKENS.spacing.md,
    borderRadius: TOKENS.radii.md,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    gap: TOKENS.spacing.sm,
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
  unitSub: {
    fontFamily: FONT_FAMILY.body,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurfaceVariant,
  },
  unitPrice: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: TOKENS.typography.body,
    lineHeight: TOKENS.lineHeight.body,
    color: TOKENS.colors.primary,
  },
  modalBody: {
    padding: TOKENS.spacing.md,
    gap: TOKENS.spacing.md,
  },
  itemHint: {
    fontFamily: FONT_FAMILY.body,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurfaceVariant,
  },
  actionsCol: {
    gap: TOKENS.spacing.sm,
  },
});
