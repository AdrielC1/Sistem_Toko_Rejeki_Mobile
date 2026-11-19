import * as SecureStore from "expo-secure-store";
import { Storage } from "expo-sqlite/kv-store";
import type { AuthSessionUser, StoreSettings, UserRole } from "@/types";

export const SECURE_KEYS = {
  SESSION_TOKEN: "pos_session_token",
  USER_SNAPSHOT: "pos_user_snapshot",
} as const;

export const KV_KEYS = {
  SERVER_BASE_URL: "pos_server_base_url",
  SERVER_CONFIG: "pos_server_config_v2",
  STORE_SETTINGS: "pos_store_settings",
  CLIENT_UUID: "pos_client_uuid",
} as const;

const VALID_ROLES: ReadonlySet<string> = new Set<UserRole>([
  "owner",
  "admin",
  "kasir",
]);

let authStorageQueue: Promise<void> = Promise.resolve();

/**
 * Serializes async `SecureStore` auth reads, writes, and clears so concurrent
 * refresh/logout/login flows never interleave out of order.
 */
export function enqueueAuthStorageOp<T>(op: () => Promise<T>): Promise<T> {
  const run = authStorageQueue.then(op, op);
  authStorageQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

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

async function writeSessionTokenRaw(token: string): Promise<void> {
  // Never pass requireAuthentication: true (unsupported in Expo Go).
  await SecureStore.setItemAsync(SECURE_KEYS.SESSION_TOKEN, token);
}

async function deleteSessionTokenRaw(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SECURE_KEYS.SESSION_TOKEN);
  } catch {
    // Ignore delete failure when key is already absent or unavailable.
  }
}

async function writeUserSnapshotRaw(user: AuthSessionUser): Promise<void> {
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

async function deleteUserSnapshotRaw(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SECURE_KEYS.USER_SNAPSHOT);
  } catch {
    // Ignore delete failure when key is already absent or unavailable.
  }
}

export async function getSessionToken(): Promise<string | null> {
  return enqueueAuthStorageOp(async () => {
    try {
      const token = await SecureStore.getItemAsync(SECURE_KEYS.SESSION_TOKEN);
      return token && token.length > 0 ? token : null;
    } catch {
      return null;
    }
  });
}

export async function setSessionToken(token: string): Promise<void> {
  return enqueueAuthStorageOp(() => writeSessionTokenRaw(token));
}

export async function clearSessionToken(): Promise<void> {
  return enqueueAuthStorageOp(() => deleteSessionTokenRaw());
}

export async function getUserSnapshot(): Promise<AuthSessionUser | null> {
  return enqueueAuthStorageOp(async () => {
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
  });
}

export async function setUserSnapshot(
  user: AuthSessionUser,
  shouldCommit?: () => boolean
): Promise<void> {
  return enqueueAuthStorageOp(async () => {
    if (shouldCommit && !shouldCommit()) {
      return;
    }
    await writeUserSnapshotRaw(user);
  });
}

export async function clearUserSnapshot(): Promise<void> {
  return enqueueAuthStorageOp(() => deleteUserSnapshotRaw());
}

export async function clearAuthSession(
  shouldCommit?: () => boolean
): Promise<void> {
  return enqueueAuthStorageOp(async () => {
    if (shouldCommit && !shouldCommit()) {
      return;
    }
    await Promise.all([deleteSessionTokenRaw(), deleteUserSnapshotRaw()]);
  });
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

export function setStoredServerUrl(url: string): boolean {
  try {
    Storage.setItemSync(KV_KEYS.SERVER_BASE_URL, url);
    return true;
  } catch {
    return false;
  }
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

export function setCachedStoreSettings(settings: StoreSettings): boolean {
  try {
    Storage.setItemSync(KV_KEYS.STORE_SETTINGS, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

export function getStoredServerConfigRaw(): string | null {
  try {
    const raw = Storage.getItemSync(KV_KEYS.SERVER_CONFIG);
    if (!raw) {
      return null;
    }
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

export function setStoredServerConfigRaw(json: string): boolean {
  try {
    Storage.setItemSync(KV_KEYS.SERVER_CONFIG, json);
    return true;
  } catch {
    return false;
  }
}

export function clearStoredServerConfig(): void {
  try {
    Storage.removeItemSync(KV_KEYS.SERVER_CONFIG);
  } catch {
    // Ignore removal error if store is uninitialized.
  }
}

export function getOrCreateClientIdSync(generator: () => string): string {
  try {
    const existing = Storage.getItemSync(KV_KEYS.CLIENT_UUID);
    if (typeof existing === "string" && existing.trim().length > 0) {
      return existing.trim();
    }
    const created = generator().trim();
    if (created.length > 0) {
      Storage.setItemSync(KV_KEYS.CLIENT_UUID, created);
      return created;
    }
  } catch {
    // Fallback to generated ID if synchronous kv-store fails.
  }
  return generator();
}
