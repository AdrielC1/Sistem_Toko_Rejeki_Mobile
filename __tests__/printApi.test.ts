import { buildCompletedOrderPayload } from "@/domain/pricing";
import { resetActiveRouteForTest } from "@/services/api/apiClient";
import {
  flushServerPrinterQueue,
  submitServerPrintJob,
  submitWhatsAppOrderLog,
} from "@/services/api/printApi";
import { resetTestStorage } from "./setup";

const CONFIG = {
  primaryUrl: "http://192.168.1.100:3000",
  fallbackUrl: "https://kasir.tokorejeki.my.id",
};

const SAMPLE_ORDER = buildCompletedOrderPayload({
  items: [
    {
      productId: "p-1",
      productName: "Beras 5kg",
      sku: "BRS-5",
      unitId: "u-1",
      unitName: "Sak",
      conversionFactor: 1,
      baseUnitPrice: 65000,
      wholesaleTiers: [],
      quantity: 2,
      effectiveUnitPrice: 65000,
      subtotal: 130000,
      wholesaleSavings: 0,
    },
  ],
  discount: 5000,
  cashierName: "Budi Kasir",
  storeSettings: { storeName: "Toko Rejeki" },
  orderNumber: "TRX-001",
  dateIso: "2026-11-19T03:10:00.000Z",
});

describe("printApi (/api/print, /api/print/flush, /api/wa-log)", () => {
  beforeEach(() => {
    resetTestStorage();
    resetActiveRouteForTest();
    jest.clearAllMocks();
    globalThis.fetch = jest.fn() as unknown as typeof globalThis.fetch;
  });

  it("branches on HTTP 200 body.success === false and preserves paperNearEnd diagnostics", async () => {
    const fetchMock = globalThis.fetch as jest.Mock;

    // HTTP 200 with success: false + diagnostic
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        success: false,
        error: "Kertas printer habis",
        diagnostic: {
          errorCode: "PAPER_OUT",
          errorMessage: "Kertas gulungan habis",
          paperNearEnd: true,
        },
      }),
    });

    const failed = await submitServerPrintJob(CONFIG, {
      order: SAMPLE_ORDER,
      copies: 2,
    });
    expect(failed.ok).toBe(false);
    expect(failed.error).toBe("Kertas printer habis");
    expect(failed.paperNearEnd).toBe(true);
    expect(failed.isConnectionError).toBe(false);

    // HTTP 200 with success: true + paperNearEnd warning
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        success: true,
        diagnostic: { paperNearEnd: true },
      }),
    });

    const succeeded = await submitServerPrintJob(CONFIG, {
      order: SAMPLE_ORDER,
      copies: 2,
    });
    expect(succeeded.ok).toBe(true);
    expect(succeeded.paperNearEnd).toBe(true);

    // Flush endpoint
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        success: true,
        message: "Spooler dibersihkan",
      }),
    });
    const flushRes = await flushServerPrinterQueue(CONFIG);
    expect(flushRes).toEqual({
      ok: true,
      message: "Spooler dibersihkan",
    });

    // Non-blocking WA log sends ISO date cleanly
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ success: true }),
    });
    const waRes = await submitWhatsAppOrderLog(CONFIG, SAMPLE_ORDER);
    expect(waRes.ok).toBe(true);
    const [, waInit] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    expect(JSON.parse(String(waInit.body))).toMatchObject({
      storeName: "Toko Rejeki",
      date: "2026-11-19T03:10:00.000Z",
      grandTotal: 125000,
    });
  });
});
