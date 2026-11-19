import { fetch, type FetchRequestInit } from "expo/fetch";
import {
  clearAuthSession,
  getSessionToken,
} from "@/services/storage/secureStorage";
import type { ApiResponse, ServerRoute, ServerUrlConfig } from "@/types";

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_LAN_TIMEOUT_MS = 2000;

export const NETWORK_UNREACHABLE_ERROR =
  "Server atau database toko tidak merespons. Periksa Alamat Server API dan pastikan perangkat berada di Wi-Fi toko yang sama.";

export interface ApiFetchOptions extends Omit<FetchRequestInit, "credentials"> {
  sessionToken?: string | null;
  timeoutMs?: number;
  skipSessionCookie?: boolean;
}

export interface ApiRequestResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
  rawBody: ApiResponse<T> | null;
  error: string | null;
  offline: boolean;
  sessionRevoked: boolean;
  networkError: boolean;
  timedOut: boolean;
  stale: boolean;
  headers: Headers | null;
  response: Response | null;
}

export interface FailoverApiRequestResult<T = unknown>
  extends ApiRequestResult<T> {
  usedRoute: ServerRoute | null;
  resolvedBaseUrl: string | null;
}

let authEpoch = 0;
let activeRoute: ServerRoute = "lan";
const sessionRevokedHandlers = new Set<(reason: string) => void>();
const activeRouteHandlers = new Set<(route: ServerRoute) => void>();

export function getActiveRoute(): ServerRoute {
  return activeRoute;
}

export function setActiveRoute(route: ServerRoute): void {
  if (activeRoute === route) {
    return;
  }
  activeRoute = route;
  for (const handler of activeRouteHandlers) {
    try {
      handler(route);
    } catch {
      // Isolate subscriber errors
    }
  }
}

export function subscribeActiveRoute(
  fn: (route: ServerRoute) => void
): () => void {
  activeRouteHandlers.add(fn);
  return () => {
    activeRouteHandlers.delete(fn);
  };
}

export function resetActiveRouteForTest(): void {
  activeRoute = "lan";
}

export function getAuthEpoch(): number {
  return authEpoch;
}

export function bumpAuthEpoch(): number {
  authEpoch += 1;
  return authEpoch;
}

export function registerSessionRevokedHandler(
  fn: (reason: string) => void
): () => void {
  sessionRevokedHandlers.add(fn);
  return () => {
    sessionRevokedHandlers.delete(fn);
  };
}

function normalizeEndpointPath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

/**
 * Wraps `expo/fetch` with `credentials: "omit"`, manual `Cookie: pos_session=...`
 * injection from `SecureStore`, JSON `Content-Type`, and `AbortController` timeout.
 */
export async function apiFetch(
  baseUrl: string,
  path: string,
  options: ApiFetchOptions = {}
): Promise<Response> {
  const {
    sessionToken,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    skipSessionCookie = false,
    headers: initHeaders,
    signal: externalSignal,
    ...rest
  } = options;

  const cleanBase = baseUrl.replace(/\/+$/, "");
  const cleanPath = normalizeEndpointPath(path);
  const targetUrl = `${cleanBase}${cleanPath}`;

  const headers = new Headers(initHeaders);
  const resolvedToken =
    sessionToken !== undefined
      ? sessionToken
      : skipSessionCookie
        ? null
        : await getSessionToken();

  if (resolvedToken) {
    headers.set("Cookie", `pos_session=${resolvedToken}`);
  }

  if (typeof rest.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const controller = new AbortController();
  let didTimeout = false;
  const timer = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);

  const onExternalAbort = () => {
    controller.abort();
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  try {
    return await fetch(targetUrl, {
      ...rest,
      headers,
      credentials: "omit",
      signal: controller.signal,
    });
  } catch (err) {
    if (didTimeout) {
      const timeoutError = new Error(`Request timeout after ${timeoutMs}ms`);
      timeoutError.name = "TimeoutError";
      throw timeoutError;
    }
    throw err;
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", onExternalAbort);
    }
  }
}

/**
 * Executes an authenticated API request with `authEpoch` race protection and
 * clears `SecureStore` ONLY on HTTP `401` or HTTP `403` from `/api/auth/me` (D-04).
 */
export async function apiRequest<T = unknown>(
  baseUrl: string,
  path: string,
  options: ApiFetchOptions = {}
): Promise<ApiRequestResult<T>> {
  const capturedEpoch = getAuthEpoch();
  const rawPath = normalizeEndpointPath(path).split("?")[0];
  const normalizedPath = rawPath.length > 1 ? rawPath.replace(/\/+$/, "") : rawPath;

  let res: Response;
  try {
    res = await apiFetch(baseUrl, path, options);
  } catch (err) {
    const timedOut =
      err instanceof Error &&
      (err.name === "TimeoutError" || err.name === "AbortError");
    return {
      ok: false,
      status: 0,
      data: null,
      rawBody: null,
      error: NETWORK_UNREACHABLE_ERROR,
      offline: true,
      sessionRevoked: false,
      networkError: true,
      timedOut,
      stale: capturedEpoch !== getAuthEpoch(),
      headers: null,
      response: null,
    };
  }

  let rawBody: ApiResponse<T> | null = null;
  try {
    const json: unknown = await res.json();
    if (json && typeof json === "object") {
      rawBody = json as ApiResponse<T>;
    }
  } catch {
    rawBody = null;
  }

  const isStaleBeforeClear = capturedEpoch !== getAuthEpoch();
  const isAuthMe = normalizedPath === "/api/auth/me";
  const shouldRevoke = res.status === 401 || (res.status === 403 && isAuthMe);

  if (shouldRevoke) {
    const reason =
      typeof rawBody?.error === "string" && rawBody.error.trim().length > 0
        ? rawBody.error
        : "Sesi tidak valid atau akun dinonaktifkan. Silakan masuk kembali.";

    let didRevokeCurrentSession = false;
    if (!isStaleBeforeClear) {
      await clearAuthSession();
      if (capturedEpoch === getAuthEpoch()) {
        didRevokeCurrentSession = true;
        for (const handler of sessionRevokedHandlers) {
          try {
            handler(reason);
          } catch {
            // Isolate subscriber errors
          }
        }
      }
    }

    return {
      ok: false,
      status: res.status,
      data: null,
      rawBody,
      error: reason,
      offline: false,
      sessionRevoked: didRevokeCurrentSession,
      networkError: false,
      timedOut: false,
      stale: !didRevokeCurrentSession,
      headers: res.headers ?? null,
      response: res,
    };
  }

  const isSuccess =
    res.ok &&
    (res.status === 204 || (rawBody !== null && rawBody.success !== false));
  const errorMessage = !isSuccess
    ? typeof rawBody?.error === "string" && rawBody.error.trim().length > 0
      ? rawBody.error
      : `Permintaan gagal (HTTP ${res.status})`
    : null;

  return {
    ok: isSuccess,
    status: res.status,
    data:
      isSuccess && rawBody && rawBody.data !== undefined ? rawBody.data : null,
    rawBody,
    error: errorMessage,
    offline: Boolean(rawBody?.offline),
    sessionRevoked: false,
    networkError: false,
    timedOut: false,
    stale: capturedEpoch !== getAuthEpoch(),
    headers: res.headers ?? null,
    response: res,
  };
}

function shouldFailOverResponse<T>(result: ApiRequestResult<T>): boolean {
  if (result.sessionRevoked) {
    return false;
  }
  if (result.networkError) {
    return true;
  }
  return result.rawBody === null && result.status >= 502;
}

/**
 * Smart Auto LAN -> Cloud failover wrapper over `apiRequest`.
 * Tries active route first (`lan` by default with 2000ms timeout); fails over ONLY
 * on `networkError === true` or `(rawBody === null && status >= 502)`.
 * NEVER fails over on 400, 401, 403, 404, 429, or structured 503 `{ offline: true }`.
 */
export async function apiRequestWithFailover<T = unknown>(
  config: ServerUrlConfig,
  path: string,
  options: ApiFetchOptions = {}
): Promise<FailoverApiRequestResult<T>> {
  const candidates: {
    route: ServerRoute;
    baseUrl: string;
    timeoutMs?: number;
  }[] = [];

  if (config.primaryUrl) {
    candidates.push({
      route: "lan",
      baseUrl: config.primaryUrl,
      timeoutMs: options.timeoutMs ?? DEFAULT_LAN_TIMEOUT_MS,
    });
  }
  if (config.fallbackUrl) {
    candidates.push({
      route: "cloud",
      baseUrl: config.fallbackUrl,
      timeoutMs: options.timeoutMs,
    });
  }

  if (candidates.length === 0) {
    return {
      ok: false,
      status: 0,
      data: null,
      rawBody: null,
      error: NETWORK_UNREACHABLE_ERROR,
      offline: true,
      sessionRevoked: false,
      networkError: true,
      timedOut: false,
      stale: false,
      headers: null,
      response: null,
      usedRoute: null,
      resolvedBaseUrl: null,
    };
  }

  if (candidates.length === 2 && getActiveRoute() === "cloud") {
    candidates.reverse();
  }

  let firstResult: ApiRequestResult<T> | null = null;
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const result = await apiRequest<T>(candidate.baseUrl, path, {
      ...options,
      timeoutMs: candidate.timeoutMs ?? options.timeoutMs,
    });
    if (i === 0) {
      firstResult = result;
    }

    if (!shouldFailOverResponse(result)) {
      setActiveRoute(candidate.route);
      return {
        ...result,
        usedRoute: candidate.route,
        resolvedBaseUrl: candidate.baseUrl,
      };
    }

    if (i === candidates.length - 1) {
      return {
        ...(firstResult ?? result),
        usedRoute: null,
        resolvedBaseUrl: null,
      };
    }
  }

  return {
    ...(firstResult as ApiRequestResult<T>),
    usedRoute: null,
    resolvedBaseUrl: null,
  };
}
