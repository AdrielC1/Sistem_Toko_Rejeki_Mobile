---
phase: 01-auth-lan-transport-spike-role-protected-shell
source_review: .planning/phases/01-auth-lan-transport-spike-role-protected-shell/01-REVIEW.md
fixed_at: 2026-11-18T15:38:00Z
commit_policy: no_commits_user_will_commit
status: all_resolved
---

# Phase 1: Code Review Disposition Report

**Source Review:** `.planning/phases/01-auth-lan-transport-spike-role-protected-shell/01-REVIEW.md`  
**Execution Mode:** Direct working-tree edits on disk (zero git commits / tags created, per user instruction `"untuk commit dari saya aja ya nanti"`).  
**Backend Integrity:** Sibling `../Apps_Toko_Rejeki` untouched (read-only).

## Finding Disposition Matrix

| ID | Severity | Category | Status | Files Modified | Summary & Test Verification |
|----|----------|----------|--------|----------------|-----------------------------|
| `CR-01` | Critical (Blocker) | Concurrency / Auth Storage | `fixed` | `src/services/storage/secureStorage.ts`, `src/context/AuthContext.tsx`, `__tests__/authContext.test.tsx` | Added serialized `enqueueAuthStorageOp` queue wrapping `SecureStore` session reads/writes/clears; updated `setUserSnapshot` and `clearAuthSession` to accept an optional `shouldCommit` predicate checked inside the queued op; removed `clearAuthSession()` on `epoch !== getAuthEpoch()` from `refreshUserWithBaseUrl`'s HTTP `200` branch and moved `setUser(refreshedUser)` after the queued snapshot write. Verified by new CR-01 regression test in `__tests__/authContext.test.tsx`. |
| `WR-01` | Warning | Offline Hydration | `fixed` | `src/context/AuthContext.tsx`, `src/services/storage/secureStorage.ts`, `__tests__/authContext.test.tsx` | Captured `sessionToken` from `Promise.all([getUserSnapshot(), getSessionToken()])` in `hydrate()`; only authenticates offline and calls `/api/auth/me` when both `snapshotUser` and `sessionToken` are non-null; cleans up orphaned snapshot via queued `clearAuthSession(() => mountEpoch === getAuthEpoch())`. Verified by new WR-01 test in `__tests__/authContext.test.tsx`. |
| `WR-02` | Warning | Storage Error Handling | `fixed` | `src/services/storage/secureStorage.ts`, `src/services/api/authApi.ts`, `src/context/AuthContext.tsx`, `src/app/(auth)/login.tsx`, `__tests__/authContext.test.tsx` | Wrapped `Storage.setItemSync` in `setStoredServerUrl` and `setCachedStoreSettings` returning `boolean`; wrapped `SecureStore` session writes in `loginWithCredentials` (cleaning partial session via `clearAuthSession()` on failure) and added `catch` handling in `AuthContext.login()`, `AuthContext.refreshUserWithBaseUrl()`, `AuthContext.saveServerUrl()`, `AuthContext.testServerUrl()`, and `LoginScreen.handleSubmit()`. Verified by new WR-02 test in `__tests__/authContext.test.tsx`. |
| `WR-03` | Warning | Expo Router Deprecation | `fixed` | `src/app/(auth)/_layout.tsx`, `src/app/(app)/_layout.tsx` | Replaced deprecated `unstable_settings.initialRouteName` with `unstable_settings.anchor` (`"login"` and `"(tabs)"`). Verified by `npx jest` emitting zero Expo Router `initialRouteName` deprecation warnings. |
| `WR-04` | Warning | Android Backup Security | `fixed` | `app.config.ts` | Registered `"expo-secure-store"` in `plugins` so prebuilds configure Android Auto Backup exclusion rules for `EncryptedSharedPreferences`. Verified by `npx expo-doctor` (20/20) and `npx expo config --type public --json`. |
| `WR-05` | Warning | UI Race / Unmount Safety | `fixed` | `src/components/common/ServerUrlPanel.tsx`, `__tests__/loginScreen.test.tsx` | Locked `InputField` (`editable={!isTesting}` + `onChangeText` guard) and hint chips (`disabled={isTesting}` + `if (isTesting) return;`), added `isMountedRef` around post-`await` state updates in `handleTestConnection`, and reset `draftUrl` via `savedServerUrl ?? ""` when `savedServerUrl !== prevSavedUrl`. Verified by new WR-05 test in `__tests__/loginScreen.test.tsx`. |
| `WR-06` | Warning | Image Error Fallback | `fixed` | `src/app/(auth)/login.tsx`, `__tests__/loginScreen.test.tsx` | Added `failedLogoUri` state and `<Image onError={() => setFailedLogoUri(storeLogo)} />` so invalid/unreachable `storeLogo` URIs fall back cleanly to the `TR` monogram badge (`#005eb8`). Verified by new WR-06 test in `__tests__/loginScreen.test.tsx`. |
| `WR-07` | Warning | Necessity (Redundant Persistence) | `fixed` | `src/context/AuthContext.tsx` | Removed duplicate `setCachedStoreSettings(result.storeSettings)` in `testServerUrl` (already written by `testServerConnection`) and redundant `clearAuthSession()` in `refreshUserWithBaseUrl` on `401`/`403` (owned by `apiRequest` + `registerSessionRevokedHandler`). Verified by existing `authContext.test.tsx` and `routingRbac.test.tsx` suites. |
| `IN-01` | Info | Necessity (Defensive Guard) | `acknowledged` | None (`src/app/index.tsx` retained as-is) | Retained `if (!isHydrated) return null;` in `src/app/index.tsx` as a lightweight defensive guard if `IndexScreen` is ever rendered in isolation outside `RootNavigator` in tests. |
| `IN-02` | Info | Cookie Parsing | `fixed` | `src/services/api/cookieParser.ts`, `__tests__/cookieParser.test.ts` | Restricted `POS_SESSION_REGEX` to case-sensitive `/(?:^|,\s*)pos_session=([A-Za-z0-9_.-]+)/` and fell back to `headers.get("set-cookie")` only when `getSetCookie()` and `_rawHeaders` produced no rows (`candidates.length === 0`). Verified by new IN-02 test in `__tests__/cookieParser.test.ts`. |
| `IN-03` | Info | HTTP Client Guards | `fixed` | `src/services/api/apiClient.ts`, `__tests__/apiClient.test.ts` | Restricted auto `Content-Type: application/json` to `typeof rest.body === "string"` (preserving `FormData` multipart headers) and required a parsed JSON object (`rawBody !== null && rawBody.success !== false`) unless status is `204` for `apiRequest` success. Verified by new IN-03 test cases in `__tests__/apiClient.test.ts`. |
| `IN-04` | Info | Rate Limit Parsing | `fixed` | `src/services/api/authApi.ts`, `__tests__/apiClient.test.ts` | Added `parsedBody.retryAfter > 0` check in `parseRetryAfterSeconds` so `0` or negative values fall through to the `Retry-After` HTTP header. Verified by new IN-04 test case in `__tests__/apiClient.test.ts`. |
| `IN-05` | Info | Tab Bar Styling Parity | `fixed` | `src/app/(app)/(tabs)/_layout.tsx` | Consumed `options.tabBarActiveTintColor ?? TOKENS.colors.primary` and `options.tabBarInactiveTintColor ?? TOKENS.colors.muted` inside `VelocityTabBar` for tab icons and labels. Verified by `npx tsc --noEmit`, `npx expo lint`, and `routingRbac.test.tsx`. |

## Final Verification Suite

All checks executed in the workspace after all edits completed:
- `npx jest`: **7/7 suites passed, 48/48 tests passed** (`0` failures, `0` Expo Router deprecation warnings)
- `npx tsc --noEmit`: **0 errors**
- `npx expo lint`: **0 errors, 0 warnings**
- `npx expo-doctor`: **20/20 checks passed**
- `expo config --type public --json` check: **`EXPO_CONFIG_PUBLIC_OK=true`**
- Git commits created: **0** (all changes left uncommitted in working tree per user instruction)
