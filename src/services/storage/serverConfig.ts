import { z } from "zod";
import { apiFetch } from "@/services/api/apiClient";
import { setCachedStoreSettings } from "@/services/storage/secureStorage";
import type { ConnectionTestResult, StoreSettings } from "@/types";

export const SERVER_URL_HINTS = {
  androidEmulator: "http://10.0.2.2:3000",
  lanExample: "http://192.168.1.10:3000",
} as const;

export const SERVER_URL_INVALID_ERROR =
  "Alamat server tidak valid atau tidak terjangkau. Pastikan diawali http:// atau https:// dan server kasir aktif.";

const HOSTNAME_REGEX = /^(?:[A-Za-z0-9.-]+|\[[0-9A-Fa-f:]+\])$/;

const serverUrlSchema = z
  .string()
  .trim()
  .min(1, SERVER_URL_INVALID_ERROR)
  .refine((val) => !/\s/.test(val), SERVER_URL_INVALID_ERROR)
  .transform((val, ctx) => {
    let parsed: URL;
    try {
      parsed = new URL(val);
    } catch {
      ctx.addIssue({
        code: "custom",
        message: SERVER_URL_INVALID_ERROR,
      });
      return z.NEVER;
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      ctx.addIssue({
        code: "custom",
        message: SERVER_URL_INVALID_ERROR,
      });
      return z.NEVER;
    }

    const host = parsed.hostname;
    if (
      !host ||
      host === "." ||
      host === ".." ||
      host.startsWith(".") ||
      host.endsWith(".") ||
      host.includes("..") ||
      !HOSTNAME_REGEX.test(host) ||
      parsed.username ||
      parsed.password
    ) {
      ctx.addIssue({
        code: "custom",
        message: SERVER_URL_INVALID_ERROR,
      });
      return z.NEVER;
    }

    const cleanPath = parsed.pathname
      .replace(/\/+$/, "")
      .replace(/\/api$/i, "");

    return `${parsed.protocol}//${parsed.host}${cleanPath}`;
  });

const publicSettingsPayloadSchema = z.object({
  success: z.literal(true),
  offline: z.boolean().optional(),
  data: z.object({
    storeName: z.string().min(1),
    storeAddress: z
      .string()
      .nullish()
      .transform((v) => v ?? undefined),
    storePhone: z
      .string()
      .nullish()
      .transform((v) => v ?? undefined),
    storeLogo: z
      .string()
      .nullish()
      .transform((v) => v ?? undefined),
    previewReceiptBeforePrint: z
      .boolean()
      .nullish()
      .transform((v) => v ?? undefined),
    printerPaperWidth: z
      .number()
      .nullish()
      .transform((v) => v ?? undefined),
    printerName: z
      .string()
      .nullish()
      .transform((v) => v ?? undefined),
    printerType: z
      .enum(["usb", "network"])
      .nullish()
      .transform((v) => v ?? undefined),
    receiptFooterNote: z
      .string()
      .nullish()
      .transform((v) => v ?? undefined),
  }),
});

export function parseStoreSettingsResponse(
  json: unknown
): { storeSettings: StoreSettings; offlineDb: boolean } | null {
  const parsed = publicSettingsPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return null;
  }

  return {
    storeSettings: parsed.data.data,
    offlineDb: Boolean(parsed.data.offline),
  };
}

export function normalizeServerUrl(
  raw: string
): { ok: true; url: string } | { ok: false; error: string } {
  const result = serverUrlSchema.safeParse(typeof raw === "string" ? raw : "");
  if (!result.success) {
    return {
      ok: false,
      error: SERVER_URL_INVALID_ERROR,
    };
  }
  return {
    ok: true,
    url: result.data,
  };
}

/**
 * Validates Server URL format and tests reachability against pre-login `GET /api/settings`
 * (never `/api/health`, which returns 401 when unauthenticated).
 * Updates cached `storeSettings` in `kv-store` on 200 without modifying saved `server_base_url` on error.
 */
export async function testServerConnection(
  rawUrl: string
): Promise<ConnectionTestResult> {
  const normalized = normalizeServerUrl(rawUrl);
  if (!normalized.ok) {
    return {
      ok: false,
      latencyMs: 0,
      error: normalized.error,
    };
  }

  const startedAt = Date.now();
  try {
    const res = await apiFetch(normalized.url, "/api/settings", {
      method: "GET",
      sessionToken: null,
      timeoutMs: 6000,
    });
    const latencyMs = Math.max(0, Date.now() - startedAt);

    if (!res.ok) {
      return {
        ok: false,
        latencyMs,
        error: SERVER_URL_INVALID_ERROR,
      };
    }

    const json: unknown = await res.json();
    const parsed = parseStoreSettingsResponse(json);
    if (!parsed) {
      return {
        ok: false,
        latencyMs,
        error: SERVER_URL_INVALID_ERROR,
      };
    }

    setCachedStoreSettings(parsed.storeSettings);

    return {
      ok: true,
      latencyMs,
      storeSettings: parsed.storeSettings,
      offlineDb: parsed.offlineDb,
    };
  } catch {
    return {
      ok: false,
      latencyMs: Math.max(0, Date.now() - startedAt),
      error: SERVER_URL_INVALID_ERROR,
    };
  }
}
