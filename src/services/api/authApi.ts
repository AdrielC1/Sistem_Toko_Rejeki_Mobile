import {
  NETWORK_UNREACHABLE_ERROR,
  apiFetch,
  apiRequest,
  bumpAuthEpoch,
} from "@/services/api/apiClient";
import {
  extractPosSessionFromResponse,
  getSessionCaptureDiagnostics,
} from "@/services/api/cookieParser";
import {
  clearSessionToken,
  isValidAuthSessionUser,
  setCachedStoreSettings,
  setSessionToken,
  setUserSnapshot,
} from "@/services/storage/secureStorage";
import { parseStoreSettingsResponse } from "@/services/storage/serverConfig";
import type {
  ApiResponse,
  AuthSessionUser,
  LoginAttemptResult,
  StoreSettings,
} from "@/types";

const ERROR_COPY = {
  BLANK_CREDENTIALS: "Username dan kata sandi wajib diisi sebelum masuk.",
  INVALID_CREDENTIALS:
    "Username atau kata sandi salah. Periksa kembali akun Anda dan coba masuk lagi.",
  INACTIVE_ACCOUNT:
    "Akun ini sedang dinonaktifkan. Hubungi pemilik toko (Owner) untuk mengaktifkan kembali.",
  SERVER_UNREACHABLE: NETWORK_UNREACHABLE_ERROR,
} as const;

function parseRetryAfterSeconds(
  parsedBody: ApiResponse<unknown> | null,
  res: Response
): number {
  if (
    typeof parsedBody?.retryAfter === "number" &&
    Number.isFinite(parsedBody.retryAfter)
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

export async function loginWithCredentials(
  baseUrl: string,
  username: string,
  password: string
): Promise<LoginAttemptResult> {
  const trimmedUsername = typeof username === "string" ? username.trim() : "";
  const rawPassword = typeof password === "string" ? password : "";

  if (!trimmedUsername || !rawPassword) {
    return {
      ok: false,
      status: 400,
      error: ERROR_COPY.BLANK_CREDENTIALS,
    };
  }

  if (trimmedUsername.length > 100 || rawPassword.length > 256) {
    return {
      ok: false,
      status: 401,
      error: ERROR_COPY.INVALID_CREDENTIALS,
    };
  }

  let res: Response;
  try {
    res = await apiFetch(baseUrl, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        username: trimmedUsername,
        password: rawPassword,
      }),
      sessionToken: null,
    });
  } catch {
    return {
      ok: false,
      status: 0,
      error: ERROR_COPY.SERVER_UNREACHABLE,
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
      ok: false,
      status: 400,
      error: ERROR_COPY.BLANK_CREDENTIALS,
    };
  }

  if (res.status === 401) {
    return {
      ok: false,
      status: 401,
      error: ERROR_COPY.INVALID_CREDENTIALS,
    };
  }

  if (res.status === 403) {
    return {
      ok: false,
      status: 403,
      error: ERROR_COPY.INACTIVE_ACCOUNT,
    };
  }

  if (res.status === 429) {
    const retryAfterSeconds = parseRetryAfterSeconds(parsedBody, res);
    return {
      ok: false,
      status: 429,
      error: `Terlalu banyak percobaan gagal. Coba lagi dalam ${retryAfterSeconds} detik.`,
      retryAfterSeconds,
    };
  }

  if (res.status >= 500 || !res.ok) {
    return {
      ok: false,
      status: res.status,
      error: ERROR_COPY.SERVER_UNREACHABLE,
    };
  }

  if (
    parsedBody?.success !== true ||
    !isValidAuthSessionUser(parsedBody.data)
  ) {
    return {
      ok: false,
      status: res.status || 500,
      error: ERROR_COPY.SERVER_UNREACHABLE,
    };
  }

  const token = extractPosSessionFromResponse(res);
  if (__DEV__) {
    console.info(
      "[AuthSpike] pos_session capture:",
      getSessionCaptureDiagnostics(token)
    );
  }

  if (token !== null) {
    await setSessionToken(token);
  } else {
    // Ensure no stale previous user's pos_session_token survives on 200 login
    await clearSessionToken();
  }

  await setUserSnapshot(parsedBody.data);
  bumpAuthEpoch();

  return {
    ok: true,
    user: parsedBody.data,
  };
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
