---
phase: "01"
slug: "auth-lan-transport-spike-role-protected-shell"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-18"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `jest` (`^30.x`) + `jest-expo` (`~58.0.15`) + `@testing-library/react-native` (`^14.1.0`) + `expo-router/testing-library` |
| **Config file** | `jest.config.js` (`preset: "jest-expo"`) & `__tests__/setup.ts` (installed in Wave 0) |
| **Quick run command** | `npx jest --bail && npx tsc --noEmit` |
| **Full suite command** | `npx jest && npx tsc --noEmit && npx expo lint` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --bail && npx tsc --noEmit`
- **After every plan wave:** Run `npx jest && npx tsc --noEmit && npx expo lint`
- **Before `/gsd-verify-work`:** Full suite must be green + `npx expo-doctor` clean + Physical Device / Emulator Cold-Kill Spike signed off
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | AUTH-02, AUTH-03 | T-01-SC | Blocking-human Package Legitimacy Gate (`npmjs.com/package/...`, `postinstall: null`) for all 18 `SUS (too-new)` npm packages prior to install | checkpoint | `manual (blocking-human pre-install gate)` | N/A | ⬜ pending |
| 01-01-02 | 01 | 1 | AUTH-02, AUTH-03 | T-01-01, T-01-SC | Bootstrap Expo SDK 58 + `app.config.ts` (`userInterfaceStyle: "light"`, `usesCleartextTraffic: true`, `NSAllowsLocalNetworking: true`) + ESLint flat (`eslint.config.js`) + Jest Wave 0 + clean placeholder `_layout.tsx`/`index.tsx` | config + smoke | `npx tsc --noEmit && npx expo lint && npx expo config --type public && npx expo-doctor && npx jest --passWithNoTests` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 2 | AUTH-03 | T-01-03 | Core auth types, `SecureStore` (`pos_session_token`, `pos_user_snapshot`) + `kv-store` (`pos_server_base_url`, `pos_store_settings`), and `pos_session` `Set-Cookie` extractor + diagnostics | unit | `npx tsc --noEmit && npx expo lint` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 2 | AUTH-01, AUTH-02, AUTH-03, AUTH-04 | T-01-02, T-01-03, T-01-04 | `zod` URL validation + `GET /api/settings` test, `apiFetch`/`apiRequest` (`401`/auth-`403` vs feature-`403`/`5xx` + `authEpoch`), and `authApi` `__DEV__` diagnostics + `clearSessionToken()` when `token === null` on `200` login | unit | `npx tsc --noEmit && npx expo lint` | ❌ W0 | ⬜ pending |
| 01-02-03 | 02 | 2 | AUTH-01, AUTH-02, AUTH-03 | T-01-02, T-01-03, T-01-04 | Transport & storage unit suites covering `cookieParser`, `serverConfig`, `apiClient`, and `authApi` null-token stale session cleanup | unit | `npx jest __tests__/cookieParser.test.ts __tests__/serverConfig.test.ts __tests__/apiClient.test.ts && npx tsc --noEmit && npx expo lint` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 3 | AUTH-01, AUTH-02 | T-01-06 | Velocity Blue tokens, 48px touch-target primitives, `RoleBadge`, and collapsible `ServerUrlPanel` (`SERVER_URL_HINTS`) | component | `npx tsc --noEmit && npx expo lint` | ❌ W0 | ⬜ pending |
| 01-03-02 | 03 | 3 | AUTH-01, AUTH-02, AUTH-03, AUTH-04 | T-01-05, T-01-06, T-01-07 | `AuthContext` cold-boot hydration, `429` countdown, fail-safe offline logout, `saveServerUrl`/`testServerUrl` persistence rules, and `LoginScreen` UI | component + unit | `npx jest __tests__/authContext.test.tsx && npx tsc --noEmit && npx expo lint` | ❌ W0 | ⬜ pending |
| 01-03-03 | 03 | 3 | AUTH-01, AUTH-02 | T-01-05, T-01-06 | Dedicated `LoginScreen` & `ServerUrlPanel` component test suite covering UI-SPEC `E1`/`E2` states (`TR` monogram, `Eye`/`EyeOff`, `400`, `429`, auto-expand, `Server Terhubung`, URL preservation) | component | `npx jest __tests__/loginScreen.test.tsx && npx tsc --noEmit && npx expo lint` | ❌ W0 | ⬜ pending |
| 01-04-01 | 04 | 4 | AUTH-02, AUTH-04 | T-01-09 | `LogoutConfirmModal` offline fail-safe confirmation + `Pengaturan` profile card, `ServerUrlPanel`, and `Sesi Lokal Aktif` | component | `npx tsc --noEmit && npx expo lint` | ❌ W0 | ⬜ pending |
| 01-04-02 | 04 | 4 | NAV-01, NAV-04 | T-01-08 | `Kasir`, role-aware `Produk` (`Mode Baca Saja (Kasir)` vs `Mode Kelola Katalog Aktif`), and `Pesanan` screens | component | `npx tsc --noEmit && npx expo lint` | ❌ W0 | ⬜ pending |
| 01-05-01 | 05 | 5 | AUTH-03, NAV-01, NAV-04 | T-01-10 | Root Splash/`<Stack.Protected>` gate, `/` `<Redirect>`, keyed `(app)/_layout.tsx` (`user.id:user.role`), and 4-tab Velocity Blue JS `<Tabs>` | routing + config | `npx tsc --noEmit && npx expo lint` | ❌ W0 | ⬜ pending |
| 01-05-02 | 05 | 5 | AUTH-03, AUTH-04, NAV-01, NAV-04 | T-01-08, T-01-09, T-01-10 | Integration suite (`renderRouter`) for `<Stack.Protected>`, 4 tabs, `kasir` read-only banner, offline logout modal, stack reset + full automated suite | integration (`renderRouter`) | `npx jest && npx tsc --noEmit && npx expo lint` | ❌ W0 | ⬜ pending |
| 01-06-01 | 06 | 6 | AUTH-01, AUTH-02, AUTH-03, AUTH-04, NAV-01, NAV-04 | T-01-11, T-01-SC | Automated pre-flight gate (`jest`, `tsc`, `expo lint`, `expo-doctor`, `expo config`) + live sibling `/api/settings` & LAN IP capture in `01-SPIKE-EVIDENCE.md` | pre-flight | `npx jest && npx tsc --noEmit && npx expo lint && npx expo-doctor && npx expo config --type public` | ❌ W0 | ⬜ pending |
| 01-06-02 | 06 | 6 | AUTH-01, AUTH-02, AUTH-03, AUTH-04, NAV-01, NAV-04 | T-01-11 | Physical Device / Emulator Cold-Kill Spike (`D-05` blocking-human escalation gate) | checkpoint | `manual (on-device cold-kill spike)` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `eslint.config.js` — Flat ESLint config extending `eslint-config-expo/flat` (`npx expo lint`)
- [ ] `jest.config.js` — `preset: "jest-expo"`, `setupFilesAfterEnv: ["<rootDir>/__tests__/setup.ts"]`, `testMatch: ["**/__tests__/**/*.test.[jt]s?(x)"]`, `moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" }`
- [ ] `__tests__/setup.ts` — In-memory `expo-secure-store` mock (`getItemAsync`/`setItemAsync`/`deleteItemAsync`), `expo-sqlite/kv-store` sync/async mock, `expo/fetch`, `expo-font` / `expo-splash-screen` / `expo-network` / `expo-haptics` stubs
- [ ] `__tests__/cookieParser.test.ts` — Tests `Set-Cookie` extraction from `_rawHeaders`, `headers.get("set-cookie")` with `Expires` commas, and `getSetCookie()`, plus `getSessionCaptureDiagnostics`
- [ ] `__tests__/serverConfig.test.ts` — Tests `zod` URL validation, trailing-slash normalization, and `GET /api/settings` test-connection helper (never `/api/health`)
- [ ] `__tests__/apiClient.test.ts` — Tests `Cookie` header injection (`credentials: "omit"`), `401`, `/api/auth/me` `403`, feature `403`, `503`, `authEpoch` race protection, and `authApi.loginWithCredentials` `token === null` stale-token clearing (`clearSessionToken`)
- [ ] `__tests__/authContext.test.tsx` — Tests cold-boot snapshot hydration, `429` countdown state, `saveServerUrl`/`testServerUrl` preservation rules, and fail-safe offline logout
- [ ] `__tests__/loginScreen.test.tsx` — Tests UI-SPEC `E1`/`E2` states (`TR` monogram fallback, `Eye`/`EyeOff` password toggle, `400` validation banner, `429` countdown UI, auto-expanded `ServerUrlPanel`, `"Server Terhubung"` banner, and preserving valid saved URL when draft is invalid/unreachable)
- [ ] `__tests__/routingRbac.test.tsx` — Uses `expo-router/testing-library` (`renderRouter`, `screen`) to verify `<Stack.Protected>`, 4 tabs, `kasir` read-only indicator, `LogoutConfirmModal`, and `user.id:user.role` stack reset
- [ ] Framework install (after Plan `01-01` `blocking-human` legitimacy gate): `npx expo install --dev jest-expo eslint-config-expo && npm install -D jest@^30.0.0 @types/jest@^30.0.0 @testing-library/react-native@^14.1.0 eslint@^9`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pre-login `GET /api/settings` reachability over LAN HTTP (`192.168.x.x:3000` / `10.0.2.2:3000`) | AUTH-02 | Requires live sibling `Apps_Toko_Rejeki` server & real Android Emulator / physical phone LAN networking | Open collapsible `Alamat Server API` on Login, enter server URL, tap `Tes Koneksi Server`, verify `Server Terhubung` emerald banner and store title/logo update |
| `pos_session` `httpOnly` cookie extraction (`_rawHeaders`/`set-cookie`) and survival across force-kill + offline relaunch + online `/api/auth/me` revalidation | AUTH-03 | Native `OkHttp` / `URLSession` `Set-Cookie` forwarding in Expo Go cannot be proved by Jest fetch mocks alone (`D-05` escalation gate) | Log in, confirm `__DEV__` boolean+length log (`pos_session` extracted), force-kill app, toggle Airplane Mode, relaunch (must enter 4-tab shell), reconnect Wi-Fi, force-kill and relaunch (verify `/api/auth/me` returns `200`, not `401`). If `null` or `401`, HALT and consult user before any backend edit |
| `429` throttle countdown, `403` inactive revocation, fail-safe offline logout, and `kasir`/`admin`/`owner` account switch Back-stack reset on device | AUTH-01, AUTH-04, NAV-04 | End-to-end visual keyboard avoidance, hardware back behavior, and live server throttle behavior | Trigger repeated invalid logins to observe live 1s countdown; toggle Airplane Mode and confirm logout clears session; log in as `owner`, switch to `Pengaturan`, log out, log in as `kasir`, inspect `Produk` `Mode Baca Saja (Kasir)` banner and confirm Android Back cannot return to `owner` screen |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
