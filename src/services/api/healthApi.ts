import { apiFetch, apiRequestWithFailover } from "@/services/api/apiClient";
import type {
  HealthStatusSnapshot,
  ServerRoute,
  ServerUrlConfig,
} from "@/types";

const LAN_PROBE_TIMEOUT_MS = 2000;

function parseHealthBody(raw: unknown): {
  valid: boolean;
  dbOnline: boolean;
  readOnly: boolean;
  latencyMs: number | null;
  serverTime: string | null;
} {
  if (!raw || typeof raw !== "object") {
    return {
      valid: false,
      dbOnline: false,
      readOnly: false,
      latencyMs: null,
      serverTime: null,
    };
  }

  const body = raw as Record<string, unknown>;
  const hasHealthShape = "db" in body || "status" in body;
  if (!hasHealthShape) {
    return {
      valid: false,
      dbOnline: false,
      readOnly: false,
      latencyMs: null,
      serverTime: null,
    };
  }

  const dbOnline =
    body.db === "connected" ||
    (body.db === undefined && body.status === "online");
  const readOnly = !dbOnline || body.fallbackMode === "read-only";
  const latencyMs =
    typeof body.latencyMs === "number" && Number.isFinite(body.latencyMs)
      ? body.latencyMs
      : null;
  const serverTime =
    typeof body.serverTime === "string" ? body.serverTime : null;

  return {
    valid: true,
    dbOnline,
    readOnly,
    latencyMs,
    serverTime,
  };
}

export async function fetchClusterHealth(
  config: ServerUrlConfig
): Promise<HealthStatusSnapshot & { usedRoute: ServerRoute | null }> {
  const result = await apiRequestWithFailover<unknown>(config, "/api/health", {
    method: "GET",
  });

  if (result.sessionRevoked || result.networkError) {
    return {
      serverReachable: false,
      dbOnline: false,
      readOnly: false,
      latencyMs: null,
      serverTime: null,
      usedRoute: null,
    };
  }

  const parsed = parseHealthBody(result.rawBody);
  if (!parsed.valid) {
    return {
      serverReachable: result.status > 0 && result.status < 502,
      dbOnline: false,
      readOnly: false,
      latencyMs: null,
      serverTime: null,
      usedRoute: result.usedRoute,
    };
  }

  return {
    serverReachable: true,
    dbOnline: parsed.dbOnline,
    readOnly: parsed.readOnly,
    latencyMs: parsed.latencyMs,
    serverTime: parsed.serverTime,
    usedRoute: result.usedRoute,
  };
}

/**
 * Probes only the primary LAN URL directly to check if shop LAN has recovered
 * while operating on Cloud fallback. Does not mutate `activeRoute` on failure.
 */
export async function probeLanHealthOnly(primaryUrl: string): Promise<{
  ok: boolean;
  dbOnline: boolean;
  latencyMs: number | null;
  serverTime: string | null;
}> {
  if (!primaryUrl) {
    return {
      ok: false,
      dbOnline: false,
      latencyMs: null,
      serverTime: null,
    };
  }

  try {
    const res = await apiFetch(primaryUrl, "/api/health", {
      method: "GET",
      timeoutMs: LAN_PROBE_TIMEOUT_MS,
    });
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    const parsed = parseHealthBody(json);
    if (!res.ok && !parsed.valid) {
      return {
        ok: false,
        dbOnline: false,
        latencyMs: null,
        serverTime: null,
      };
    }
    return {
      ok: parsed.valid,
      dbOnline: parsed.dbOnline,
      latencyMs: parsed.latencyMs,
      serverTime: parsed.serverTime,
    };
  } catch {
    return {
      ok: false,
      dbOnline: false,
      latencyMs: null,
      serverTime: null,
    };
  }
}
