import {
  NETWORK_UNREACHABLE_ERROR,
  apiFetch,
  apiRequest,
  bumpAuthEpoch,
  getActiveRoute,
  setActiveRoute,
  apiRequestWithFailover,
} from "@/services/api/apiClient";
import {
  extractPosSessionFromResponse,
  getSessionCaptureDiagnostics,
} from "@/services/api/cookieParser";
import {
  clearAuthSession,
  clearSessionToken,
  isValidAuthSessionUser,
  setCachedStoreSettings,
  setSessionToken,
  setUserSnapshot,
} from "@/services/storage/secureStorage";
import {
  LAN_PROBE_TIMEOUT_MS,
  parseStoreSettingsResponse,
} from "@/services/storage/serverConfig";
import type {
  ApiResponse,
  AuthSessionUser,
  LoginAttemptResult,
  ServerRoute,
  ServerUrlConfig,
  StoreSettings,
} from "@/types";

const ERROR_COPY = {
  BLANK_CREDENTIALS: "Username dan kata sandi wajib diisi sebelum masuk.",
  INVALID_CREDENTIALS:
    "Username atau kata sandi salah. Periksa kembali akun Anda dan coba masuk lagi.",
  INACTIVE_ACCOUNT:
    "Akun ini sedang dinonaktifkan. Hubungi pemilik toko (Owner) untuk mengaktifkan kembali.",
  SERVER_UNREACHABLE: NETWORK_UNREACHABLE_ERROR,
  SESSION_STORAGE_ERROR:
    "Gagal menyimpan sesi login ke penyimpanan aman perangkat. Pastikan penyimpanan perangkat tersedia lalu coba lagi.",
} as const;

function parseRetryAfterSeconds(
  parsedBody: ApiResponse<unknown> | null,
  res: Response
): number {
  if (
    typeof parsedBody?.retryAfter === "number" &&
    Number.isFinite(parsedBody.retryAfter) &&
    parsedBody.retryAfter > 0
  ) {
    return Math.max(1, Math.ceil(parsedBody.retryAfter));
  }

  const headerValue = res.headers?.get?.("Retry-After");
  if (headerValue) {
    const numeric = Number(headerValue.trim());
    if (Number.isFinite(numeric) && numeric > 0) {
      return Math.max(1, Math.ceil(numeric));
    }
  }

  return 2;
}

function validateCredentialInputs(
  username: string,
  password: string
):
  | { ok: true; trimmedUsername: string; rawPassword: string }
  | { ok: false; result: LoginAttemptResult } {
  const trimmedUsername = typeof username === "string" ? username.trim() : "";
  const rawPassword = typeof password === "string" ? password : "";

  if (!trimmedUsername || !rawPassword) {
    return {
      ok: false,
      result: {
        ok: false,
        status: 400,
        error: ERROR_COPY.BLANK_CREDENTIALS,
      },
    };
  }

  if (trimmedUsername.length > 100 || rawPassword.length > 256) {
    return {
      ok: false,
      result: {
        ok: false,
        status: 401,
        error: ERROR_COPY.INVALID_CREDENTIALS,
      },
    };
  }

  return { ok: true, trimmedUsername, rawPassword };
}

async function performSingleLoginAttempt(
  baseUrl: string,
  trimmedUsername: string,
  rawPassword: string,
  timeoutMs?: number
): Promise<{ shouldFailOver: boolean; result: LoginAttemptResult }> {
  let res: Response;
  try {
    res = await apiFetch(baseUrl, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        username: trimmedUsername,
        password: rawPassword,
      }),
      sessionToken: null,
      ...(timeoutMs ? { timeoutMs } : {}),
    });
  } catch {
    return {
      shouldFailOver: true,
      result: {
        ok: false,
        status: 0,
        error: ERROR_COPY.SERVER_UNREACHABLE,
      },
    };
  }

  let parsedBody: ApiResponse<AuthSessionUser> | null = null;
  try {
    const json: unknown = await res.json();
    if (json && typeof json === "object") {
      parsedBody = json as ApiResponse<AuthSessionUser>;
    }
  } catch {
    parsedBody = null;
  }

  if (res.status === 400) {
    return {
      shouldFailOver: false,
      result: {
        ok: false,
        status: 400,
        error: ERROR_COPY.BLANK_CREDENTIALS,
      },
    };
  }

  if (res.status === 401) {
    return {
      shouldFailOver: false,
      result: {
        ok: false,
        status: 401,
        error: ERROR_COPY.INVALID_CREDENTIALS,
      },
    };
  }

  if (res.status === 403) {
    return {
      shouldFailOver: false,
      result: {
        ok: false,
        status: 403,
        error: ERROR_COPY.INACTIVE_ACCOUNT,
      },
    };
  }

  if (res.status === 429) {
    const retryAfterSeconds = parseRetryAfterSeconds(parsedBody, res);
    return {
      shouldFailOver: false,
      result: {
        ok: false,
        status: 429,
        error: `Terlalu banyak percobaan gagal. Coba lagi dalam ${retryAfterSeconds} detik.`,
        retryAfterSeconds,
      },
    };
  }

  if (res.status >= 502 && parsedBody === null) {
    return {
      shouldFailOver: true,
      result: {
        ok: false,
        status: res.status,
        error: ERROR_COPY.SERVER_UNREACHABLE,
      },
    };
  }

  if (res.status >= 500 || !res.ok) {
    return {
      shouldFailOver: false,
      result: {
        ok: false,
        status: res.status,
        error: ERROR_COPY.SERVER_UNREACHABLE,
      },
    };
  }

  if (
    parsedBody?.success !== true ||
    !isValidAuthSessionUser(parsedBody.data)
  ) {
    return {
      shouldFailOver: false,
      result: {
        ok: false,
        status: res.status || 500,
        error: ERROR_COPY.SERVER_UNREACHABLE,
      },
    };
  }

  const token = extractPosSessionFromResponse(res);
  if (__DEV__) {
    console.info(
      "[AuthSpike] pos_session capture:",
      getSessionCaptureDiagnostics(token)
    );
  }

  try {
    if (token !== null) {
      await setSessionToken(token);
    } else {
      // Ensure no stale previous user's pos_session_token survives on 200 login
      await clearSessionToken();
    }

    await setUserSnapshot(parsedBody.data);
  } catch {
    await clearAuthSession();
    return {
      shouldFailOver: false,
      result: {
        ok: false,
        status: 500,
        error: ERROR_COPY.SESSION_STORAGE_ERROR,
      },
    };
  }
  bumpAuthEpoch();

  return {
    shouldFailOver: false,
    result: {
      ok: true,
      user: parsedBody.data,
    },
  };
}

export async function loginWithCredentials(
  baseUrl: string,
  username: string,
  password: string
): Promise<LoginAttemptResult> {
  const validated = validateCredentialInputs(username, password);
  if (!validated.ok) {
    return validated.result;
  }
  const attempt = await performSingleLoginAttempt(
    baseUrl,
    validated.trimmedUsername,
    validated.rawPassword
  );
  return attempt.result;
}

function getOrderedCandidates(
  config: ServerUrlConfig
): { route: ServerRoute; baseUrl: string; timeoutMs?: number }[] {
  const candidates: {
    route: ServerRoute;
    baseUrl: string;
    timeoutMs?: number;
  }[] = [];

  if (config.primaryUrl) {
    candidates.push({
      route: "lan",
      baseUrl: config.primaryUrl,
      timeoutMs: LAN_PROBE_TIMEOUT_MS,
    });
  }
  if (config.fallbackUrl) {
    candidates.push({
      route: "cloud",
      baseUrl: config.fallbackUrl,
    });
  }

  if (candidates.length === 2 && getActiveRoute() === "cloud") {
    return [candidates[1], candidates[0]];
  }
  return candidates;
}

export async function loginWithFailover(
  config: ServerUrlConfig,
  username: string,
  password: string
): Promise<
  LoginAttemptResult & { usedRoute?: ServerRoute; resolvedBaseUrl?: string }
> {
  const validated = validateCredentialInputs(username, password);
  if (!validated.ok) {
    return validated.result;
  }

  const candidates = getOrderedCandidates(config);
  if (candidates.length === 0) {
    return {
      ok: false,
      status: 0,
      error: ERROR_COPY.SERVER_UNREACHABLE,
    };
  }

  let lastAttempt: { shouldFailOver: boolean; result: LoginAttemptResult } | null =
    null;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const attempt = await performSingleLoginAttempt(
      candidate.baseUrl,
      validated.trimmedUsername,
      validated.rawPassword,
      candidate.timeoutMs
    );
    lastAttempt = attempt;

    if (!attempt.shouldFailOver || i === candidates.length - 1) {
      if (!attempt.shouldFailOver) {
        setActiveRoute(candidate.route);
        return {
          ...attempt.result,
          usedRoute: candidate.route,
          resolvedBaseUrl: candidate.baseUrl,
        };
      }
      return attempt.result;
    }
  }

  return (
    lastAttempt?.result ?? {
      ok: false,
      status: 0,
      error: ERROR_COPY.SERVER_UNREACHABLE,
    }
  );
}

export async function fetchCurrentUser(baseUrl: string): Promise<{
  status: number;
  user: AuthSessionUser | null;
  offline: boolean;
  sessionRevoked: boolean;
  networkError: boolean;
}> {
  const result = await apiRequest<AuthSessionUser>(baseUrl, "/api/auth/me", {
    method: "GET",
  });

  const validUser =
    result.ok && isValidAuthSessionUser(result.data) ? result.data : null;

  return {
    status: result.status,
    user: validUser,
    offline: result.offline,
    sessionRevoked: result.sessionRevoked,
    networkError: result.networkError,
  };
}

export async function fetchCurrentUserWithFailover(
  config: ServerUrlConfig
): Promise<{
  status: number;
  user: AuthSessionUser | null;
  offline: boolean;
  sessionRevoked: boolean;
  networkError: boolean;
  usedRoute: ServerRoute | null;
  resolvedBaseUrl: string | null;
}> {
  const result = await apiRequestWithFailover<AuthSessionUser>(
    config,
    "/api/auth/me",
    {
      method: "GET",
    }
  );

  const validUser =
    result.ok && isValidAuthSessionUser(result.data) ? result.data : null;

  return {
    status: result.status,
    user: validUser,
    offline: result.offline,
    sessionRevoked: result.sessionRevoked,
    networkError: result.networkError,
    usedRoute: result.usedRoute,
    resolvedBaseUrl: result.resolvedBaseUrl,
  };
}

export async function logoutSession(baseUrl: string): Promise<void> {
  if (!baseUrl) {
    return;
  }
  try {
    await apiFetch(baseUrl, "/api/auth/logout", {
      method: "POST",
      timeoutMs: 4000,
    });
  } catch {
    // Fail-safe offline logout: network errors are intentionally ignored.
  }
}

export async function logoutSessionWithFailover(
  config: ServerUrlConfig
): Promise<void> {
  const candidates = getOrderedCandidates(config);
  const target = candidates[0]?.baseUrl;
  if (!target) {
    return;
  }
  await logoutSession(target);
}

export async function fetchPublicSettings(
  baseUrl: string
): Promise<StoreSettings | null> {
  if (!baseUrl) {
    return null;
  }
  try {
    const res = await apiFetch(baseUrl, "/api/settings", {
      method: "GET",
      sessionToken: null,
      timeoutMs: 6000,
    });
    if (!res.ok) {
      return null;
    }
    const json: unknown = await res.json();
    const parsed = parseStoreSettingsResponse(json);
    if (!parsed) {
      return null;
    }
    setCachedStoreSettings(parsed.storeSettings);
    return parsed.storeSettings;
  } catch {
    return null;
  }
}

export async function fetchAuthenticatedSettings(
  config: ServerUrlConfig
): Promise<StoreSettings | null> {
  const result = await apiRequestWithFailover<StoreSettings>(
    config,
    "/api/settings",
    {
      method: "GET",
      timeoutMs: 6000,
    }
  );

  if (!result.ok || !result.rawBody) {
    return null;
  }

  const parsed = parseStoreSettingsResponse(result.rawBody);
  if (!parsed) {
    return null;
  }

  setCachedStoreSettings(parsed.storeSettings);
  return parsed.storeSettings;
}
