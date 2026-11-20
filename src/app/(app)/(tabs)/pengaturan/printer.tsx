import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Bluetooth,
  Check,
  ChevronLeft,
  Info,
  Printer,
  Save,
  Server,
  Smartphone,
} from "lucide-react-native";
import {
  FeedbackBanner,
  PrimaryButton,
  SecondaryButton,
  SurfaceCard,
} from "@/components/ui/VelocityPrimitives";
import { useAuth } from "@/context/AuthContext";
import { useSystemStatus } from "@/context/SystemStatusContext";
import { buildCompletedOrderPayload } from "@/domain/pricing";
import {
  triggerServerTestPrint,
  updateStoreSettings,
} from "@/services/api/settingsApi";
import {
  executeReceiptPrint,
  isBluetoothEscPosSupported,
  scanPairedBluetoothPrinters,
} from "@/services/print/printerService";
import { setCachedStoreSettings } from "@/services/storage/secureStorage";
import {
  usePrinterPrefsStore,
  type PairedBluetoothPrinter,
  type PrinterDeviceMode,
} from "@/store/printerPrefsStore";
import { FONT_FAMILY, TOKENS } from "@/theme/tokens";

const MODE_OPTIONS: {
  id: PrinterDeviceMode;
  title: string;
  desc: string;
  icon: "server" | "bluetooth" | "system";
}[] = [
  {
    id: "server",
    title: "Printer Server Toko",
    desc: "Cetak via API /api/print ke printer USB/LAN komputer kasir utama",
    icon: "server",
  },
  {
    id: "bluetooth",
    title: "Thermal Bluetooth ESC/POS",
    desc: "Cetak langsung ke printer thermal Bluetooth 58mm/80mm (memerlukan build APK / Dev Client)",
    icon: "bluetooth",
  },
  {
    id: "system",
    title: "Cetak Sistem HP / PDF",
    desc: "Cetak melalui dialog print bawaan Android / iOS (AirPrint / Mopria / PDF)",
    icon: "system",
  },
];

export default function PengaturanPrinterScreen() {
  const router = useRouter();
  const {
    user,
    roleCapabilities,
    storeSettings,
    serverConfig,
    refreshStoreSettings,
  } = useAuth();
  const { healthState, isDeviceConnected, dbOnline } = useSystemStatus();

  const printerMode = usePrinterPrefsStore((s) => s.mode);
  const bluetoothDevice = usePrinterPrefsStore((s) => s.bluetoothDevice);
  const bluetoothPaperWidth = usePrinterPrefsStore((s) => s.bluetoothPaperWidth);
  const storedPreviewBeforePrint = usePrinterPrefsStore(
    (s) => s.previewBeforePrint
  );
  const setMode = usePrinterPrefsStore((s) => s.setMode);
  const setBluetoothDevice = usePrinterPrefsStore((s) => s.setBluetoothDevice);
  const setBluetoothPaperWidth = usePrinterPrefsStore(
    (s) => s.setBluetoothPaperWidth
  );
  const setStoredPreviewBeforePrint = usePrinterPrefsStore(
    (s) => s.setPreviewBeforePrint
  );

  const [draftMode, setDraftMode] = useState<PrinterDeviceMode>(printerMode);
  const [draftPaperWidth, setDraftPaperWidth] = useState<58 | 80>(
    bluetoothPaperWidth
  );
  const [previewBeforePrint, setPreviewBeforePrint] = useState<boolean>(
    storedPreviewBeforePrint
  );
  const [pairedDevices, setPairedDevices] = useState<PairedBluetoothPrinter[]>(
    []
  );
  const [isScanningBt, setIsScanningBt] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isTestingDevice, setIsTestingDevice] = useState<boolean>(false);
  const [banner, setBanner] = useState<{
    variant: "success" | "warning" | "error" | "info";
    message: string;
  } | null>(null);

  const btDriverReady = isBluetoothEscPosSupported();

  const canWriteOnline =
    roleCapabilities.canManageStore &&
    isDeviceConnected &&
    dbOnline &&
    healthState !== "offline" &&
    healthState !== "read_only";

  const handleSelectMode = (nextMode: PrinterDeviceMode) => {
    setDraftMode(nextMode);
    setMode(nextMode);
    setBanner(null);
  };

  const handleSelectPaperWidth = (nextWidth: 58 | 80) => {
    setDraftPaperWidth(nextWidth);
    setBluetoothPaperWidth(nextWidth);
    setBanner(null);
  };

  const handleScanBluetoothDevices = async () => {
    setIsScanningBt(true);
    setBanner(null);
    try {
      const res = await scanPairedBluetoothPrinters();
      if (!res.ok) {
        setBanner({
          variant: "warning",
          message:
            res.error ??
            "Gagal memindai printer Bluetooth yang sudah dipasangkan.",
        });
        return;
      }
      setPairedDevices(res.devices);
      if (res.devices.length === 0) {
        setBanner({
          variant: "info",
          message:
            "Tidak ditemukan perangkat Bluetooth terpasang (Paired). Pasangkan printer di Pengaturan Bluetooth HP terlebih dahulu.",
        });
      }
    } finally {
      setIsScanningBt(false);
    }
  };

  const handleSavePrinterSettings = async () => {
    if (isSaving) {
      return;
    }
    setIsSaving(true);
    setBanner(null);
    try {
      setMode(draftMode);
      setBluetoothPaperWidth(draftPaperWidth);
      setStoredPreviewBeforePrint(previewBeforePrint);
      const nextLocalSettings = {
        ...(storeSettings ?? { storeName: "Toko Rejeki" }),
        printerPaperWidth: draftPaperWidth,
        previewReceiptBeforePrint: previewBeforePrint,
      };
      setCachedStoreSettings(nextLocalSettings);

      if (canWriteOnline) {
        const res = await updateStoreSettings(serverConfig, {
          printerPaperWidth: draftPaperWidth,
          previewReceiptBeforePrint: previewBeforePrint,
        });
        if (res.ok) {
          await refreshStoreSettings();
        }
      } else {
        await refreshStoreSettings();
      }

      setBanner({
        variant: "success",
        message:
          "Pengaturan metode cetak, ukuran kertas, & pratinjau struk berhasil disimpan.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeviceTestPrint = async () => {
    setIsTestingDevice(true);
    setBanner(null);
    try {
      const activeMode = draftMode;
      if (activeMode === "server") {
        const res = await triggerServerTestPrint(serverConfig, {
          printerName: storeSettings?.printerName,
          printerType: storeSettings?.printerType ?? "usb",
          paperWidth: draftPaperWidth,
        });
        setBanner({
          variant: res.ok ? "success" : "error",
          message: res.message,
        });
        return;
      }

      const sampleOrder = buildCompletedOrderPayload({
        items: [
          {
            productId: "test-1",
            productName: "Produk Contoh Struk",
            sku: "TEST-01",
            unitId: "u-pcs",
            unitName: "Pcs",
            conversionFactor: 1,
            baseUnitPrice: 10000,
            wholesaleTiers: [],
            quantity: 1,
            effectiveUnitPrice: 10000,
            subtotal: 10000,
            wholesaleSavings: 0,
          },
        ],
        discount: 0,
        cashierName: user?.fullName ?? "Kasir",
        storeSettings: storeSettings
          ? { ...storeSettings, printerPaperWidth: draftPaperWidth }
          : { storeName: "Toko Rejeki", printerPaperWidth: draftPaperWidth },
        orderNumber: "TEST-PRINT",
      });

      const res = await executeReceiptPrint({
        mode: activeMode,
        order: sampleOrder,
        copies: 1,
        serverConfig,
        storeSettings: storeSettings
          ? { ...storeSettings, printerPaperWidth: draftPaperWidth }
          : { storeName: "Toko Rejeki", printerPaperWidth: draftPaperWidth },
        bluetoothDevice,
        bluetoothPaperWidth: draftPaperWidth,
      });

      setBanner({
        variant: res.ok ? "success" : "error",
        message: res.ok
          ? "Tes cetak berhasil dikirim."
          : (res.error ?? "Tes cetak gagal dijalankan."),
      });
    } finally {
      setIsTestingDevice(false);
    }
  };

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
        <Text style={styles.topTitle}>Printer &amp; Metode Cetak</Text>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {banner ? (
          <FeedbackBanner
            testID="printer-settings-banner"
            variant={banner.variant}
            message={banner.message}
          />
        ) : null}

        <SurfaceCard testID="printer-device-mode-card" style={styles.card}>
          <Text style={styles.sectionHeading}>Metode Cetak Perangkat Ini</Text>
          <Text style={styles.sectionSub}>
            Pilih jalur pencetakan struk ketika menekan tombol Cetak Struk di
            layar Kasir pada perangkat ini.
          </Text>

          {MODE_OPTIONS.map((opt) => {
            const selected = draftMode === opt.id;
            return (
              <Pressable
                key={opt.id}
                testID={`printer-mode-${opt.id}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => handleSelectMode(opt.id)}
                style={[styles.modeCard, selected && styles.modeCardSelected]}
              >
                <View
                  style={[
                    styles.modeIconWrap,
                    selected && styles.modeIconWrapSelected,
                  ]}
                >
                  {opt.icon === "server" ? (
                    <Server
                      size={18}
                      color={
                        selected
                          ? TOKENS.colors.onPrimary
                          : TOKENS.colors.onSurfaceVariant
                      }
                    />
                  ) : opt.icon === "bluetooth" ? (
                    <Bluetooth
                      size={18}
                      color={
                        selected
                          ? TOKENS.colors.onPrimary
                          : TOKENS.colors.onSurfaceVariant
                      }
                    />
                  ) : (
                    <Smartphone
                      size={18}
                      color={
                        selected
                          ? TOKENS.colors.onPrimary
                          : TOKENS.colors.onSurfaceVariant
                      }
                    />
                  )}
                </View>
                <View style={styles.modeTextCol}>
                  <Text
                    style={[
                      styles.modeTitle,
                      selected && styles.modeTitleSelected,
                    ]}
                  >
                    {opt.title}
                  </Text>
                  <Text style={styles.modeDesc}>{opt.desc}</Text>
                </View>
                {selected ? (
                  <View style={styles.selectedCheckCircle}>
                    <Check size={14} color={TOKENS.colors.onPrimary} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}

          <View style={styles.paperWidthBox}>
            <View style={styles.paperWidthHeader}>
              <Text style={styles.switchLabel}>Ukuran Kertas Struk Lokal</Text>
              <Text style={styles.switchSub}>
                Dapat diubah sewaktu-waktu sesuai ukuran roll kertas printer yang
                sedang digunakan (58mm atau 80mm).
              </Text>
            </View>
            <View style={styles.paperWidthRow}>
              {([58, 80] as const).map((width) => {
                const selected = draftPaperWidth === width;
                return (
                  <Pressable
                    key={width}
                    testID={`printer-paper-width-${width}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => handleSelectPaperWidth(width)}
                    style={[
                      styles.paperChip,
                      selected && styles.paperChipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.paperChipTitle,
                        selected && styles.paperChipTitleSelected,
                      ]}
                    >
                      {`${width}mm`}
                    </Text>
                    <Text
                      style={[
                        styles.paperChipSub,
                        selected && styles.paperChipSubSelected,
                      ]}
                    >
                      {width === 58 ? "Thermal Kecil" : "Thermal Lebar"}
                    </Text>
                  </Pressable>
              );
            })}
          </View>
        </View>

        {draftMode === "bluetooth" ? (
          <View
            testID="printer-bluetooth-device-box"
            style={styles.paperWidthBox}
          >
            <View style={styles.paperWidthHeader}>
              <Text style={styles.switchLabel}>Perangkat Printer Bluetooth</Text>
              <Text style={styles.switchSub}>
                {btDriverReady
                  ? bluetoothDevice
                    ? `Terpilih: ${bluetoothDevice.name} (${bluetoothDevice.address})`
                    : "Pilih printer thermal yang sudah di-pair di Bluetooth HP."
                  : "Driver native Bluetooth hanya aktif pada build APK / Development Build (tidak tersedia di Expo Go standar)."}
              </Text>
            </View>

            <SecondaryButton
              testID="printer-bt-scan-button"
              variant="tonal"
              label="Pindai Printer Terpasang (Paired)"
              loading={isScanningBt}
              loadingLabel="Memindai Bluetooth..."
              disabled={isScanningBt}
              icon={<Bluetooth size={16} color={TOKENS.colors.onPrimaryFixed} />}
              onPress={() => {
                void handleScanBluetoothDevices();
              }}
            />

            {pairedDevices.map((dev) => {
              const isSelected = bluetoothDevice?.address === dev.address;
              return (
                <Pressable
                  key={dev.address}
                  accessibilityRole="button"
                  onPress={() => {
                    setBluetoothDevice(dev);
                    setBanner({
                      variant: "success",
                      message: `Printer "${dev.name}" dipilih.`,
                    });
                  }}
                  style={[
                    styles.btDeviceRow,
                    isSelected && styles.btDeviceRowSelected,
                  ]}
                >
                  <View style={styles.modeTextCol}>
                    <Text style={styles.switchLabel}>{dev.name}</Text>
                    <Text style={styles.btDeviceAddress}>{dev.address}</Text>
                  </View>
                  {isSelected ? (
                    <View style={styles.selectedCheckCircle}>
                      <Check size={14} color={TOKENS.colors.onPrimary} />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View style={styles.previewSwitchBox}>
            <View style={styles.previewSwitchTextCol}>
              <Text style={styles.switchLabel}>
                Tampilkan Pratinjau Struk Sebelum Cetak
              </Text>
              <Text style={styles.switchSub}>
                Tampilkan kertas struk di layar sebelum dikirim ke printer.
              </Text>
            </View>
            <Switch
              testID="printer-preview-toggle"
              value={previewBeforePrint}
              onValueChange={setPreviewBeforePrint}
            />
          </View>

          <View style={styles.actionsGroup}>
            <PrimaryButton
              testID="printer-save-mode-button"
              label="Simpan Pengaturan Printer"
              loading={isSaving}
              loadingLabel="Menyimpan..."
              disabled={isSaving || isTestingDevice}
              icon={<Save size={18} color={TOKENS.colors.onPrimary} />}
              onPress={() => {
                void handleSavePrinterSettings();
              }}
            />

            <SecondaryButton
              testID="printer-device-test-button"
              variant="tonal"
              label="Tes Cetak Sekarang"
              loading={isTestingDevice}
              loadingLabel="Mengirim Tes Cetak..."
              disabled={isTestingDevice || isSaving}
              icon={<Printer size={17} color={TOKENS.colors.onPrimaryFixed} />}
              onPress={() => {
                void handleDeviceTestPrint();
              }}
            />
          </View>
        </SurfaceCard>

        <SurfaceCard testID="printer-server-redirect-card" style={styles.card}>
          <View style={styles.redirectHeaderRow}>
            <View style={styles.redirectIconBadge}>
              <Info size={18} color={TOKENS.colors.primary} />
            </View>
            <Text style={styles.sectionHeading}>
              Konfigurasi Struk &amp; Printer Server
            </Text>
          </View>
          <Text style={styles.redirectBodyText}>
            Pengaturan perangkat keras printer server, tata letak bagian struk,
            serta catatan kaki struk dikelola secara terpusat langsung dari
            halaman{" "}
            <Text style={styles.redirectBoldText}>
              Pengaturan Server / Web Toko Rejeki
            </Text>
            .
          </Text>
        </SurfaceCard>
      </ScrollView>
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
    gap: 12,
  },
  sectionHeading: {
    flex: 1,
    fontFamily: FONT_FAMILY.heading,
    fontSize: TOKENS.typography.body,
    lineHeight: TOKENS.lineHeight.body,
    color: TOKENS.colors.onSurface,
  },
  sectionSub: {
    fontFamily: FONT_FAMILY.body,
    fontSize: TOKENS.typography.label,
    lineHeight: 18,
    color: TOKENS.colors.onSurfaceVariant,
  },
  modeCard: {
    minHeight: TOKENS.spacing.touchTarget,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: TOKENS.radii.md,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    gap: 10,
  },
  modeCardSelected: {
    backgroundColor: TOKENS.colors.primaryFixed,
    borderColor: TOKENS.colors.primary,
  },
  modeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: TOKENS.colors.surfaceCard,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  modeIconWrapSelected: {
    backgroundColor: TOKENS.colors.primary,
  },
  modeTextCol: {
    flex: 1,
    gap: 2,
  },
  modeTitle: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 14,
    lineHeight: 19,
    color: TOKENS.colors.onSurface,
  },
  modeTitleSelected: {
    color: TOKENS.colors.onPrimaryFixed,
  },
  modeDesc: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 12,
    lineHeight: 16,
    color: TOKENS.colors.onSurfaceVariant,
  },
  selectedCheckCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: TOKENS.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  paperWidthBox: {
    gap: 10,
    padding: 12,
    borderRadius: TOKENS.radii.md,
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
  },
  paperWidthHeader: {
    gap: 2,
  },
  paperWidthRow: {
    flexDirection: "row",
    gap: 10,
  },
  paperChip: {
    flex: 1,
    minHeight: TOKENS.spacing.touchTarget,
    borderRadius: TOKENS.radii.sm,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    backgroundColor: TOKENS.colors.surfaceCard,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 2,
  },
  paperChipSelected: {
    backgroundColor: TOKENS.colors.primary,
    borderColor: TOKENS.colors.primary,
  },
  paperChipTitle: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: 15,
    color: TOKENS.colors.onSurface,
  },
  paperChipTitleSelected: {
    color: TOKENS.colors.onPrimary,
  },
  paperChipSub: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 11,
    color: TOKENS.colors.onSurfaceVariant,
  },
  paperChipSubSelected: {
    color: TOKENS.colors.primaryFixed,
  },
  btDeviceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 10,
    borderRadius: TOKENS.radii.sm,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    backgroundColor: TOKENS.colors.surfaceCard,
    gap: 8,
  },
  btDeviceRowSelected: {
    borderColor: TOKENS.colors.primary,
    backgroundColor: TOKENS.colors.primaryFixed,
  },
  btDeviceAddress: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: 11,
    color: TOKENS.colors.onSurfaceVariant,
  },
  previewSwitchBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 12,
    borderRadius: TOKENS.radii.md,
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
  },
  previewSwitchTextCol: {
    flex: 1,
    gap: 2,
  },
  switchLabel: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 13,
    lineHeight: 18,
    color: TOKENS.colors.onSurface,
  },
  switchSub: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 11,
    lineHeight: 15,
    color: TOKENS.colors.onSurfaceVariant,
  },
  actionsGroup: {
    gap: 10,
    paddingTop: 2,
  },
  redirectHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  redirectIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: TOKENS.colors.primaryFixed,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  redirectBodyText: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 13,
    lineHeight: 19,
    color: TOKENS.colors.onSurfaceVariant,
  },
  redirectBoldText: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    color: TOKENS.colors.onSurface,
  },
});
