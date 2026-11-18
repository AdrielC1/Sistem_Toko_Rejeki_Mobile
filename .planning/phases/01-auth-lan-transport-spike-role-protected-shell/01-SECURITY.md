---
phase: 01-auth-lan-transport-spike-role-protected-shell
asvs_level: 1
block_on: high
threats_total: 12
threats_closed: 12
threats_open: 0
status: secured
audited_at: "2026-11-18T15:24:00Z"
---

# Phase 1 Security Audit (`01-auth-lan-transport-spike-role-protected-shell`)

**Verdict:** `SECURED` (`12/12` threats closed, `0` blocking/non-blocking open threats, `0` unregistered threat flags)  
**Standard:** OWASP ASVS Level 1 (`block_on: high`)  
**Scope:** Direct source inspection across `app.config.ts`, `package.json`, `package-lock.json`, `src/`, `__tests__/`, and `.planning/phases/01-auth-lan-transport-spike-role-protected-shell/01-SPIKE-EVIDENCE.md`. Sibling `../Apps_Toko_Rejeki` remains completely unmodified.

## Threat Verification Matrix

| Threat ID | Category | Component(s) | Severity | Disposition | Status | Verified Code & Artifact Evidence |
|-----------|----------|--------------|----------|-------------|--------|-----------------------------------|
| `T-01-01` | Tampering | `app.config.ts` | high | mitigate | CLOSED | `app.config.ts:10` locks `userInterfaceStyle: "light"`; `app.config.ts:17-22` sets `NSLocalNetworkUsageDescription` and `NSAppTransportSecurity: { NSAllowsArbitraryLoads: false, NSAllowsLocalNetworking: true }`; `app.config.ts:45-52` configures `expo-build-properties` with `android.usesCleartextTraffic: true`; `app.config.ts:54-56` sets `experiments.typedRoutes: true`. Confirmed via `npx expo config --type public --json`. |
| `T-01-02` | Tampering | `src/services/storage/serverConfig.ts` | high | mitigate | CLOSED | `serverConfig.ts:14,16-65,121-135` (`serverUrlSchema` + `normalizeServerUrl` via `zod`) enforces `http:`/`https:` protocols only, forbids whitespace and embedded `username`/`password`, validates hostnames via `HOSTNAME_REGEX`, and trims trailing slashes and `/api`. `serverConfig.ts:142-160` (`testServerConnection`) normalizes first and targets `GET /api/settings` (zero `/api/health` calls anywhere in `src/`). Tested by `__tests__/serverConfig.test.ts` (5/5). |
| `T-01-03` | Information Disclosure | `cookieParser.ts`, `secureStorage.ts`, `authApi.ts` | high | mitigate | CLOSED | `secureStorage.ts:5-13,59-62,85-97` stores compact `pos_session_token` and `{ id, username, fullName, role, sessionStamp? }` `pos_user_snapshot` in `expo-secure-store` without `requireAuthentication: true` (0 occurrences in `src/`), well under 2KB; `secureStorage.ts:124-126,149-151` stores `pos_server_base_url` and `pos_store_settings` (`storeLogo`) in `expo-sqlite/kv-store`. `cookieParser.ts:82-89` (`getSessionCaptureDiagnostics`) returns `{ captured, length }` only. `authApi.ts:162-175` logs only diagnostics in `__DEV__` and calls `clearSessionToken()` whenever `token === null` on a `200` login response. |
| `T-01-04` | Denial of Service | `src/services/api/apiClient.ts`, `src/context/AuthContext.tsx` | medium | mitigate | CLOSED | `apiClient.ts:34-44,151-153,188-227` tracks monotonic `authEpoch`; `shouldRevoke` triggers strictly on `res.status === 401` or `res.status === 403 && normalizedPath === "/api/auth/me"`, guarding `clearAuthSession()` and revocation handlers with `capturedEpoch === getAuthEpoch()`. Feature `403`, `5xx`, timeouts, and network errors preserve local `SecureStore` state. `AuthContext.tsx:142-168` (`refreshUserWithBaseUrl`) also verifies `epoch !== getAuthEpoch()` before/after storage writes. |
| `T-01-05` | Elevation of Privilege | `src/context/AuthContext.tsx`, `src/app/(auth)/login.tsx` | high | mitigate | CLOSED | `AuthContext.tsx:102-140,241,248,269,287-289,305-313,329-330` enforces `loginInFlightRef` deduplication, blocks submission while `retryAfterRef.current > 0` (zero auto-retry), and clears the 1s `setInterval` timer on unmount, login success, and logout. `login.tsx:47,59,67-70,207` keeps `password` strictly in transient component state, resets `setPassword("")` on success, and sets `disabled={isLoggingIn || isThrottled}`. |
| `T-01-06` | Information Disclosure | `ServerUrlPanel.tsx`, `AuthContext.tsx`, `login.tsx`, `serverConfig.ts` | medium | mitigate | CLOSED | `serverConfig.ts:142-152` runs `normalizeServerUrl` (`zod`) before network calls; `AuthContext.tsx:356-399` persists `serverUrl` via `saveServerUrl` only on validation pass and via `testServerUrl` only when `testServerConnection` returns `ok: true`, leaving prior saved URLs/settings intact on failure. `authApi.ts:26-33,109-149` and `login.tsx:128-141` emit static Indonesian `ERROR_COPY` strings without echoing credentials. |
| `T-01-07` | Information Disclosure | `AuthContext.tsx`, `authApi.ts` | low | transfer | CLOSED | Verified zero `SESSION_SECRET`, HMAC signing/verification logic, or `pgcrypto`/password hashing in mobile `src/`. Responsibility transfer explicitly documented in `01-RESEARCH.md:81,187-230,766` and `01-CONTEXT.md:49` to `Apps_Toko_Rejeki` backend (`apps/src/lib/session.ts`, `auth.ts`, `apiAuth.ts`, `app/api/auth/login/route.ts`). |
| `T-01-08` | Information Disclosure | `src/app/(app)/(tabs)/produk.tsx`, `src/context/AuthContext.tsx` | medium | mitigate | CLOSED | `AuthContext.tsx:73-82` (`computeRoleCapabilities`) sets `canEditProducts: false`, `canViewCostPrice: false`, `canManageStore: false`, and `isReadOnlyCatalog: true` for `"kasir"` (and all `false` for `null`). `produk.tsx:13,27-64` gates `Mode Baca Saja (Kasir)` vs `Mode Kelola Katalog Aktif`; zero `costPrice` fields or product write CTAs exist in `src/`. |
| `T-01-09` | Repudiation | `LogoutConfirmModal.tsx`, `pengaturan.tsx`, `AuthContext.tsx`, `authApi.ts` | low | mitigate | CLOSED | `pengaturan.tsx:47-55,145-169` and `LogoutConfirmModal.tsx:31-35,74-90` enforce explicit two-step modal confirmation (`Keluar dari Akun?` -> `Ya, Akhiri Sesi`) and block dismissal while `isSubmitting`. `AuthContext.tsx:322-354` deduplicates via `logoutInFlightRef`, bumps `authEpoch`, calls `logoutSession(activeUrl)` (`authApi.ts:209-221`, 4000ms fail-safe), and clears `SecureStore` in `finally`. |
| `T-01-10` | Elevation of Privilege | `src/app/_layout.tsx`, `src/app/index.tsx`, `src/app/(app)/_layout.tsx` | high | mitigate | CLOSED | `src/app/_layout.tsx:19,26-56` holds `SplashScreen` until `isHydrated && fontsReady` and guards `(auth)`/`(app)` via declarative `<Stack.Protected guard={!isAuthenticated} redirectTo="/kasir">` and `<Stack.Protected guard={isAuthenticated} redirectTo="/login">`. `src/app/index.tsx:4-12` redirects post-hydration; `src/app/(app)/_layout.tsx:8-13` keys `<Slot key={user ? \`${user.id}:${user.role}\` : "guest"} />` to discard prior route state on account/role switch. |
| `T-01-11` | Information Disclosure | Device Spike Telemetry, `cookieParser.ts`, `authApi.ts`, `01-SPIKE-EVIDENCE.md` | high | mitigate | CLOSED | `cookieParser.ts:82-89` and `authApi.ts:163-168` (sole `console.*` call across `src/`) emit only `{ captured, length }` under `if (__DEV__)` with zero raw `pos_session`, `Cookie`, `Set-Cookie`, or password output. `01-SPIKE-EVIDENCE.md:40-48` records user `approved` Cold-Kill Spike sign-off (`2026-11-18T22:18:07+07:00`) with zero embedded secrets. |
| `T-01-SC` | Tampering | `package.json`, `package-lock.json` | high | mitigate | CLOSED | Plan `01-01` Task 1 blocking-human Package Legitimacy Gate received explicit user approval before installation (`01-01-SUMMARY.md:73,132`). Lockfile audit confirms `0` direct packages declare `hasInstallScript` (only transitive `@parcel/watcher@2.6.0` and optional macOS `fsevents@2.3.3` carry `hasInstallScript`), `0` version mismatches against `node_modules/expo/bundledNativeModules.json`, and `npx expo-doctor` passed `20/20` checks. |

## Accepted Risks Log

*(None — all 11 STRIDE threats mitigated and 1 architecture transfer verified against documented boundary.)*

## Transferred Risks Log

| Threat ID | Component | Transferred Control | Target Owner & Documentation |
|-----------|-----------|---------------------|------------------------------|
| `T-01-07` | `AuthContext.tsx`, `authApi.ts` | Password verification (`pgcrypto`) and `pos_session` HMAC-SHA256 signing/verification (`SESSION_SECRET` never shipped to mobile) | `Apps_Toko_Rejeki` Next.js backend (`01-RESEARCH.md:81,187-230,766`, `01-CONTEXT.md:49`) |

## Unregistered Threat Flags

None (`0` entries in `01-01-SUMMARY.md`..`01-06-SUMMARY.md` `## Threat Flags`).

## Verification Checks Executed During Audit

| Check | Result |
|-------|--------|
| `npx jest` | Exit `0` — `7/7` test suites passed, `41/41` tests passed (`cookieParser`, `serverConfig`, `apiClient`, `authContext`, `tabScreens`, `loginScreen`, `routingRbac`) |
| `npx tsc --noEmit` | Exit `0` — `0` errors |
| `npx expo lint` | Exit `0` — `0` errors, `0` warnings |
| `npx expo-doctor` | Exit `0` — `20/20` checks passed |
| `npx expo config --type public --json` | Exit `0` — `userInterfaceStyle: "light"`, `NSAllowsArbitraryLoads: false`, `NSAllowsLocalNetworking: true`, `android.usesCleartextTraffic: true`, `typedRoutes: true` |
| Source grep (`src/`, `app.config.ts`) | `0` `requireAuthentication` uses, `0` `/api/health` pre-login calls, `0` `Bearer` fallbacks, `0` `costPrice` exposures, `0` `SESSION_SECRET` occurrences, sole `console.info` emits `{ captured, length }` |
| Lockfile audit (`package.json`, `package-lock.json`) | `44` direct deps; `0` direct `hasInstallScript` entries; `0` `bundledNativeModules.json` mismatches |
| Sibling backend check (`git -C ../Apps_Toko_Rejeki status --short`) | Empty (completely unmodified) |
