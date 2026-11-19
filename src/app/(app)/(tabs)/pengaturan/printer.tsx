import React, { useEffect, useState } from "react";
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
  ChevronLeft,
  Printer,
  Save,
  Search,
  Server,
  Smartphone,
} from "lucide-react-native";
import {
  FeedbackBanner,
  InputField,
  PrimaryButton,
  SecondaryButton,
  SurfaceCard,
} from "@/components/ui/VelocityPrimitives";
import { useAuth } from "@/context/AuthContext";
import { useSystemStatus } from "@/context/SystemStatusContext";
import { buildCompletedOrderPayload } from "@/domain/pricing";
import {
  fetchServerPrinters,
  triggerServerTestPrint,
  updateStoreSettings,
  type ServerPrinterInfo,
} from "@/services/api/settingsApi";
import {
  executeReceiptPrint,
  scanPairedBluetoothPrinters,
} from "@/services/print/printerService";
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
    desc: "Cetak via API /api/print ke printer USB/LAN komputer kasir",
    icon: "server",
  },
  {
    id: "bluetooth",
    title: "Thermal Bluetooth ESC/POS",
    desc: "Cetak langsung offline ke printer thermal Bluetooth 58mm/80mm",
    icon: "bluetooth",
  },
  {
    id: "system",
    title: "Cetak Sistem HP / PDF",
    desc: "Cetak melalui dialog print bawaan Android / iOS (AirPrint / Mopria)",
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
  const setMode = usePrinterPrefsStore((s) => s.setMode);
  const setBluetoothDevice = usePrinterPrefsStore((s) => s.setBluetoothDevice);
  const setBluetoothPaperWidth = usePrinterPrefsStore(
    (s) => s.setBluetoothPaperWidth
  );

  // Local BT draft state
  const [scannedBtDevices, setScannedBtDevices] = useState<
    PairedBluetoothPrinter[]
  >([]);
  const [manualBtName, setManualBtName] = useState<string>(
    bluetoothDevice?.name ?? ""
  );
  const [manualBtMac, setManualBtMac] = useState<string>(
    bluetoothDevice?.address ?? ""
  );
  const [isTestingDevice, setIsTestingDevice] = useState<boolean>(false);

  // Owner Server Printer settings state
  const [serverPrinters, setServerPrinters] = useState<ServerPrinterInfo[]>([]);
  const [selectedServerPrinter, setSelectedServerPrinter] = useState<string>(
    storeSettings?.printerName ?? ""
  );
  const [selectedPrinterType, setSelectedPrinterType] = useState<
    "usb" | "network"
  >(storeSettings?.printerType ?? "usb");
  const [serverPaperWidth, setServerPaperWidth] = useState<number>(
    storeSettings?.printerPaperWidth ?? 58
  );
  const [previewBeforePrint, setPreviewBeforePrint] = useState<boolean>(
    storeSettings?.previewReceiptBeforePrint ?? true
  );
  const [receiptFooterNote, setReceiptFooterNote] = useState<string>(
    storeSettings?.receiptFooterNote ?? ""
  );
  const [isSavingServer, setIsSavingServer] = useState<boolean>(false);
  const [banner, setBanner] = useState<{
    variant: "success" | "warning" | "error";
    message: string;
  } | null>(null);

  const canWriteOnline =
    isDeviceConnected &&
    dbOnline &&
    healthState !== "offline" &&
    healthState !== "read_only";

  useEffect(() => {
    if (!roleCapabilities.canManageStore || !isDeviceConnected) {
      return;
    }
    let active = true;
    void fetchServerPrinters(serverConfig)
      .then((res) => {
        if (active && res.ok) {
          setServerPrinters(res.printers);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isDeviceConnected, roleCapabilities.canManageStore, serverConfig]);

  const handleScanBt = async () => {
    setBanner(null);
    const res = await scanPairedBluetoothPrinters();
    if (res.ok) {
      setScannedBtDevices(res.devices);
      if (res.devices.length === 0) {
        setBanner({
          variant: "warning",
          message:
            "Tidak ada printer Bluetooth terpasang. Pastikan printer sudah di-pair di Pengaturan Bluetooth HP.",
        });
      }
    } else {
      setBanner({
        variant: "warning",
        message: res.error ?? "Pemindaian Bluetooth tidak tersedia.",
      });
    }
  };

  const handleSaveManualBt = () => {
    if (!manualBtMac.trim()) {
      setBanner({
        variant: "error",
        message: "Alamat MAC / ID perangkat Bluetooth wajib diisi.",
      });
      return;
    }
    setBluetoothDevice({
      name: manualBtName.trim() || "Printer Thermal BT",
      address: manualBtMac.trim(),
    });
    setBanner({
      variant: "success",
      message: "Printer Bluetooth perangkat ini berhasil disimpan.",
    });
  };

  const handleDeviceTestPrint = async () => {
    setIsTestingDevice(true);
    setBanner(null);
    try {
      if (printerMode === "server") {
        const res = await triggerServerTestPrint(serverConfig, {
          printerName: selectedServerPrinter || storeSettings?.printerName,
          printerType: selectedPrinterType,
          paperWidth: serverPaperWidth,
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
        storeSettings: storeSettings ?? null,
        orderNumber: "TEST-PRINT",
      });

      const res = await executeReceiptPrint({
        mode: printerMode,
        order: sampleOrder,
        copies: 1,
        serverConfig,
        storeSettings: storeSettings ?? null,
        bluetoothDevice,
        bluetoothPaperWidth,
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

  const handleSaveServerSettings = async () => {
    if (isSavingServer || !canWriteOnline) {
      return;
    }
    setIsSavingServer(true);
    setBanner(null);
    try {
      const res = await updateStoreSettings(serverConfig, {
        printerName: selectedServerPrinter.trim(),
        printerType: selectedPrinterType,
        printerPaperWidth: serverPaperWidth,
        previewReceiptBeforePrint: previewBeforePrint,
        receiptFooterNote: receiptFooterNote.trim(),
      });
      if (res.ok) {
        await refreshStoreSettings();
        setBanner({
          variant: "success",
          message: "Pengaturan printer & struk server berhasil disimpan.",
        });
      } else {
        setBanner({
          variant: "error",
          message: res.error ?? "Gagal menyimpan pengaturan printer server.",
        });
      }
    } finally {
      setIsSavingServer(false);
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
          {MODE_OPTIONS.map((opt) => {
            const selected = printerMode === opt.id;
            return (
              <Pressable
                key={opt.id}
                testID={`printer-mode-${opt.id}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setMode(opt.id)}
                style={[styles.modeCard, selected && styles.modeCardSelected]}
              >
                <View style={styles.modeIconWrap}>
                  {opt.icon === "server" ? (
                    <Server
                      size={18}
                      color={
                        selected
                          ? TOKENS.colors.onPrimaryFixed
                          : TOKENS.colors.onSurfaceVariant
                      }
                    />
                  ) : opt.icon === "bluetooth" ? (
                    <Bluetooth
                      size={18}
                      color={
                        selected
                          ? TOKENS.colors.onPrimaryFixed
                          : TOKENS.colors.onSurfaceVariant
                      }
                    />
                  ) : (
                    <Smartphone
                      size={18}
                      color={
                        selected
                          ? TOKENS.colors.onPrimaryFixed
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
              </Pressable>
            );
          })}

          {printerMode === "bluetooth" ? (
            <View style={styles.btPanel}>
              <Text style={styles.fieldLabel}>
                Lebar Kertas Thermal Bluetooth
              </Text>
              <View style={styles.chipRow}>
                {([58, 80] as const).map((w) => (
                  <Pressable
                    key={w}
                    testID={`bt-width-${w}`}
                    onPress={() => setBluetoothPaperWidth(w)}
                    style={[
                      styles.chip,
                      bluetoothPaperWidth === w && styles.chipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        bluetoothPaperWidth === w && styles.chipTextSelected,
                      ]}
                    >
                      {`${w}mm`}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <SecondaryButton
                testID="bt-scan-button"
                variant="tonal"
                label="Pindai Printer Bluetooth Terpasang"
                icon={<Search size={16} color={TOKENS.colors.onPrimaryFixed} />}
                onPress={() => {
                  void handleScanBt();
                }}
              />

              {scannedBtDevices.map((dev) => (
                <Pressable
                  key={dev.address}
                  onPress={() => {
                    setBluetoothDevice(dev);
                    setManualBtName(dev.name);
                    setManualBtMac(dev.address);
                  }}
                  style={styles.printerOptionRow}
                >
                  <Text style={styles.printerOptionTitle}>{dev.name}</Text>
                  <Text style={styles.printerOptionAddr}>{dev.address}</Text>
                </Pressable>
              ))}

              <InputField
                label="Nama Printer Bluetooth"
                value={manualBtName}
                onChangeText={setManualBtName}
                placeholder="Contoh: RPP02N-58mm"
              />
              <InputField
                label="Alamat MAC Bluetooth"
                value={manualBtMac}
                onChangeText={setManualBtMac}
                placeholder="00:11:22:33:44:55"
                monospace
              />
              <SecondaryButton
                variant="outlined"
                label="Simpan Perangkat Bluetooth"
                onPress={handleSaveManualBt}
              />
            </View>
          ) : null}

          <PrimaryButton
            testID="printer-device-test-button"
            label="Tes Cetak Sekarang"
            loading={isTestingDevice}
            loadingLabel="Mengirim Tes Cetak..."
            disabled={isTestingDevice}
            icon={<Printer size={18} color={TOKENS.colors.onPrimary} />}
            onPress={() => {
              void handleDeviceTestPrint();
            }}
          />
        </SurfaceCard>

        {roleCapabilities.canManageStore ? (
          <SurfaceCard testID="printer-owner-server-card" style={styles.card}>
            <Text style={styles.sectionHeading}>
              Konfigurasi Printer Server &amp; Struk (Owner)
            </Text>

            {serverPrinters.length > 0 ? (
              <View style={styles.printersWrap}>
                <Text style={styles.fieldLabel}>
                  Printer Terdeteksi di Server
                </Text>
                {serverPrinters.map((sp) => {
                  const chosen = sp.name === selectedServerPrinter;
                  return (
                    <Pressable
                      key={sp.name}
                      onPress={() => {
                        setSelectedServerPrinter(sp.name);
                        setSelectedPrinterType(sp.type);
                      }}
                      style={[
                        styles.printerOptionRow,
                        chosen && styles.modeCardSelected,
                      ]}
                    >
                      <Text style={styles.printerOptionTitle}>{sp.name}</Text>
                      <Text style={styles.printerOptionAddr}>
                        {sp.type.toUpperCase()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <InputField
              testID="printer-server-name-input"
              label="Nama Printer Server"
              value={selectedServerPrinter}
              onChangeText={setSelectedServerPrinter}
              placeholder="EPSON TM-T82 / POS-58"
            />

            <Text style={styles.fieldLabel}>Lebar Kertas Struk Server</Text>
            <View style={styles.chipRow}>
              {([58, 80] as const).map((w) => (
                <Pressable
                  key={w}
                  testID={`server-width-${w}`}
                  onPress={() => setServerPaperWidth(w)}
                  style={[
                    styles.chip,
                    serverPaperWidth === w && styles.chipSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      serverPaperWidth === w && styles.chipTextSelected,
                    ]}
                  >
                    {`${w}mm`}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>
                Tampilkan Pratinjau Struk Sebelum Cetak
              </Text>
              <Switch
                testID="printer-preview-toggle"
                value={previewBeforePrint}
                onValueChange={setPreviewBeforePrint}
              />
            </View>

            <InputField
              testID="printer-footer-note-input"
              label="Catatan Kaki Struk"
              value={receiptFooterNote}
              onChangeText={setReceiptFooterNote}
              placeholder="Terima kasih sudah berbelanja"
            />

            <SecondaryButton
              testID="printer-owner-save-button"
              variant="tonal"
              label="Simpan Pengaturan Struk Server"
              loading={isSavingServer}
              loadingLabel="Menyimpan..."
              disabled={isSavingServer || !canWriteOnline}
              icon={<Save size={16} color={TOKENS.colors.onPrimaryFixed} />}
              onPress={() => {
                void handleSaveServerSettings();
              }}
            />
          </SurfaceCard>
        ) : null}
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
    gap: TOKENS.spacing.md,
  },
  sectionHeading: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: TOKENS.typography.body,
    lineHeight: TOKENS.lineHeight.body,
    color: TOKENS.colors.onSurface,
  },
  modeCard: {
    minHeight: TOKENS.spacing.touchTarget,
    flexDirection: "row",
    alignItems: "center",
    padding: TOKENS.spacing.md,
    borderRadius: TOKENS.radii.md,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    gap: TOKENS.spacing.sm,
  },
  modeCardSelected: {
    backgroundColor: TOKENS.colors.primaryFixed,
    borderColor: TOKENS.colors.primary,
  },
  modeIconWrap: {
    width: TOKENS.spacing.xl,
    alignItems: "center",
  },
  modeTextCol: {
    flex: 1,
    gap: 2,
  },
  modeTitle: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.body,
    lineHeight: TOKENS.lineHeight.body,
    color: TOKENS.colors.onSurface,
  },
  modeTitleSelected: {
    color: TOKENS.colors.onPrimaryFixed,
  },
  modeDesc: {
    fontFamily: FONT_FAMILY.body,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurfaceVariant,
  },
  btPanel: {
    padding: TOKENS.spacing.md,
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    borderRadius: TOKENS.radii.md,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    gap: TOKENS.spacing.sm,
  },
  fieldLabel: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurfaceVariant,
  },
  chipRow: {
    flexDirection: "row",
    gap: TOKENS.spacing.sm,
  },
  chip: {
    minWidth: 72,
    minHeight: TOKENS.spacing.touchTarget,
    paddingHorizontal: TOKENS.spacing.md,
    borderRadius: TOKENS.radii.sm,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    backgroundColor: TOKENS.colors.surfaceCard,
    justifyContent: "center",
    alignItems: "center",
  },
  chipSelected: {
    backgroundColor: TOKENS.colors.primary,
    borderColor: TOKENS.colors.primary,
  },
  chipText: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurface,
  },
  chipTextSelected: {
    color: TOKENS.colors.onPrimary,
  },
  printersWrap: {
    gap: TOKENS.spacing.xs,
  },
  printerOptionRow: {
    minHeight: TOKENS.spacing.touchTarget,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: TOKENS.spacing.md,
    borderRadius: TOKENS.radii.sm,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    backgroundColor: TOKENS.colors.surfaceCard,
  },
  printerOptionTitle: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    color: TOKENS.colors.onSurface,
  },
  printerOptionAddr: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: TOKENS.typography.label,
    color: TOKENS.colors.onSurfaceVariant,
  },
  switchRow: {
    minHeight: TOKENS.spacing.touchTarget,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: TOKENS.spacing.sm,
  },
  switchLabel: {
    flex: 1,
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurface,
  },
});
