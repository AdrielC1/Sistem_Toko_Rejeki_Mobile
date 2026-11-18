---
phase: 01-auth-lan-transport-spike-role-protected-shell
plan: 04
subsystem: ui
tags: [velocity-blue, logout-modal, rbac, tabs, kasir, produk, pesanan, pengaturan, safe-area, react-native-testing-library]

# Dependency graph
requires:
  - phase: 01-auth-lan-transport-spike-role-protected-shell
    provides: Velocity Blue tokens (TOKENS, ROLE_STYLES, FONT_FAMILY), VelocityPrimitives, RoleBadge, ServerUrlPanel, and AuthContext
provides:
  - Shared TabScreenHeader (SafeAreaView edges=["top"]) and EmptyStateCard reusable UI components
  - Centered LogoutConfirmModal with isSubmitting close-blocking and Mengakhiri Sesi... loading state
  - PengaturanScreen with active staff profile card, role-colored avatar, RoleBadge, 2-line Server URL + ServerUrlPanel, Sesi Lokal Aktif badge, and fail-safe offline Logout trigger
  - KasirScreen with active cashier greeting, RoleBadge, offline-ready auth shell notice, and Buka Pengaturan Server action
  - Role-aware ProdukScreen gating Mode Baca Saja (Kasir) vs Mode Kelola Katalog Aktif without exposing costPrice or mutation CTAs to kasir
  - PesananScreen with Belum Ada Pesanan Tertunda empty state and Ke Layar Kasir action
  - Component test suite (__tests__/tabScreens.test.tsx) covering UI-SPEC E4 states and role-gating
affects: [01-05, 01-06, phase-2, phase-3, phase-4, phase-5]

# Actuals (#2632)
actuals:
  tokens: 9109
  tasks: 2
  commits: 0

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Shared TabScreenHeader wrapping SafeAreaView edges={["top"]} for Expo SDK 58 edge-to-edge status bar clearance across all 4 tab screens
    - Shared EmptyStateCard unifying icon-badge empty placeholder presentation across Produk and Pesanan tabs
    - Strictly separated role-gating branches on ProdukScreen (isReadOnlyCatalog vs canEditProducts, fail-closed when role is null)
    - Mounted-ref guarded LogoutConfirmModal confirmation handler clearing modal safely after AuthContext.logout() offline cleanup

key-files:
  created:
    - src/components/common/TabScreenHeader.tsx
    - src/components/common/EmptyStateCard.tsx
    - src/components/common/LogoutConfirmModal.tsx
    - src/app/(app)/(tabs)/pengaturan.tsx
    - src/app/(app)/(tabs)/kasir.tsx
    - src/app/(app)/(tabs)/produk.tsx
    - src/app/(app)/(tabs)/pesanan.tsx
    - __tests__/tabScreens.test.tsx
  modified: []

key-decisions:
  - "Extracted TabScreenHeader (SafeAreaView edges=['top']) and EmptyStateCard into src/components/common/ to keep all four tab screens DRY and provide a single header extension point for Phase 2 global DB health status."
  - "Rendered flat template string for LogoutConfirmModal body ('Sesi aktif akun ... akan diakhiri dari perangkat ini.') instead of nested Text spans so screen readers and RNTL text queries match reliably."
  - "Added dedicated component suite __tests__/tabScreens.test.tsx in Wave 4 alongside tsc/lint checks to verify role gating, offline fail-safe logout clearing, and cross-tab navigation prior to Plan 01-05 routing integration."

patterns-established:
  - "Tab header pattern: every tab screen starts with TabScreenHeader using TOKENS.colors.surfaceCard, 1px TOKENS.colors.borderSubtle divider, and SafeAreaView edges=['top'] above a #f9f9ff ScrollView padded >=24px at the bottom."
  - "Fail-closed catalog RBAC pattern: ProdukScreen renders Mode Kelola Katalog Aktif strictly when roleCapabilities.canEditProducts is true and Mode Baca Saja (Kasir) strictly when roleCapabilities.isReadOnlyCatalog is true."
  - "Token purity: zero hardcoded hex colors or em-dashes across all tab screens and common modal/header components."

requirements-completed:
  - AUTH-02
  - AUTH-04
  - NAV-01
  - NAV-04

coverage:
  - id: D1
    description: "Centered LogoutConfirmModal with caution box, Mengakhiri Sesi... submission lock, and offline fail-safe AuthContext.logout() clearing SecureStore"
    requirement: "AUTH-04"
    verification:
      - kind: unit
        ref: "__tests__/tabScreens.test.tsx#renders LogoutConfirmModal copy, blocks close while submitting, and triggers callbacks"
        status: pass
      - kind: unit
        ref: "__tests__/tabScreens.test.tsx#renders Pengaturan profile, ServerUrlPanel, Sesi Lokal Aktif, and fail-safe offline logout"
        status: pass
    human_judgment: false
  - id: D2
    description: "PengaturanScreen displaying active user fullName, @username, role-colored avatar, RoleBadge, 2-line wrapped Server URL, Sesi Lokal Aktif badge, and embedded ServerUrlPanel"
    requirement: "AUTH-02"
    verification:
      - kind: unit
        ref: "__tests__/tabScreens.test.tsx#renders Pengaturan profile, ServerUrlPanel, Sesi Lokal Aktif, and fail-safe offline logout"
        status: pass
    human_judgment: false
  - id: D3
    description: "Role-aware ProdukScreen showing Mode Baca Saja (Kasir) exclusively to kasir (zero costPrice or mutation CTAs) and Mode Kelola Katalog Aktif exclusively to admin/owner"
    requirement: "NAV-04"
    verification:
      - kind: unit
        ref: "__tests__/tabScreens.test.tsx#gates Produk between Mode Baca Saja (Kasir) and Mode Kelola Katalog Aktif (Admin/Owner)"
        status: pass
    human_judgment: false
  - id: D4
    description: "KasirScreen active greeting + Buka Pengaturan Server CTA and PesananScreen Belum Ada Pesanan Tertunda + Ke Layar Kasir CTA"
    requirement: "NAV-01"
    verification:
      - kind: unit
        ref: "__tests__/tabScreens.test.tsx#renders Kasir greeting, RoleBadge, and navigates to Pengaturan"
        status: pass
      - kind: unit
        ref: "__tests__/tabScreens.test.tsx#renders Pesanan empty state and navigates to Kasir"
        status: pass
    human_judgment: false
  - id: D5
    description: "Visual layout backstop: long staff names, @username, 2-line Server URLs, edge-to-edge SafeAreaView top clearance, and >=24px ScrollView bottom clearance on physical 360px viewports"
    requirement: "NAV-01"
    verification: []
    human_judgment: true
    rationale: "Visual overflow wrapping, status-bar SafeAreaView inset clearance under Expo SDK 58 edge-to-edge, and >=24px clearance above the bottom tab bar require real device/emulator inspection in Plan 01-06."

# Metrics
duration: 6min
completed: 2026-11-18
status: complete
---

# Phase 1 Plan 04: LogoutConfirmModal and 4 Role-Aware Tab Screens Summary

**Implemented `LogoutConfirmModal` (offline fail-safe logout + submission lock), shared `TabScreenHeader`/`EmptyStateCard`, and all four Velocity Blue role-aware tab screens (`pengaturan.tsx`, `kasir.tsx`, `produk.tsx`, `pesanan.tsx`) verified by 5 new component tests (33 total passing), strict TypeScript, and zero-error Expo ESLint**

## Performance

- **Duration:** 6 min
- **Started:** 2026-11-18T13:51:19Z
- **Completed:** 2026-11-18T13:57:20Z
- **Tasks:** 2
- **Files modified:** 8 files created (`TabScreenHeader.tsx`, `EmptyStateCard.tsx`, `LogoutConfirmModal.tsx`, `pengaturan.tsx`, `kasir.tsx`, `produk.tsx`, `pesanan.tsx`, `__tests__/tabScreens.test.tsx`), plus `.planning/ROADMAP.md`, `.planning/STATE.md`, and this summary

## Accomplishments
- Created `src/components/common/LogoutConfirmModal.tsx` (`rgba(25, 28, 33, 0.55)` backdrop via `TOKENS.colors.modalBackdrop`, `16px`-radius `#ffffff` card, `Keluar dari Akun?`, caution box, `48px` `Tetap Masuk` and `Ya, Akhiri Sesi` / `Mengakhiri Sesi...` buttons, and `onRequestClose` guard while submitting) alongside `src/app/(app)/(tabs)/pengaturan.tsx` (active account card with `48x48` role avatar, `fullName`, `@username`, `RoleBadge`; server card with 2-line wrapped `Alamat Server API`, `Sesi Lokal Aktif` pill, and embedded `ServerUrlPanel`; destructive `Keluar dari Akun` action wired to fail-safe `AuthContext.logout()`).
- Created `src/components/common/TabScreenHeader.tsx` (`SafeAreaView` `edges={["top"]}`, `#ffffff` header, `1px` `#e2e8f0` divider, `24px` `#00478d` icon + `20px` `HankenGrotesk_600SemiBold` title) and `src/components/common/EmptyStateCard.tsx` to eliminate header and empty-state layout duplication across tab screens.
- Implemented `src/app/(app)/(tabs)/kasir.tsx` (cashier greeting, `RoleBadge`, offline shell notice, `Buka Pengaturan Server` -> `router.push("/pengaturan")`), `src/app/(app)/(tabs)/produk.tsx` (`Mode Baca Saja (Kasir)` amber banner for `kasir` vs `Mode Kelola Katalog Aktif` Velocity Blue pill for `admin`/`owner`, zero `costPrice` or mutation CTAs exposed, `Katalog Produk Belum Tersinkronisasi` -> `router.push("/pengaturan")`), and `src/app/(app)/(tabs)/pesanan.tsx` (`Belum Ada Pesanan Tertunda` -> `router.push("/kasir")`).
- Added `__tests__/tabScreens.test.tsx` verifying all E4 UI states, `kasir` vs `admin`/`owner` RBAC isolation, offline fail-safe logout clearing `SecureStore`, and cross-tab navigation calls.

## Task Commits

Pending manual user commit (per user instruction).

## Files Created/Modified
- `src/components/common/TabScreenHeader.tsx` - Shared top header with `SafeAreaView` `edges={["top"]}`, `TOKENS.colors.surfaceCard`, `1px` `borderSubtle` divider, and `24px` primary Lucide icon + `20px` Heading.
- `src/components/common/EmptyStateCard.tsx` - Shared Velocity Blue placeholder card with `48x48` icon badge, centered heading/description, and full-width action slot.
- `src/components/common/LogoutConfirmModal.tsx` - Centered confirmation modal blocking close during `isSubmitting` (`Mengakhiri Sesi...`) and triggering `onConfirm` for fail-safe logout.
- `src/app/(app)/(tabs)/pengaturan.tsx` - Settings hub displaying active user profile card, saved Server URL + `Sesi Lokal Aktif` + `ServerUrlPanel`, and `Keluar dari Akun` modal integration.
- `src/app/(app)/(tabs)/kasir.tsx` - Cashier screen displaying active staff greeting, `RoleBadge`, offline readiness banner, and `Buka Pengaturan Server` navigation CTA.
- `src/app/(app)/(tabs)/produk.tsx` - Role-gated catalog screen showing `Mode Baca Saja (Kasir)` for `kasir` vs `Mode Kelola Katalog Aktif` for `admin`/`owner` and empty-state CTA to `/pengaturan`.
- `src/app/(app)/(tabs)/pesanan.tsx` - Pending orders screen displaying `Belum Ada Pesanan Tertunda` empty card and `Ke Layar Kasir` navigation CTA to `/kasir`.
- `__tests__/tabScreens.test.tsx` - 5 component tests covering `LogoutConfirmModal`, `PengaturanScreen`, `KasirScreen`, `ProdukScreen` (`kasir`/`admin`/`owner`), and `PesananScreen`.

## Decisions Made
- Extracted `TabScreenHeader` and `EmptyStateCard` into `src/components/common/` rather than repeating identical `SafeAreaView` header and empty-card styles across the 4 tab screens, while preparing a clean `rightSlot` on `TabScreenHeader` for Phase 2's global DB health status indicator.
- Rendered flat template copy inside `LogoutConfirmModal` (`Sesi aktif akun ${displayUsername} akan diakhiri dari perangkat ini.`) instead of nested `<Text>` spans for consistent screen-reader output and deterministic React Native Testing Library text matching.
- Added `__tests__/tabScreens.test.tsx` in Wave 4 so Plan `01-04` deliverables have immediate automated component coverage ahead of Plan `01-05`'s `renderRouter` integration suite (`__tests__/routingRbac.test.tsx`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Code Quality & Testability] Extracted shared `TabScreenHeader` and `EmptyStateCard` and added Wave 4 component suite `__tests__/tabScreens.test.tsx`**
- **Found during:** Tasks 1 and 2
- **Issue:** All four tab screens share an identical SDK 58 edge-to-edge `SafeAreaView` header contract, and `produk.tsx` / `pesanan.tsx` share identical empty-card styling; additionally, Plan `01-04` lacked a dedicated Wave 4 component test file before Wave 5 `routingRbac.test.tsx`.
- **Fix:** Extracted `src/components/common/TabScreenHeader.tsx` and `src/components/common/EmptyStateCard.tsx`, and added `__tests__/tabScreens.test.tsx` (5 tests covering `LogoutConfirmModal` and all 4 screens).
- **Files modified:** `src/components/common/TabScreenHeader.tsx`, `src/components/common/EmptyStateCard.tsx`, `__tests__/tabScreens.test.tsx`
- **Verification:** `npx jest`, `npx tsc --noEmit`, and `npx expo lint` all exited `0` (33/33 tests passing across 6 suites).
- **Committed in:** Pending manual user commit (per user instruction)

---

**Total deviations:** 1 auto-fixed (DRY structural extraction + Wave 4 component verification)
**Impact on plan:** Zero scope creep; improves maintainability for Phase 2 header status and guarantees E4 screen behavior prior to Plan `01-05`.

## Issues Encountered
- Initial run of `__tests__/tabScreens.test.tsx` threw `Found multiple elements with text: Kasir` on `KasirScreen` because both `TabScreenHeader` (`"Kasir"`) and `RoleBadge` (`"Kasir"`) render `"Kasir"` simultaneously when authenticated as `kasir`; updated the test assertion to scope queries with `within(screen.getByTestId("kasir-header"))` and `within(screen.getByTestId("kasir-role-badge"))`.

## User Setup Required

None - no external service configuration required.

## Verification Output Summary

- `npx jest` -> exit `0` (`Test Suites: 6 passed, 6 total`, `Tests: 33 passed, 33 total`, `8.599 s`)
- `npx tsc --noEmit` -> exit `0` (`0` errors)
- `npx expo lint` -> exit `0` (`0` errors, `0` warnings)
- Token & hygiene audit across all 8 created files -> `0` hardcoded hex/rgba colors (`hex=0`), `0` em-dashes (`emdash=0`), `0` `costPrice` exposures on `ProdukScreen`, `36436` chars (`9109` estimated tokens)
- Sibling backend integrity (`git -C ../Apps_Toko_Rejeki status --short`) -> empty (completely unmodified)

## Next Phase Readiness

- `LogoutConfirmModal` and all four Velocity Blue tab screens (`kasir`, `produk`, `pesanan`, `pengaturan`) are implemented, tested, and ready for Plan `01-05` (`_layout.tsx` Splash/`<Stack.Protected>` boot gate, `index.tsx` redirect, keyed `(app)/_layout.tsx`, 4-tab JS `<Tabs>` bar, and `__tests__/routingRbac.test.tsx`).
- No git commits were created; all files remain cleanly on disk for manual user commit.

## Self-Check: PASSED
- Verified all 8 created files exist on disk (`src/components/common/TabScreenHeader.tsx`, `src/components/common/EmptyStateCard.tsx`, `src/components/common/LogoutConfirmModal.tsx`, `src/app/(app)/(tabs)/pengaturan.tsx`, `src/app/(app)/(tabs)/kasir.tsx`, `src/app/(app)/(tabs)/produk.tsx`, `src/app/(app)/(tabs)/pesanan.tsx`, `__tests__/tabScreens.test.tsx`).
- Verified `.planning/ROADMAP.md` (`01-04-PLAN.md` `[x]`, `4/6` In Progress), `.planning/STATE.md` (advanced to Plan 5 of 6), and `01-04-SUMMARY.md` updated cleanly without creating any git commit (`actuals.commits: 0`).
- Verified `npx jest`, `npx tsc --noEmit`, and `npx expo lint` all exited `0` after the final code edit (`33 passed, 33 total` across 6 suites).

---
*Phase: 01-auth-lan-transport-spike-role-protected-shell*
*Completed: 2026-11-18*
