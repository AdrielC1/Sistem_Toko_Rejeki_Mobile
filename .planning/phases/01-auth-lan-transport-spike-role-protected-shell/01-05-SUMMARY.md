---
phase: 01-auth-lan-transport-spike-role-protected-shell
plan: 05
subsystem: ui
tags: [expo-router, stack-protected, js-tabs, velocity-blue, splash-screen, expo-font, rbac, expo-router-testing-library]

# Dependency graph
requires:
  - phase: 01-auth-lan-transport-spike-role-protected-shell
    provides: AuthProvider, computeRoleCapabilities, TOKENS/FONT_FAMILY, LoginScreen, LogoutConfirmModal, and all 4 role-aware tab screens
provides:
  - Root boot gate in src/app/_layout.tsx holding SplashScreen until Google Fonts (with fontError fallback) and SecureStore/kv-store hydration finish, then gating (auth) and (app) via declarative <Stack.Protected>
  - Root entry redirect in src/app/index.tsx routing / cleanly to /kasir or /login post-hydration
  - Account/role-switch stack reset wrapper in src/app/(app)/_layout.tsx keying <Slot /> by user.id:user.role
  - Velocity Blue 4-tab JS <Tabs> Bottom Navigation Bar in src/app/(app)/(tabs)/_layout.tsx (Kasir, Produk, Pesanan, Pengaturan) with active top indicator strip, #d6e3ff icon pill, 48px touch targets, and SafeAreaInsets padding
  - End-to-end expo-router/testing-library integration suite (__tests__/routingRbac.test.tsx)
affects: [01-06, phase-2, phase-3, phase-4, phase-5]

# Actuals (#2632)
actuals:
  tokens: 6853
  tasks: 2
  commits: 0

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Root SplashScreen.preventAutoHideAsync() + parallel Google Font loading (error-tolerant via fontsLoaded || Boolean(fontError)) and AuthProvider SecureStore hydration gate before rendering <Stack>
    - Declarative <Stack.Protected guard={...} redirectTo={...}> boundaries paired with keyed <Slot key={`${user.id}:${user.role}`} /> for zero-history-leak account switches
    - Custom VelocityTabBar passed to JS <Tabs> (expo-router/js-tabs) with backBehavior="initialRoute" and anchor="kasir" delivering 2px top indicator strip + #d6e3ff icon pill + >=48px touch targets + Math.max(insets.bottom, 8) safe-area clearance
    - SafeAreaProviderCompat-compatible react-native-safe-area-context Jest mock preserving SafeAreaInsetsContext and SafeAreaFrameContext providers for expo-router/testing-library

key-files:
  created:
    - src/app/(app)/_layout.tsx
    - src/app/(app)/(tabs)/_layout.tsx
    - __tests__/routingRbac.test.tsx
  modified:
    - src/app/_layout.tsx
    - src/app/index.tsx
    - __tests__/setup.ts

key-decisions:
  - "Used JS <Tabs> from expo-router/js-tabs with a dedicated VelocityTabBar renderer (rather than NativeTabs or default TabBarIcon) so active tabs always pair color with a 2px #00478d top indicator bar, #d6e3ff rounded-square icon pill, 13px single-line labels, 48px touch targets, and bottom padding Math.max(insets.bottom, 8)."
  - "Added explicit redirectTo='/kasir' and redirectTo='/login' props on the root <Stack.Protected> groups alongside <Stack.Screen name='index' /> so deep links and logout transitions resolve directly without intermediate flashes."
  - "Set backBehavior='initialRoute' and unstable_settings.anchor='kasir' in (app)/(tabs)/_layout.tsx while keeping unstable_settings.initialRouteName='(tabs)' in (app)/_layout.tsx per Plan 01-05 contract."
  - "Updated __tests__/setup.ts react-native-safe-area-context mock to preserve SafeAreaInsetsContext and SafeAreaFrameContext from actual so BottomTabView and SafeAreaProviderCompat render cleanly under renderRouter."

patterns-established:
  - "Boot gate pattern: hold SplashScreen at root until isHydrated && (fontsLoaded || Boolean(fontError)) before mounting <Stack>, guaranteeing zero unstyled flash or permanent splash deadlock if font assets fail offline."
  - "RBAC isolation pattern: enforce root auth boundaries via <Stack.Protected> and force full subtree unmount on account/role transitions via key={user ? `${user.id}:${user.role}` : 'guest'}."
  - "Tab bar visual indicator pattern: active tab pairs #00478d icon/SemiBold label with #d6e3ff pill and 2px top bar (never color-only)."

requirements-completed:
  - AUTH-03
  - AUTH-04
  - NAV-01
  - NAV-04

coverage:
  - id: D1
    description: "SplashScreen boot gate holding UI until Google Fonts (with fontError tolerance) and SecureStore/kv-store hydrate, preserving 503/offline sessions and wiping /api/auth/me 403 sessions"
    requirement: "AUTH-03"
    verification:
      - kind: integration
        ref: "__tests__/routingRbac.test.tsx#holds SplashScreen while fonts are still loading"
        status: pass
      - kind: integration
        ref: "__tests__/routingRbac.test.tsx#tolerates font load errors and releases SplashScreen once auth hydrates"
        status: pass
      - kind: integration
        ref: "__tests__/routingRbac.test.tsx#retains offline/503 session snapshot into 4-tab shell and wipes session on /api/auth/me 403"
        status: pass
    human_judgment: false
  - id: D2
    description: "Root <Stack.Protected> blocking unauthenticated access to /, /kasir, and /produk and routing cleanly to /login"
    requirement: "NAV-01"
    verification:
      - kind: integration
        ref: "__tests__/routingRbac.test.tsx#blocks unauthenticated entry to /, /kasir, and /produk via <Stack.Protected>"
        status: pass
    human_judgment: false
  - id: D3
    description: "Velocity Blue 4-tab JS <Tabs> Bottom Navigation Bar (Kasir, Produk, Pesanan, Pengaturan) rendered for all roles, gating Produk between Mode Baca Saja (Kasir) and Mode Kelola Katalog Aktif (Admin/Owner)"
    requirement: "NAV-01"
    verification:
      - kind: integration
        ref: "__tests__/routingRbac.test.tsx#mounts all 4 Velocity Blue bottom tabs for kasir and enforces read-only policy on Produk"
        status: pass
      - kind: integration
        ref: "__tests__/routingRbac.test.tsx#displays Mode Kelola Katalog Aktif and hides Mode Baca Saja (Kasir) for admin and owner"
        status: pass
    human_judgment: false
  - id: D4
    description: "Fail-safe offline logout from Pengaturan modal back to /login and clean navigation stack reset on owner -> kasir account switch via user.id:user.role key"
    requirement: "AUTH-04"
    verification:
      - kind: integration
        ref: "__tests__/routingRbac.test.tsx#renders Pengaturan profile and executes fail-safe offline logout back to Login"
        status: pass
      - kind: integration
        ref: "__tests__/routingRbac.test.tsx#resets authenticated navigation state cleanly on account switch via user.id:user.role key"
        status: pass
    human_judgment: false
  - id: D5
    description: "4 equal 25%-width Bottom Navigation Bar tabs (Kasir, Produk, Pesanan, Pengaturan) single-line 13px label fit and >=24px bottom clearance on physical 360px devices"
    requirement: "NAV-01"
    verification: []
    human_judgment: true
    rationale: "Single-line 13px label rendering without ellipsis truncation on 360px physical devices and real gesture-bar inset clearance above the tab bar require device/emulator inspection in Plan 01-06."

# Metrics
duration: 11min
completed: 2026-11-18
status: complete
---

# Phase 1 Plan 05: Root Stack.Protected Boot Gate, 4-Tab JS Tabs & Routing RBAC Summary

**Implemented the production Splash/Google Fonts/Auth hydration boot gate with `<Stack.Protected>` route guards (`src/app/_layout.tsx`), entry redirect (`src/app/index.tsx`), `${user.id}:${user.role}` stack reset wrapper (`src/app/(app)/_layout.tsx`), Velocity Blue 4-tab JS `<Tabs>` Bottom Navigation Bar (`src/app/(app)/(tabs)/_layout.tsx`), and 8 end-to-end `expo-router/testing-library` integration tests (`41/41` tests passing across all 7 suites)**

## Performance

- **Duration:** 11 min
- **Started:** 2026-11-18T13:58:48Z
- **Completed:** 2026-11-18T14:10:10Z
- **Tasks:** 2
- **Files modified:** 6 code/test files (`src/app/_layout.tsx`, `src/app/index.tsx`, `src/app/(app)/_layout.tsx`, `src/app/(app)/(tabs)/_layout.tsx`, `__tests__/routingRbac.test.tsx`, `__tests__/setup.ts`), plus `.planning/ROADMAP.md`, `.planning/STATE.md`, and this summary

## Accomplishments
- Replaced the Plan `01-01` root placeholders with production `src/app/_layout.tsx` (module-scope `SplashScreen.preventAutoHideAsync()`, `SafeAreaProvider` with `DEFAULT_SAFE_AREA_METRICS`, parallel `HankenGrotesk_600SemiBold` / `Inter_400Regular` / `Inter_600SemiBold` / `JetBrainsMono_400Regular` / `JetBrainsMono_600SemiBold` loading with `fontError` fallback, `AuthProvider` hydration gate, `<StatusBar style="dark" />`, and `<Stack.Protected>` guards) and `src/app/index.tsx` (`<Redirect href={user ? "/kasir" : "/login"} />`).
- Created `src/app/(app)/_layout.tsx` exporting `unstable_settings = { initialRouteName: "(tabs)" }` and rendering `<Slot key={user ? `${user.id}:${user.role}` : "guest"} />` so switching between `owner`/`admin` and `kasir` accounts discards prior screen state and history completely.
- Built `src/app/(app)/(tabs)/_layout.tsx` using JavaScript `<Tabs>` from `expo-router/js-tabs` (`backBehavior="initialRoute"`, `unstable_settings = { anchor: "kasir" }`, `headerShown: false`) with custom `VelocityTabBar` rendering 4 equal-width tabs (`Kasir`, `Produk`, `Pesanan` without fake badge, `Pengaturan`) using Lucide icons (`Calculator`, `Package`, `ReceiptText`, `Settings`), `#ffffff` surface, `1px` `#e2e8f0` top border, `64 + Math.max(insets.bottom, 8)` height, `48px` min-height pressables, `#00478d` 2px top active indicator strip, and `#d6e3ff` rounded-square active icon pill.
- Created `__tests__/routingRbac.test.tsx` (8 integration tests via `expo-router/testing-library` `renderRouter`) verifying SplashScreen hold/font-error fallback, `/api/auth/me` `503` retention vs `403` revocation, unauthenticated `<Stack.Protected>` redirects for `/`, `/kasir`, `/produk`, 4-tab switching + `kasir` read-only vs `admin`/`owner` management banners on `Produk`, offline fail-safe logout modal from `Pengaturan`, and clean `owner` -> `kasir` account switch resets.

## Task Commits

Pending manual user commit (per user instruction).

## Files Created/Modified
- `src/app/_layout.tsx` - Root layout loading Google Fonts, holding SplashScreen until hydration completes, providing `SafeAreaProvider` + `AuthProvider`, and gating `(auth)`/`(app)` via `<Stack.Protected>`.
- `src/app/index.tsx` - Post-hydration root redirect sending authenticated sessions to `/kasir` and unauthenticated sessions to `/login`.
- `src/app/(app)/_layout.tsx` - Authenticated layout keying `<Slot />` by `${user.id}:${user.role}` to guarantee fresh navigation state on account/role switches.
- `src/app/(app)/(tabs)/_layout.tsx` - Velocity Blue 4-tab JS `<Tabs>` Bottom Navigation Bar (`Kasir`, `Produk`, `Pesanan`, `Pengaturan`) with active top bar + `#d6e3ff` icon pill and safe-area clearance.
- `__tests__/routingRbac.test.tsx` - Full `renderRouter` integration test suite covering boot hydration, `<Stack.Protected>`, 4-tab navigation, RBAC policy banners, fail-safe logout, and stack resets.
- `__tests__/setup.ts` - Preserved `SafeAreaInsetsContext` and `SafeAreaFrameContext` from `react-native-safe-area-context` in the Jest mock so `BottomTabView` and `SafeAreaProviderCompat` render cleanly under `renderRouter`.

## Decisions Made
- Implemented `VelocityTabBar` over `expo-router/js-tabs` `<Tabs>` instead of fighting `TabBarIcon`'s fixed `31x28` wrapper so active tabs consistently show both the `2px` `#00478d` top strip and the `48x28` `#d6e3ff` rounded-square icon pill alongside `13px` single-line labels and `Math.max(insets.bottom, 8)` bottom padding.
- Configured explicit `redirectTo="/kasir"` and `redirectTo="/login"` props on the root `<Stack.Protected>` wrappers alongside `<Stack.Screen name="index" />` so protected-route rejections route immediately to the canonical screen.
- Updated `__tests__/setup.ts` `react-native-safe-area-context` mock to spread `jest.requireActual("react-native-safe-area-context")` and wrap `SafeAreaProvider` in `SafeAreaFrameContext.Provider` and `SafeAreaInsetsContext.Provider` after discovering `BottomTabView` consumes `SafeAreaInsetsContext.Consumer` and `SafeAreaProviderCompat` calls `React.use(SafeAreaInsetsContext)`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Preserved `SafeAreaInsetsContext` and `SafeAreaFrameContext` in `__tests__/setup.ts` for `BottomTabView` under `renderRouter`**
- **Found during:** Task 1 / Task 2 integration verification
- **Issue:** Inspecting `expo-router`'s `BottomTabView.js` and `SafeAreaProviderCompat.js` showed `<Tabs>` reads `SafeAreaInsetsContext.Consumer` and `React.use(SafeAreaInsetsContext)`, whereas `__tests__/setup.ts` previously omitted both contexts from its `react-native-safe-area-context` mock.
- **Fix:** Updated `__tests__/setup.ts` to spread `jest.requireActual("react-native-safe-area-context")` and provide `SafeAreaFrameContext.Provider` and `SafeAreaInsetsContext.Provider` inside `SafeAreaProvider` while keeping `SafeAreaView` as `View` for component tests.
- **Files modified:** `__tests__/setup.ts`
- **Verification:** `npx jest`, `npx tsc --noEmit`, and `npx expo lint` all passed (`41/41` tests across 7 suites).
- **Committed in:** Pending manual user commit (per user instruction)

---

**Total deviations:** 1 auto-fixed (1 blocking test-environment context fix)
**Impact on plan:** Necessary for `expo-router`'s JS `<Tabs>` to render inside `expo-router/testing-library`. Zero scope creep.

## Issues Encountered
- Expo Router SDK 58 `TabsClient.d.ts` omits `initialRouteName` from `<Tabs>` props in TypeScript (`Omit<..., "initialRouteName">`); moved tab initial screen selection to `export const unstable_settings = { anchor: "kasir" }` alongside `backBehavior="initialRoute"`, eliminating both the TypeScript error and `backBehavior` console warning.
- Running multiple `renderRouter("./src/app")` mounts concurrently or without prior `unmount()` triggered Expo Router's duplicate `NavigationContainer` error and a 5s Jest timeout under parallel suite execution; isolated one `renderRouter` lifecycle per test case and set `jest.setTimeout(15000)` in `__tests__/routingRbac.test.tsx`.

## User Setup Required

None - no external service configuration required.

## Verification Output Summary

- `npx jest` -> exit `0` (`Test Suites: 7 passed, 7 total`, `Tests: 41 passed, 41 total`, `20.175 s`)
- `npx tsc --noEmit` -> exit `0` (`0` errors)
- `npx expo lint` -> exit `0` (`0` errors, `0` warnings)
- `npx expo config --type public --json` -> exit `0` (SDK `58.0.0`, `userInterfaceStyle: "light"`, `scheme: "tokorejekipos"`, `typedRoutes: true`, `usesCleartextTraffic: true`, `NSAllowsLocalNetworking: true`)
- Token & hygiene audit across all 6 touched files -> `0` hardcoded hex/rgba colors (`hexCount=0`), `0` em-dashes (`emdashCount=0`), `27412` chars (`6853` estimated tokens)
- Sibling backend integrity (`git -C ../Apps_Toko_Rejeki status --short`) -> exit `0`, empty (completely unmodified)

## Next Phase Readiness

- Complete Phase 1 navigation shell, boot gate, Velocity Blue 4-tab bar, and automated Jest/TS/ESLint suites (`41/41` passing) are verified on disk and ready for Plan `01-06` (Physical Device / Emulator Cold-Kill Spike & visual layout backstop).
- No git commits were created; all files remain cleanly on disk for manual user commit.

## Self-Check: PASSED
- Verified all created/modified files exist on disk (`src/app/_layout.tsx`, `src/app/index.tsx`, `src/app/(app)/_layout.tsx`, `src/app/(app)/(tabs)/_layout.tsx`, `__tests__/routingRbac.test.tsx`, `__tests__/setup.ts`).
- Verified `.planning/ROADMAP.md` (`01-05-PLAN.md` `[x]`, `5/6` In Progress), `.planning/STATE.md` (advanced to Plan 6 of 6), and `01-05-SUMMARY.md` updated cleanly without creating any git commit (`actuals.commits: 0`).
- Verified `npx jest` (`41 passed, 41 total` across 7 suites), `npx tsc --noEmit`, `npx expo lint`, and `npx expo config --type public --json` all exited `0` after the final code edit.

---
*Phase: 01-auth-lan-transport-spike-role-protected-shell*
*Completed: 2026-11-18*
