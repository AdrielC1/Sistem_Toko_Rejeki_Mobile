---
phase: 01-auth-lan-transport-spike-role-protected-shell
plan: 03
subsystem: ui
tags: [velocity-blue, design-tokens, auth-context, login-screen, server-url-panel, role-badge, react-native-testing-library, jest]

# Dependency graph
requires:
  - phase: 01-auth-lan-transport-spike-role-protected-shell
    provides: Shared TypeScript DTO contracts, dual-tier SecureStore/kv-store storage adapter, Server URL normalizer/tester, authEpoch-guarded apiClient, and typed authApi
provides:
  - Velocity Blue design tokens (TOKENS, ROLE_STYLES, FONT_FAMILY) and accessible >=48px touch-target UI primitives (SurfaceCard, PrimaryButton, SecondaryButton, InputField, FeedbackBanner, InputFieldHandle)
  - RoleBadge component aligned with Sidebar.tsx owner/admin/kasir colors and icons
  - Controlled collapsible ServerUrlPanel with LAN/Emulator quick-fill hints, Tes Koneksi Server, and Simpan Alamat Server
  - AuthProvider, AuthContextValue (with role, isLoggingOut, roleCapabilities, 429 countdown timer, epoch-guarded /api/auth/me revalidation, fail-safe offline logout), computeRoleCapabilities, and useAuth hook
  - Headerless (auth)/_layout.tsx stack and Velocity Blue LoginScreen with TR/storeLogo badge, eye/eye-off toggle, and 400/401/403/429/503 feedback banners
  - Jest context and component suites (__tests__/authContext.test.tsx and __tests__/loginScreen.test.tsx) covering AUTH-01 through AUTH-04 and UI-SPEC E1/E2
affects: [01-04, 01-05, 01-06, phase-2, phase-3, phase-4, phase-5]

# Actuals (#2632)
actuals:
  tokens: 19461
  tasks: 3
  commits: 0

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Velocity Blue StyleSheet tokens (src/theme/tokens.ts) enforcing 4 typography sizes, 8px spacing multiples, and >=48px touch targets
    - Controlled ServerUrlPanel with render-time savedServerUrl sync (satisfying React 19 react-hooks/set-state-in-effect) and auto-expand only when unconfigured
    - Synchronous void-wrapped button press callbacks preventing RNTL v14 async fireEvent.press promise deadlocks during pending network loading states
    - AuthContext mount-epoch and double-epoch SecureStore guards preventing stale /api/auth/me HTTP 200 responses from resurrecting sessions after logout()

key-files:
  created:
    - src/theme/tokens.ts
    - src/components/ui/VelocityPrimitives.tsx
    - src/components/common/RoleBadge.tsx
    - src/components/common/ServerUrlPanel.tsx
    - src/context/AuthContext.tsx
    - src/app/(auth)/_layout.tsx
    - src/app/(auth)/login.tsx
    - __tests__/authContext.test.tsx
    - __tests__/loginScreen.test.tsx
  modified:
    - jest.config.js

key-decisions:
  - "Mapped lucide-react-native to dist/cjs/lucide-react-native.js in jest.config.js because jest-expo resolves the package's ESM react-native entry while excluding lucide-react-native from transformIgnorePatterns."
  - "Used render-time previous-prop comparison in ServerUrlPanel instead of useEffect setState so ESLint react-hooks/set-state-in-effect passes and hydrated savedServerUrl collapses cleanly on cold start."
  - "Wrapped PrimaryButton/SecondaryButton press invocation synchronously so RNTL v14 fireEvent.press immediately yields after triggering async login/test requests, allowing loading UI assertions while fetch remains pending."
  - "Guarded computeRoleCapabilities(null) fail-closed (all booleans false, including canViewCostPrice: false) while keeping exact parity for owner, admin, and kasir."

patterns-established:
  - "Design system boundary: all UI colors, spacing, radii, typography, and role colors import TOKENS/ROLE_STYLES/FONT_FAMILY from src/theme/tokens.ts without raw hex strings."
  - "Server configuration boundary: ServerUrlPanel stays side-effect-free on storage, delegating saveServerUrl/testServerUrl to AuthContext which persists server_base_url and storeSettings ONLY when validation or GET /api/settings succeeds."
  - "Auth concurrency boundary: AuthContext guards login() via loginInFlightRef + retryAfterRef > 0 block, deduplicates concurrent logout() calls via logoutInFlightRef, and checks getAuthEpoch() before and after async SecureStore snapshot writes."

requirements-completed:
  - AUTH-01
  - AUTH-02
  - AUTH-03
  - AUTH-04

coverage:
  - id: D1
    description: "Velocity Blue design tokens, >=48px touch-target primitives, RoleBadge, and collapsible ServerUrlPanel with LAN/Emulator hints"
    requirement: "AUTH-02"
    verification:
      - kind: unit
        ref: "__tests__/loginScreen.test.tsx#auto-expands ServerUrlPanel when unconfigured, shows Server Terhubung on 200, and preserves saved URL on invalid/unreachable drafts"
        status: pass
    human_judgment: false
  - id: D2
    description: "AuthContext cold-boot offline hydration, epoch-guarded /api/auth/me race protection, and fail-safe offline logout deduplication"
    requirement: "AUTH-03"
    verification:
      - kind: unit
        ref: "__tests__/authContext.test.tsx#ignores stale in-flight /api/auth/me HTTP 200 responses that resolve after logout()"
        status: pass
    human_judgment: false
  - id: D3
    description: "AuthContext fail-safe offline logout clearing SecureStore and toggling isLoggingOut cleanly"
    requirement: "AUTH-04"
    verification:
      - kind: unit
        ref: "__tests__/authContext.test.tsx#executes fail-safe offline logout and deduplicates concurrent logout calls"
        status: pass
    human_judgment: false
  - id: D4
    description: "LoginScreen Velocity Blue card with TR monogram fallback / storeLogo branding, 48x48 password toggle, 400/401/403/503 error banners, and 1s 429 countdown UI"
    requirement: "AUTH-01"
    verification:
      - kind: unit
        ref: "__tests__/loginScreen.test.tsx#validates blank credentials without network, renders 401/403/offline errors, and runs live 429 countdown UI"
        status: pass
    human_judgment: false
  - id: D5
    description: "AuthContext login concurrency deduplication and saveServerUrl/testServerUrl saved-URL preservation rules"
    requirement: "AUTH-01"
    verification:
      - kind: unit
        ref: "__tests__/authContext.test.tsx#persists saveServerUrl/testServerUrl only on success and preserves prior saved URL on failure"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-11-18
status: complete
---

# Phase 1 Plan 03: Velocity Blue Tokens, AuthContext & Login Screen Summary

**Implemented the Velocity Blue design system tokens/primitives, `RoleBadge`, collapsible `ServerUrlPanel`, `AuthContext` state machine (`429` countdown, `authEpoch` race guard, fail-safe offline logout), headerless `(auth)/_layout.tsx`, and `LoginScreen` verified by 11 new Jest context/component tests (28 total passing), strict TypeScript, and zero-error Expo ESLint**

## Performance

- **Duration:** 12 min
- **Started:** 2026-11-18T13:38:24Z
- **Completed:** 2026-11-18T13:49:58Z
- **Tasks:** 3
- **Files modified:** 10 files (9 created, 1 modified in `jest.config.js`, plus `.planning/ROADMAP.md`, `.planning/STATE.md`, and this summary)

## Accomplishments
- Created `src/theme/tokens.ts` (`TOKENS`, `ROLE_STYLES`, `FONT_FAMILY`), `src/components/ui/VelocityPrimitives.tsx` (`SurfaceCard`, `PrimaryButton`, `SecondaryButton`, `InputField`, `FeedbackBanner`, `InputFieldHandle` with `minHeight: 48` touch targets and `WCAG AA` contrast pairings), `RoleBadge.tsx`, and controlled collapsible `ServerUrlPanel.tsx` (`SERVER_URL_HINTS` quick-fill chips, `Tes Koneksi Server`, `Simpan Alamat Server`, `numberOfLines={1}` collapsed URL truncation).
- Built `src/context/AuthContext.tsx` (`AuthProvider`, `useAuth`, `computeRoleCapabilities`, `AuthContextValue` exposing `role`, `isLoggingOut`, `retryAfterSeconds`, `saveServerUrl`, `testServerUrl`) with cold-boot `SecureStore`/`kv-store` hydration, `authEpoch`-guarded `/api/auth/me` revalidation, `loginInFlightRef` + `retryAfterRef > 0` enforcement, `setInterval` 1s `429` countdown cleaned up on unmount, `testServerUrl` persistence strictly on `ok: true`, and fail-safe deduplicated offline `logout()`.
- Built `src/app/(auth)/_layout.tsx` and `src/app/(auth)/login.tsx` matching `01-UI-SPEC.md` (`TR` `#005eb8` monogram / `storeLogo` `64x64` badge, `Alamat Server Belum Terhubung` pre-config notice, auto-expanded `ServerUrlPanel`, `Eye`/`EyeOff` `48x48` toggle, `400`/`401`/`403`/`429`/`503` banners, `KeyboardAvoidingView` + `ScrollView`), backed by `__tests__/authContext.test.tsx` (7 tests) and `__tests__/loginScreen.test.tsx` (4 tests).

## Task Commits

Pending manual user commit (per user instruction).

## Files Created/Modified
- `src/theme/tokens.ts` - Velocity Blue light palette tokens, spacing grid (`48px` touch target, `64px` logo/tab bar), radii, 4-size typography scale (`FONT_FAMILY`), and `ROLE_STYLES` (`Owner` purple, `Admin` blue, `Kasir` emerald).
- `src/components/ui/VelocityPrimitives.tsx` - Accessible `SurfaceCard`, `PrimaryButton`, `SecondaryButton`, `InputField` (with `48x48` trailing icon button slot and `InputFieldHandle`), and icon-paired `FeedbackBanner`.
- `src/components/common/RoleBadge.tsx` - Role indicator pill (`Owner` / `Admin` / `Kasir`) with matching `ShieldCheck` / `User` Lucide icons.
- `src/components/common/ServerUrlPanel.tsx` - Collapsible `Alamat Server API` accordion auto-expanding when unconfigured, displaying `SERVER_URL_HINTS` chips and delegating `Tes Koneksi Server` / `Simpan Alamat Server`.
- `src/context/AuthContext.tsx` - Complete session lifecycle state machine (`AuthProvider`, `useAuth`, `computeRoleCapabilities`) with `authEpoch` race protection, `429` timer, concurrency guards, and fail-safe offline logout.
- `src/app/(auth)/_layout.tsx` - Headerless Auth stack layout exporting `unstable_settings = { initialRouteName: "login" }`.
- `src/app/(auth)/login.tsx` - Velocity Blue Login screen (`maxWidth: 440` card inside `SafeAreaView` + `KeyboardAvoidingView` + `ScrollView`), `TR`/logo badge, `ServerUrlPanel`, password toggle, and error/`429` countdown banners.
- `__tests__/authContext.test.tsx` - 7 Jest unit/context tests covering `computeRoleCapabilities`, offline cold-boot hydration, online `/api/auth/me` matrix, stale `/api/auth/me` `200` after `logout()` race, `login()` `400`/`401`/`403`/`429` fake-timer countdown + concurrency, `saveServerUrl`/`testServerUrl` preservation, and fail-safe offline `logout()`.
- `__tests__/loginScreen.test.tsx` - 4 component integration tests covering all `01-UI-SPEC.md` `E1`/`E2` scenarios (`TR` monogram vs `storeLogo`, `48x48` password toggle + `Memeriksa Akses...`, `400`/`401`/`403`/offline/`429` UI countdown, auto-expanded `ServerUrlPanel`, `Server Terhubung`, and URL preservation).
- `jest.config.js` - Added `moduleNameMapper` entry mapping `lucide-react-native` to its CommonJS entry (`dist/cjs/lucide-react-native.js`) so `jest-expo` resolves Lucide icons without ESM loader errors.

## Decisions Made
- Mapped `lucide-react-native` to `<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js` in `jest.config.js` rather than overriding `jest-expo`'s full `transformIgnorePatterns` list, keeping Expo's default native transform exclusions intact.
- Used React render-time previous-value tracking in `ServerUrlPanel.tsx` to sync `draftUrl` and collapse on async `AuthProvider` cold-start hydration without triggering ESLint's `react-hooks/set-state-in-effect` error.
- Wrapped `onPress` synchronously inside `PrimaryButton`/`SecondaryButton` and caller callbacks so `@testing-library/react-native` v14 `fireEvent.press` does not await unresolved network promises when asserting intermediate loading states (`Memeriksa Akses...`, `Menguji Koneksi...`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Resolved Jest CJS/ESM module resolution for `lucide-react-native` and RNTL v14 async `fireEvent.press` loading-state deadlock**
- **Found during:** Task 3 (`__tests__/loginScreen.test.tsx` initial run)
- **Issue:** (a) `jest-expo` selected `lucide-react-native`'s `.mjs` `react-native` entry while ignoring `node_modules`, throwing `Must use import to load ES Module`; (b) `@testing-library/react-native` v14 `fireEvent.press` awaits any `Promise` returned by an `onPress` handler, deadlocking tests that assert loading state before resolving a mocked pending `fetch` promise.
- **Fix:** (a) Added `^lucide-react-native$` CJS `moduleNameMapper` in `jest.config.js`; (b) wrapped `onPress` calls synchronously in `VelocityPrimitives.tsx`, `ServerUrlPanel.tsx`, and `src/app/(auth)/login.tsx`.
- **Files modified:** `jest.config.js`, `src/components/ui/VelocityPrimitives.tsx`, `src/components/common/ServerUrlPanel.tsx`, `src/app/(auth)/login.tsx`
- **Verification:** Re-ran `npx jest __tests__/loginScreen.test.tsx`, `npx jest`, `npx tsc --noEmit`, and `npx expo lint` (all exited `0`).
- **Committed in:** Pending manual user commit (per user instruction)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential for Jest component execution under `jest-expo` + `@testing-library/react-native` v14. Zero scope creep.

## Issues Encountered
- ESLint 9 (`eslint-config-expo/flat`) flagged `react-hooks/set-state-in-effect` on an initial `useEffect` draft-URL sync in `ServerUrlPanel.tsx`; resolved cleanly via render-time previous-prop comparison.
- React Native `0.88` Strict TypeScript API defines `TextInput` ref instance via `React.ComponentRef<typeof TextInput>`, exported as `InputFieldHandle` in `VelocityPrimitives.tsx` for type-safe focus handoff between `Username` and `Kata Sandi`.

## User Setup Required

None - no external service configuration required.

## Verification Output Summary

- `npx jest __tests__/authContext.test.tsx` -> exit `0` (`Test Suites: 1 passed, 1 total`, `Tests: 7 passed, 7 total`)
- `npx jest __tests__/loginScreen.test.tsx` -> exit `0` (`Test Suites: 1 passed, 1 total`, `Tests: 4 passed, 4 total`)
- `npx jest` -> exit `0` (`Test Suites: 5 passed, 5 total`, `Tests: 28 passed, 28 total`, `7.843 s`)
- `npx tsc --noEmit` -> exit `0` (`0` errors)
- `npx expo lint` -> exit `0` (`0` errors, `0` warnings)

## Next Phase Readiness

- Velocity Blue design tokens, UI primitives, `RoleBadge`, `ServerUrlPanel`, `AuthContext`, and `(auth)/login` are tested and ready for Plan `01-04` (Wave 4: `LogoutConfirmModal` and the 4 role-aware tab screens `Kasir`, `Produk`, `Pesanan`, `Pengaturan`).
- Sibling `../Apps_Toko_Rejeki` remains completely unmodified (`git -C ../Apps_Toko_Rejeki status --short` empty).
- No git commits were created; all files remain cleanly on disk for manual user commit.

## Self-Check: PASSED
- Verified all 9 created files and 1 modified file exist on disk (`src/theme/tokens.ts`, `src/components/ui/VelocityPrimitives.tsx`, `src/components/common/RoleBadge.tsx`, `src/components/common/ServerUrlPanel.tsx`, `src/context/AuthContext.tsx`, `src/app/(auth)/_layout.tsx`, `src/app/(auth)/login.tsx`, `__tests__/authContext.test.tsx`, `__tests__/loginScreen.test.tsx`, `jest.config.js`).
- Verified `01-03-SUMMARY.md`, `.planning/ROADMAP.md`, and `.planning/STATE.md` updated cleanly without creating any git commit (`actuals.commits: 0`).
- Verified `npx jest`, `npx tsc --noEmit`, and `npx expo lint` all exited `0` after the final code edit (`28 passed, 28 total`).

---
*Phase: 01-auth-lan-transport-spike-role-protected-shell*
*Completed: 2026-11-18*
