import { fetchAuthenticatedSettings } from "@/services/api/authApi";
import { apiRequestWithFailover } from "@/services/api/apiClient";
import {
  getCachedStoreSettings,
  setCachedStoreSettings,
} from "@/services/storage/secureStorage";
import type { ServerUrlConfig, StoreSettings } from "@/types";

export interface ServerPrinterInfo {
  name: string;
  type: "usb" | "network";
  isDefault?: boolean;
  status?: string;
}

export interface StoreSettingsPatch {
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  storeLogo?: string | null;
  previewReceiptBeforePrint?: boolean;
  printerPaperWidth?: number;
  printerName?: string;
  printerType?: "usb" | "network";
  receiptFooterNote?: string;
}

/**
 * Performs safe read-merge-write against `PUT /api/settings` so updating store profile
 * or basic printer preferences never drops `receiptSections` or `receiptItemConfig`.
 */
export async function updateStoreSettings(
  config: ServerUrlConfig,
  patch: StoreSettingsPatch
): Promise<{ ok: boolean; settings: StoreSettings | null; error?: string }> {
  const latestRemote = await fetchAuthenticatedSettings(config).catch(
    () => null
  );
  const current = latestRemote ?? getCachedStoreSettings() ?? {
    storeName: "Toko Rejeki",
  };

  const mergedPayload: Record<string, unknown> = {
    storeName: patch.storeName ?? current.storeName,
    storeAddress:
      patch.storeAddress !== undefined
        ? patch.storeAddress
        : (current.storeAddress ?? ""),
    storePhone:
      patch.storePhone !== undefined
        ? patch.storePhone
        : (current.storePhone ?? ""),
    storeLogo:
      patch.storeLogo !== undefined
        ? (patch.storeLogo ?? "")
        : (current.storeLogo ?? ""),
    previewReceiptBeforePrint:
      patch.previewReceiptBeforePrint !== undefined
        ? patch.previewReceiptBeforePrint
        : (current.previewReceiptBeforePrint ?? true),
    printerPaperWidth:
      patch.printerPaperWidth !== undefined
        ? patch.printerPaperWidth
        : (current.printerPaperWidth ?? 58),
    printerName:
      patch.printerName !== undefined
        ? patch.printerName
        : (current.printerName ?? ""),
    printerType:
      patch.printerType !== undefined
        ? patch.printerType
        : (current.printerType ?? "usb"),
    receiptFooterNote:
      patch.receiptFooterNote !== undefined
        ? patch.receiptFooterNote
        : (current.receiptFooterNote ?? ""),
    ...(current.receiptSections
      ? { receiptSections: current.receiptSections }
      : {}),
    ...(current.receiptItemConfig
      ? { receiptItemConfig: current.receiptItemConfig }
      : {}),
  };

  const res = await apiRequestWithFailover<StoreSettings>(
    config,
    "/api/settings",
    {
      method: "PUT",
      timeoutMs: 12000,
      body: JSON.stringify(mergedPayload),
    }
  );

  if (!res.ok) {
    return {
      ok: false,
      settings: null,
      error: res.error ?? "Gagal menyimpan pengaturan toko.",
    };
  }

  const nextSettings: StoreSettings = res.data ?? {
    ...current,
    storeName: String(mergedPayload.storeName),
    storeAddress: String(mergedPayload.storeAddress ?? ""),
    storePhone: String(mergedPayload.storePhone ?? ""),
    storeLogo: String(mergedPayload.storeLogo ?? ""),
    previewReceiptBeforePrint: Boolean(mergedPayload.previewReceiptBeforePrint),
    printerPaperWidth: Number(mergedPayload.printerPaperWidth ?? 58),
    printerName: String(mergedPayload.printerName ?? ""),
    printerType:
      mergedPayload.printerType === "network" ? "network" : "usb",
    receiptFooterNote: String(mergedPayload.receiptFooterNote ?? ""),
  };

  setCachedStoreSettings(nextSettings);
  return {
    ok: true,
    settings: nextSettings,
  };
}

export async function fetchServerPrinters(
  config: ServerUrlConfig
): Promise<{ ok: boolean; printers: ServerPrinterInfo[]; error?: string }> {
  const res = await apiRequestWithFailover<ServerPrinterInfo[]>(
    config,
    "/api/printers",
    { method: "GET", timeoutMs: 8000 }
  );

  if (!res.ok || !Array.isArray(res.data)) {
    return {
      ok: false,
      printers: [],
      error: res.error ?? "Gagal mengambil daftar printer dari server.",
    };
  }

  return {
    ok: true,
    printers: res.data,
  };
}

export async function triggerServerTestPrint(
  config: ServerUrlConfig,
  params?: {
    printerName?: string;
    printerType?: "usb" | "network";
    paperWidth?: number;
  }
): Promise<{ ok: boolean; message: string }> {
  const res = await apiRequestWithFailover<{ message?: string }>(
    config,
    "/api/printers/test",
    {
      method: "POST",
      timeoutMs: 12000,
      body: JSON.stringify(params ?? {}),
    }
  );

  if (res.ok) {
    return {
      ok: true,
      message: res.data?.message ?? "Tes cetak printer server berhasil dikirim.",
    };
  }

  return {
    ok: false,
    message: res.error ?? "Gagal mengirim tes cetak ke printer server.",
  };
}
