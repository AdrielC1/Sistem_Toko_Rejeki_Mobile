import * as Print from "expo-print";
import { buildEscPosReceiptBytes } from "@/domain/escposBuilder";
import type { CompletedOrder } from "@/domain/pricing";
import { buildReceiptHtml } from "@/domain/receiptLayout";
import {
  flushServerPrinterQueue,
  submitServerPrintJob,
  type PrintDiagnosticInfo,
} from "@/services/api/printApi";
import type { PairedBluetoothPrinter, PrinterDeviceMode } from "@/store/printerPrefsStore";
import type { ServerUrlConfig, StoreSettings } from "@/types";

export interface BluetoothEscPosDriver {
  scanPairedDevices: () => Promise<PairedBluetoothPrinter[]>;
  writeRawBytes: (deviceAddress: string, payload: Uint8Array) => Promise<void>;
}

let registeredBtDriver: BluetoothEscPosDriver | null = null;

export function registerBluetoothEscPosDriver(
  driver: BluetoothEscPosDriver | null
): void {
  registeredBtDriver = driver;
}

export function isBluetoothEscPosSupported(): boolean {
  return registeredBtDriver !== null;
}

export async function scanPairedBluetoothPrinters(): Promise<{
  ok: boolean;
  devices: PairedBluetoothPrinter[];
  error?: string;
}> {
  if (!registeredBtDriver) {
    return {
      ok: false,
      devices: [],
      error:
        "Driver Bluetooth Thermal ESC/POS memerlukan aplikasi native build (APK / Development Build), tidak tersedia di Expo Go standar.",
    };
  }
  try {
    const devices = await registeredBtDriver.scanPairedDevices();
    return { ok: true, devices };
  } catch (err) {
    return {
      ok: false,
      devices: [],
      error:
        err instanceof Error
          ? err.message
          : "Gagal memindai perangkat printer Bluetooth.",
    };
  }
}

export interface UnifiedPrintResult {
  ok: boolean;
  mode: PrinterDeviceMode;
  paperNearEnd: boolean;
  diagnostic?: PrintDiagnosticInfo;
  error?: string;
  requiresIntervention?: boolean;
}

export async function executeReceiptPrint(params: {
  mode: PrinterDeviceMode;
  order: CompletedOrder;
  copies: number;
  serverConfig: ServerUrlConfig;
  storeSettings: StoreSettings | null;
  bluetoothDevice: PairedBluetoothPrinter | null;
  bluetoothPaperWidth: 58 | 80;
}): Promise<UnifiedPrintResult> {
  const paperWidthMm =
    params.mode === "bluetooth"
      ? params.bluetoothPaperWidth
      : params.storeSettings?.printerPaperWidth ?? 58;

  if (params.mode === "system") {
    try {
      const html = buildReceiptHtml(params.order, paperWidthMm);
      await Print.printAsync({ html });
      return {
        ok: true,
        mode: "system",
        paperNearEnd: false,
      };
    } catch (err) {
      return {
        ok: false,
        mode: "system",
        paperNearEnd: false,
        error:
          err instanceof Error
            ? err.message
            : "Cetak sistem HP dibatalkan atau gagal.",
        requiresIntervention: false,
      };
    }
  }

  if (params.mode === "bluetooth") {
    if (!params.bluetoothDevice) {
      return {
        ok: false,
        mode: "bluetooth",
        paperNearEnd: false,
        error:
          "Belum ada printer Bluetooth yang dipilih. Pilih printer di Pengaturan -> Printer.",
        requiresIntervention: true,
      };
    }
    if (!registeredBtDriver) {
      return {
        ok: false,
        mode: "bluetooth",
        paperNearEnd: false,
        error:
          "Cetak Bluetooth ESC/POS langsung hanya aktif pada build native (APK/Dev Client). Gunakan Printer Server atau Cetak Sistem HP.",
        requiresIntervention: true,
      };
    }

    try {
      const rawBytes = buildEscPosReceiptBytes(params.order, {
        paperWidthMm,
        copies: params.copies,
      });
      await registeredBtDriver.writeRawBytes(
        params.bluetoothDevice.address,
        rawBytes
      );
      return {
        ok: true,
        mode: "bluetooth",
        paperNearEnd: false,
      };
    } catch (err) {
      return {
        ok: false,
        mode: "bluetooth",
        paperNearEnd: false,
        error:
          err instanceof Error
            ? err.message
            : "Gagal mengirim perintah cetak ESC/POS ke printer Bluetooth.",
        requiresIntervention: true,
      };
    }
  }

  // Default: "server"
  const serverRes = await submitServerPrintJob(params.serverConfig, {
    order: params.order,
    copies: params.copies,
    settings: params.storeSettings,
  });

  return {
    ok: serverRes.ok,
    mode: "server",
    paperNearEnd: serverRes.paperNearEnd,
    diagnostic: serverRes.diagnostic,
    error: serverRes.error,
    requiresIntervention: !serverRes.ok,
  };
}

export async function flushServerSpooler(
  config: ServerUrlConfig,
  storeSettings: StoreSettings | null
): Promise<{ ok: boolean; message: string }> {
  return flushServerPrinterQueue(config, {
    printerName: storeSettings?.printerName,
    printerType: storeSettings?.printerType,
  });
}
