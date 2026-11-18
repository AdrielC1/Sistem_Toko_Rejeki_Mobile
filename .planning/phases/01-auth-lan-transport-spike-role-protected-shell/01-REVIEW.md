---
phase: 01-auth-lan-transport-spike-role-protected-shell
reviewed: 2026-11-18T15:28:31Z
depth: standard
files_reviewed: 37
files_reviewed_list:
  - package.json
  - app.config.ts
  - tsconfig.json
  - eslint.config.js
  - jest.config.js
  - src/types/index.ts
  - src/theme/tokens.ts
  - src/services/storage/secureStorage.ts
  - src/services/storage/serverConfig.ts
  - src/services/api/cookieParser.ts
  - src/services/api/apiClient.ts
  - src/services/api/authApi.ts
  - src/context/AuthContext.tsx
  - src/components/ui/VelocityPrimitives.tsx
  - src/components/common/RoleBadge.tsx
  - src/components/common/ServerUrlPanel.tsx
  - src/components/common/TabScreenHeader.tsx
  - src/components/common/EmptyStateCard.tsx
  - src/components/common/LogoutConfirmModal.tsx
  - src/app/_layout.tsx
  - src/app/index.tsx
  - src/app/(auth)/_layout.tsx
  - src/app/(auth)/login.tsx
  - src/app/(app)/_layout.tsx
  - src/app/(app)/(tabs)/_layout.tsx
  - src/app/(app)/(tabs)/kasir.tsx
  - src/app/(app)/(tabs)/produk.tsx
  - src/app/(app)/(tabs)/pesanan.tsx
  - src/app/(app)/(tabs)/pengaturan.tsx
  - __tests__/setup.ts
  - __tests__/cookieParser.test.ts
  - __tests__/serverConfig.test.ts
  - __tests__/apiClient.test.ts
  - __tests__/authContext.test.tsx
  - __tests__/loginScreen.test.tsx
  - __tests__/tabScreens.test.tsx
  - __tests__/routingRbac.test.tsx
findings:
  critical: 1
  warning: 7
  info: 5
  total: 13
  necessity: 2
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-11-18T15:28:31Z
**Depth:** standard
**Files Reviewed:** 37
**Status:** issues_found

## Summary

Reviewed all 37 Phase 1 configuration, service, context, UI component, route layout, tab screen, and Jest test files for **Apps Toko Rejeki Mobile** at `standard` depth against `GEMINI.md`, `01-CONTEXT.md`, `01-UI-SPEC.md`, and the sibling `Apps_Toko_Rejeki` API contracts.

**Tooling Baseline Observed (Read-Only):**
- `npx jest --verbose`: 7/7 suites passed, 41/41 tests passed (observed repeated `console.warn` from Expo Router for deprecated `unstable_settings.initialRouteName`).
- `npx tsc --noEmit`: 0 errors.
- `npx expo lint`: 0 errors/warnings.
- `npx expo config --type introspect --json`: verified light mode lock, `usesCleartextTraffic: true`, `NSAllowsLocalNetworking: true`, and `NSAllowsArbitraryLoads: false`, while surfacing missing Android `expo-secure-store` backup exclusion rules.

**High-Level Assessment:**
The Velocity Blue design token enforcement (`0` hardcoded colors in components/screens), `<Stack.Protected>` + `${user.id}:${user.role}` RBAC boundaries, and Indonesian copywriting parity are strong overall. However, adversarial tracing uncovered **1 Critical/Blocker** concurrency race in `AuthContext.refreshUserWithBaseUrl` that can wipe a newly logged-in session in `SecureStore`, **7 Warnings** (including `getSessionToken()` ignored on cold-boot hydration, uncaught `SecureStore`/`kv-store` write errors on login, deprecated `unstable_settings.initialRouteName`, missing `expo-secure-store` Android backup exclusion plugin, mid-flight edits in `ServerUrlPanel`, missing `<Image onError>` fallback on `LoginScreen`, and 1 necessity finding for duplicate `kv-store` writes), plus **5 Info** items (including 1 necessity finding).

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Concurrent `logout()` + `login()` race inside `refreshUserWithBaseUrl` can wipe the newly authenticated user's `SecureStore` session

**Classification:** BLOCKER
**File:** `src/context/AuthContext.tsx:150-157`
**Issue:** When `GET /api/auth/me` returns HTTP `200`, `refreshUserWithBaseUrl` updates React state (`setUser(res.user)` on line `150`), awaits `setUserSnapshot(res.user)` (`line 151`), and then checks `if (epoch !== getAuthEpoch())` (`line 153`) and unconditionally calls `await clearAuthSession()` (`line 154`). If a user logs out (`bumpAuthEpoch()` in `logout()`) and immediately logs in again (`login()` bumps `authEpoch` and writes the new session token/snapshot to `SecureStore`) while `setUserSnapshot` is awaiting Keychain/Keystore IPC, `epoch !== getAuthEpoch()` evaluates `true` and `clearAuthSession()` deletes the **newly logged-in user's** `pos_session_token` and `pos_user_snapshot` from `SecureStore` while leaving React state logged in. Conversely, if an offline `logout()` executes `clearAuthSession()` before an already-started `setUserSnapshot(res.user)` completes in native storage, the stale `pos_user_snapshot` can outlive logout.
**Impact:** Silent credential/session data loss for the newly logged-in staff account on next cold boot, or stale user snapshot surviving logout (`AUTH-03` / `AUTH-04`).
**Fix:** Check `epoch !== getAuthEpoch()` before writing `setUserSnapshot(res.user)`, serialize `SecureStore` auth writes and clears through a shared async queue/mutex in `src/services/storage/secureStorage.ts`, and never call `clearAuthSession()` unconditionally from a `200` `/api/auth/me` branch (`logout()` owns clearing on logout):
```ts
if (res.status === 200 && res.user) {
  if (!isMountedRef.current || epoch !== getAuthEpoch()) {
    return;
  }
  await enqueueAuthStorageOp(async () => {
    if (epoch !== getAuthEpoch()) {
      return;
    }
    await setUserSnapshot(res.user);
  });
  if (isMountedRef.current && epoch === getAuthEpoch()) {
    setUser(res.user);
  }
  return;
}
```

## Warnings

### WR-01: Cold-boot `hydrate()` calls `getSessionToken()` and discards the result, authenticating offline sessions with no `pos_session_token`

**Classification:** WARNING
**File:** `src/context/AuthContext.tsx:194-210`
**Issue:** `hydrate()` executes `const [snapshotUser] = await Promise.all([getUserSnapshot(), getSessionToken()]);`, ignoring the returned `sessionToken` while still calling `setUser(snapshotUser)` when `snapshotUser` is non-null. If `pos_user_snapshot` exists in `SecureStore` while `pos_session_token` is `null` (for example, partial storage clear, Keychain/Keystore entry loss, or a `200` login where `Set-Cookie` failed to capture and `authApi.ts:174` called `clearSessionToken()`), cold-booting offline enters the `(app)` 4-tab shell with zero session cookie, then immediately triggers `401` revocation once online.
**Impact:** Violates the `pos_session` + `auth_user_snapshot` cold-boot contract (`01-UI-SPEC.md` / `AUTH-03`) and wastes an unused `SecureStore` IPC read.
**Fix:** Capture `sessionToken` and require both `snapshotUser` and `sessionToken` during cold-boot hydration (cleaning up orphaned snapshots if `sessionToken` is absent):
```ts
const [snapshotUser, sessionToken] = await Promise.all([
  getUserSnapshot(),
  getSessionToken(),
]);
...
if (snapshotUser && sessionToken && mountEpoch === getAuthEpoch()) {
  setUser(snapshotUser);
} else if (snapshotUser && !sessionToken) {
  await clearAuthSession();
}
```

### WR-02: Uncaught `SecureStore` and `kv-store` write exceptions produce unhandled promise rejections and silent login/URL failures

**Classification:** WARNING
**File:** `src/services/storage/secureStorage.ts:59-62, 85-97, 124-126, 149-151`, `src/context/AuthContext.tsx:275-317, 356-399`, `src/app/(auth)/login.tsx:67, 181, 215`
**Issue:** While read and delete helpers in `secureStorage.ts` wrap native storage calls in `try/catch`, `setSessionToken`, `setUserSnapshot`, `setStoredServerUrl`, and `setCachedStoreSettings` do not. In `AuthContext.login()`, `await loginWithCredentials(...)` (`authApi.ts:171, 177`) is wrapped in `try { ... } finally { ... }` without a `catch` block, and `LoginScreen.handleSubmit()` invokes `login(...)` inside `void handleSubmit()` without error handling. If `SecureStore.setItemAsync` or `Storage.setItemSync` throws (e.g., Android Keystore failure, device lock state, or SQLite I/O error), `login()` rejects uncaught, `authError` remains `null`, and the user sees no error banner.
**Impact:** Silent authentication or server-settings failures and unhandled promise rejections on native storage errors.
**Fix:** Add a `catch` block in `AuthContext.login()` that sets a user-facing `authError` and returns `false`, and catch synchronous `Storage.setItemSync` failures in `saveServerUrl` / `testServerUrl` (returning `{ ok: false, error }`) and `LoginScreen.handleSubmit()`.

### WR-03: Deprecated `unstable_settings.initialRouteName` in `(auth)/_layout.tsx` and `(app)/_layout.tsx` emits Expo Router SDK 58 warnings

**Classification:** WARNING
**File:** `src/app/(auth)/_layout.tsx:3-5`, `src/app/(app)/_layout.tsx:4-6`
**Issue:** Both layout files export `unstable_settings = { initialRouteName: ... }` instead of `unstable_settings = { anchor: ... }`. Verified in `node_modules/expo-router/build/layoutAnchor.js:155-159` and live `npx jest --verbose` execution, Expo Router logs `` `unstable_settings.initialRouteName` is deprecated. Use `unstable_settings.anchor` instead. `` during routing, whereas `src/app/(app)/(tabs)/_layout.tsx:115-117` already uses `anchor: "kasir"`.
**Impact:** Noisy dev/test console warnings and risk of breaking initial-route resolution when Expo Router removes the deprecated key.
**Fix:** Replace `initialRouteName` with `anchor` in both files:
```ts
// src/app/(auth)/_layout.tsx
export const unstable_settings = {
  anchor: "login",
};

// src/app/(app)/_layout.tsx
export const unstable_settings = {
  anchor: "(tabs)",
};
```

### WR-04: `app.config.ts` omits `"expo-secure-store"` from `plugins`, leaving Android Auto Backup active without SecureStore exclusion rules

**Classification:** WARNING
**File:** `app.config.ts:35-53`
**Issue:** Running `npx expo config --type introspect --json` shows `android:allowBackup="true"` on `<application>` without `android:fullBackupContent="@xml/secure_store_backup_rules"` or `android:dataExtractionRules="@xml/secure_store_data_extraction_rules"`, because `"expo-secure-store"` is not registered in `plugins` (`node_modules/expo-secure-store/plugin/build/withSecureStore.js:22-46`).
**Impact:** When prebuilding for `expo-dev-client` or release APKs (Phase 3+), Android Auto Backup can copy `EncryptedSharedPreferences` ciphertext (`pos_session_token`, `pos_user_snapshot`) into backups without the device-bound Keystore key, causing decryption crashes on restore or leaking encrypted credential blobs.
**Fix:** Register `"expo-secure-store"` in `app.config.ts` `plugins` (compatible with both Expo Go and prebuild):
```ts
plugins: [
  "expo-router",
  "expo-secure-store",
  ...
]
```

### WR-05: `ServerUrlPanel` allows draft edits and hint-chip presses during in-flight connection tests and updates state if unmounted

**Classification:** WARNING
**File:** `src/components/common/ServerUrlPanel.tsx:47-55, 61-64, 87-113, 148-196`
**Issue:** While `isTesting` is `true` (up to 6000ms timeout), `InputField` (`lines 148-165`) does not pass `editable={!isTesting}`, `hintChip` `Pressable`s (`lines 168-196`) do not pass `disabled={isTesting}`, and `handleSelectHint` (`line 61`) lacks an `if (isTesting) return;` guard. Editing `draftUrl` or tapping a hint mid-test causes the resolved response for the previous URL to overwrite `draftUrl` via `savedServerUrl !== prevSavedUrl` (`lines 47-55`) and display `"Server Terhubung"` for the wrong URL. Additionally, `handleTestConnection` (`lines 87-113`) invokes `setFeedback` and `setIsTesting(false)` after `await` with no `isMountedRef` guard, and `lines 49-54` do not reset `draftUrl` if `savedServerUrl` transitions to `null`.
**Impact:** Confusing URL draft overwrites and mismatched connection feedback during slow LAN requests.
**Fix:** Lock `InputField` (`editable={!isTesting}`) and hint chips (`disabled={isTesting}` plus early return in `handleSelectHint`), add an `isMountedRef` guard around post-`await` `setState` calls in `handleTestConnection`, and sync `draftUrl` whenever `savedServerUrl !== prevSavedUrl`.

### WR-06: Login brand `<Image>` for `storeLogo` lacks an `onError` fallback to the `TR` monogram

**Classification:** WARNING
**File:** `src/app/(auth)/login.tsx:52-53, 94-105`
**Issue:** Whenever `storeSettings?.storeLogo` is a non-empty string, `hasLogo` is `true` and `<Image source={{ uri: storeLogo }} />` renders without an `onError` handler. If `storeLogo` is an unreachable HTTPS URL while offline, a relative path, or malformed base64 data, the `64x64` brand container displays a blank white box instead of falling back to the `TR` monogram (`#005eb8`).
**Impact:** Blank brand badge on the Login screen when cached remote logos are unreachable offline or invalid.
**Fix:** Track failed image URIs (`const [failedLogoUri, setFailedLogoUri] = useState<string | null>(null)`), compute `const hasLogo = storeLogo.length > 0 && failedLogoUri !== storeLogo`, and attach `onError={() => setFailedLogoUri(storeLogo)}` on `<Image>`.

### WR-07: Already-defended-elsewhere — `AuthContext.testServerUrl` redundantly persists `storeSettings` already written by `testServerConnection`

**Classification:** WARNING
**File:** `src/context/AuthContext.tsx:388-390`
**Category:** necessity
**Issue:** `AuthContext.testServerUrl` calls `await testServerConnection(rawUrl)` (`line 374`), and `testServerConnection` (`src/services/storage/serverConfig.ts:181`) already calls `setCachedStoreSettings(parsed.storeSettings)` synchronously to SQLite `kv-store` on HTTP `200` before returning `{ ok: true, storeSettings }`. Lines `388-390` of `AuthContext.tsx` then call `setCachedStoreSettings(result.storeSettings)` a second time for the identical object. (Similarly, `AuthContext.tsx:161` executes `await clearAuthSession()` inside `refreshUserWithBaseUrl` on `401`/`403` even though `apiRequest` at `src/services/api/apiClient.ts:200` has already cleared `SecureStore` and notified `sessionRevokedHandlers` before returning whenever `epoch === getAuthEpoch()`.)
**Fix:** Remove the duplicate `setCachedStoreSettings(result.storeSettings)` call in `AuthContext.testServerUrl` (retaining only `storeSettingsRef.current = result.storeSettings` and `setStoreSettings(result.storeSettings)`), and rely on `apiRequest` as the single owner of `clearAuthSession()` for `401`/auth-`403` responses.

## Info

### IN-01: Impossible-state guard — `IndexScreen` checks `if (!isHydrated)` when `RootNavigator` withholds `<Stack>` until `isHydrated && fontsReady`

**Classification:** WARNING *(Info tier — judgment call)*
**File:** `src/app/index.tsx:7-9`
**Category:** necessity
**Issue:** `RootNavigator` (`src/app/_layout.tsx:28, 36-38`) returns `null` until `isReady = isHydrated && fontsReady`, so `<Stack>` and `IndexScreen` cannot mount while `isHydrated === false`, and `AuthContext` (`src/context/AuthContext.tsx:88, 211`) transitions `isHydrated` from `false` to `true` once without resetting it. Neither `src/` nor `__tests__/` mounts `IndexScreen` outside `RootLayout`.
**Fix:** Remove the redundant `if (!isHydrated)` check in `src/app/index.tsx` or document it explicitly as an isolated-test guard.

### IN-02: `POS_SESSION_REGEX` allows case-insensitive names and whitespace/semicolon boundaries, and `cookieParser` scans overlapping header sources

**Classification:** WARNING *(Info tier)*
**File:** `src/services/api/cookieParser.ts:14, 27-74`
**Issue:** HTTP cookie names are case-sensitive per RFC 6265, yet `POS_SESSION_REGEX` (`/(?:^|,\s*|;\s*|\s)pos_session=([A-Za-z0-9_.-]+)/i`) uses `/i` and allows `;\s*|\s` prefixes that could match inside another cookie's attribute or space-delimited value in a comma-joined `Set-Cookie` string. Additionally, `candidates` unconditionally aggregates `getSetCookie()`, `_rawHeaders`, and `headers.get("set-cookie")` instead of short-circuiting `headers.get` when structured `Set-Cookie` rows were already extracted.
**Fix:** Restrict the regex to `/(?:^|,\s*)pos_session=([A-Za-z0-9_.-]+)/` (preserving `;\s*` only if needed for non-standard delimiters) and fall back to `headers.get("set-cookie")` only when `getSetCookie()` and `_rawHeaders` produced no `set-cookie` entries.

### IN-03: `apiFetch` forces `Content-Type: application/json` for non-string bodies and `apiRequest` marks non-JSON `200` responses as `ok: true`

**Classification:** WARNING *(Info tier)*
**File:** `src/services/api/apiClient.ts:93-99, 229`
**Issue:** Lines `93-99` set `Content-Type: application/json` for any non-null `rest.body`, which would break `FormData` multipart boundaries in future phases. Line `229` (`res.ok && (rawBody ? rawBody.success !== false : true)`) marks an HTTP `200` response with `rawBody === null` (e.g., an HTML captive-portal login page) as `ok: true`.
**Fix:** Check `typeof rest.body === "string"` before defaulting `Content-Type: application/json`, and require a parsed JSON object (unless status is `204`) for `apiRequest` success.

### IN-04: `parseRetryAfterSeconds` clamps `retryAfter <= 0` to `1` before checking the `Retry-After` HTTP header

**Classification:** WARNING *(Info tier)*
**File:** `src/services/api/authApi.ts:39-52`
**Issue:** Line `41` validates `Number.isFinite(parsedBody.retryAfter)` without `parsedBody.retryAfter > 0` (unlike line `49` for the HTTP header), so a `0` or negative JSON field returns `1` instead of falling back to `Retry-After`.
**Fix:** Add `&& parsedBody.retryAfter > 0` to the condition on line `41`.

### IN-05: Unused `tabBarActiveTintColor` and `tabBarInactiveTintColor` options in `(tabs)/_layout.tsx`

**Classification:** WARNING *(Info tier)*
**File:** `src/app/(app)/(tabs)/_layout.tsx:48-50, 129-130`
**Issue:** `TabsLayout` configures `tabBarActiveTintColor` and `tabBarInactiveTintColor` in `screenOptions`, but `VelocityTabBar` reads `TOKENS.colors.primary` and `TOKENS.colors.muted` directly instead of `options.tabBarActiveTintColor` / `options.tabBarInactiveTintColor`.
**Fix:** Consume `options.tabBarActiveTintColor ?? TOKENS.colors.primary` and `options.tabBarInactiveTintColor ?? TOKENS.colors.muted` inside `VelocityTabBar`, or drop the two unused properties from `screenOptions`.

---

_Reviewed: 2026-11-18T15:28:31Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
