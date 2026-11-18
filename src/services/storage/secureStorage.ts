import * as SecureStore from "expo-secure-store";
import { Storage } from "expo-sqlite/kv-store";
import type { AuthSessionUser, StoreSettings, UserRole } from "@/types";

export const SECURE_KEYS = {
  SESSION_TOKEN: "pos_session_token",
  USER_SNAPSHOT: "pos_user_snapshot",
} as const;

export const KV_KEYS = {
  SERVER_BASE_URL: "pos_server_base_url",
  STORE_SETTINGS: "pos_store_settings",
} as const;

const VALID_ROLES: ReadonlySet<string> = new Set<UserRole>([
  "owner",
  "admin",
  "kasir",
]);

export function isValidAuthSessionUser(value: unknown): value is AuthSessionUser {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    typeof candidate.username === "string" &&
    candidate.username.length > 0 &&
    typeof candidate.fullName === "string" &&
    candidate.fullName.length > 0 &&
    typeof candidate.role === "string" &&
    VALID_ROLES.has(candidate.role) &&
    (candidate.sessionStamp === undefined ||
      typeof candidate.sessionStamp === "string")
  );
}

function isValidStoreSettings(value: unknown): value is StoreSettings {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.storeName === "string" && candidate.storeName.length > 0
  );
}

export async function getSessionToken(): Promise<string | null> {
  try {
    const token = await SecureStore.getItemAsync(SECURE_KEYS.SESSION_TOKEN);
    return token && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

export async function setSessionToken(token: string): Promise<void> {
  // Never pass requireAuthentication: true (unsupported in Expo Go).
  await SecureStore.setItemAsync(SECURE_KEYS.SESSION_TOKEN, token);
}

export async function clearSessionToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SECURE_KEYS.SESSION_TOKEN);
  } catch {
    // Ignore delete failure when key is already absent or unavailable.
  }
}

export async function getUserSnapshot(): Promise<AuthSessionUser | null> {
  try {
    const raw = await SecureStore.getItemAsync(SECURE_KEYS.USER_SNAPSHOT);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    return isValidAuthSessionUser(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function setUserSnapshot(user: AuthSessionUser): Promise<void> {
  const compactSnapshot: AuthSessionUser = {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    ...(user.sessionStamp ? { sessionStamp: user.sessionStamp } : {}),
  };
  await SecureStore.setItemAsync(
    SECURE_KEYS.USER_SNAPSHOT,
    JSON.stringify(compactSnapshot)
  );
}

export async function clearUserSnapshot(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SECURE_KEYS.USER_SNAPSHOT);
  } catch {
    // Ignore delete failure when key is already absent or unavailable.
  }
}

export async function clearAuthSession(): Promise<void> {
  await Promise.all([clearSessionToken(), clearUserSnapshot()]);
}

export function getStoredServerUrl(): string | null {
  try {
    const stored = Storage.getItemSync(KV_KEYS.SERVER_BASE_URL);
    if (!stored) {
      return null;
    }
    const trimmed = stored.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

export function setStoredServerUrl(url: string): void {
  Storage.setItemSync(KV_KEYS.SERVER_BASE_URL, url);
}

export function clearStoredServerUrl(): void {
  try {
    Storage.removeItemSync(KV_KEYS.SERVER_BASE_URL);
  } catch {
    // Ignore removal error if store is uninitialized.
  }
}

export function getCachedStoreSettings(): StoreSettings | null {
  try {
    const raw = Storage.getItemSync(KV_KEYS.STORE_SETTINGS);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    return isValidStoreSettings(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function setCachedStoreSettings(settings: StoreSettings): void {
  Storage.setItemSync(KV_KEYS.STORE_SETTINGS, JSON.stringify(settings));
}
