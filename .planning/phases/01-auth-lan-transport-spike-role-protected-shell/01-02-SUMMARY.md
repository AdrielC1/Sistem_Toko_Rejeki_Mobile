---
phase: 01-auth-lan-transport-spike-role-protected-shell
plan: 02
subsystem: auth
tags: [expo-fetch, expo-secure-store, expo-sqlite-kv-store, zod, cookie-transport, auth-epoch, rbac-types, jest]

# Dependency graph
requires:
  - phase: 01-auth-lan-transport-spike-role-protected-shell
    provides: Expo SDK 58 + TypeScript 6.0 workspace, ESLint flat config, and Jest Wave 0 harness (__tests__/setup.ts with resetTestStorage())
provides:
  - Shared TypeScript DTO contracts (UserRole, AuthSessionUser, StoreSettings, ApiResponse, ConnectionTestResult, LoginAttemptResult, RoleCapabilities)
  - Dual-tier encrypted SecureStore (pos_session_token, pos_user_snapshot) and synchronous expo-sqlite/kv-store (pos_server_base_url, pos_store_settings) persistence adapter
  - Multi-source pos_session Set-Cookie parser (getSetCookie, _rawHeaders, headers.get) with safe boolean+length spike diagnostics
  - zod-validated LAN/HTTPS Server URL normalizer (SERVER_URL_HINTS) and pre-login GET /api/settings reachability check
  - expo/fetch (credentials omit) client with Cookie header injection, monotonic authEpoch guard, and strict 401/auth-403 vs feature-403/5xx matrix
  - Typed authApi (loginWithCredentials, fetchCurrentUser, logoutSession, fetchPublicSettings) with __DEV__ spike telemetry and null-token stale cleanup
  - Wave 0 Jest unit test suites for cookieParser, serverConfig, apiClient, and authApi
affects: [01-03, 01-04, 01-05, 01-06, phase-2, phase-3, phase-4, phase-5]

# Actuals (#2632)
actuals:
  tokens: 11312
  tasks: 3
  commits: 0

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Dual-tier storage separating compact credentials (<2KB in expo-secure-store without requireAuthentication) from URL and storeLogo-bearing StoreSettings in synchronous expo-sqlite/kv-store
    - expo/fetch with credentials "omit" + explicit Cookie header injection + _rawHeaders/set-cookie extraction across Expires commas
    - Monotonic authEpoch concurrency guard isolating stale in-flight /api/auth/me responses from newer login/logout state
    - Status revocation matrix clearing SecureStore exclusively on HTTP 401 (any endpoint) or HTTP 403 on /api/auth/me while preserving offline session on feature 403, 5xx, timeouts, and network errors

key-files:
  created:
    - src/types/index.ts
    - src/services/storage/secureStorage.ts
    - src/services/storage/serverConfig.ts
    - src/services/api/cookieParser.ts
    - src/services/api/apiClient.ts
    - src/services/api/authApi.ts
    - __tests__/cookieParser.test.ts
    - __tests__/serverConfig.test.ts
    - __tests__/apiClient.test.ts
  modified: []

key-decisions:
  - "Exported isValidAuthSessionUser from secureStorage.ts and parseStoreSettingsResponse from serverConfig.ts so snapshot validation and GET /api/settings Zod parsing are shared without duplication across authApi.ts."
  - "Pre-login testServerConnection targets public GET /api/settings (never GET /api/health which returns 401 when unauthenticated) and caches storeSettings only on valid 200 responses without mutating saved server_base_url on error."
  - "On HTTP 200 POST /api/auth/login, authApi emits safe __DEV__ getSessionCaptureDiagnostics(token) ({ captured, length }) without raw token bytes and calls clearSessionToken() when token === null so no prior user's pos_session_token remains in SecureStore."

patterns-established:
  - "Storage boundary: pos_session_token and pos_user_snapshot live strictly in expo-secure-store (never requireAuthentication: true); pos_server_base_url and pos_store_settings live in synchronous expo-sqlite/kv-store."
  - "Transport boundary: all REST requests route through apiFetch with credentials: 'omit' and explicit AbortController timeouts, never Authorization: Bearer fallback (D-05)."
  - "Revocation boundary: apiRequest checks capturedEpoch === getAuthEpoch() before clearing SecureStore or notifying revocation subscribers on 401 or /api/auth/me 403."

requirements-completed:
  - AUTH-01
  - AUTH-02
  - AUTH-03
  - AUTH-04

coverage:
  - id: D1
    description: "Shared TypeScript DTO contracts and dual-tier SecureStore/kv-store storage adapter with defensive JSON parsing"
    requirement: "AUTH-03"
    verification:
      - kind: unit
        ref: "__tests__/apiClient.test.ts#aborts timed-out requests via AbortController and handles corrupt storage JSON defensively"
        status: pass
    human_judgment: false
  - id: D2
    description: "pos_session Set-Cookie extraction across _rawHeaders, headers.get('set-cookie') Expires commas, and getSetCookie() plus safe { captured, length } diagnostics"
    requirement: "AUTH-03"
    verification:
      - kind: unit
        ref: "__tests__/cookieParser.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "zod Server URL normalization (http/https only, trailing slash and /api stripping) and pre-login GET /api/settings reachability check preserving saved URL on errors"
    requirement: "AUTH-02"
    verification:
      - kind: unit
        ref: "__tests__/serverConfig.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "expo/fetch client with credentials omit, manual Cookie injection, monotonic authEpoch guard, and strict 401/auth-403 vs feature-403/5xx/network preservation"
    requirement: "AUTH-03"
    verification:
      - kind: unit
        ref: "__tests__/apiClient.test.ts#guards against stale /api/auth/me 401 responses via authEpoch after a newer login"
        status: pass
    human_judgment: false
  - id: D5
    description: "authApi login (400/401/403/429 retryAfter/503, __DEV__ spike telemetry, null-token stale cleanup), fetchCurrentUser, fail-safe offline logoutSession, and fetchPublicSettings"
    requirement: "AUTH-01"
    verification:
      - kind: unit
        ref: "__tests__/apiClient.test.ts#loginWithCredentials stores extracted pos_session, emits safe __DEV__ diagnostics, and clears stale token if 200 returns null token"
        status: pass
    human_judgment: false
  - id: D6
    description: "Fail-safe offline POST /api/auth/logout wrapper that completes cleanly when network rejects"
    requirement: "AUTH-04"
    verification:
      - kind: unit
        ref: "__tests__/apiClient.test.ts#handles 429 retryAfter, 401/403 login errors, fail-safe offline logout, and public settings fetch"
        status: pass
    human_judgment: false

# Metrics
duration: 4min
completed: 2026-11-18
status: complete
---

# Phase 1 Plan 02: Auth DTOs, Dual-Tier Storage, Cookie Transport & API Client Summary

**Implemented the Phase 1 transport, cookie extraction, and dual-tier `SecureStore`/`kv-store` auth core (`src/types/index.ts`, `secureStorage.ts`, `serverConfig.ts`, `cookieParser.ts`, `apiClient.ts`, `authApi.ts`) with 17 passing Jest unit tests, strict TypeScript compilation, and zero ESLint issues**

## Performance

- **Duration:** 4 min
- **Started:** 2026-11-18T13:33:10Z
- **Completed:** 2026-11-18T13:37:17Z
- **Tasks:** 3
- **Files modified:** 9 created (plus `.planning/ROADMAP.md`, `.planning/STATE.md`, and this summary)

## Accomplishments
- Created typed domain contracts (`UserRole`, `AuthSessionUser`, `StoreSettings`, `ApiResponse`, `ConnectionTestResult`, `LoginAttemptResult`, `RoleCapabilities`) aligned with `Apps_Toko_Rejeki` and downstream Wave 3 (`AuthContext`) contracts.
- Built `secureStorage.ts` separating compact auth tokens/snapshots (`pos_session_token`, `pos_user_snapshot` in `expo-secure-store` without `requireAuthentication`) from mutable Server URL and potentially large base64 `storeLogo` settings (`pos_server_base_url`, `pos_store_settings` in synchronous `expo-sqlite/kv-store`), plus `cookieParser.ts` handling `_rawHeaders`, `whatwg-fetch` comma-joined `Expires` headers, and optional `getSetCookie()`.
- Implemented `zod`-based `normalizeServerUrl` + `testServerConnection` (targeting pre-login `GET /api/settings`, never `/api/health`), `apiClient.ts` (`expo/fetch` with `credentials: "omit"`, manual `Cookie` header, `AbortController` timeouts, monotonic `authEpoch` race protection, and `401`/auth-`403` vs feature-`403`/`5xx` classification), and `authApi.ts` with `__DEV__` boolean+length spike logging and `clearSessionToken()` stale-token cleanup when `token === null` on `200` login, all verified by 3 Jest test suites (17/17 passing).

## Task Commits

Pending manual user commit (per user instruction).

## Files Created/Modified
- `src/types/index.ts` - Shared TypeScript contracts for `UserRole`, `AuthSessionUser`, `StoreSettings`, `ApiResponse`, `ConnectionTestResult`, `LoginAttemptResult`, and `RoleCapabilities`.
- `src/services/storage/secureStorage.ts` - Dual-tier `expo-secure-store` + synchronous `expo-sqlite/kv-store` storage adapter with defensive JSON parsing (`isValidAuthSessionUser`).
- `src/services/api/cookieParser.ts` - `extractPosSessionFromResponse` across `getSetCookie()`, `_rawHeaders`, and `headers.get("set-cookie")` plus safe `{ captured, length }` `getSessionCaptureDiagnostics`.
- `src/services/storage/serverConfig.ts` - `SERVER_URL_HINTS`, `zod`-based `normalizeServerUrl`, shared `parseStoreSettingsResponse`, and pre-login `GET /api/settings` `testServerConnection`.
- `src/services/api/apiClient.ts` - `expo/fetch` (`credentials: "omit"`) client with `Cookie` injection, `AbortController` timeout, monotonic `authEpoch`, revocation subscriber registry, and `401`/`/api/auth/me` `403` clearing matrix.
- `src/services/api/authApi.ts` - `loginWithCredentials`, `fetchCurrentUser`, `logoutSession`, and `fetchPublicSettings` implementing exact UI-SPEC Indonesian messages, `429` `retryAfter` parsing, `__DEV__` spike telemetry, and null-token stale cleanup.
- `__tests__/cookieParser.test.ts` - Unit suite covering `_rawHeaders`, `whatwg-fetch` `Expires` commas, `getSetCookie()`, non-matching/cleared cookies, and redacted diagnostics (5 tests).
- `__tests__/serverConfig.test.ts` - Unit suite covering `SERVER_URL_HINTS`, valid/invalid URL normalization, `/api/settings` reachability vs `/api/health`, `kv-store` caching, and saved URL preservation on failure (5 tests).
- `__tests__/apiClient.test.ts` - Unit suite covering `Cookie` injection with `credentials: "omit"`, `401`/auth-`403` vs feature-`403`/`5xx`/offline preservation, `authEpoch` concurrency safety, `loginWithCredentials` `token === null` stale-token clearing + `__DEV__` diagnostics, `429`/`403` errors, timeout aborts, corrupt JSON storage resilience, and fail-safe offline logout (7 tests).

## Decisions Made
- Exported `isValidAuthSessionUser` from `src/services/storage/secureStorage.ts` and `parseStoreSettingsResponse` from `src/services/storage/serverConfig.ts` so `authApi.ts` reuses the exact same validation schemas without duplication.
- Normalized trailing slashes on endpoint paths inside `apiRequest` (e.g., `/api/auth/me/` -> `/api/auth/me`) before checking the `/api/auth/me` `403` revocation condition.
- Kept `testServerConnection` strictly side-effect-free on `pos_server_base_url` (only caching `storeSettings` on `200`) so `AuthContext` (`01-03`) remains the single owner of promoting a tested URL to `setStoredServerUrl()` when `ok: true`.

## Deviations from Plan

None - plan executed as specified (with minor DRY helper exports `isValidAuthSessionUser` and `parseStoreSettingsResponse` and additional defensive tests for `AbortController` timeouts and corrupt storage JSON).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Verification Output Summary

- `npx jest __tests__/cookieParser.test.ts __tests__/serverConfig.test.ts __tests__/apiClient.test.ts` -> exit `0` (`Test Suites: 3 passed, 3 total`, `Tests: 17 passed, 17 total`)
- `npx jest` -> exit `0` (`Test Suites: 3 passed, 3 total`, `Tests: 17 passed, 17 total`)
- `npx tsc --noEmit` -> exit `0` (`TSC_EXIT=0`, 0 errors)
- `npx expo lint` -> exit `0` (`LINT_EXIT=0`, 0 violations)

## Next Phase Readiness

- Wave 2 transport, dual-tier storage, cookie extraction, Server URL validation, and `authApi` foundations are tested and ready for Plan `01-03` (Wave 3: Velocity Blue tokens/primitives, `ServerUrlPanel`, `AuthContext`, and `LoginScreen`).
- Sibling `../Apps_Toko_Rejeki` remains completely unmodified (`D-05` respected).
- No git commits were created; all files remain cleanly on disk for manual user commit.

## Self-Check: PASSED
- Verified all 9 created files exist on disk (`src/types/index.ts`, `src/services/storage/secureStorage.ts`, `src/services/storage/serverConfig.ts`, `src/services/api/cookieParser.ts`, `src/services/api/apiClient.ts`, `src/services/api/authApi.ts`, `__tests__/cookieParser.test.ts`, `__tests__/serverConfig.test.ts`, `__tests__/apiClient.test.ts`).
- Verified `01-02-SUMMARY.md`, `.planning/ROADMAP.md`, and `.planning/STATE.md` updated cleanly without creating any git commit (`actuals.commits: 0`).
- Verified `npx jest`, `npx tsc --noEmit`, and `npx expo lint` all exited `0` after the final code edit.

---
*Phase: 01-auth-lan-transport-spike-role-protected-shell*
*Completed: 2026-11-18*
