<!-- GSD:project-start source:PROJECT.md -->

## Project

**Apps Toko Rejeki Mobile**

Apps Toko Rejeki Mobile adalah aplikasi kasir (POS) mobile mandiri berbasis **Expo + Expo Router + TypeScript** yang mereferensikan desain antarmuka mobile dan menghubungkan langsung ke layanan API (Web Service) dari proyek web **Apps Toko Rejeki**. Aplikasi ini digunakan oleh staf toko (**Kasir**, **Admin**, dan **Owner**) untuk melayani transaksi harian, memantau katalog produk beserta harga grosir, mengelola nota tertunda secara lokal, serta mengakses pengaturan dan profil aplikasi lewat navigasi Bottom Navigation Bar 4 tab.

**Core Value:** Transaksi kasir dan pengelolaan katalog produk Toko Rejeki berjalan cepat dan konsisten di perangkat mobile—tetap dapat dipakai saat koneksi terputus melalui persistensi sesi dan sinkronisasi katalog lokal, serta tersinkron dengan server API Toko Rejeki saat online.

### Constraints

- **Tech Stack**: React Native dengan **Expo + Expo Router + TypeScript** — wajib menggunakan stack ini untuk aplikasi mobile mandiri
- **Backend Compatibility**: Mengonsumsi endpoint API yang sudah ada di `Apps_Toko_Rejeki`; setiap perubahan yang diperlukan pada backend wajib dikomunikasikan ke user terlebih dahulu sebelum dilakukan
- **Rubric Compliance**: Wajib memenuhi 5 kriteria: (1) API Web Service buatan sendiri, (2) Bottom Navigation Bar, (3) minimal 5 halaman, (4) minimal 2 halaman utama ber-list dengan klik item menuju halaman detail, (5) 1 halaman Profile/About aplikasi
- **Offline Resilience**: Sesi login dan katalog lokal harus tetap terbaca saat offline, dan nota tertunda pada `Pesanan Aktif` tersimpan persisten di perangkat

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Executive Stack Recommendation

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **Expo SDK** | `~58.0.25` | Managed React Native toolchain, Metro bundler, Expo Go runtime, CNG prebuild | Current stable SDK (Oct 2026), aligns with Play Store / App Store Expo Go on Windows dev machines, includes prebuilt `expo-modules-core` and fast fingerprinting. | MEDIUM |
| **React Native & React** | `0.88.1` / `19.3.0` | Native UI runtime (New Architecture mandatory) & React 19 UI | Bundled by SDK 58; `react@19.3.0` aligns directly with `Apps_Toko_Rejeki` web (`react@^19.3.1`), enabling clean TypeScript DTO parity and React 19 patterns. | MEDIUM |
| **Expo Router** | `~58.0.31` | File-based navigation (`Tabs` bottom bar + `Stack` detail/settings push routes) | Native support for `(tabs)` + nested `Stack` screens (`Produk` → `Detail Produk`, `Pesanan` → `Detail Pesanan`, `Pengaturan` sub-screens) and typed routes (`typedRoutes: true`). Use JS `Tabs` (not `NativeTabs`) for full Velocity Blue styling & badge control. | MEDIUM |
| **TypeScript** | `~5.9` (`^5`, SDK 58 strict) | End-to-end static typing & Strict TypeScript API | SDK 58 / RN `0.88` enables Strict TypeScript API by default; prevents runtime crashes on cart pricing, wholesale tiers, and API contracts. | MEDIUM |
| **expo-sqlite** | `~58.0.17` | Relational SQLite (`SQLiteProvider`) for catalog/sync + `expo-sqlite/kv-store` for held orders | Bundled in Expo Go. Relational SQLite handles SKU/barcode/category filtering and 5-second `/api/sync/delta` upserts/soft-deletes in transactions; `expo-sqlite/kv-store` exposes synchronous `getItemSync`/`setItemSync` eliminating async cold-boot flicker. | MEDIUM |
| **expo-secure-store** | `~58.0.3` | Encrypted Keychain / Keystore storage for session cookie & offline user snapshot | Native OS encryption for `pos_session` HMAC token and `{ id, username, fullName, role }` offline fallback (~400–600 bytes total, well below the ~2048-byte platform threshold). Works in Expo Go. | MEDIUM |
| **Zustand** | `^5.1.0` | Client state for multi-tab cart (`Pesanan Aktif`), auth state, and sync status | Selector-based subscriptions isolate re-renders during rapid POS quantity/numpad taps; `persist` middleware with synchronous `expo-sqlite/kv-store` hydrates held orders on frame 1. | MEDIUM |
| **`StyleSheet.create` + Design Tokens** | Built-in (`react-native@0.88.1`) | Velocity Blue styling system (`src/theme/tokens.ts`) | Zero Metro/Babel plugin risk on SDK 58 (`0.88.1`), fastest list-item layout performance, strict TS type safety for colors, 8px spacing grid, 48px touch targets, and elevation tokens from `design.md`. | MEDIUM |

### Supporting Libraries

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| **`expo/fetch`** (built into `expo`) | `~58.0.25` | WinterCG-compliant HTTP client (default global `fetch` in SDK 58) | All REST calls to `/api/auth/*`, `/api/sync/*`, `/api/products/*`, `/api/print`, `/api/wa-log`, `/api/settings`, `/api/users`, `/api/categories`, `/api/units`. Use with `credentials: "omit"` when injecting stored `Cookie` headers manually. | MEDIUM |
| **lucide-react-native** + **react-native-svg** | `^1.74.0` + `15.16.0` | Crisp SVG icon set matching web app (`lucide-react@^1.74.0`) | All tab icons, POS actions, status indicators, and settings items. Exact 1:1 icon-name parity with the Next.js web app; `react-native-svg@15.16.0` is bundled in Expo Go. | MEDIUM |
| **@shopify/flash-list** | `2.3.2` | High-performance virtualized list/grid for product catalog & active orders | Pure-JS New Architecture v2 rewrite bundled in SDK 58 (`estimatedItemSize` removed). Use on `Kasir` catalog grid/list and `Produk` list when catalog scales to hundreds/thousands of SKUs. | MEDIUM |
| **expo-network** | `~58.0.5` | OS network state hook (`useNetworkState()`) & listener | Instant detection of Wi-Fi/airplane-mode loss; pair with `GET /api/health` ping to distinguish "device offline" vs "shop LAN server offline". | MEDIUM |
| **expo-font** + `@expo-google-fonts/*` | `~58.0.12` + `0.4.x` | Custom typography from `design.md` (`Hanken Grotesk`, `Inter`, `JetBrains Mono`) | Load `@expo-google-fonts/hanken-grotesk` (`0.4.3`), `@expo-google-fonts/inter` (`0.4.2`), and `@expo-google-fonts/jetbrains-mono` (`0.4.1`) at splash screen boot so prices and SKUs match Velocity Blue typography. | MEDIUM |
| **expo-splash-screen** + **expo-status-bar** + **expo-system-ui** | `~58.0.14` / `~58.0.5` / `~58.0.7` | Splash hold during font/SQLite/auth boot & status bar styling | Hold native splash via `SplashScreen.preventAutoHideAsync()` until fonts, SQLite schema, and `SecureStore` auth hydration finish. | MEDIUM |
| **expo-haptics** | `~58.0.8` | Tactile feedback for POS actions | Subtle selection/impact feedback when tapping catalog items, numpad digits, or completing checkout (`Haptics.impactAsync`). Works in Expo Go. | MEDIUM |
| **zod** | `^4.6.7` | Runtime schema validation for API responses, env/server URL config, and forms | Validate stored server base URL, product CRUD forms (`admin`/`owner`), and sync payloads at runtime without bloating bundle size. | MEDIUM |
| **expo-clipboard** | `~58.0.4` | Copy SKU/barcode or receipt summary | Helpful utility on Product Detail and Receipt Preview screens; bundled in Expo Go. | MEDIUM |
| **react-native-reanimated** + **react-native-worklets** + **react-native-gesture-handler** | `4.7.1` / `0.13.0` / `~3.3.0` | Smooth drawer/sheet/pill transitions & Expo Router navigation gestures | Required peers of `expo-router@58`; bundled in Expo Go. Use `react-native-keyboard-controller` (`1.22.7`, SDK 58 bundled) if cash/discount modals need precision keyboard avoidance. | MEDIUM |
| **expo-dev-client** (optional / prebuild phase) | `~58.0.20` | Custom Development Build binary | Add only when moving from Expo Go to standalone APK/IPA builds, LAN mDNS discovery, or custom native modules. | MEDIUM |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **Expo CLI (`npx expo`)** | Dev server, `npx expo install` version alignment, `expo-doctor` | Always install native/Expo packages via `npx expo install` so versions stay locked to SDK 58's `bundledNativeModules.json`. |
| **TypeScript (`tsc --noEmit`)** | Compile-time type verification | Enable `"strict": true` and `"expo/tsconfig.base"` in `tsconfig.json`; verify zero errors in CI/phase checks. |
| **ESLint (`eslint-config-expo@~58.0.4`)** | Linting for React 19, Hooks, and Expo Router conventions | First-party SDK 58 ESLint flat config. |
| **Jest + `jest-expo@~58.0.14` + `@testing-library/react-native@^14.1.0`** | Unit & component testing (pricing tiers, SQLite delta sync, Zustand cart, auth guards) | `@testing-library/react-native >= 14.0.0` is an explicit peer dependency of `expo-router@58.0.31`; mock `expo-sqlite` and `expo-secure-store` in unit tests for cart/wholesale pricing logic. |
| **EAS CLI (`eas-cli`)** | Cloud builds for Android APK/AAB and iOS from Windows | Essential on Windows since local Xcode/iOS builds are unavailable; Android APK preview builds can run in cloud or locally with Android SDK. |

## Installation

# Bootstrap SDK 58 project with Expo Router + TypeScript

# Core Expo modules (versions automatically aligned to SDK 58)

# Pure-JS libraries & Velocity Blue Google Fonts

# Dev & Testing dependencies

## Alternatives Considered

| Category | Recommended | Alternative | When to Use Alternative |
|----------|-------------|-------------|-------------------------|
| **UI Styling** | Typed Velocity Blue `tokens.ts` + `StyleSheet.create` | **NativeWind `4.2.7`** (`tailwindcss@^3.4.19`) | Use if the developer strongly prioritizes writing Tailwind `className` utilities over `StyleSheet` AND verifies in Phase 1 that `nativewind@4.2.7` + `react-native-css-interop@0.2.7` bundles cleanly under SDK 58 (`rn@0.88.1` + `reanimated@4.7.1`) in Expo Go. Note that v4.2.7 uses Tailwind v3 config (`tailwind.config.js`), unlike the web app's Tailwind v4. |
| **UI Styling (TW v4)** | Typed Velocity Blue `tokens.ts` + `StyleSheet.create` | **Uniwind `1.13.2`** (OSS) | Use if Tailwind CSS v4 CSS-first syntax (`@theme`, `@import "tailwindcss"`) is a strict requirement while staying Expo Go compatible. Must stay on latest (`>=1.13.2`) for the RN `0.88` `AssetRegistry` fix. |
| **HTTP Cookie / Auth** | `expo/fetch` + manual `Set-Cookie` capture in `expo-secure-store` + `Cookie` header (`credentials: "omit"`) | **Backend `Authorization: Bearer` support** (additive change to `Apps_Toko_Rejeki/apps/src/lib/apiAuth.ts` & `login/route.ts`) | **Recommended upgrade (with user approval per `PROJECT.md`)** if Phase 1 testing on real Android/iOS devices shows `Set-Cookie` on `HttpOnly` responses being stripped or mangled by native networking. |
| **HTTP Cookie / Auth** | Manual `Cookie` + `SecureStore` | **`@preeternal/react-native-cookie-manager@7.0.0`** or **`expo-cookies@1.0.2`** | Only if you commit to **Development Builds (`expo-dev-client`) from Day 1** (disabling Expo Go) and need WebView + native HTTP cookie jar synchronization. |
| **Local Storage (Catalog)** | Direct typed SQLite repository over `expo-sqlite` | **Drizzle ORM (`0.45.4` / `1.0.0-rc.5`) + `drizzle-kit`** | Use if the mobile database expands beyond ~8–10 relational tables (e.g., if mobile adds full offline transaction queues, audit logs, and local reporting requiring complex relational joins). |
| **Local Storage (KV)** | `expo-sqlite/kv-store` | **`react-native-mmkv@4.3.2`** (`+ react-native-nitro-modules`) | Use when switching away from Expo Go to custom Development Builds and needing maximum C++ JSI throughput for massive KV blobs (>100KB/write). |
| **Server State / Caching** | `expo-sqlite` local-first sync engine + lightweight typed API client | **TanStack Query (`@tanstack/react-query@^5.107.1`)** | Use if future milestones add read-heavy online-only dashboards (sales analytics, multi-branch reports) that benefit from stale-while-revalidate query caching rather than SQLite delta sync. |
| **Bottom Navigation** | `expo-router` `Tabs` (React Navigation JS tabs) | **`expo-router/native-tabs`** | Use only if you want OS-default iOS 27 Liquid Glass / Android native bottom bar chrome and SF Symbols instead of Velocity Blue custom surface/borders and Lucide icons. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **`@react-native-cookies/cookies`** | Officially deprecated and relies on the legacy React Native bridge; breaks compilation under SDK 58's mandatory New Architecture. | `expo/fetch` (`credentials: "omit"`) + `expo-secure-store` (or Bearer fallback on backend; or `@preeternal/react-native-cookie-manager@7.0.0` only in custom Dev Builds). |
| **`nativewind@5.0.0-rc.1`** | Still a pre-release (`rc.1`) dependent on `react-native-css@3.1.0-rc.1` and requires `@expo/metro-config@58>lightningcss: 1.30.1` overrides to avoid Metro deserialization errors. | `StyleSheet.create` + typed Velocity Blue tokens (or `nativewind@4.2.7` if Tailwind classes are mandatory and smoke-tested). |
| **`@react-native-async-storage/async-storage`** | Extra native dependency (`v3.1.1` on npm vs `v2.2.0` pinned in SDK 58 `bundledNativeModules.json`) that only supports asynchronous reads, causing cart/session hydration flashes. | `expo-sqlite/kv-store` (bundled in `expo-sqlite`, zero extra native dep, synchronous `getItemSync`/`setItemSync`). |
| **`react-native-mmkv` / `react-native-unistyles` v3** (for Expo Go workflow) | Both depend on C++ Nitro Modules (`react-native-nitro-modules`), which **crash in Expo Go** and force local Android/iOS native builds or EAS Dev Client before any UI testing on Windows. | `expo-sqlite/kv-store` + `StyleSheet.create`. |
| **WatermelonDB** | Heavy JSI/native setup requiring custom dev builds, decorator/babel configuration, and overkill sync primitives when `Apps_Toko_Rejeki` already provides `/api/sync/full` and `/api/sync/delta`. | `expo-sqlite@~58.0.17` relational tables + transactions. |
| **Implicit `fetch` cookie persistence (`credentials: "include"` alone)** | Android `OkHttp` and iOS `NSURLSession` cookie persistence across process kills, plain `http://` LAN servers, and restarts is unreliable without manual persistence; mixing native cookie jars with manual `Cookie` headers causes header overwrites. | Explicit `pos_session` capture into `expo-secure-store` + `Cookie` header + `credentials: "omit"`. |
| **Storing catalog JSON or held orders inside `expo-secure-store`** | iOS/Android Keychain/EncryptedSharedPreferences reject or fail unpredictably above ~2048 bytes per key. | Store only compact session cookie + user snapshot (~400–600 bytes) in `expo-secure-store`; store catalog in `expo-sqlite` tables and held orders in `expo-sqlite/kv-store`. |
| **`@gorhom/bottom-sheet` < `5.1.8` (or unnecessary heavy sheet dependencies)** | Reanimated 4 removed `restDisplacementThreshold` / `restSpeedThreshold`, causing older `@gorhom/bottom-sheet` builds to lag ~200ms on dismiss/backdrop callbacks. | Native `Modal` / Expo Router `presentation: 'modal'` / `formSheet` (or `@gorhom/bottom-sheet@^5.2.14` only if drag-snap sheets are explicitly needed). |
| **`InteractionManager` / `ImageBackground` / `StatusBar.backgroundColor`** | Removed or deprecated in Expo SDK 58 / React Native `0.88` (with edge-to-edge enabled). | `requestIdleCallback`, standard `View` + absolute `Image`, and `expo-status-bar` / `react-native-safe-area-context`. |

## Stack Patterns by Variant

### 1. Auth & Cookie Persistence Verification Gate (Phase 1 Critical Path)

- **Context from `Apps_Toko_Rejeki`:**
- **Pattern:**

### 2. Three-Tier Offline Persistence Model

- **Tier 1 (`expo-sqlite` relational):** Tables `products`, `categories`, `units`, `sync_meta`, `sync_audit` (mirroring `Apps_Toko_Rejeki/apps/src/lib/offlineDb.ts`). Wrap `/api/sync/full` and `/api/sync/delta` batches inside `db.withTransactionAsync(...)` with `PRAGMA journal_mode = WAL;` and SQLite indexes on `sku`, `barcode`, `category_id`, and `name`. Store nested `unitConversions` + `wholesaleTiers` as JSON text alongside indexed scalar columns so wholesale price calculation (`calculateEffectiveUnitPrice`) stays identical to web `POSCartContext.tsx`.
- **Tier 2 (`expo-sqlite/kv-store` + Zustand `persist`):** Store `toko_rejeki_pos_tabs_v1` (multi-tab held orders `Nota #1..N`, `activeTabId`) and `server_base_url` / `store_settings` cache using a synchronous `StateStorage` adapter (`Storage.getItemSync`, `Storage.setItemSync`, `Storage.removeItemSync`). Zero hydration race conditions.
- **Tier 3 (`expo-secure-store`):** Store `auth_session_cookie` and `auth_user_snapshot`. On offline cold start, keep the user logged in from `auth_user_snapshot` until an online `GET /api/auth/me` explicitly returns `401` or `403` (matching `Apps_Toko_Rejeki/apps/src/context/AuthContext.tsx`).

### 3. Currency & Date Formatting Under Hermes (`id-ID` / `IDR`)

- Hermes in RN `0.88` supports ECMA-402 `Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" })`, **however** ICU formatting can vary slightly between Android and iOS (`"Rp 150.000"` vs `"Rp150.000"`).
- **Recommended Pattern:** Write a deterministic pure-TS Rupiah formatter (`formatRupiah`) using integer grouping or `Intl.NumberFormat("id-ID")` normalized to consistent `"Rp 150.000"` display (matching `Apps_Toko_Rejeki/apps/src/lib/format.ts`), avoiding heavyweight `@formatjs` polyfill bundles unless full locale date/pluralization formatting diverges.

### 4. Role-Based Bottom Tabs + List → Detail Routes (Rubric Compliance)

- Keep all 4 primary tabs (`Kasir`, `Produk`, `Pesanan`, `Pengaturan`) rendered in `app/(tabs)/_layout.tsx` via `expo-router` `Tabs` for every role (`kasir`, `admin`, `owner`), matching `PROJECT.md` ("Tab `Produk` tampil *read-only* untuk peran `kasir`").
- Put detail and owner-management routes on a parent/nested `Stack` (e.g., `produk/[id]`, `pesanan/[id]`, `pengaturan/toko`, `pengaturan/akun`, `pengaturan/kategori-satuan`, `pengaturan/printer`, `pengaturan/sinkronisasi`, `pengaturan/tentang`) so tab bar visibility and back-navigation stay clean and exceed the 5-page + 2 list→detail rubric minimums.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `expo@~58.0.25` | `react@19.3.0`, `react-native@0.88.1` | SDK 58 enforces New Architecture (`newArchEnabled` always on) and Strict TypeScript API. |
| `expo-router@~58.0.31` | `react-native-screens@~4.30.1`, `react-native-safe-area-context@~5.11.1`, `react-native-gesture-handler@~3.3.0`, `@testing-library/react-native@>=14.0.0` | Requires `react-native-reanimated@4.7.1` + `react-native-worklets@0.13.0` installed via `npx expo install`. |
| `lucide-react-native@^1.74.0` | `react@19.3.0`, `react-native-svg@15.16.0` | `lucide-react-native@1.74.0` peerDeps explicitly allow `react: ^19.0.0` and `react-native-svg: ^15.0.0`. Matches web app's `lucide-react@^1.74.0`. |
| `@shopify/flash-list@2.3.2` | `react-native@0.88.1` (New Architecture) | FlashList v2 works **only** on New Architecture and removes `estimatedItemSize`; works in Expo Go. |
| `expo-sqlite@~58.0.17` | `zustand@^5.1.0` | `expo-sqlite/kv-store` synchronous API integrates directly with Zustand v5 `createJSONStorage`. Works in Expo Go. |
| `nativewind@4.2.7` *(if chosen as alt)* | `tailwindcss@^3.4.19`, `react-native-reanimated@>=3.6.2` + `react-native-worklets` | Targets Tailwind v3 + SDK 57; test on SDK 58 before committing. Do **not** mix Tailwind v4 (`4.3.5`) with NativeWind v4. |

## Sources

- **Live npm registry (`npm view <pkg> dist-tags / peerDependencies`):** Verified exact versions (`expo@58.0.25`, `expo-router@58.0.31`, `react-native@0.88.1`, `react@19.3.0/19.3.1`, `expo-sqlite@58.0.17`, `expo-secure-store@58.0.3`, `expo-network@58.0.5`, `zustand@5.1.0`, `lucide-react-native@1.74.0`, `@shopify/flash-list@2.3.3/2.3.2`, `nativewind@4.2.7` vs `5.0.0-rc.1`, `uniwind@1.13.2`, `@testing-library/react-native@14.1.0`) — **Confidence: MEDIUM** (verified against official registry).
- **Expo SDK 58 Bundled Native Modules (`unpkg.com/expo@58.0.25/bundledNativeModules.json`):** Verified exact SDK 58 pinned native dependency matrix and Expo Go compatibility — **Confidence: MEDIUM** (primary package manifest).
- **Official Expo Documentation (`docs.expo.dev` via `search_web`):** Verified Expo SDK 58 release notes (RN 0.88, React 19.3, Strict TS, `expo-font` variable fonts, `InteractionManager` removal), `expo-sqlite` (`SQLiteProvider` + `expo-sqlite/kv-store`), `expo-secure-store` (~2048-byte native limit guidance), `expo-network` (`useNetworkState`), `expo-router` (`Tabs` vs `native-tabs`), and `expo/fetch` WinterCG documentation — **Confidence: MEDIUM**.
- **Cookie & Auth Handling (`github.com/expo/expo`, `better-auth.com`, `npmjs.com` via `search_web`):** Verified `expo/fetch` `credentials: "omit"` + `Set-Cookie` + `SecureStore` pattern, `headers.getSetCookie()`, and deprecation of `@react-native-cookies/cookies` — **Confidence: MEDIUM**.
- **Styling Ecosystem (`nativewind.dev`, `github.com/nativewind/nativewind`, `uniwind.dev` via `search_web`):** Verified NativeWind `4.2.7` (SDK 57 / TW v3), `5.0.0-rc.1` (`lightningcss` Metro override), and Uniwind `1.13.2` (RN `0.88` `AssetRegistry` fix) — **Confidence: MEDIUM**.
- **Existing Backend & Design System Inspection (`Apps_Toko_Rejeki`):** Directly read `apps/package.json`, `design.md`, `src/middleware.ts`, `src/lib/session.ts`, `src/lib/apiAuth.ts`, `src/lib/auth.ts`, `src/lib/offlineDb.ts`, `src/context/AuthContext.tsx`, `src/context/POSCartContext.tsx`, `src/app/api/auth/*`, `src/app/api/sync/*`, `src/app/api/products/route.ts`, `src/app/api/print/route.ts`, and `src/app/api/wa-log/route.ts`.

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.agents/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:user-override -->

## GSD Workflow Policy (Opsional / Atas Instruksi User)

Penggunaan workflow GSD **tidak wajib** dijalankan sebelum menggunakan `Edit`, `Write`, atau tool pengubah file lainnya.

- Agent dapat langsung mengerjakan perubahan kode, migrasi, konfigurasi, atau perbaikan secara langsung sesuai permintaan user tanpa harus memulai command GSD terlebih dahulu.
- Workflow dan command GSD (`/gsd-fast`, `/gsd-quick`, `/gsd-debug`, `/gsd-execute-phase`, `/gsd-plan-phase`, dll.) **hanya digunakan apabila diminta atau diinstruksikan langsung oleh user**.
- Aturan proyek lainnya pada dokumen ini (seperti tech stack, kompatibilitas backend `Apps_Toko_Rejeki`, kepatuhan rubrik, dan ketahanan offline) tetap berlaku.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
