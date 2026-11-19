import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LayoutGrid, Search, Star, X } from "lucide-react-native";
import {
  MAX_PINNED_CATEGORIES,
  usePinnedCategoriesStore,
} from "@/store/pinnedCategoriesStore";
import { FONT_FAMILY, TOKENS } from "@/theme/tokens";
import type { Category } from "@/types";

export interface CategoryPickerModalProps {
  visible: boolean;
  categories: Category[];
  selectedCategoryId: string;
  enablePinning?: boolean;
  onSelect: (categoryId: string) => void;
  onClose: () => void;
}

/**
 * Pure text-only category bottom sheet / modal matching the Hybrid pattern in
 * `TEMP_REFERENSI.html` styled with Velocity Blue tokens (no category icons/symbols).
 */
export function CategoryPickerModal({
  visible,
  categories,
  selectedCategoryId,
  enablePinning = false,
  onSelect,
  onClose,
}: CategoryPickerModalProps) {
  const [query, setQuery] = useState<string>("");
  const pinnedIds = usePinnedCategoriesStore((s) => s.pinnedIds);
  const togglePin = usePinnedCategoriesStore((s) => s.togglePin);

  const sortedCategories = useMemo(
    () =>
      [...categories].sort((a, b) => a.name.localeCompare(b.name, "id-ID")),
    [categories]
  );

  const pinnedCategories = useMemo(
    () => sortedCategories.filter((cat) => pinnedIds.includes(cat.id)),
    [pinnedIds, sortedCategories]
  );

  const filteredCategories = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return sortedCategories;
    }
    return sortedCategories.filter((cat) =>
      cat.name.toLowerCase().includes(q)
    );
  }, [query, sortedCategories]);

  const handleClose = () => {
    setQuery("");
    onClose();
  };

  const handleSelectCategory = (categoryId: string) => {
    onSelect(categoryId);
    setQuery("");
    onClose();
  };

  return (
    <Modal
      testID="category-picker-modal"
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={styles.modalSheet}>
          <View style={styles.sheetHandle} />

          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderText}>
              <Text style={styles.modalTitle}>
                {`Semua Kategori (${categories.length})`}
              </Text>
              <Text style={styles.modalSubtitle}>
                {enablePinning
                  ? `Ketuk bintang untuk sematkan favorit ke baris utama (maks. ${MAX_PINNED_CATEGORIES}).`
                  : "Pilih kategori untuk memfilter daftar produk."}
              </Text>
            </View>
            <Pressable
              testID="category-modal-close"
              accessibilityRole="button"
              accessibilityLabel="Tutup modal kategori"
              onPress={handleClose}
              style={styles.modalCloseBtn}
            >
              <X size={18} color={TOKENS.colors.onSurfaceVariant} />
            </Pressable>
          </View>

          <View style={styles.modalSearchWrap}>
            <View style={styles.modalSearchBox}>
              <Search size={16} color={TOKENS.colors.outline} />
              <TextInput
                testID="category-modal-search"
                value={query}
                onChangeText={setQuery}
                placeholder="Ketik nama kategori..."
                placeholderTextColor={TOKENS.colors.outline}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.modalSearchInput}
              />
              {query.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setQuery("")}
                  style={styles.clearIconBtn}
                >
                  <X size={14} color={TOKENS.colors.onSurfaceVariant} />
                </Pressable>
              ) : null}
            </View>
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {enablePinning &&
            query.trim().length === 0 &&
            pinnedCategories.length > 0 ? (
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionLabel}>
                  {`Disematkan (${pinnedCategories.length}/${MAX_PINNED_CATEGORIES})`}
                </Text>
                <View style={styles.pinnedModalRow}>
                  {pinnedCategories.map((cat) => (
                    <Pressable
                      key={`modal-pin-${cat.id}`}
                      onPress={() => handleSelectCategory(cat.id)}
                      style={[
                        styles.pinnedModalChip,
                        selectedCategoryId === cat.id &&
                          styles.pinnedModalChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.pinnedModalChipText,
                          selectedCategoryId === cat.id &&
                            styles.pinnedModalChipTextActive,
                        ]}
                      >
                        {cat.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <Pressable
              testID="category-modal-option-all"
              onPress={() => handleSelectCategory("all")}
              style={[
                styles.allOptionRow,
                selectedCategoryId === "all" && styles.allOptionRowActive,
              ]}
            >
              <Text
                style={[
                  styles.allOptionText,
                  selectedCategoryId === "all" && styles.allOptionTextActive,
                ]}
              >
                Semua Kategori
              </Text>
            </Pressable>

            <View style={styles.modalSection}>
              <Text style={styles.modalSectionLabel}>
                Daftar Kategori (A–Z)
              </Text>
              {filteredCategories.length === 0 ? (
                <View style={styles.emptyCatState}>
                  <Text style={styles.emptyCatText}>
                    {`Kategori "${query}" tidak ditemukan.`}
                  </Text>
                </View>
              ) : (
                <View style={styles.categoryGrid}>
                  {filteredCategories.map((cat) => {
                    const isSelected = selectedCategoryId === cat.id;
                    const isPinned = pinnedIds.includes(cat.id);
                    const pinDisabled =
                      !isPinned && pinnedIds.length >= MAX_PINNED_CATEGORIES;
                    return (
                      <View
                        key={cat.id}
                        style={[
                          styles.categoryGridCard,
                          isSelected && styles.categoryGridCardActive,
                        ]}
                      >
                        <Pressable
                          testID={`category-modal-item-${cat.id}`}
                          accessibilityRole="button"
                          onPress={() => handleSelectCategory(cat.id)}
                          style={styles.categoryGridTapArea}
                        >
                          <Text
                            numberOfLines={2}
                            style={[
                              styles.categoryGridTitle,
                              isSelected && styles.categoryGridTitleActive,
                            ]}
                          >
                            {cat.name}
                          </Text>
                        </Pressable>

                        {enablePinning ? (
                          <Pressable
                            testID={`category-modal-pin-${cat.id}`}
                            accessibilityRole="button"
                            accessibilityLabel={
                              isPinned
                                ? `Lepas sematan ${cat.name}`
                                : `Sematkan ${cat.name}`
                            }
                            disabled={pinDisabled}
                            hitSlop={8}
                            onPress={() => togglePin(cat.id)}
                            style={[
                              styles.pinToggleBtn,
                              isPinned && styles.pinToggleBtnActive,
                              pinDisabled && styles.pinToggleBtnDisabled,
                            ]}
                          >
                            <Star
                              size={15}
                              color={
                                isPinned
                                  ? TOKENS.colors.warningBorder
                                  : TOKENS.colors.outline
                              }
                              fill={
                                isPinned ? TOKENS.colors.warning : "transparent"
                              }
                            />
                          </Pressable>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export interface HybridCategoryBarProps {
  categories: Category[];
  selectedCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
  testIDPrefix?: string;
}

/**
 * Pola 1 Hybrid Category Bar (Velocity Blue, pure text categories):
 * `[Semua (N)]` modal trigger + `[Semua Produk]` + (active non-pinned `✕`) + pinned favorite text pills.
 */
export function HybridCategoryBar({
  categories,
  selectedCategoryId,
  onSelectCategory,
  testIDPrefix = "kasir",
}: HybridCategoryBarProps) {
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const pinnedIds = usePinnedCategoriesStore((s) => s.pinnedIds);

  const pinnedCategories = useMemo(
    () => categories.filter((c) => pinnedIds.includes(c.id)),
    [categories, pinnedIds]
  );

  const activeCategory = useMemo(
    () =>
      selectedCategoryId !== "all"
        ? categories.find((c) => c.id === selectedCategoryId) ?? null
        : null,
    [categories, selectedCategoryId]
  );

  const activeNotPinned =
    activeCategory && !pinnedIds.includes(activeCategory.id)
      ? activeCategory
      : null;

  return (
    <View style={styles.barWrap}>
      <View style={styles.barFlow}>
        <Pressable
          testID={`${testIDPrefix}-category-modal-trigger`}
          accessibilityRole="button"
          onPress={() => setModalOpen(true)}
          style={({ pressed }) => [
            styles.allCategoriesTrigger,
            pressed && styles.pressedItem,
          ]}
        >
          <LayoutGrid size={14} color={TOKENS.colors.onPrimary} />
          <Text style={styles.allCategoriesTriggerText}>
            {`Semua (${categories.length})`}
          </Text>
        </Pressable>

        <Pressable
          testID={`${testIDPrefix}-category-all`}
          accessibilityRole="button"
          accessibilityState={{ selected: selectedCategoryId === "all" }}
          onPress={() => onSelectCategory("all")}
          style={[
            styles.textChip,
            selectedCategoryId === "all" && styles.textChipPrimaryActive,
          ]}
        >
          <Text
            style={[
              styles.textChipLabel,
              selectedCategoryId === "all" && styles.textChipPrimaryLabelActive,
            ]}
          >
            Semua Produk
          </Text>
        </Pressable>

        {activeNotPinned ? (
          <View style={styles.activeNonPinnedPill}>
            <Text style={styles.activeNonPinnedText}>
              {activeNotPinned.name}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Hapus filter ${activeNotPinned.name}`}
              hitSlop={6}
              onPress={() => onSelectCategory("all")}
              style={styles.removeFilterCircle}
            >
              <X size={11} color={TOKENS.colors.onPrimaryFixed} />
            </Pressable>
          </View>
        ) : null}

        {pinnedCategories.map((cat) => {
          const isSelected = selectedCategoryId === cat.id;
          return (
            <Pressable
              key={cat.id}
              testID={`${testIDPrefix}-category-${cat.id}`}
              accessibilityRole="button"
              onPress={() => onSelectCategory(cat.id)}
              style={[
                styles.textChip,
                isSelected && styles.textChipPrimaryActive,
              ]}
            >
              <Text
                style={[
                  styles.textChipLabel,
                  isSelected && styles.textChipPrimaryLabelActive,
                ]}
              >
                {cat.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <CategoryPickerModal
        visible={modalOpen}
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        enablePinning
        onSelect={onSelectCategory}
        onClose={() => setModalOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  barWrap: {
    paddingTop: 2,
  },
  barFlow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  allCategoriesTrigger: {
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: TOKENS.radii.sm,
    backgroundColor: TOKENS.colors.primary,
    borderWidth: 1,
    borderColor: TOKENS.colors.primary,
  },
  allCategoriesTriggerText: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: TOKENS.colors.onPrimary,
  },
  textChip: {
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    borderRadius: TOKENS.radii.sm,
    backgroundColor: TOKENS.colors.surfaceCard,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
  },
  textChipPrimaryActive: {
    backgroundColor: TOKENS.colors.primaryFixed,
    borderColor: "#93b8f8",
  },
  textChipLabel: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: TOKENS.colors.onSurfaceVariant,
  },
  textChipPrimaryLabelActive: {
    color: TOKENS.colors.onPrimaryFixed,
  },
  activeNonPinnedPill: {
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingLeft: 10,
    paddingRight: 6,
    borderRadius: TOKENS.radii.sm,
    backgroundColor: TOKENS.colors.primaryFixed,
    borderWidth: 1,
    borderColor: "#93b8f8",
  },
  activeNonPinnedText: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: TOKENS.colors.onPrimaryFixed,
  },
  removeFilterCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: TOKENS.colors.surfaceCard,
    alignItems: "center",
    justifyContent: "center",
  },
  pressedItem: {
    opacity: 0.82,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: TOKENS.colors.modalBackdrop,
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: TOKENS.colors.surfaceCard,
    borderTopLeftRadius: TOKENS.radii.lg,
    borderTopRightRadius: TOKENS.radii.lg,
    maxHeight: "84%",
    overflow: "hidden",
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: TOKENS.colors.borderSubtle,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  modalHeader: {
    paddingHorizontal: TOKENS.spacing.md,
    paddingVertical: TOKENS.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.colors.borderSubtle,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: TOKENS.spacing.sm,
  },
  modalHeaderText: {
    flex: 1,
  },
  modalTitle: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: 17,
    lineHeight: 22,
    color: TOKENS.colors.onSurface,
  },
  modalSubtitle: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 12,
    lineHeight: 16,
    color: TOKENS.colors.muted,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: TOKENS.colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSearchWrap: {
    paddingHorizontal: TOKENS.spacing.md,
    paddingVertical: TOKENS.spacing.sm,
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.colors.borderSubtle,
  },
  modalSearchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TOKENS.colors.surfaceCard,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    borderRadius: TOKENS.radii.md,
    paddingHorizontal: TOKENS.spacing.sm,
    gap: TOKENS.spacing.xs,
  },
  modalSearchInput: {
    flex: 1,
    fontFamily: FONT_FAMILY.body,
    fontSize: 14,
    color: TOKENS.colors.onSurface,
    paddingVertical: 8,
  },
  clearIconBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  modalScroll: {
    maxHeight: 460,
  },
  modalScrollContent: {
    padding: TOKENS.spacing.md,
    gap: TOKENS.spacing.md,
  },
  modalSection: {
    gap: TOKENS.spacing.xs,
  },
  modalSectionLabel: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 11,
    lineHeight: 15,
    color: TOKENS.colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  pinnedModalRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  pinnedModalChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: TOKENS.radii.sm,
    backgroundColor: TOKENS.colors.warningBg,
    borderWidth: 1,
    borderColor: TOKENS.colors.warningBorder,
  },
  pinnedModalChipActive: {
    backgroundColor: TOKENS.colors.primary,
    borderColor: TOKENS.colors.primary,
  },
  pinnedModalChipText: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: TOKENS.colors.warningText,
  },
  pinnedModalChipTextActive: {
    color: TOKENS.colors.onPrimary,
  },
  allOptionRow: {
    paddingHorizontal: TOKENS.spacing.md,
    paddingVertical: 10,
    borderRadius: TOKENS.radii.sm,
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
  },
  allOptionRowActive: {
    backgroundColor: TOKENS.colors.primaryFixed,
    borderColor: TOKENS.colors.primary,
  },
  allOptionText: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 13,
    lineHeight: 18,
    color: TOKENS.colors.onSurface,
  },
  allOptionTextActive: {
    color: TOKENS.colors.onPrimaryFixed,
  },
  emptyCatState: {
    paddingVertical: TOKENS.spacing.lg,
    alignItems: "center",
  },
  emptyCatText: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 13,
    color: TOKENS.colors.muted,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: TOKENS.spacing.xs,
  },
  categoryGridCard: {
    width: "48.8%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: TOKENS.colors.surfaceCard,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    borderRadius: TOKENS.radii.md,
    paddingLeft: TOKENS.spacing.sm,
    paddingRight: 4,
    paddingVertical: 6,
    minHeight: 46,
  },
  categoryGridCardActive: {
    backgroundColor: TOKENS.colors.primaryFixed,
    borderColor: TOKENS.colors.primary,
  },
  categoryGridTapArea: {
    flex: 1,
    paddingVertical: 4,
  },
  categoryGridTitle: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 13,
    lineHeight: 17,
    color: TOKENS.colors.onSurface,
  },
  categoryGridTitleActive: {
    color: TOKENS.colors.onPrimaryFixed,
  },
  pinToggleBtn: {
    width: 30,
    height: 30,
    borderRadius: TOKENS.radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  pinToggleBtnActive: {
    backgroundColor: TOKENS.colors.warningBg,
  },
  pinToggleBtnDisabled: {
    opacity: 0.3,
  },
});
