import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  Info,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react-native";
import {
  FeedbackBanner,
  PrimaryButton,
  SecondaryButton,
} from "@/components/ui/VelocityPrimitives";
import { useAuth } from "@/context/AuthContext";
import { useSystemStatus } from "@/context/SystemStatusContext";
import { getCatalogProductById } from "@/db/catalogRepo";
import { formatRupiah } from "@/domain/format";
import { useLocalCatalog } from "@/hooks/useLocalCatalog";
import {
  createServerProduct,
  fetchServerProductDetail,
  updateServerProduct,
} from "@/services/api/productsApi";
import { FONT_FAMILY, TOKENS } from "@/theme/tokens";

const DEFAULT_FALLBACK_UNITS = [
  "Pcs",
  "Dus",
  "Slop",
  "Bal",
  "Ikat",
  "Karton",
  "Pack",
  "Box",
  "Lusin",
];

interface DraftConversion {
  key: string;
  unitId: string;
  unitName: string;
  factorText: string;
  costPriceText: string;
  priceText: string;
}

interface DraftWholesaleTier {
  key: string;
  unitName: string;
  minQtyText: string;
  priceText: string;
}

function formatThousandId(rawDigits: string): string {
  const cleaned = rawDigits.replace(/[^0-9]/g, "");
  if (!cleaned) {
    return "";
  }
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num <= 0) {
    return cleaned === "0" ? "0" : "";
  }
  return num.toLocaleString("id-ID");
}

function SearchableOptionModal({
  visible,
  title,
  placeholder,
  options,
  selectedValue,
  disabledValues = [],
  allowCustom = true,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  placeholder: string;
  options: string[];
  selectedValue: string;
  disabledValues?: string[];
  allowCustom?: boolean;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState<string>("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return options;
    }
    return options.filter((opt) => opt.toLowerCase().includes(q));
  }, [options, query]);

  const exactMatchExists = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return true;
    }
    return options.some((opt) => opt.toLowerCase() === q);
  }, [options, query]);

  const handleClose = () => {
    setQuery("");
    onClose();
  };

  const handlePick = (val: string) => {
    setQuery("");
    onSelect(val);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={handleClose}
              style={styles.modalCloseBtn}
            >
              <X size={18} color={TOKENS.colors.onSurfaceVariant} />
            </Pressable>
          </View>

          <View style={styles.modalSearchWrap}>
            <Search size={16} color={TOKENS.colors.outline} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={placeholder}
              placeholderTextColor={TOKENS.colors.outline}
              autoCapitalize="words"
              autoCorrect={false}
              style={styles.modalSearchInput}
            />
            {query.length > 0 ? (
              <Pressable onPress={() => setQuery("")} hitSlop={8}>
                <X size={15} color={TOKENS.colors.onSurfaceVariant} />
              </Pressable>
            ) : null}
          </View>

          <ScrollView
            style={styles.modalList}
            contentContainerStyle={styles.modalListContent}
            keyboardShouldPersistTaps="handled"
          >
            {allowCustom && query.trim().length > 0 && !exactMatchExists ? (
              <Pressable
                onPress={() => handlePick(query.trim())}
                style={styles.customOptionRow}
              >
                <Plus size={16} color={TOKENS.colors.primary} />
                <Text style={styles.customOptionText}>
                  {`Gunakan "${query.trim()}"`}
                </Text>
              </Pressable>
            ) : null}

            {filtered.length === 0 ? (
              <Text style={styles.modalEmptyText}>
                Tidak ada pilihan yang cocok.
              </Text>
            ) : (
              filtered.map((opt) => {
                const isSelected =
                  opt.trim().toLowerCase() ===
                  selectedValue.trim().toLowerCase();
                const isDisabled =
                  !isSelected &&
                  disabledValues.some(
                    (d) => d.trim().toLowerCase() === opt.trim().toLowerCase()
                  );
                return (
                  <Pressable
                    key={opt}
                    disabled={isDisabled}
                    onPress={() => handlePick(opt)}
                    style={[
                      styles.modalOptionRow,
                      isSelected && styles.modalOptionRowActive,
                      isDisabled && styles.modalOptionRowDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        isSelected && styles.modalOptionTextActive,
                        isDisabled && styles.modalOptionTextDisabled,
                      ]}
                    >
                      {opt}
                    </Text>
                    {isSelected ? (
                      <Check size={16} color={TOKENS.colors.onPrimary} />
                    ) : null}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function ProductFormScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = typeof id === "string" && id.trim().length > 0;
  const { role, serverConfig } = useAuth();
  const { healthState, isDeviceConnected, dbOnline } = useSystemStatus();
  const { categories, units } = useLocalCatalog({ includeInactive: true });

  const [name, setName] = useState<string>("");
  const [sku, setSku] = useState<string>("");
  const [barcode, setBarcode] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [categoryName, setCategoryName] = useState<string>("");
  const [unitId, setUnitId] = useState<string>("");
  const [unitName, setUnitName] = useState<string>("");
  const [costPriceText, setCostPriceText] = useState<string>("0");
  const [sellingPriceText, setSellingPriceText] = useState<string>("");
  const [stockText, setStockText] = useState<string>("0");
  const [sellBaseUnit, setSellBaseUnit] = useState<boolean>(true);
  const [isOpenPrice, setIsOpenPrice] = useState<boolean>(false);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [conversions, setConversions] = useState<DraftConversion[]>([]);
  const [wholesaleTiers, setWholesaleTiers] = useState<DraftWholesaleTier[]>(
    []
  );
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Picker modal states
  const [categoryPickerOpen, setCategoryPickerOpen] = useState<boolean>(false);
  const [unitPickerTarget, setUnitPickerTarget] = useState<
    | { type: "base" }
    | { type: "conversion"; key: string }
    | { type: "wholesale"; key: string }
    | null
  >(null);

  const canWriteOnline =
    isDeviceConnected &&
    dbOnline &&
    healthState !== "offline" &&
    healthState !== "read_only";

  useEffect(() => {
    let active = true;
    if (!isEdit || typeof id !== "string") {
      return;
    }

    void (async () => {
      const local = await getCatalogProductById(id, role);
      const source =
        local ??
        (await fetchServerProductDetail(serverConfig, id, role)).product;
      if (!active || !source) {
        return;
      }
      const resolvedBaseName = source.unitName?.trim() || "Pcs";
      setName(source.name);
      setSku(source.sku);
      setBarcode(source.barcode ?? "");
      setCategoryId(source.categoryId);
      setCategoryName(source.categoryName ?? "");
      setUnitId(source.unitId);
      setUnitName(resolvedBaseName);
      setCostPriceText(String(source.costPrice ?? 0));
      setSellingPriceText(String(source.sellingPrice));
      setStockText(String(source.stock ?? 0));
      setSellBaseUnit(source.sellBaseUnit !== false);
      setIsOpenPrice(Boolean(source.isOpenPrice));
      setIsActive(source.isActive);
      setConversions(
        source.unitConversions
          .filter(
            (c) =>
              c.unitId !== source.unitId &&
              c.unitName.trim().toLowerCase() !==
                resolvedBaseName.toLowerCase()
          )
          .map((c, idx) => ({
            key: `conv-${idx}-${c.unitId || c.unitName}`,
            unitId: c.unitId,
            unitName: c.unitName?.trim() || "Satuan",
            factorText: String(c.conversionFactor),
            costPriceText: String(c.costPrice ?? 0),
            priceText: String(c.sellingPrice),
          }))
      );
      setWholesaleTiers(
        source.wholesaleTiers.map((t, idx) => ({
          key: `tier-${idx}-${t.minQty}`,
          unitName: t.unitName?.trim() || resolvedBaseName,
          minQtyText: String(t.minQty),
          priceText: String(t.price),
        }))
      );
    })();

    return () => {
      active = false;
    };
  }, [id, isEdit, role, serverConfig]);

  const effectiveCategoryName =
    categoryName.trim() ||
    categories.find((c) => c.id === categoryId)?.name ||
    categories[0]?.name ||
    "";
  const effectiveCategoryId =
    categories.find(
      (c) =>
        c.name.trim().toLowerCase() ===
        effectiveCategoryName.trim().toLowerCase()
    )?.id ||
    categoryId ||
    categories[0]?.id ||
    "cat-default";

  const baseUnitName =
    unitName.trim() ||
    units.find((u) => u.id === unitId)?.name ||
    units[0]?.name ||
    "Pcs";
  const effectiveUnitId =
    units.find(
      (u) => u.name.trim().toLowerCase() === baseUnitName.trim().toLowerCase()
    )?.id ||
    unitId ||
    units[0]?.id ||
    "unit-default";

  const categoryOptions = useMemo(() => {
    const names = categories.map((c) => c.name.trim()).filter(Boolean);
    if (
      effectiveCategoryName &&
      !names.some(
        (n) => n.toLowerCase() === effectiveCategoryName.toLowerCase()
      )
    ) {
      names.unshift(effectiveCategoryName);
    }
    return names;
  }, [categories, effectiveCategoryName]);

  const unitOptions = useMemo(() => {
    const set = new Set<string>();
    for (const u of units) {
      if (u.name.trim()) {
        set.add(u.name.trim());
      }
    }
    for (const fallback of DEFAULT_FALLBACK_UNITS) {
      set.add(fallback);
    }
    return Array.from(set);
  }, [units]);

  const configuredProductUnitNames = useMemo(() => {
    const list: string[] = [];
    if (baseUnitName.trim()) {
      list.push(baseUnitName.trim());
    }
    for (const c of conversions) {
      const n = c.unitName.trim();
      if (n && !list.some((x) => x.toLowerCase() === n.toLowerCase())) {
        list.push(n);
      }
    }
    return list.length > 0 ? list : ["Pcs"];
  }, [baseUnitName, conversions]);

  const resolveRegularPriceForUnitName = (targetName: string): number => {
    if (
      targetName.trim().toLowerCase() === baseUnitName.trim().toLowerCase()
    ) {
      return Number(sellingPriceText || "0") || 0;
    }
    const found = conversions.find(
      (c) => c.unitName.trim().toLowerCase() === targetName.trim().toLowerCase()
    );
    return Number(found?.priceText || "0") || 0;
  };

  const handleAddConversion = () => {
    const usedLower = new Set(
      [baseUnitName, ...conversions.map((c) => c.unitName)].map((n) =>
        n.trim().toLowerCase()
      )
    );
    const candidateName =
      unitOptions.find((opt) => !usedLower.has(opt.toLowerCase())) ?? "Dus";
    const candidateUnitObj = units.find(
      (u) => u.name.trim().toLowerCase() === candidateName.toLowerCase()
    );

    setConversions((prev) => [
      ...prev,
      {
        key: `conv-${Date.now()}-${prev.length}`,
        unitId: candidateUnitObj?.id ?? `unit-${candidateName.toLowerCase()}`,
        unitName: candidateName,
        factorText: "12",
        costPriceText: "0",
        priceText: "0",
      },
    ]);
  };

  const handleAddWholesaleTier = () => {
    setWholesaleTiers((prev) => [
      ...prev,
      {
        key: `tier-${Date.now()}-${prev.length}`,
        unitName: configuredProductUnitNames[0] || baseUnitName,
        minQtyText: "5",
        priceText: sellingPriceText || "0",
      },
    ]);
  };

  const handleSave = async () => {
    if (isSaving || !canWriteOnline) {
      return;
    }
    if (!name.trim()) {
      setErrorMsg("Nama produk wajib diisi.");
      return;
    }
    if (!effectiveCategoryName.trim()) {
      setErrorMsg("Kategori produk wajib dipilih atau diisi.");
      return;
    }

    const sellingPrice = Number(sellingPriceText || "0");
    const costPrice = Number(costPriceText || "0");
    const stock = Number(stockText || "0");
    if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
      setErrorMsg("Harga jual harus berupa angka valid.");
      return;
    }
    if (sellBaseUnit && sellingPrice <= 0) {
      setErrorMsg(
        "Harga jual untuk Satuan Dasar harus lebih besar dari Rp 0."
      );
      return;
    }

    const resolvedCostPrice = Number.isFinite(costPrice)
      ? Math.max(0, Math.round(costPrice))
      : 0;
    const resolvedSellingPrice = Math.round(sellingPrice);

    const normalizedTiers = wholesaleTiers
      .filter((t) => Number(t.minQtyText) > 0 && Number(t.priceText) > 0)
      .map((t) => {
        const tierPrice = Math.max(0, Math.round(Number(t.priceText)));
        const tierUnitName = t.unitName.trim() || baseUnitName;
        return {
          unitName: tierUnitName,
          minQty: Math.max(1, Math.round(Number(t.minQtyText))),
          price: tierPrice,
          specialPrice: tierPrice,
        };
      });

    for (const tier of normalizedTiers) {
      const normalPrice = resolveRegularPriceForUnitName(tier.unitName);
      if (normalPrice > 0 && tier.price >= normalPrice) {
        setErrorMsg(
          `Harga grosir satuan "${tier.unitName}" (${formatRupiah(tier.price)}) harus lebih kecil dari harga normalnya (${formatRupiah(normalPrice)}).`
        );
        return;
      }
    }

    const extraConversions = conversions
      .filter(
        (c) =>
          c.unitName.trim() &&
          c.unitName.trim().toLowerCase() !== baseUnitName.trim().toLowerCase()
      )
      .map((c) => {
        const factor = Math.max(1, Number(c.factorText || "1"));
        const cleanUnitName = c.unitName.trim();
        const convUnit = units.find(
          (u) => u.name.trim().toLowerCase() === cleanUnitName.toLowerCase()
        );
        const rawConvCost = Number(c.costPriceText || "0");
        const resolvedConvCost =
          Number.isFinite(rawConvCost) && rawConvCost > 0
            ? Math.round(rawConvCost)
            : Math.round(resolvedCostPrice * factor);
        const unitTiers = normalizedTiers.filter(
          (t) => t.unitName.toLowerCase() === cleanUnitName.toLowerCase()
        );
        return {
          unitId:
            convUnit?.id || c.unitId || `unit-${cleanUnitName.toLowerCase()}`,
          unitName: cleanUnitName,
          conversionFactor: factor,
          costPrice: resolvedConvCost,
          sellingPrice: Math.max(0, Math.round(Number(c.priceText || "0"))),
          isActive: true,
          wholesaleTiers: unitTiers,
        };
      });

    const baseUnitTiers = normalizedTiers.filter(
      (t) => t.unitName.toLowerCase() === baseUnitName.toLowerCase()
    );

    const payload = {
      sku: sku.trim(),
      barcode: barcode.trim() || null,
      name: name.trim(),
      categoryId: effectiveCategoryId,
      categoryName: effectiveCategoryName.trim() || "Umum",
      unitId: effectiveUnitId,
      unitName: baseUnitName,
      costPrice: resolvedCostPrice,
      sellingPrice: resolvedSellingPrice,
      isOpenPrice,
      sellBaseUnit,
      stock: Number.isFinite(stock) ? Math.max(0, Math.round(stock)) : 0,
      isActive,
      unitConversions: [
        {
          unitId: effectiveUnitId,
          unitName: baseUnitName,
          conversionFactor: 1,
          costPrice: resolvedCostPrice,
          sellingPrice: resolvedSellingPrice,
          isActive: sellBaseUnit,
          wholesaleTiers: baseUnitTiers,
        },
        ...extraConversions,
      ],
      wholesaleTiers: normalizedTiers,
    };

    setIsSaving(true);
    setErrorMsg(null);
    try {
      const res =
        isEdit && typeof id === "string"
          ? await updateServerProduct(serverConfig, id, payload, role)
          : await createServerProduct(serverConfig, payload, role);

      if (res.ok) {
        router.back();
      } else {
        setErrorMsg(res.error ?? "Gagal menyimpan data produk ke server.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const currentUnitModalValue = useMemo(() => {
    if (!unitPickerTarget) {
      return "";
    }
    if (unitPickerTarget.type === "base") {
      return baseUnitName;
    }
    if (unitPickerTarget.type === "conversion") {
      return (
        conversions.find((c) => c.key === unitPickerTarget.key)?.unitName ?? ""
      );
    }
    return (
      wholesaleTiers.find((t) => t.key === unitPickerTarget.key)?.unitName ??
      baseUnitName
    );
  }, [baseUnitName, conversions, unitPickerTarget, wholesaleTiers]);

  const currentUnitModalDisabled = useMemo(() => {
    if (!unitPickerTarget || unitPickerTarget.type === "wholesale") {
      return [];
    }
    if (unitPickerTarget.type === "base") {
      return conversions.map((c) => c.unitName);
    }
    return [
      baseUnitName,
      ...conversions
        .filter((c) => c.key !== unitPickerTarget.key)
        .map((c) => c.unitName),
    ];
  }, [baseUnitName, conversions, unitPickerTarget]);

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={["top"]} style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <ChevronLeft size={22} color={TOKENS.colors.onSurface} />
        </Pressable>
        <Text numberOfLines={1} style={styles.topTitle}>
          {isEdit ? "Edit Produk & Skema Harga" : "Tambah Produk Baru"}
        </Text>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!canWriteOnline ? (
          <FeedbackBanner
            variant="warning"
            message="Server/database tidak terjangkau. Penambahan dan perubahan produk hanya dapat dilakukan saat online."
          />
        ) : null}

        {errorMsg ? (
          <FeedbackBanner variant="error" message={errorMsg} />
        ) : null}

        {/* ── SECTION A: INFORMASI DASAR PRODUK ── */}
        <View style={styles.basicInfoCard}>
          <View style={styles.basicInfoHeader}>
            <Info size={16} color={TOKENS.colors.primary} />
            <Text style={styles.basicInfoTitle}>INFORMASI DASAR PRODUK</Text>
          </View>

          {/* Nama Produk */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Nama Produk <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              testID="produk-form-name"
              value={name}
              onChangeText={setName}
              placeholder="Masukkan nama produk..."
              placeholderTextColor={TOKENS.colors.outline}
              style={styles.whiteTextInput}
            />
          </View>

          {/* Kategori (Dropdown Picker with Clear X & Chevron) */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Kategori <Text style={styles.requiredStar}>*</Text>
            </Text>
            <Pressable
              testID="produk-form-category-trigger"
              accessibilityRole="button"
              onPress={() => setCategoryPickerOpen(true)}
              style={styles.selectBox}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.selectBoxValue,
                  !effectiveCategoryName && styles.selectBoxPlaceholder,
                ]}
              >
                {effectiveCategoryName || "Pilih / ketik kategori..."}
              </Text>
              <View style={styles.selectBoxIcons}>
                {effectiveCategoryName ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Reset kategori"
                    hitSlop={8}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      setCategoryName("");
                      setCategoryId("");
                    }}
                    style={styles.selectClearBtn}
                  >
                    <X size={15} color={TOKENS.colors.onSurfaceVariant} />
                  </Pressable>
                ) : null}
                <ChevronDown size={16} color={TOKENS.colors.onSurfaceVariant} />
              </View>
            </Pressable>
          </View>

          {/* Kode Item / SKU & Barcode Fisik (2 Kolom) */}
          <View style={styles.twoColRow}>
            <View style={styles.colHalf}>
              <Text style={styles.fieldLabel}>Kode Item / SKU</Text>
              <TextInput
                testID="produk-form-sku"
                value={sku}
                onChangeText={setSku}
                placeholder="Contoh: 2TAGE"
                placeholderTextColor={TOKENS.colors.outline}
                autoCapitalize="characters"
                style={styles.whiteMonoInput}
              />
            </View>

            <View style={styles.colHalf}>
              <Text style={styles.fieldLabel}>Barcode Fisik</Text>
              <TextInput
                testID="produk-form-barcode"
                value={barcode}
                onChangeText={setBarcode}
                placeholder="Scan barcode..."
                placeholderTextColor={TOKENS.colors.outline}
                style={styles.whiteMonoInput}
              />
            </View>
          </View>
        </View>

        {/* ── SECTION B: 1. KONVERSI SATUAN & HARGA JUAL ── */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderTextCol}>
              <Text style={styles.sectionHeadingTitle}>
                1. Konversi Satuan &amp; Harga Jual
              </Text>
              <Text style={styles.sectionHeadingSub}>
                Satuan pertama adalah{" "}
                <Text style={styles.sectionHeadingSubBold}>
                  Satuan Dasar (Base)
                </Text>
                .
              </Text>
            </View>

            <Pressable
              testID="produk-form-add-unit"
              accessibilityRole="button"
              onPress={handleAddConversion}
              style={({ pressed }) => [
                styles.addUnitOutlineBtn,
                pressed && styles.pressedBtn,
              ]}
            >
              <Plus size={16} color={TOKENS.colors.primary} />
              <Text style={styles.addUnitOutlineText}>Tambah Satuan</Text>
            </Pressable>
          </View>

          {/* Kartu Satuan Dasar (Base) */}
          <View style={styles.unitCard}>
            <View style={styles.unitCardHeader}>
              <Text numberOfLines={1} style={styles.unitCardTag}>
                SATUAN DASAR (BASE)
              </Text>

              <View style={styles.unitHeaderRightGroup}>
                <Pressable
                  testID="produk-form-base-sold-toggle"
                  accessibilityRole="switch"
                  accessibilityState={{ checked: sellBaseUnit }}
                  onPress={() => setSellBaseUnit((prev) => !prev)}
                  style={styles.visibilitySwitchPill}
                >
                  <Text style={styles.visibilitySwitchLabel}>
                    {sellBaseUnit ? "Tampilkan" : "Tidak Dijual"}
                  </Text>
                  <View
                    style={[
                      styles.customSwitchTrack,
                      sellBaseUnit && styles.customSwitchTrackOn,
                    ]}
                  >
                    <View
                      style={[
                        styles.customSwitchThumb,
                        sellBaseUnit && styles.customSwitchThumbOn,
                      ]}
                    />
                  </View>
                </Pressable>

                <View style={styles.baseBadge}>
                  <Text style={styles.baseBadgeText}>BASE</Text>
                </View>
              </View>
            </View>

            {/* Row 1: Satuan * & Isi (BASE) * */}
            <View style={styles.twoColRow}>
              <View style={styles.colHalf}>
                <Text style={styles.fieldLabel}>
                  Satuan <Text style={styles.requiredStar}>*</Text>
                </Text>
                <Pressable
                  testID="produk-form-base-unit-trigger"
                  accessibilityRole="button"
                  onPress={() => setUnitPickerTarget({ type: "base" })}
                  style={styles.selectBoxCompact}
                >
                  <Text numberOfLines={1} style={styles.selectBoxValue}>
                    {baseUnitName}
                  </Text>
                  <View style={styles.selectBoxIcons}>
                    <ChevronDown
                      size={16}
                      color={TOKENS.colors.onSurfaceVariant}
                    />
                  </View>
                </Pressable>
              </View>

              <View style={styles.colHalf}>
                <Text numberOfLines={1} style={styles.fieldLabel}>
                  {`Isi (${baseUnitName.toUpperCase()}) `}
                  <Text style={styles.requiredStar}>*</Text>
                </Text>
                <View style={styles.disabledFactorBox}>
                  <Text style={styles.disabledFactorText}>1</Text>
                </View>
              </View>
            </View>

            {/* Row 2: Harga Beli Satuan & Harga Jual Satuan * */}
            <View style={styles.twoColRow}>
              <View style={styles.colHalf}>
                <Text numberOfLines={1} style={styles.fieldLabel}>
                  Harga Beli Satuan
                </Text>
                <View style={styles.rpInputBox}>
                  <Text style={styles.rpPrefixMuted}>Rp</Text>
                  <TextInput
                    testID="produk-form-cost-price"
                    value={formatThousandId(costPriceText)}
                    onChangeText={(txt) =>
                      setCostPriceText(txt.replace(/[^0-9]/g, ""))
                    }
                    placeholder="0"
                    placeholderTextColor={TOKENS.colors.outline}
                    keyboardType="numeric"
                    selectTextOnFocus
                    style={styles.rpInputText}
                  />
                </View>
              </View>

              <View style={styles.colHalf}>
                <View style={styles.priceLabelRow}>
                  <Text numberOfLines={1} style={styles.fieldLabel}>
                    Harga Jual Satuan{" "}
                    {sellBaseUnit ? (
                      <Text style={styles.requiredStar}>*</Text>
                    ) : null}
                  </Text>
                  {!sellBaseUnit ? (
                    <Text style={styles.referenceTag}>Acuan</Text>
                  ) : null}
                </View>
                <View style={styles.rpInputBox}>
                  <Text style={styles.rpPrefixPrimary}>Rp</Text>
                  <TextInput
                    testID="produk-form-selling-price"
                    value={formatThousandId(sellingPriceText)}
                    onChangeText={(txt) =>
                      setSellingPriceText(txt.replace(/[^0-9]/g, ""))
                    }
                    placeholder="0"
                    placeholderTextColor={TOKENS.colors.outline}
                    keyboardType="numeric"
                    selectTextOnFocus
                    style={styles.rpInputTextPrimary}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Kartu Satuan Turunan (Derived Units) */}
          {conversions.map((conv, index) => (
            <View key={conv.key} style={styles.unitCard}>
              <View style={styles.unitCardHeader}>
                <Text style={styles.unitCardTag}>
                  {`SATUAN TURUNAN ${index + 1}`}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    setConversions((prev) =>
                      prev.filter((row) => row.key !== conv.key)
                    )
                  }
                  style={styles.deleteInlineBtn}
                >
                  <Trash2 size={15} color={TOKENS.colors.destructive} />
                  <Text style={styles.deleteInlineText}>Hapus</Text>
                </Pressable>
              </View>

              <View style={styles.twoColRow}>
                <View style={styles.colHalf}>
                  <Text style={styles.fieldLabel}>
                    Satuan <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      setUnitPickerTarget({
                        type: "conversion",
                        key: conv.key,
                      })
                    }
                    style={styles.selectBoxCompact}
                  >
                    <Text numberOfLines={1} style={styles.selectBoxValue}>
                      {conv.unitName || "Pilih..."}
                    </Text>
                    <ChevronDown
                      size={16}
                      color={TOKENS.colors.onSurfaceVariant}
                    />
                  </Pressable>
                </View>

                <View style={styles.colHalf}>
                  <Text numberOfLines={1} style={styles.fieldLabel}>
                    {`Isi (${baseUnitName.toUpperCase()}) `}
                    <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <TextInput
                    value={conv.factorText}
                    keyboardType="numeric"
                    placeholder="1"
                    placeholderTextColor={TOKENS.colors.outline}
                    selectTextOnFocus
                    onChangeText={(txt) =>
                      setConversions((prev) =>
                        prev.map((row) =>
                          row.key === conv.key
                            ? {
                                ...row,
                                factorText: txt.replace(/[^0-9]/g, ""),
                              }
                            : row
                        )
                      )
                    }
                    style={styles.factorInputBox}
                  />
                </View>
              </View>

              <View style={styles.twoColRow}>
                <View style={styles.colHalf}>
                  <Text numberOfLines={1} style={styles.fieldLabel}>
                    Harga Beli Satuan
                  </Text>
                  <View style={styles.rpInputBox}>
                    <Text style={styles.rpPrefixMuted}>Rp</Text>
                    <TextInput
                      value={formatThousandId(conv.costPriceText)}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={TOKENS.colors.outline}
                      selectTextOnFocus
                      onChangeText={(txt) =>
                        setConversions((prev) =>
                          prev.map((row) =>
                            row.key === conv.key
                              ? {
                                  ...row,
                                  costPriceText: txt.replace(/[^0-9]/g, ""),
                                }
                              : row
                          )
                        )
                      }
                      style={styles.rpInputText}
                    />
                  </View>
                </View>

                <View style={styles.colHalf}>
                  <Text numberOfLines={1} style={styles.fieldLabel}>
                    Harga Jual Satuan <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <View style={styles.rpInputBox}>
                    <Text style={styles.rpPrefixPrimary}>Rp</Text>
                    <TextInput
                      value={formatThousandId(conv.priceText)}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={TOKENS.colors.outline}
                      selectTextOnFocus
                      onChangeText={(txt) =>
                        setConversions((prev) =>
                          prev.map((row) =>
                            row.key === conv.key
                              ? {
                                  ...row,
                                  priceText: txt.replace(/[^0-9]/g, ""),
                                }
                              : row
                          )
                        )
                      }
                      style={styles.rpInputTextPrimary}
                    />
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* ── SECTION C: 2. SKEMA GROSIR BERTINGKAT ── */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderTextCol}>
              <Text style={styles.sectionHeadingTitle}>
                2. Skema Grosir Bertingkat
              </Text>
              <Text style={styles.sectionHeadingSub}>
                Potongan harga otomatis berdasarkan minimal qty.
              </Text>
            </View>

            <Pressable
              testID="produk-form-add-wholesale"
              accessibilityRole="button"
              onPress={handleAddWholesaleTier}
              style={({ pressed }) => [
                styles.addWholesaleOutlineBtn,
                pressed && styles.pressedBtn,
              ]}
            >
              <Plus size={16} color="#b45309" />
              <Text style={styles.addWholesaleOutlineText}>Tambah Grosir</Text>
            </Pressable>
          </View>

          {wholesaleTiers.length === 0 ? (
            <View style={styles.emptyWholesaleBox}>
              <Text style={styles.emptyWholesaleText}>
                Belum ada skema grosir. Ketuk &ldquo;Tambah Grosir&rdquo; di
                atas untuk menambahkan.
              </Text>
            </View>
          ) : (
            wholesaleTiers.map((tier, index) => {
              const normalPrice = resolveRegularPriceForUnitName(tier.unitName);
              return (
                <View key={tier.key} style={styles.wholesaleCard}>
                  <View style={styles.unitCardHeader}>
                    <Text style={styles.wholesaleCardTag}>
                      {`TIER GROSIR ${index + 1}`}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        setWholesaleTiers((prev) =>
                          prev.filter((row) => row.key !== tier.key)
                        )
                      }
                      style={styles.deleteInlineBtn}
                    >
                      <Trash2 size={15} color={TOKENS.colors.destructive} />
                      <Text style={styles.deleteInlineText}>Hapus</Text>
                    </Pressable>
                  </View>

                  <View style={styles.twoColRow}>
                    <View style={styles.colHalf}>
                      <Text style={styles.amberFieldLabel}>Satuan Target</Text>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() =>
                          setUnitPickerTarget({
                            type: "wholesale",
                            key: tier.key,
                          })
                        }
                        style={styles.selectBoxCompact}
                      >
                        <Text numberOfLines={1} style={styles.selectBoxValue}>
                          {tier.unitName || baseUnitName}
                        </Text>
                        <ChevronDown
                          size={16}
                          color={TOKENS.colors.onSurfaceVariant}
                        />
                      </Pressable>
                    </View>

                    <View style={styles.colHalf}>
                      <Text numberOfLines={1} style={styles.amberFieldLabel}>
                        Min. Pembelian (≥)
                      </Text>
                      <TextInput
                        value={tier.minQtyText}
                        keyboardType="numeric"
                        placeholder="2"
                        placeholderTextColor={TOKENS.colors.outline}
                        selectTextOnFocus
                        onChangeText={(txt) =>
                          setWholesaleTiers((prev) =>
                            prev.map((row) =>
                              row.key === tier.key
                                ? {
                                    ...row,
                                    minQtyText: txt.replace(/[^0-9]/g, ""),
                                  }
                                : row
                            )
                          )
                        }
                        style={styles.amberInputBox}
                      />
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <View style={styles.wholesalePriceLabelRow}>
                      <Text style={styles.amberFieldLabel}>
                        Harga Grosir / Satuan{" "}
                        <Text style={styles.requiredStar}>*</Text>
                      </Text>
                      {normalPrice > 0 ? (
                        <Text style={styles.normalPriceHint}>
                          {`Normal: ${formatRupiah(normalPrice)}`}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.amberRpInputBox}>
                      <Text style={styles.rpPrefixAmber}>Rp</Text>
                      <TextInput
                        value={formatThousandId(tier.priceText)}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={TOKENS.colors.outline}
                        selectTextOnFocus
                        onChangeText={(txt) =>
                          setWholesaleTiers((prev) =>
                            prev.map((row) =>
                              row.key === tier.key
                                ? {
                                    ...row,
                                    priceText: txt.replace(/[^0-9]/g, ""),
                                  }
                                : row
                            )
                          )
                        }
                        style={styles.rpInputTextAmber}
                      />
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Bottom Sticky Action Bar */}
      <View style={styles.bottomFooterBar}>
        <SecondaryButton
          variant="tonal"
          label="Batal"
          disabled={isSaving}
          onPress={() => router.back()}
          style={styles.footerBtnHalf}
        />
        <PrimaryButton
          testID="produk-form-submit"
          label={isEdit ? "Simpan Perubahan" : "Simpan Produk"}
          loading={isSaving}
          loadingLabel="Menyimpan..."
          disabled={isSaving || !canWriteOnline}
          icon={<Save size={17} color={TOKENS.colors.onPrimary} />}
          onPress={() => {
            void handleSave();
          }}
          style={styles.footerBtnHalf}
        />
      </View>

      {/* Searchable Category Picker Modal */}
      <SearchableOptionModal
        visible={categoryPickerOpen}
        title="Pilih Kategori Produk"
        placeholder="Cari atau ketik kategori baru..."
        options={categoryOptions}
        selectedValue={effectiveCategoryName}
        allowCustom
        onSelect={(val) => {
          setCategoryName(val);
          const match = categories.find(
            (c) => c.name.trim().toLowerCase() === val.trim().toLowerCase()
          );
          if (match) {
            setCategoryId(match.id);
          }
        }}
        onClose={() => setCategoryPickerOpen(false)}
      />

      {/* Searchable Unit Picker Modal */}
      <SearchableOptionModal
        visible={unitPickerTarget !== null}
        title={
          unitPickerTarget?.type === "wholesale"
            ? "Pilih Satuan Target Grosir"
            : "Pilih Satuan Produk"
        }
        placeholder="Cari atau ketik nama satuan..."
        options={
          unitPickerTarget?.type === "wholesale"
            ? configuredProductUnitNames
            : unitOptions
        }
        selectedValue={currentUnitModalValue}
        disabledValues={currentUnitModalDisabled}
        allowCustom={unitPickerTarget?.type !== "wholesale"}
        onSelect={(val) => {
          if (!unitPickerTarget) {
            return;
          }
          const matchedUnit = units.find(
            (u) => u.name.trim().toLowerCase() === val.trim().toLowerCase()
          );
          if (unitPickerTarget.type === "base") {
            const oldBase = baseUnitName;
            setUnitName(val);
            if (matchedUnit) {
              setUnitId(matchedUnit.id);
            }
            setWholesaleTiers((prev) =>
              prev.map((t) =>
                t.unitName.toLowerCase() === oldBase.toLowerCase()
                  ? { ...t, unitName: val }
                  : t
              )
            );
          } else if (unitPickerTarget.type === "conversion") {
            setConversions((prev) =>
              prev.map((row) =>
                row.key === unitPickerTarget.key
                  ? {
                      ...row,
                      unitName: val,
                      unitId: matchedUnit?.id ?? row.unitId,
                    }
                  : row
              )
            );
          } else {
            setWholesaleTiers((prev) =>
              prev.map((row) =>
                row.key === unitPickerTarget.key
                  ? { ...row, unitName: val }
                  : row
              )
            );
          }
        }}
        onClose={() => setUnitPickerTarget(null)}
      />
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
    fontSize: 18,
    lineHeight: 22,
    color: TOKENS.colors.onSurface,
  },
  scrollContent: {
    padding: TOKENS.spacing.md,
    paddingBottom: TOKENS.spacing.xl,
    gap: 18,
  },
  basicInfoCard: {
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    padding: 14,
    gap: 12,
  },
  basicInfoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  basicInfoTitle: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    color: TOKENS.colors.primary,
  },
  fieldGroup: {
    gap: 5,
  },
  fieldLabel: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: TOKENS.colors.onSurfaceVariant,
  },
  requiredStar: {
    color: TOKENS.colors.destructive,
    fontFamily: FONT_FAMILY.heading,
  },
  whiteTextInput: {
    height: 42,
    backgroundColor: TOKENS.colors.surfaceCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    paddingHorizontal: 12,
    fontFamily: FONT_FAMILY.heading,
    fontSize: 14,
    color: TOKENS.colors.onSurface,
  },
  whiteMonoInput: {
    height: 42,
    backgroundColor: TOKENS.colors.surfaceCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    paddingHorizontal: 12,
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: 13,
    color: TOKENS.colors.onSurface,
  },
  selectBox: {
    height: 42,
    backgroundColor: TOKENS.colors.surfaceCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  selectBoxCompact: {
    height: 42,
    backgroundColor: TOKENS.colors.surfaceCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  selectBoxValue: {
    flex: 1,
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 13,
    lineHeight: 17,
    color: TOKENS.colors.onSurface,
  },
  selectBoxPlaceholder: {
    color: TOKENS.colors.outline,
    fontFamily: FONT_FAMILY.body,
  },
  selectBoxIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  selectClearBtn: {
    padding: 2,
  },
  twoColRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  colHalf: {
    flex: 1,
    gap: 5,
    minWidth: 0,
  },
  sectionBlock: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  sectionHeaderTextCol: {
    flex: 1,
    gap: 2,
  },
  sectionHeadingTitle: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: 15,
    lineHeight: 20,
    color: TOKENS.colors.onSurface,
  },
  sectionHeadingSub: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 12,
    lineHeight: 16,
    color: TOKENS.colors.onSurfaceVariant,
  },
  sectionHeadingSubBold: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    color: TOKENS.colors.onSurface,
  },
  addUnitOutlineBtn: {
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: TOKENS.colors.surfaceCard,
    borderWidth: 1,
    borderColor: "rgba(0, 71, 141, 0.32)",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexShrink: 0,
  },
  addUnitOutlineText: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: 12,
    lineHeight: 16,
    color: TOKENS.colors.primary,
  },
  addWholesaleOutlineBtn: {
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: TOKENS.colors.surfaceCard,
    borderWidth: 1,
    borderColor: "#f59e0b",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexShrink: 0,
  },
  addWholesaleOutlineText: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: 12,
    lineHeight: 16,
    color: "#b45309",
  },
  pressedBtn: {
    opacity: 0.78,
  },
  unitCard: {
    backgroundColor: TOKENS.colors.surfaceCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    padding: 13,
    gap: 11,
  },
  unitCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  unitCardTag: {
    flex: 1,
    fontFamily: FONT_FAMILY.heading,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.4,
    color: TOKENS.colors.onSurfaceVariant,
  },
  unitHeaderRightGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  visibilitySwitchPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9,
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
  },
  visibilitySwitchLabel: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 11,
    lineHeight: 14,
    color: TOKENS.colors.onSurfaceVariant,
  },
  customSwitchTrack: {
    width: 30,
    height: 17,
    borderRadius: 9,
    backgroundColor: TOKENS.colors.outline,
    padding: 2,
    justifyContent: "center",
  },
  customSwitchTrackOn: {
    backgroundColor: TOKENS.colors.primary,
  },
  customSwitchThumb: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: "#ffffff",
  },
  customSwitchThumbOn: {
    alignSelf: "flex-end",
  },
  baseBadge: {
    backgroundColor: TOKENS.colors.primaryFixed,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  baseBadgeText: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: 10,
    lineHeight: 13,
    color: TOKENS.colors.primary,
  },
  disabledFactorBox: {
    height: 42,
    borderRadius: 12,
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  disabledFactorText: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: 13,
    color: TOKENS.colors.onSurfaceVariant,
  },
  factorInputBox: {
    height: 42,
    borderRadius: 12,
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    paddingHorizontal: 12,
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: 13,
    color: TOKENS.colors.onSurface,
  },
  rpInputBox: {
    height: 42,
    borderRadius: 12,
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  rpPrefixMuted: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: 13,
    color: TOKENS.colors.onSurfaceVariant,
    marginRight: 6,
  },
  rpPrefixPrimary: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: 13,
    color: TOKENS.colors.primary,
    marginRight: 6,
  },
  rpInputText: {
    flex: 1,
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: 13,
    color: TOKENS.colors.onSurface,
    paddingVertical: 0,
  },
  rpInputTextPrimary: {
    flex: 1,
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: 13,
    color: TOKENS.colors.primary,
    paddingVertical: 0,
  },
  priceLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  referenceTag: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 10,
    lineHeight: 13,
    color: TOKENS.colors.warningText,
    backgroundColor: TOKENS.colors.warningBg,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  deleteInlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  deleteInlineText: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: 12,
    lineHeight: 16,
    color: TOKENS.colors.destructive,
  },
  emptyWholesaleBox: {
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: TOKENS.colors.borderSubtle,
    padding: 14,
    alignItems: "center",
  },
  emptyWholesaleText: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 12,
    lineHeight: 17,
    color: TOKENS.colors.onSurfaceVariant,
    textAlign: "center",
  },
  wholesaleCard: {
    backgroundColor: "#fffbeb",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#fde68a",
    padding: 13,
    gap: 11,
  },
  wholesaleCardTag: {
    flex: 1,
    fontFamily: FONT_FAMILY.heading,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.4,
    color: "#b45309",
  },
  amberFieldLabel: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: "#92400e",
  },
  amberInputBox: {
    height: 42,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#fcd34d",
    paddingHorizontal: 12,
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: 13,
    color: "#78350f",
  },
  wholesalePriceLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  normalPriceHint: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 11,
    lineHeight: 15,
    color: TOKENS.colors.onSurfaceVariant,
  },
  amberRpInputBox: {
    height: 42,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#fcd34d",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  rpPrefixAmber: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: 13,
    color: "#b45309",
    marginRight: 6,
  },
  rpInputTextAmber: {
    flex: 1,
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: 13,
    color: "#92400e",
    paddingVertical: 0,
  },
  bottomFooterBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: TOKENS.spacing.md,
    paddingVertical: 12,
    backgroundColor: TOKENS.colors.surfaceCard,
    borderTopWidth: 1,
    borderTopColor: TOKENS.colors.borderSubtle,
  },
  footerBtnHalf: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: TOKENS.colors.modalBackdrop,
    justifyContent: "center",
    padding: TOKENS.spacing.md,
  },
  modalCard: {
    backgroundColor: TOKENS.colors.surfaceCard,
    borderRadius: TOKENS.radii.lg,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    maxHeight: "80%",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: TOKENS.spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.colors.borderSubtle,
  },
  modalTitle: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: 16,
    lineHeight: 20,
    color: TOKENS.colors.onSurface,
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: TOKENS.colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: TOKENS.spacing.md,
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
  },
  modalSearchInput: {
    flex: 1,
    fontFamily: FONT_FAMILY.body,
    fontSize: 13,
    color: TOKENS.colors.onSurface,
    paddingVertical: 0,
  },
  modalList: {
    maxHeight: 360,
  },
  modalListContent: {
    paddingHorizontal: TOKENS.spacing.md,
    paddingBottom: TOKENS.spacing.md,
    gap: 6,
  },
  customOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: TOKENS.colors.primaryFixed,
    borderWidth: 1,
    borderColor: TOKENS.colors.primary,
  },
  customOptionText: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 13,
    color: TOKENS.colors.onPrimaryFixed,
  },
  modalEmptyText: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 13,
    color: TOKENS.colors.muted,
    textAlign: "center",
    paddingVertical: 16,
  },
  modalOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
  },
  modalOptionRowActive: {
    backgroundColor: TOKENS.colors.primary,
    borderColor: TOKENS.colors.primary,
  },
  modalOptionRowDisabled: {
    opacity: 0.4,
  },
  modalOptionText: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 13,
    color: TOKENS.colors.onSurface,
  },
  modalOptionTextActive: {
    color: TOKENS.colors.onPrimary,
  },
  modalOptionTextDisabled: {
    color: TOKENS.colors.muted,
  },
});
