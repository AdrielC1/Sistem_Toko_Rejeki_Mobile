import { z } from "zod";
import { apiFetch } from "@/services/api/apiClient";
import {
  clearStoredServerUrl,
  getStoredServerConfigRaw,
  getStoredServerUrl,
  setCachedStoreSettings,
  setStoredServerConfigRaw,
  setStoredServerUrl,
} from "@/services/storage/secureStorage";
import type {
  ConnectionTestResult,
  ServerRoute,
  ServerUrlConfig,
  StoreSettings,
} from "@/types";

export const DEFAULT_PRIMARY_SERVER_URL = "http://192.168.1.100:3000";
export const DEFAULT_CLOUD_SERVER_URL = "https://kasir.tokorejeki.my.id";
export const LAN_PROBE_TIMEOUT_MS = 2000;

export const SERVER_URL_HINTS = {
  androidEmulator: "http://10.0.2.2:3000",
  lanExample: "http://192.168.1.10:3000",
} as const;

export const SERVER_URL_INVALID_ERROR =
  "Alamat server tidak valid atau tidak terjangkau. Pastikan diawali http:// atau https:// dan server kasir aktif.";

export const DUAL_SERVER_EMPTY_ERROR =
  "Minimal satu alamat server (LAN atau Cloud) wajib diisi.";

export const DUAL_SERVER_UNREACHABLE_ERROR =
  "Tidak dapat terhubung ke server LAN maupun Cloud. Periksa koneksi Wi-Fi atau alamat server.";

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

const receiptLineSchema = z.object({
  text: z.string(),
  align: z.enum(["left", "center", "right"]),
  bold: z.boolean().optional(),
  fontSize: z.enum(["sm", "md", "lg"]).optional(),
});

const receiptSectionSchema = z.object({
  id: z.string(),
  type: z.enum(["header", "meta", "items", "totals", "footer", "custom"]),
  title: z.string().optional(),
  enabled: z.boolean(),
  lines: z.array(receiptLineSchema).optional(),
});

const receiptItemConfigSchema = z.object({
  showSku: z.boolean().optional(),
  showUnitPrice: z.boolean().optional(),
  showDiscountLine: z.boolean().optional(),
  showWholesaleBadge: z.boolean().optional(),
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
    receiptSections: z
      .array(receiptSectionSchema)
      .nullish()
      .transform((v) => v ?? undefined),
    receiptItemConfig: receiptItemConfigSchema
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

function normalizeOptionalUrl(
  raw: string | null | undefined
): { provided: false; url: null } | { provided: true; ok: true; url: string } | { provided: true; ok: false; error: string } {
  if (typeof raw !== "string") {
    return { provided: false, url: null };
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { provided: false, url: null };
  }
  const normalized = normalizeServerUrl(trimmed);
  if (!normalized.ok) {
    return { provided: true, ok: false, error: normalized.error };
  }
  return { provided: true, ok: true, url: normalized.url };
}

export function normalizeDualServerConfig(raw: {
  primaryUrl?: string | null;
  fallbackUrl?: string | null;
}): { ok: true; config: ServerUrlConfig } | { ok: false; error: string } {
  const primary = normalizeOptionalUrl(raw.primaryUrl);
  if (primary.provided && !primary.ok) {
    return { ok: false, error: primary.error };
  }

  const fallback = normalizeOptionalUrl(raw.fallbackUrl);
  if (fallback.provided && !fallback.ok) {
    return { ok: false, error: fallback.error };
  }

  if (!primary.url && !fallback.url) {
    return { ok: false, error: DUAL_SERVER_EMPTY_ERROR };
  }

  return {
    ok: true,
    config: {
      primaryUrl: primary.url,
      fallbackUrl: fallback.url,
    },
  };
}

function sanitizeStoredUrlValue(val: unknown): string | null {
  if (typeof val !== "string") {
    return null;
  }
  const normalized = normalizeServerUrl(val);
  return normalized.ok ? normalized.url : null;
}

export function getStoredServerConfig(): ServerUrlConfig {
  const raw = getStoredServerConfigRaw();
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed) &&
        ("primaryUrl" in parsed || "fallbackUrl" in parsed)
      ) {
        const record = parsed as Record<string, unknown>;
        return {
          primaryUrl: sanitizeStoredUrlValue(record.primaryUrl),
          fallbackUrl: sanitizeStoredUrlValue(record.fallbackUrl),
        };
      }
    } catch {
      // Fall through to legacy migration / defaults if JSON is malformed.
    }
  }

  const legacyUrl = getStoredServerUrl();
  if (legacyUrl) {
    const normalized = normalizeServerUrl(legacyUrl);
    if (normalized.ok) {
      if (normalized.url === DEFAULT_CLOUD_SERVER_URL) {
        return {
          primaryUrl: null,
          fallbackUrl: normalized.url,
        };
      }
      return {
        primaryUrl: normalized.url,
        fallbackUrl: null,
      };
    }
  }

  return {
    primaryUrl: DEFAULT_PRIMARY_SERVER_URL,
    fallbackUrl: DEFAULT_CLOUD_SERVER_URL,
  };
}

export function setStoredServerConfig(config: ServerUrlConfig): boolean {
  const primaryUrl = config.primaryUrl ? sanitizeStoredUrlValue(config.primaryUrl) : null;
  const fallbackUrl = config.fallbackUrl ? sanitizeStoredUrlValue(config.fallbackUrl) : null;
  const saved = setStoredServerConfigRaw(
    JSON.stringify({ primaryUrl, fallbackUrl })
  );

  const preferredSingle = primaryUrl ?? fallbackUrl;
  if (preferredSingle) {
    setStoredServerUrl(preferredSingle);
  } else {
    clearStoredServerUrl();
  }

  return saved;
}

async function probeSingleSettingsEndpoint(
  baseUrl: string,
  timeoutMs: number
): Promise<{
  ok: boolean;
  latencyMs: number;
  storeSettings?: StoreSettings;
  offlineDb?: boolean;
  error?: string;
}> {
  const startedAt = Date.now();
  try {
    const res = await apiFetch(baseUrl, "/api/settings", {
      method: "GET",
      sessionToken: null,
      timeoutMs,
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

    return {
      ok: true,
      latencyMs,
      storeSettings: parsed.storeSettings,
      offlineDb: parsed.offlineDb,
    };
  } catch (err) {
    const msg =
      err instanceof Error && err.message.trim().length > 0
        ? err.message
        : SERVER_URL_INVALID_ERROR;
    return {
      ok: false,
      latencyMs: Math.max(0, Date.now() - startedAt),
      error: msg,
    };
  }
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

  const probe = await probeSingleSettingsEndpoint(normalized.url, 6000);
  if (!probe.ok || !probe.storeSettings) {
    return {
      ok: false,
      latencyMs: probe.latencyMs,
      error: SERVER_URL_INVALID_ERROR,
    };
  }

  setCachedStoreSettings(probe.storeSettings);

  return {
    ok: true,
    latencyMs: probe.latencyMs,
    storeSettings: probe.storeSettings,
    offlineDb: probe.offlineDb,
  };
}

/**
 * Tests dual LAN + Cloud configuration against `GET /api/settings`:
 * probes primary LAN first (`LAN_PROBE_TIMEOUT_MS`), then automatically tests Cloud fallback on failure.
 */
export async function testDualServerConnection(
  config: ServerUrlConfig
): Promise<ConnectionTestResult> {
  const normalized = normalizeDualServerConfig(config);
  if (!normalized.ok) {
    return {
      ok: false,
      latencyMs: 0,
      error: normalized.error,
    };
  }

  const { primaryUrl, fallbackUrl } = normalized.config;
  const startedAt = Date.now();
  let lanAttemptError: string | undefined;

  const tryRoute = async (
    route: ServerRoute,
    url: string,
    timeoutMs: number
  ) => {
    const probe = await probeSingleSettingsEndpoint(url, timeoutMs);
    if (probe.ok && probe.storeSettings) {
      setCachedStoreSettings(probe.storeSettings);
      return {
        ok: true as const,
        latencyMs: Math.max(0, Date.now() - startedAt),
        storeSettings: probe.storeSettings,
        offlineDb: probe.offlineDb,
        routeUsed: route,
        lanAttemptError,
      };
    }
    return {
      ok: false as const,
      error: probe.error ?? SERVER_URL_INVALID_ERROR,
    };
  };

  if (primaryUrl) {
    const lanRes = await tryRoute("lan", primaryUrl, LAN_PROBE_TIMEOUT_MS);
    if (lanRes.ok) {
      return lanRes;
    }
    lanAttemptError = lanRes.error;
  }

  if (fallbackUrl) {
    const cloudRes = await tryRoute("cloud", fallbackUrl, 6000);
    if (cloudRes.ok) {
      return cloudRes;
    }
  }

  return {
    ok: false,
    latencyMs: Math.max(0, Date.now() - startedAt),
    error: DUAL_SERVER_UNREACHABLE_ERROR,
    lanAttemptError,
  };
}
