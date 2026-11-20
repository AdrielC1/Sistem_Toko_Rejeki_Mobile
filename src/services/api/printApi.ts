import { formatWibDateTime } from "@/domain/format";
import type { CompletedOrder } from "@/domain/pricing";
import { apiRequestWithFailover } from "@/services/api/apiClient";
import { useCatalogScopeStore } from "@/store/catalogScopeStore";
import type { ServerRoute, ServerUrlConfig, StoreSettings } from "@/types";

export interface PrintDiagnosticInfo {
  errorCode?: string;
  errorMessage?: string;
  paperNearEnd?: boolean;
}

export interface ServerPrintOutcome {
  ok: boolean;
  usedRoute: ServerRoute | null;
  paperNearEnd: boolean;
  diagnostic?: PrintDiagnosticInfo;
  error?: string;
  isConnectionError: boolean;
}

interface RawPrintResponseBody {
  success?: boolean;
  error?: string;
  diagnostic?: PrintDiagnosticInfo;
  message?: string;
}

function mapOrderItemsForServer(items: CompletedOrder["items"]) {
  return items.map((item) => {
    const isWholesale =
      !item.isCustomPrice &&
      typeof item.baseUnitPrice === "number" &&
      item.effectiveUnitPrice < item.baseUnitPrice &&
      (item.wholesaleSavings ?? 0) > 0;
    return {
      productId: item.productId,
      name: item.productName,
      unit: item.unitName,
      qty: item.quantity,
      unitPrice: item.effectiveUnitPrice,
      total: item.subtotal,
      ...(isWholesale
        ? { originalPrice: item.baseUnitPrice, isWholesale: true }
        : {}),
    };
  });
}

export async function submitServerPrintJob(
  config: ServerUrlConfig,
  params: {
    order: CompletedOrder;
    copies: number;
    settings?: StoreSettings | null;
  }
): Promise<ServerPrintOutcome> {
  const serverOrder = {
    orderId: params.order.orderNumber,
    invoiceNumber: params.order.orderNumber,
    date: formatWibDateTime(params.order.date),
    items: mapOrderItemsForServer(params.order.items),
    subtotal: params.order.subtotal,
    discount: params.order.discount,
    grandTotal: params.order.grandTotal,
    cashGiven: params.order.cashGiven,
    change: params.order.change,
  };

  const result = await apiRequestWithFailover<unknown>(config, "/api/print", {
    method: "POST",
    timeoutMs: 15000,
    body: JSON.stringify({
      order: serverOrder,
      copies: params.copies,
      ...(params.settings ? { settings: params.settings } : {}),
    }),
  });

  const body = (result.rawBody ?? null) as RawPrintResponseBody | null;
  const diagnostic = body?.diagnostic;
  const paperNearEnd = Boolean(diagnostic?.paperNearEnd);

  if (result.networkError) {
    return {
      ok: false,
      usedRoute: result.usedRoute,
      paperNearEnd,
      diagnostic,
      error:
        result.error ??
        "Server printer tidak dapat dihubungi. Periksa koneksi jaringan.",
      isConnectionError: true,
    };
  }

  // Backend `/api/print` can return HTTP 200 with `{ success: false, error, diagnostic }`.
  if (result.ok && body?.success === true) {
    return {
      ok: true,
      usedRoute: result.usedRoute,
      paperNearEnd,
      diagnostic,
      isConnectionError: false,
    };
  }

  return {
    ok: false,
    usedRoute: result.usedRoute,
    paperNearEnd,
    diagnostic,
    error:
      body?.error ??
      diagnostic?.errorMessage ??
      result.error ??
      "Printer gagal mencetak struk.",
    isConnectionError: false,
  };
}

export async function flushServerPrinterQueue(
  config: ServerUrlConfig,
  params?: { printerName?: string; printerType?: "usb" | "network" }
): Promise<{ ok: boolean; message: string }> {
  const result = await apiRequestWithFailover<unknown>(
    config,
    "/api/print/flush",
    {
      method: "POST",
      timeoutMs: 10000,
      body: JSON.stringify({
        ...(params?.printerName ? { printerName: params.printerName } : {}),
        ...(params?.printerType ? { printerType: params.printerType } : {}),
      }),
    }
  );

  const body = (result.rawBody ?? null) as RawPrintResponseBody | null;
  if (result.ok && body?.success !== false) {
    return {
      ok: true,
      message: body?.message ?? "Antrean printer berhasil dibersihkan.",
    };
  }

  return {
    ok: false,
    message:
      body?.error ??
      result.error ??
      "Gagal membersihkan antrean printer di server.",
  };
}

export async function submitWhatsAppOrderLog(
  config: ServerUrlConfig,
  order: CompletedOrder
): Promise<{ ok: boolean }> {
  try {
    const scope = useCatalogScopeStore.getState().scope;
    const sourceLabel = scope === "mini" ? "Katalog Mini" : "Katalog Utama";

    const result = await apiRequestWithFailover<unknown>(
      config,
      "/api/wa-log",
      {
        method: "POST",
        timeoutMs: 8000,
        body: JSON.stringify({
          storeName: order.storeName,
          sourceLabel,
          date: order.date,
          items: mapOrderItemsForServer(order.items),
          subtotal: order.subtotal,
          discount: order.discount,
          grandTotal: order.grandTotal,
        }),
      }
    );
    const body = (result.rawBody ?? null) as RawPrintResponseBody | null;
    return { ok: Boolean(result.ok && body?.success !== false) };
  } catch {
    return { ok: false };
  }
}
