# Phase 1: Auth, LAN Transport Spike & Role-Protected Shell - Research

**Researched:** 2026-11-18
**Domain:** Expo SDK 58 + Expo Router (`Stack.Protected`, 4-Tab RBAC Shell), `expo/fetch` Cookie Transport over LAN HTTP/HTTPS, `expo-secure-store`, `expo-build-properties` / iOS ATS, and `Apps_Toko_Rejeki` Auth API Contracts
**Confidence:** MEDIUM (HIGH for `Apps_Toko_Rejeki` backend contracts, SDK 58 package manifests, and `expo/fetch` / `expo-router` source inspection; MEDIUM for physical Android/iOS Expo Go `Set-Cookie` survival pending on-device spike execution)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
#### Server URL & Connectivity (`AUTH-02`)
- **D-01**: Layar Login menyediakan panel **"Alamat Server API"** yang dapat dibuka/tutup (collapsible) untuk mengubah dan menyimpan URL server (`http://192.168.x.x:3000` atau HTTPS tunnel) beserta hint helper (`http://10.0.2.2:3000` untuk Android Emulator / IP LAN PC toko).
- **D-02**: Panel Server URL menyertakan tombol **"Tes Koneksi"** yang memanggil `GET /api/settings` atau `GET /api/health` untuk memverifikasi keterjangkauan server sebelum login.

#### Session & Cookie Transport Strategy (`AUTH-03`)
- **D-03**: Autentikasi menangkap cookie `pos_session` dari header `Set-Cookie` lewat `expo/fetch`, menyimpannya bersama snapshot profil pengguna (`{ id, username, fullName, role }`) ke `expo-secure-store`, dan mengirimkannya pada setiap request API lewat header `Cookie` dengan `credentials: "omit"`.
- **D-04**: Revalidasi `GET /api/auth/me` saat aplikasi dibuka online hanya menghapus sesi lokal bila server membalas `401` atau `/api/auth/me` membalas `403` (akun nonaktif/token dicabut); error jaringan atau `5xx` tetap mempertahankan sesi lokal agar staf tetap bisa masuk mode offline.
- **D-05**: Apabila hasil uji cold-kill pada perangkat fisik menunjukkan OS memblokir pembacaan `Set-Cookie` `httpOnly`, agen wajib berhenti dan **berkonsultasi dengan pengguna terlebih dahulu** sebelum mengajukan perubahan backend pada `Apps_Toko_Rejeki` (mis. fallback `Authorization: Bearer`).

#### Login UI & 4-Tab RBAC Shell (`AUTH-01`, `AUTH-04`, `NAV-01`, `NAV-04`)
- **D-06**: Layar Login mengadaptasi desain kartu putih *Velocity Blue* dari `Apps_Toko_Rejeki/apps/src/app/login/page.tsx` dengan logo/inisial `TR` dan nama toko (dimuat dari cache lokal atau `GET /api/settings`), toggle tampil/sembunyi kata sandi, banner error jelas, serta countdown timer saat menerima HTTP `429`.
- **D-07**: Setelah autentikasi berhasil, pengguna masuk ke Bottom Navigation Bar **4 tab** (`Kasir`, `Produk`, `Pesanan`, `Pengaturan`) menggunakan Expo Router `<Stack.Protected>` yang di-key oleh `user.id:user.role` agar pergantian akun mereset stack navigasi secara bersih.
- **D-08**: Keempat tab tetap tampil untuk semua peran (`kasir`, `admin`, `owner`); tab `Produk` menampilkan badge/banner penanda mode *read-only* saat login sebagai `kasir`, sementara tab `Pengaturan` di Phase 1 sudah memuat kartu profil user aktif, badge role, info Server URL, dan tombol **Keluar** dengan modal konfirmasi (`POST /api/auth/logout` fail-safe offline). Tab `Kasir`, `Produk`, dan `Pesanan` menampilkan kerangka placeholder bersih siap isi untuk Phase 2–4.

#### Expo Runtime & Native Networking (`app.config.ts`)
- **D-09**: Proyek dibuat menggunakan **Expo SDK 58** dengan dependensi yang 100% berjalan di **Expo Go** selama Phase 1–2 untuk iterasi cepat, sekaligus mengonfigurasi `app.config.ts` (`expo-build-properties` dengan `usesCleartextTraffic: true` Android serta `NSAllowsLocalNetworking` & `NSLocalNetworkUsageDescription` iOS) agar siap dipakai pada Development Build (`expo-dev-client`) mulai Phase 3 (modul printer Bluetooth).

### Agent's Discretion
- Detail tata letak internal komponen kartu, ukuran padding responsif, pemetaan ikon Lucide yang setara dengan Material Symbols web (`point_of_sale` -> `Calculator`/`ShoppingBag`, `inventory_2` -> `Package`, `receipt_long` -> `ReceiptText`, `settings` -> `Settings`), dan struktur utilitas pengujian unit Jest untuk auth/RBAC/storage.

### Deferred Ideas (OUT OF SCOPE)
- Sinkronisasi katalog SQLite (`/api/sync/full`, `/api/sync/delta`) dan header status DB (`/api/health` polling 10 detik) → Phase 2
- Fitur Kasir lengkap & cetak printer Bluetooth/Built-in HP → Phase 3
- Daftar Produk lengkap, Detail Produk, CRUD Produk, dan Detail Pesanan Aktif → Phase 4
- Sub-halaman Pengaturan Owner & Profil Toko / Tentang Aplikasi lengkap → Phase 5
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Pengguna dapat login menggunakan username dan password melalui `POST /api/auth/login` dengan toggle tampil/sembunyi kata sandi serta penanganan error `400`, `401`, `403` (akun nonaktif), dan countdown `429` (throttle) | Exact `POST /api/auth/login` contract (`400`, `401`, `403`, `429` with `retryAfter` body & `Retry-After` header, `503`, `500`), Velocity Blue card + `TR` fallback + password toggle + Lucide icons (`User`, `Lock`, `Eye`, `EyeOff`, `ArrowRight`, `CircleAlert`). |
| AUTH-02 | Pengguna dapat mengonfigurasi dan menguji URL server API (`Server URL` LAN HTTP / HTTPS tunnel) dari halaman Login maupun Pengaturan | Collapsible Server URL panel on Login + Server URL section in Pengaturan, normalized URL validation via `zod`, LAN/Emulator helper hints (`http://10.0.2.2:3000`, `http://192.168.x.x:3000`), pre-login `"Tes Koneksi"` targeting public `GET /api/settings` (avoiding `GET /api/health` unauthenticated `401`), plus `expo-build-properties` (`usesCleartextTraffic: true`) and iOS ATS `NSAllowsLocalNetworking` + `NSLocalNetworkUsageDescription`. |
| AUTH-03 | Sesi login pengguna (`pos_session` cookie/token & profil pengguna lokal) bertahan saat aplikasi ditutup/dibuka ulang dalam mode offline dan hanya menghapus sesi ketika server memberi `401` atau `GET /api/auth/me` mengembalikan `403` | Verified `expo/fetch` native `credentials: "omit"` disables `OkHttp` `CookieJar` & iOS `httpShouldHandleCookies` so manual `Cookie: pos_session=...` works; discovered `whatwg-fetch@3.6.20` `Headers` lacks `.getSetCookie()`, requiring `_rawHeaders` / `headers.get("set-cookie")` extraction + `expo-secure-store` persistence + strict `401` / `/me 403` vs feature `403` / `5xx` / network error matrix + physical-device cold-kill spike gate (`D-05`). |
| AUTH-04 | Pengguna dapat keluar (logout) melalui modal konfirmasi yang memanggil `POST /api/auth/logout` secara fail-safe (tetap membersihkan sesi lokal saat offline) | Confirmation modal UI pattern from `Sidebar.tsx`, fail-safe `try { await postLogout() } finally { clearSecureStore(); setUser(null); }` clearing `pos_session` cookie + user snapshot regardless of server/network availability. |
| NAV-01 | Aplikasi menampilkan Bottom Navigation Bar 4 tab utama (`Kasir`, `Produk`, `Pesanan`, `Pengaturan`) di dalam shell terproteksi (`<Stack.Protected>`) sesuai desain *Velocity Blue* | Verified `expo-router@58.0.32` `<Stack.Protected guard={...}>` API + JS `<Tabs>` bottom navigation bar (4 tabs: `Kasir`, `Produk`, `Pesanan`, `Pengaturan`) styled with Velocity Blue `#00478d` / `#ffffff` / `#e2e8f0` tokens and `userInterfaceStyle: "light"`. |
| NAV-04 | Sistem menegakkan hak akses peran (`kasir`, `admin`, `owner`): `kasir` melihat tab `Produk` dan `Detail Produk` dalam mode *read-only* (tanpa `costPrice` maupun aksi ubah), `admin` dapat mengelola produk, dan `owner` memiliki akses penuh termasuk sub-halaman manajemen | `key={`${user.id}:${user.role}`}` on authenticated navigator resets history cleanly on account switch/role change; `kasir` sees read-only badge/banner on `Produk` placeholder tab; RBAC capability helper + role badge styling (`Owner` purple, `Admin` primary blue, `Kasir` emerald) ready for Phase 4/5 nested `<Stack.Protected>` screens. |
</phase_requirements>

## Project Constraints (from GEMINI.md)

Extracted actionable directives from `C:/Users/adrie/Desktop/Project/Apps_Toko_Rejeki_Mobile/GEMINI.md`:
1. **Tech Stack Mandate:** Must build as an independent mobile app using **Expo + Expo Router + TypeScript** (`GEMINI.md:13`).
2. **Backend Compatibility & Consultation Gate:** Must consume existing endpoints from `Apps_Toko_Rejeki`; **any** needed change to the `Apps_Toko_Rejeki` backend MUST be communicated to and approved by the user before modifying backend files (`GEMINI.md:14`, reinforced by `01-CONTEXT.md` `D-05`).
3. **5 Grading Rubric Criteria:** Must satisfy (1) self-built Web Service API (`Apps_Toko_Rejeki`), (2) Bottom Navigation Bar, (3) minimum 5 screens, (4) minimum 2 list main screens clicking into detail screens, (5) 1 Profile/About screen (`GEMINI.md:15`). Phase 1 establishes (1) API consumption, (2) 4-tab Bottom Navigation Bar, and (3) Login + 4 tab screens (already 5 screens, expanded in Phases 4–5).
4. **Offline Resilience:** Login session and local catalog must remain readable offline, and pending orders stay persistent on device (`GEMINI.md:16`).
5. **Stack Standardization (`GEMINI.md` Stack section):** Use `StyleSheet.create` + typed Velocity Blue tokens (`src/theme/tokens.ts`), `expo-secure-store`, `expo/fetch` (`credentials: "omit"` + manual `Cookie` header), `lucide-react-native`, `@expo-google-fonts/*`, `zod`, `jest-expo`, `eslint-config-expo`, and `@testing-library/react-native`. Avoid `@react-native-cookies/cookies`, `@react-native-async-storage/async-storage`, `react-native-mmkv`, and `nativewind@5.0.0-rc.1` (`GEMINI.md:90-103`).
6. **GSD Workflow:** Perform edits within GSD plan execution rather than ad-hoc edits outside workflow (`GEMINI.md:174-182`).

---

## Summary

Phase 1 bootstraps **Apps Toko Rejeki Mobile** on **Expo SDK 58** (`expo@~58.0.26`, `expo-router@~58.0.32`, `react-native@0.88.1`, `react@19.3.0`) in a repository that currently contains only `.git/`, `.planning/`, and `GEMINI.md`. Because `create-expo-app` scaffolds into clean directories, bootstrapping via a temporary folder with `--template default@sdk-58` (or copying template files into the root) preserves `.planning/` and `GEMINI.md` cleanly. Configuring `app.config.ts` with `userInterfaceStyle: "light"`, `expo-build-properties` (`android.usesCleartextTraffic: true`), and iOS `infoPlist` (`NSAllowsLocalNetworking: true`, `NSLocalNetworkUsageDescription`) ensures both Expo Go (Phases 1–2) and future `expo-dev-client` builds (Phase 3+) can reach `http://192.168.x.x:3000` over shop LAN Wi-Fi without cleartext or ATS rejections.

Direct source inspection of `expo@58.0.26` and `Apps_Toko_Rejeki` revealed **three critical runtime details** that the Phase 1 plan must handle explicitly:
1. **`whatwg-fetch@3.6.20` lacks `headers.getSetCookie()`:** `expo/fetch` wraps native responses in React Native's `whatwg-fetch` `Headers` polyfill, which **does not implement `getSetCookie()`** (`undefined` in Hermes). Extracting `pos_session` per `D-03` must check `getSetCookie?.()` only as an optional Node/Jest fallback, inspect `response._rawHeaders` (raw `[string, string][]` tuple list from native `OkHttp` / `URLSession`) and `response.headers.get("set-cookie")`, and extract `pos_session=([A-Za-z0-9_.-]+)` safely across `Expires=...` commas. Meanwhile, `expo@58.0.26` native code confirms `credentials: "omit"` disables `OkHttp` `CookieJar` (`CookieJar.NO_COOKIES`) on Android and `httpShouldHandleCookies = false` on iOS while forwarding manual `Cookie` headers.
2. **Pre-login `"Tes Koneksi"` (`D-02`) must call `GET /api/settings`, NOT `GET /api/health`:** Inspecting `Apps_Toko_Rejeki/apps/src/app/api/health/route.ts:8-12` confirms `GET /api/health` calls `requireApiAuth(...)` and returns `401` without a session cookie, whereas `GET /api/settings` (`apps/src/app/api/settings/route.ts:78-90`) is intentionally public before login and returns `{ success: true, data: { storeName, storeAddress, storePhone, storeLogo, previewReceiptBeforePrint: false } }`.
3. **401 vs `/api/auth/me` 403 vs Feature 403 (`D-04`):** `GET /api/auth/me` returns `403` when an account is deactivated (`!freshUser.is_active`), while protected feature APIs return `403` when a valid user lacks role permissions. The HTTP client must wipe local `SecureStore` session **only** on `401` (any endpoint) or `403` specifically from `GET /api/auth/me`, never on feature `403`, `5xx`, or network failures.

**Primary recommendation:** Scaffold the SDK 58 `src/app/` structure with `StyleSheet.create` Velocity Blue tokens, `expo-secure-store` session + `server_base_url` storage, our verified `_rawHeaders`/`set-cookie` `expo/fetch` client (`credentials: "omit"`), `<Stack.Protected>` + `key={`${user.id}:${user.role}`}` 4-tab RBAC shell, and complete the physical Android/iOS cold-kill LAN spike immediately as Phase 1's exit gate before starting Phase 2.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Server URL storage, normalization & pre-auth reachability test (`AUTH-02`) | Mobile Device Storage (`expo-secure-store` / KV) + Mobile API Client | `Apps_Toko_Rejeki` (`GET /api/settings`) | Store LAN IPs (`192.168.x.x:3000`) change via DHCP; URL belongs in mutable device config validated before login via public `GET /api/settings`. |
| Credential verification, `429` backoff & `pos_session` HMAC signing (`AUTH-01`) | `Apps_Toko_Rejeki` API (`POST /api/auth/login`) | Mobile Login UI | Server owns `pgcrypto` verification, in-memory `loginThrottle.ts` exponential backoff, and `SESSION_SECRET` HMAC-SHA256 signing. |
| Session token (`pos_session`) + offline user snapshot persistence (`AUTH-03`) | Mobile Encrypted Storage (`expo-secure-store`) | `AuthContext` + `Apps_Toko_Rejeki` (`GET /api/auth/me`) | Encrypted Keychain/Keystore preserves session offline across cold kills; `/api/auth/me` revalidates online and trusts HMAC when PostgreSQL is offline. |
| Logout state termination (`AUTH-04`) | Mobile `AuthContext` + Confirmation Modal | `Apps_Toko_Rejeki` (`POST /api/auth/logout`) | Fail-safe local cleanup runs in `finally` so staff are never trapped logged in while offline; online call clears server cookie cleanly. |
| Role-protected route tree & 4-Tab Bottom Bar (`NAV-01`, `NAV-04`) | Mobile Presentation / Routing (`Expo Router` `<Stack.Protected>` + `<Tabs>`) | `Apps_Toko_Rejeki` (`requireApiAuth`) | Mobile UI enforces 4-tab layout (with `kasir` read-only `Produk` policy) and tears down navigation stacks on `user.id:user.role` changes; backend enforces authoritative API RBAC. |

---

## Standard Stack

### Core (Phase 1 Scope)

| Library | Verified Version / Range | Purpose | Provenance & Notes |
|---------|--------------------------|---------|-------------------|
| `expo` [WARNING: flagged as suspicious — verify before using.] | `~58.0.26` (npm latest `58.0.26`, created `2013-05-27`, 17.2M/wk) | Managed Expo SDK 58 runtime, Metro, `expo/fetch`, `npx expo` CLI | Flagged `SUS` (`too-new`) solely due to `2026-11-17` patch release (`postinstall: null`, `github.com/expo/expo.git`); pinned by `expo-template-default@58.0.35`. |
| `react` / `react-native` [WARNING: flagged as suspicious — verify before using.] | `19.3.0` / `0.88.1` | React 19 UI + RN 0.88 New Architecture runtime | `react` verdict `OK` (`[VERIFIED: npm registry]`); `react-native@0.88.1` flagged `SUS` (`too-new`, `2026-10-27`, 21.9M/wk, `postinstall: null`). Both pinned in `expo@58.0.26/bundledNativeModules.json`. |
| `expo-router` [WARNING: flagged as suspicious — verify before using.] | `~58.0.32` (npm latest `58.0.32`, created `2022-09-09`, 12.0M/wk) | File-based routing (`src/app/`), `<Stack.Protected>`, JS `<Tabs>`, `expo-router/testing-library` | Flagged `SUS` (`too-new`, `2026-11-17`, `postinstall: null`); inspected `Protected.d.ts`, `StackClient.js`, `TabsClient.js`, `testing-library/index.d.ts` directly. |
| `typescript` | `~6.0.3` (from `expo-template-default@58.0.35`, npm latest `6.0.3` / `5.x`) | Strict TypeScript (`strict: true`, `expo/tsconfig.base`) | `[VERIFIED: npm registry]` (`OK`, `github.com/microsoft/TypeScript.git`, `438.8M/wk`). Note `expo-template-default@58.0.35` uses `~6.0.3`. |
| `expo-secure-store` [WARNING: flagged as suspicious — verify before using.] | `~58.0.3` (npm latest `58.0.3`, created `2019-02-27`, 12.1M/wk) | Encrypted Keychain / Keystore persistence for `pos_session`, user snapshot, `server_base_url` | Flagged `SUS` (`too-new`, `2026-11-11`, `postinstall: null`); bundled in Expo Go; keep per-key payloads < 2048 bytes and omit `requireAuthentication: true`. |
| `expo-build-properties` [WARNING: flagged as suspicious — verify before using.] | `~58.0.12` (npm latest `58.0.12`, created `2022-05-02`, 7.2M/wk) | Configures `android.usesCleartextTraffic: true` in `AndroidManifest.xml` during CNG/prebuild | Flagged `SUS` (`too-new`, `2026-10-31`, `postinstall: null`); inspected `src/android.ts` (`withAndroidCleartextTraffic`) directly. |
| `StyleSheet.create` + Velocity Blue tokens | Built-in (`react-native@0.88.1`) | Exact `design.md` / `globals.css` theme without Tailwind Metro/Babel plugin risk | Zero runtime dependencies, strict TS safety, matches `01-CONTEXT.md` & `GEMINI.md` stack rules. |

### Supporting (Phase 1 Scope)

| Library | Verified Version / Range | Purpose | Provenance & Notes |
|---------|--------------------------|---------|-------------------|
| `expo/fetch` (subpath of `expo`) | `~58.0.26` | WinterCG-compliant `fetch` with `credentials: "omit"` & manual `Cookie` header | Replaces global `fetch` automatically unless `EXPO_PUBLIC_USE_RN_FETCH=1` (`expo/src/winter/runtime.native.ts:37-47`). |
| `expo-sqlite` [WARNING: flagged as suspicious — verify before using.] | `~58.0.17` (npm latest `2026-11-17T12:01:58.548Z`, `3,060,841/wk`) | Provides `expo-sqlite/kv-store` synchronous storage for `pos_server_base_url` and `pos_store_settings` (keeps large `storeLogo` out of `SecureStore`) | Flagged `SUS` (`too-new`, `publishedAt: 2026-11-17T12:01:58.548Z`, `github.com/expo/expo.git`, `postinstall: null`); bundled in Expo Go and prepares Phase 2 WAL catalog sync. |
| `expo-network` [WARNING: flagged as suspicious — verify before using.] | `~58.0.5` (npm latest `58.0.5`, created `2019-09-14`, 3.9M/wk) | OS Wi-Fi/cellular reachability check (`getNetworkStateAsync`, `useNetworkState`) | Flagged `SUS` (`too-new`, `2026-11-11`, `postinstall: null`); bundled in Expo Go. |
| `expo-font` [WARNING: flagged as suspicious — verify before using.] + `@expo-google-fonts/*` | `~58.0.12` + `0.4.3` / `0.4.2` / `0.4.1` | Loads `Hanken Grotesk`, `Inter`, and `JetBrains Mono` from `design.md` | Font packages (`hanken-grotesk@0.4.3`, `inter@0.4.2`, `jetbrains-mono@0.4.1`) are `[VERIFIED: npm registry]` (`OK`). `expo-font` flagged `SUS` (`too-new`, `2026-11-11`). |
| `expo-splash-screen`, `expo-status-bar`, `expo-system-ui`, `expo-haptics`, `expo-clipboard` [WARNING: flagged as suspicious — verify before using.] | `~58.0.14`, `~58.0.5`, `~58.0.7`, `~58.0.8`, `~58.0.4` | Splash hold during auth/font hydration, light status bar, root background color `#f9f9ff`, login/copy tactile feedback | All bundled in `expo@58.0.26/bundledNativeModules.json` and Expo Go; flagged `SUS` (`too-new`, `2026-10/11`, `postinstall: null`). |
| `lucide-react-native` [WARNING: flagged as suspicious — verify before using.] + `react-native-svg` [WARNING: flagged as suspicious — verify before using.] | `^1.75.0` + `15.16.0` (Expo aligned) | Crisp SVG icons matching `Apps_Toko_Rejeki` (`lucide-react@^1.74.0`) | `lucide-react-native@1.75.0` (`2026-11-18`) & `react-native-svg@15.16.1` (`2026-11-05`) flagged `SUS` (`too-new`, `postinstall: null`). Verified `Calculator`, `ShoppingBag`, `Package`, `ReceiptText`, `Settings`, `Eye`, `EyeOff`, `User`, `Lock`, `Server`, `Wifi`, `CircleCheck`, `CircleAlert`, `LogOut`, `ChevronDown`, `ChevronUp`, `ArrowRight`, `Shield`, `ShieldCheck` in `.d.ts`. |
| `zod` | `^4.6.7` (npm latest `4.6.7`) | Runtime validation of Server URL, login input, and API payloads | `[VERIFIED: npm registry]` (`OK`, `465.8M/wk`). |
| `zustand` [WARNING: flagged as suspicious — verify before using.] | `^5.1.0` (npm latest `5.1.0`, created `2019-04-09`, 94.9M/wk) | Lightweight store for `serverConfigStore` (or Phase 2+ cart/sync state) | Flagged `SUS` (`too-new`, `2026-11-06`, `postinstall: null`); optional for `serverConfigStore` in Phase 1 (React Context or Zustand both viable). |
| `jest-expo` [WARNING: flagged as suspicious — verify before using.], `jest`, `@types/jest`, `@testing-library/react-native`, `eslint-config-expo`, `eslint` [WARNING: flagged as suspicious — verify before using.] | `~58.0.15`, `^30.5.2`, `^30.0.0`, `^14.1.0`, `~58.0.4`, `^9.39.x` / `^10.15.0` | Unit/component testing (Jest 30 + RNTL v14 + `expo-router/testing-library`) and Expo flat ESLint | `jest`, `@types/jest`, `@testing-library/react-native`, `eslint-config-expo` are `[VERIFIED: npm registry]` (`OK`). Note `eslint-config-expo@58.0.4` tests against `eslint@^9.18.0` (`peerDependencies: { "eslint": ">=8.10" }`), so `eslint@^9` is safest if v10 plugins conflict. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `expo/fetch` (`credentials: "omit"` + manual `Cookie`) | `EXPO_PUBLIC_USE_RN_FETCH=1` (`fetch(..., { credentials: "include" })`) | Use ONLY as fallback comparison during the Phase 1 physical-device spike if manual `Set-Cookie` extraction fails; `OkHttp` `ForwardingCookieHandler` flushes asynchronously on Android and risks dropping `pos_session` on immediate force-kills. |
| Pure TS `parsePosSessionFromSetCookie` | `set-cookie-parser` | `set-cookie-parser` (`SUS: too-new`) is unnecessary overhead when `session.ts:66` emits a single `pos_session` cookie containing only `[A-Za-z0-9_.-]+` characters. |
| JS `<Tabs>` (`expo-router` `Tabs`) | `expo-router/native-tabs` | `expo-template-default@58.0.35` uses `NativeTabs`, which delegates chrome to OS native tabs (iOS Liquid Glass / Android system bar) and restricts custom Velocity Blue surface/border/active-pill styling and Lucide vector icons. Use JS `<Tabs>` (`TabsClient.d.ts`) per `STACK.md` and `01-CONTEXT.md`. |
| `StyleSheet.create` + `tokens.ts` | `nativewind` / `uniwind` | Both introduce Metro/CSS-interop complexity on RN `0.88.1`; `StyleSheet.create` has zero bundle/type risk. |

### Installation (Bootstrap & Phase 1 Packages)

Because `C:\Users\adrie\Desktop\Project\Apps_Toko_Rejeki_Mobile` already contains `.git/`, `.planning/`, and `GEMINI.md`, scaffold into a temporary directory first so `create-expo` does not abort on non-empty workspace files, then move the generated template files into the repository root:

```powershell
# 1. Scaffold SDK 58 default TypeScript + src/app template in temp folder
npx create-expo-app@latest _tmp_expo --template default@sdk-58

# 2. Move scaffolded files (preserving existing .git, .planning, GEMINI.md)
Get-ChildItem -Force _tmp_expo | ForEach-Object {
  if ($_.Name -ne ".git") {
    Move-Item -Force $_.FullName .
  }
}
Remove-Item -Recurse -Force _tmp_expo

# 3. Install Phase 1 Expo modules (versions aligned automatically to SDK 58 bundledNativeModules.json)
npx expo install expo-secure-store expo-sqlite expo-build-properties expo-network expo-font expo-splash-screen expo-status-bar expo-system-ui expo-haptics expo-clipboard react-native-svg

# 4. Install JS libraries & Velocity Blue fonts
npm install zustand@^5.1.0 lucide-react-native@^1.75.0 zod@^4.6.7 @expo-google-fonts/hanken-grotesk@^0.4.3 @expo-google-fonts/inter@^0.4.2 @expo-google-fonts/jetbrains-mono@^0.4.1

# 5. Install Dev & Testing dependencies (Wave 0 Nyquist foundation)
npx expo install --dev jest-expo eslint-config-expo
npm install -D jest@^30.0.0 @types/jest@^30.0.0 @testing-library/react-native@^14.1.0 eslint@^9
```

> **Note:** Check `package.json` after step 2: `expo-template-default@58.0.35` pre-installs `@expo/ui`, `expo-glass-effect`, `expo-symbols`, `expo-image`, `expo-web-browser`, `expo-constants`, `expo-device`, `expo-linking`, `expo-router`, `react-native-reanimated`, `react-native-worklets`, `react-native-gesture-handler`, `react-native-screens`, `react-native-safe-area-context`, and `typescript@~6.0.3`. Keep core navigation/Reanimated peers; you can keep or remove unused template components (`src/components/animated-icon*`, `src/app/explore.tsx`). Verify after install with `npx expo-doctor`.

---

## Package Legitimacy Audit

Executed via `gsd_run query package-legitimacy check --ecosystem npm` on 2026-11-18 against live npm registry metadata (`postinstall` verified `null` across all packages):

| Package | Registry | Age (`time.created` / Latest) | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-------------------------------|-----------|-------------|---------|-------------|
| `zod` | npm | `2020-03-07` / `2026-10-12` (`4.6.7`) | 465.8M/wk | `github.com/colinhacks/zod` | `OK` | Approved `[VERIFIED: npm registry]` |
| `react` | npm | — / `2026-10-14` (`19.3.0` pinned) | 265.0M/wk | `github.com/react/react` | `OK` | Approved `[VERIFIED: npm registry]` |
| `typescript` | npm | — / `2026-07-08` (`6.0.3`) | 438.8M/wk | `github.com/microsoft/TypeScript` | `OK` | Approved `[VERIFIED: npm registry]` |
| `@types/react` | npm | — / `2026-09-09` (`19.3.0`) | 241.9M/wk | `DefinitelyTyped` | `OK` | Approved `[VERIFIED: npm registry]` |
| `jest` | npm | — / `2026-09-18` (`30.5.2`) | 60.9M/wk | `github.com/jestjs/jest` | `OK` | Approved `[VERIFIED: npm registry]` |
| `@types/jest` | npm | — / `2025-06-16` (`30.0.0`) | 56.9M/wk | `DefinitelyTyped` | `OK` | Approved `[VERIFIED: npm registry]` |
| `@testing-library/react-native` | npm | `2019-05-30` / `2026-10-08` (`14.1.0`) | 6.2M/wk | `github.com/callstack/react-native-testing-library` | `OK` | Approved `[VERIFIED: npm registry]` |
| `eslint-config-expo` | npm | `2017-03-03` / `2026-09-29` (`58.0.4`) | 4.0M/wk | `github.com/expo/expo` | `OK` | Approved `[VERIFIED: npm registry]` |
| `@expo-google-fonts/inter` | npm | `2020-05-05` / `2025-09-11` (`0.4.2`) | 1.8M/wk | `github.com/expo/google-fonts` | `OK` | Approved `[VERIFIED: npm registry]` |
| `@expo-google-fonts/jetbrains-mono` | npm | `2021-06-30` / `2025-09-12` (`0.4.1`) | 440K/wk | `github.com/expo/google-fonts` | `OK` | Approved `[VERIFIED: npm registry]` |
| `@expo-google-fonts/hanken-grotesk` | npm | `2023-02-21` / `2025-09-04` (`0.4.3`) | 100K/wk | `github.com/expo/google-fonts` | `OK` | Approved `[VERIFIED: npm registry]` |
| `expo-sqlite` | npm | `publishedAt: 2026-11-17T12:01:58.548Z` | `3,060,841/wk` | `github.com/expo/expo.git` | `SUS` (`too-new`) | Flagged — planner must add `checkpoint:human-verify` (`gate="blocking-human"`) before install (`postinstall: null`) |
| `expo`, `expo-router`, `expo-secure-store`, `expo-build-properties`, `expo-network`, `expo-font`, `expo-splash-screen`, `expo-status-bar`, `expo-system-ui`, `expo-haptics`, `expo-clipboard`, `expo-constants`, `expo-linking`, `jest-expo`, `create-expo`, `expo-template-default` | npm | Created `2013–2022` / latest patches `2026-10-21` to `2026-11-17` | 54K–18.5M/wk | `github.com/expo/expo` | `SUS` (`too-new`) | Flagged — planner must add `checkpoint:human-verify` before install (recent SDK 58 patch timestamps triggered `too-new`; `postinstall: null`) |
| `react-native`, `react-native-reanimated`, `react-native-worklets`, `react-native-gesture-handler`, `react-native-screens`, `react-native-safe-area-context`, `react-native-svg` | npm | Created `2015+` / latest patches `2026-10-26` to `2026-11-17` | 13.3M–21.9M/wk | `facebook/react-native`, `software-mansion`, `appandflow` | `SUS` (`too-new`) | Flagged — planner must add `checkpoint:human-verify` before install (`postinstall: null`) |
| `zustand`, `lucide-react-native`, `eslint` | npm | Created `2019–2022` / latest patches `2026-11-06` to `2026-11-18` | 3.7M–210M/wk | `pmndrs/zustand`, `lucide-icons/lucide`, `eslint/eslint` | `SUS` (`too-new`) | Flagged — planner must add `checkpoint:human-verify` before install (`postinstall: null`) |

**Packages removed due to `SLOP` verdict:** None (all queried packages exist on npm with `postinstall: null` and verified upstream repositories).  
**Packages flagged as suspicious `SUS`:** The Expo SDK 58 / React Native 0.88 ecosystem packages plus `zustand`, `lucide-react-native`, and `eslint` returned `SUS` exclusively with reason `"too-new"` because their latest patch versions were published within days of `2026-11-18`. Per protocol, the planner should insert a `checkpoint:human-verify` confirmation step before running `npx create-expo-app` / `npm install` (and verify the resulting `package-lock.json` versions against `expo@58.0.26/bundledNativeModules.json`).

---

## Verified `Apps_Toko_Rejeki` API & Design Contracts

Every contract below was verified by opening the source files in `C:/Users/adrie/Desktop/Project/Apps_Toko_Rejeki/` during this session.

### 1. Session Token & Cookie Configuration
- **Cookie Name:** `export const SESSION_COOKIE_NAME = "pos_session";` `[VERIFIED: ../Apps_Toko_Rejeki/apps/src/lib/session.ts:3]`
- **Token Format & TTL:** `exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days` and ``return `${encodedPayload}.${encodedSig}`;`` `[VERIFIED: ../Apps_Toko_Rejeki/apps/src/lib/session.ts:53-66]` where `base64UrlEncode` uses `[A-Za-z0-9_-]` (zero commas/semicolons/whitespace).
- **Role & User DTO (`types/index.ts`):**
  - `export type UserRole = "owner" | "admin" | "kasir";` `[VERIFIED: ../Apps_Toko_Rejeki/apps/src/types/index.ts:227]`
  - `export interface AuthSessionUser { id: string; username: string; fullName: string; role: UserRole; sessionStamp?: string; }` `[VERIFIED: ../Apps_Toko_Rejeki/apps/src/types/index.ts:240-250]`
- **CSRF Middleware (`middleware.ts`):**
  - On `/api*`, for `["POST", "PUT", "PATCH", "DELETE"].includes(req.method)`: if `sec-fetch-site` header is present and `fetchSite !== "same-origin" && fetchSite !== "none"`, returns HTTP `403` `{ success: false, error: "Permintaan lintas-situs ditolak." }` `[VERIFIED: ../Apps_Toko_Rejeki/apps/src/middleware.ts:11-20]`. Native `expo/fetch` omits `sec-fetch-site`, so native Android/iOS requests pass without backend edits; Expo Web cross-origin requests fail.

### 2. `POST /api/auth/login` (`apps/src/app/api/auth/login/route.ts`)
- **Request JSON:** `{ username: string, password: string }` (`username.length <= 100`, `password.length <= 256`) `[VERIFIED: ../Apps_Toko_Rejeki/apps/src/app/api/auth/login/route.ts:17-37]`.
- **Throttle math (`loginThrottle.ts`):** `BASE_DELAY_SECONDS = 2`, `MAX_DELAY_SECONDS = 60`, `ENTRY_TTL_MS = 15 * 60 * 1000`, `Math.min(BASE_DELAY_SECONDS * 2 ** (entry.failures - 1), MAX_DELAY_SECONDS)` `[VERIFIED: ../Apps_Toko_Rejeki/apps/src/lib/loginThrottle.ts:14-16,77]`.
- **Exact Responses & Status Codes:**
  - `400`: `{ success: false, error: "Username dan kata sandi wajib diisi" }` `[VERIFIED: ../Apps_Toko_Rejeki/apps/src/app/api/auth/login/route.ts:26-29]`
  - `401` (length exceeded / bad creds / not found / missing user): `{ success: false, error: "Username atau kata sandi salah" }` `[VERIFIED: ../Apps_Toko_Rejeki/apps/src/app/api/auth/login/route.ts:13,34,59,77]`
  - `403` (correct password, inactive user): `{ success: false, error: "Akun ini sedang dinonaktifkan. Silakan hubungi pemilik toko (Owner)." }` `[VERIFIED: ../Apps_Toko_Rejeki/apps/src/app/api/auth/login/route.ts:66-72]`
  - `429` (throttled): `{ success: false, error: `Terlalu banyak percobaan gagal. Coba lagi dalam ${retryAfter} detik.`, retryAfter }` with header `"Retry-After": String(retryAfter)` `[VERIFIED: ../Apps_Toko_Rejeki/apps/src/app/api/auth/login/route.ts:43-50]`
  - `503` (DB unreachable): `{ success: false, error: "Database tidak dapat dihubungi. Pastikan database berjalan." }` `[VERIFIED: ../Apps_Toko_Rejeki/apps/src/app/api/auth/login/route.ts:119-122]`
  - `500`: `{ success: false, error: "Gagal memproses login" }` `[VERIFIED: ../Apps_Toko_Rejeki/apps/src/app/api/auth/login/route.ts:124-127]`
  - `200`: `{ success: true, data: { id: user.id, username: user.username, fullName: user.full_name, role: user.role }, message: `Selamat datang, ${user.full_name}!` }` `[VERIFIED: ../Apps_Toko_Rejeki/apps/src/app/api/auth/login/route.ts:85-98]`
- **Exact Cookie Set Attributes (`login/route.ts:105-113`):**
  ```ts
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    secure: isHttps,
  });
  ```
  `isHttps` checks `x-forwarded-proto` or `new URL(req.url).protocol`, so LAN HTTP gets `secure: false` and Cloudflare HTTPS gets `secure: true` `[VERIFIED: ../Apps_Toko_Rejeki/apps/src/app/api/auth/login/route.ts:102-113]`.

### 3. `GET /api/auth/me` (`apps/src/app/api/auth/me/route.ts`)
- **Cookie Source:** Reads ONLY `cookieStore.get(SESSION_COOKIE_NAME)` (`pos_session`) `[VERIFIED: ../Apps_Toko_Rejeki/apps/src/app/api/auth/me/route.ts:23-24]`.
- **Exact Responses & Status Codes:**
  - `401` (missing cookie): `{ success: false, data: null, error: "Belum terotentikasi" }` `[VERIFIED: ../Apps_Toko_Rejeki/apps/src/app/api/auth/me/route.ts:27-30]`
  - `401` (invalid/expired token): `clearedSessionResponse(401, "Sesi tidak valid atau telah kedaluwarsa")` (clears cookie `maxAge: 0`) `[VERIFIED: ../Apps_Toko_Rejeki/apps/src/app/api/auth/me/route.ts:10-17,34-37]`
  - `200` (DB offline or `!freshUser`, valid HMAC): `{ success: true, offline: true, data: { id: session.id, username: session.username, fullName: session.fullName, role: session.role } }` `[VERIFIED: ../Apps_Toko_Rejeki/apps/src/app/api/auth/me/route.ts:56-67]`
  - `403` (`!freshUser.is_active`): `clearedSessionResponse(403, "Akun tidak ditemukan atau telah dinonaktifkan")` `[VERIFIED: ../Apps_Toko_Rejeki/apps/src/app/api/auth/me/route.ts:69-71]`
  - `401` (`sessionStamp !== pw_stamp`): `clearedSessionResponse(401, "Kata sandi akun telah diubah. Silakan login kembali.")` `[VERIFIED: ../Apps_Toko_Rejeki/apps/src/app/api/auth/me/route.ts:73-78]`
  - `200` (DB online, active): `{ success: true, data: { id: freshUser.id, username: freshUser.username, fullName: freshUser.full_name, role: freshUser.role } }` `[VERIFIED: ../Apps_Toko_Rejeki/apps/src/app/api/auth/me/route.ts:80-88]`
  - `500` (unexpected error): `{ success: false, error: ... }` `[VERIFIED: ../Apps_Toko_Rejeki/apps/src/app/api/auth/me/route.ts:91-99]`
- **Distinction vs Feature Endpoints (`apiAuth.ts`):** Other APIs call `requireApiAuth()`, returning `401` (`"Belum login atau sesi telah berakhir. Silakan login kembali."`, `"Akun tidak ditemukan atau telah dinonaktifkan."`, `"Kata sandi akun telah diubah. Silakan login kembali."`), `503` (`"Database tidak dapat dihubungi, akun belum bisa diverifikasi."`), and `403` (`"Akses ditolak: peran Anda tidak memiliki izin untuk tindakan ini."`) `[VERIFIED: ../Apps_Toko_Rejeki/apps/src/lib/apiAuth.ts:49-90]`. **Therefore, NEVER treat `403` from non-`/api/auth/me` endpoints as a logout trigger.**

### 4. `POST /api/auth/logout` (`apps/src/app/api/auth/logout/route.ts`)
- **200:** `{ success: true, message: "Berhasil keluar dari sistem." }` and clears `SESSION_COOKIE_NAME` with `value: "", httpOnly: true, path: "/", sameSite: "lax", maxAge: 0` `[VERIFIED: ../Apps_Toko_Rejeki/apps/src/app/api/auth/logout/route.ts:6-20]`.
- **500:** `{ success: false, error: err.message || "Gagal memproses logout" }` `[VERIFIED: ../Apps_Toko_Rejeki/apps/src/app/api/auth/logout/route.ts:21-25]`.

### 5. `GET /api/settings` & `GET /api/health` (Reachability Testing Trap!)
- **`GET /api/settings` (Public Pre-Login Endpoint):**
  - When unauthenticated (`!session`), returns HTTP `200`: `{ success: true, data: { storeName: ..., storeAddress: ..., storePhone: ..., storeLogo: ..., previewReceiptBeforePrint: false } }` `[VERIFIED: ../Apps_Toko_Rejeki/apps/src/app/api/settings/route.ts:78-90]`.
  - When PostgreSQL is known offline, returns HTTP `200`: `{ success: true, offline: true, data: { ...DEFAULT_SETTINGS, ... } }` where `DEFAULT_SETTINGS.storeName === "Toko Rejeki"` `[VERIFIED: ../Apps_Toko_Rejeki/apps/src/app/api/settings/route.ts:6-34]`.
  - **Use `GET /api/settings` for the Login screen `"Tes Koneksi"` button (`D-02`)** so reachability succeeds with `200` AND populates store branding (`storeName`, `storeLogo`) on Login (`D-06`).
- **`GET /api/health` (Authenticated Staff Endpoint):**
  - Calls `requireApiAuth({ roles: ROLES_STAFF, verifyAccount: false })` — **returns HTTP `401` if called before login!** `[VERIFIED: ../Apps_Toko_Rejeki/apps/src/app/api/health/route.ts:8-12]`.
  - When authenticated, returns HTTP `200`: `{ status: 'online' | 'degraded' | 'offline', database: 'online' | 'standby_only' | 'offline', nodeRole, clusterRole, isReadOnly, activeNode, device, partnerDevice, partnerStatus, dbHost, dbPort, latencyMs, primary, standby, timestamp }` `[VERIFIED: ../Apps_Toko_Rejeki/apps/src/app/api/health/route.ts:31-68]`. (Deferred to Phase 2 global health header, though usable as authenticated reachability check in `Pengaturan`).

### 6. Velocity Blue Design System (`design.md` & `globals.css` & `Sidebar.tsx`)
- **Core Palette (`design.md:3-55`, `globals.css:31-85`):**
  - `primary`: `'#00478d'`, `primaryContainer`: `'#005eb8'`, `onPrimary`: `'#ffffff'`, `onPrimaryContainer`: `'#c8daff'`, `primaryFixed`: `'#d6e3ff'`, `onPrimaryFixed`: `'#001b3d'`
  - `background` / `surface`: `'#f9f9ff'`, `surfaceBg`: `'#f8fafc'`, `surfaceCard` / `surfaceContainerLowest`: `'#ffffff'`, `surfaceContainerLow`: `'#f2f3fb'`, `surfaceContainer`: `'#ecedf6'`, `surfaceContainerHigh`: `'#e7e8f0'`, `surfaceContainerHighest`: `'#e1e2ea'`
  - `onSurface`: `'#191c21'`, `onSurfaceVariant`: `'#424752'`, `outline`: `'#727783'`, `outlineVariant`: `'#c2c6d4'`, `borderSubtle`: `'#e2e8f0'`
  - `success`: `'#10b981'`, `warning`: `'#f59e0b'`, `error`: `'#ef4444'`, `errorContainer`: `'#ffdad6'`, `onErrorContainer`: `'#93000a'` `[VERIFIED: ../Apps_Toko_Rejeki/design.md:3-55]`.
- **Typography & Spacing (`design.md:56-118`):**
  - Fonts: `Hanken Grotesk` (`headline-lg: 24/32`, `headline-md: 20/28`, `headline-sm: 16/24`), `Inter` (`display-price-mobile: 28/36`, `body-lg: 16/24`, `body-md: 14/20`), `JetBrains Mono` (`label-mono: 13/18`)
  - `spacing`: `unit: 8`, `touch-target: 48`, `gutter-md: 16`, `margin-lg: 24`, `container-padding: 20` `[VERIFIED: ../Apps_Toko_Rejeki/design.md:56-118]`.
- **Role Badge & Tab Labels (`Sidebar.tsx:47-116`):**
  - Labels: `"Kasir"`, `"Daftar Produk"` (tab title `"Produk"` per `NAV-01`), `"Pesanan Aktif"` (tab title `"Pesanan"` per `NAV-01`), `"Pengaturan"`
  - Role colors: `owner` (`#9333ea` / purple-600), `admin` (`#00478d` / primary), `kasir` (`#059669` / emerald-600) `[VERIFIED: ../Apps_Toko_Rejeki/apps/src/components/Sidebar.tsx:88-116]`.

---

## Architecture Patterns

### System Architecture Diagram (Phase 1 Flow)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  expo-splash-screen (held until fonts + SecureStore hydration complete)    │
└──────────────────────────────────┬─────────────────────────────────────────┘
                                   ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  Root Layout (`src/app/_layout.tsx`)                                       │
│  AuthProvider + ServerConfigProvider + SafeAreaProvider                    │
│  └── <Stack screenOptions={{ headerShown: false }}>                         │
│       ├── <Stack.Protected guard={!isAuthenticated}> → (auth)/login.tsx    │
│       └── <Stack.Protected guard={isAuthenticated}>                        │
│            └── (app)/_layout.tsx  [key={`${user.id}:${user.role}`}]        │
│                 └── (tabs)/_layout.tsx  (4 JS Tabs: Kasir|Produk|Pesanan|Pengaturan)
└──────┬───────────────────────────┬──────────────────────────┬──────────────┘
       │ Login / Test Server       │ Cold Start / Revalidate  │ Logout Modal
       ▼                           ▼                          ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  `apiClient.ts` (uses `expo/fetch` with `credentials: "omit"`)             │
│  - Injects `Cookie: pos_session=<token>` from `SecureStore`                │
│  - Extracts `Set-Cookie` via `_rawHeaders` / `headers.get("set-cookie")`   │
│  - 401 (any) or 403 (/api/auth/me) ──► wipe `SecureStore` & logout         │
│  - 403 (other) ──► refresh `/api/auth/me`, keep session, surface error     │
│  - Network error / 5xx / timeout ──► preserve offline snapshot             │
└──────────────────────────────────┬─────────────────────────────────────────┘
                                   ▼ HTTP (LAN) / HTTPS (Tunnel)
         Apps_Toko_Rejeki Next.js API (`/api/settings`, `/api/auth/*`)
```

### Recommended Project Structure (Phase 1 Scope)

```text
Apps_Toko_Rejeki_Mobile/
├── app.config.ts                     # Expo SDK 58 config, userInterfaceStyle: "light", plugins
├── package.json                      # "main": "expo-router/entry", Jest & ESLint scripts
├── tsconfig.json                     # extends "expo/tsconfig.base", strict: true, "@/*": ["./src/*"]
├── eslint.config.js                  # Flat ESLint extending eslint-config-expo/flat
├── jest.config.js                    # preset: "jest-expo", setupFilesAfterEnv, moduleNameMapper
├── src/
│   ├── app/                          # Expo Router route files ONLY (keep tests in __tests__/)
│   │   ├── _layout.tsx               # Font + SecureStore boot gate + Root <Stack.Protected>
│   │   ├── (auth)/
│   │   │   ├── _layout.tsx           # Headerless auth stack
│   │   │   └── login.tsx             # Velocity Blue login card + collapsible Server URL panel
│   │   └── (app)/
│   │       ├── _layout.tsx           # Keyed by `${user.id}:${user.role}`, resets stack on account switch
│   │       └── (tabs)/
│   │           ├── _layout.tsx       # 4-Tab Velocity Blue Bottom Navigation Bar (all roles)
│   │           ├── kasir.tsx         # Clean Phase 1 placeholder (Phase 3 target)
│   │           ├── produk.tsx        # Phase 1 placeholder + kasir Read-Only banner (Phase 4 target)
│   │           ├── pesanan.tsx       # Clean Phase 1 placeholder (Phase 4 target)
│   │           └── pengaturan.tsx    # Profile card, RoleBadge, Server URL editor/test, Logout modal
│   ├── components/
│   │   ├── common/                   # RoleBadge, ServerUrlPanel, LogoutConfirmModal, ErrorBanner
│   │   └── ui/                       # Velocity Blue Button, Card, TextInputField
│   ├── context/
│   │   └── AuthContext.tsx           # SecureStore snapshot hydration, login, fail-safe logout, /me refresh
│   ├── services/
│   │   ├── api/
│   │   │   ├── apiClient.ts          # expo/fetch wrapper, Cookie injection, 401/403/5xx classification
│   │   │   ├── authApi.ts            # login, getMe, logout, getPublicSettings
│   │   │   └── cookieParser.ts       # Pure TS pos_session extractor (_rawHeaders + set-cookie + getSetCookie)
│   │   └── storage/
│   │       ├── secureStorage.ts      # Typed expo-secure-store adapter (pos_session, user_snapshot, server_url)
│   │       └── serverConfig.ts       # URL validation (zod), normalization, default LAN/emulator helpers
│   ├── theme/
│   │   └── tokens.ts                 # Exact Velocity Blue palette, typography, spacing, radii
│   └── types/
│       └── index.ts                  # UserRole, AuthSessionUser, ApiResponse<T>, LoginResult, StoreSettings
└── __tests__/                        # Jest unit & Expo Router integration tests (outside src/app/)
    ├── setup.ts                      # SecureStore / expo-router mocks & testing-library helpers
    ├── cookieParser.test.ts          # Set-Cookie extraction edge cases (Expires commas, _rawHeaders, etc.)
    ├── serverConfig.test.ts          # URL validation, trailing-slash stripping, HTTP/HTTPS acceptance
    ├── apiClient.test.ts             # 401 vs /me 403 vs feature 403 vs 5xx vs network error matrix
    ├── authContext.test.tsx          # Cold offline hydration, 429 countdown, fail-safe logout
    └── routingRbac.test.tsx          # renderRouter tests for <Stack.Protected>, 4 tabs, kasir read-only banner
```

### Pattern 1: `expo/fetch` Cookie Transport & `Set-Cookie` Extraction (`D-03`)
Inspecting `expo@58.0.26` source confirms two critical mechanics:
1. **Android (`NativeRequest.kt:40-42`) & iOS (`ExpoURLSessionTask.swift:31-38`):** Setting `credentials: "omit"` disables `OkHttp` `CookieJar` (`CookieJar.NO_COOKIES`) on Android and `httpShouldHandleCookies = false` on iOS, while still applying `requestInit.headers` (`request.headers(headers)` on Android, `request.addValue` on iOS). Therefore, manually passing `headers: { Cookie: "pos_session=<token>" }` with `credentials: "omit"` avoids native cookie jar interference and works identically over plain LAN `http://` and HTTPS tunnels.
2. **Response `Set-Cookie` Reading (`FetchResponse.ts:368-370` & `runtime.native.ts:40-47`):** `FetchResponse.headers` wraps `this._rawHeaders` (`[string, string][]`) in React Native's `whatwg-fetch@3.6.20` `Headers` class, which **does not implement `getSetCookie()`**. Read candidate headers in priority order:
   1. Optional `(response.headers as { getSetCookie?: () => string[] }).getSetCookie?.()` (in case Jest/Node Web Fetch is active),
   2. `(response as { _rawHeaders?: [string, string][] })._rawHeaders?.filter(([k]) => k.toLowerCase() === "set-cookie").map(([, v]) => v)` (direct native header tuples preserved on `expo/fetch` `FetchResponse`),
   3. `response.headers.get("set-cookie")` fallback.
   Parse with `/(?:^|,\s*|\s)pos_session=([A-Za-z0-9_.-]+)/i` — verified safe because `session.ts:66` encodes payload + signature in base64url (`[A-Za-z0-9_-]`) joined by `.`.

### Pattern 2: `<Stack.Protected>` Root Gate + `user.id:user.role` Keyed Tabs (`D-07`, `D-08`)
- In `expo-router@58.0.32`, `Stack.Protected` (`Protected.d.ts:4-8`, `mapProtectedScreen.js:330-333`) takes `guard: boolean` and automatically clears guarded routes from the navigation stack when `guard` transitions from `true` to `false`.
- Wrap `(auth)` under `<Stack.Protected guard={!isAuthenticated}>` and `(app)` under `<Stack.Protected guard={isAuthenticated}>` inside `src/app/_layout.tsx` (after `isHydrated === true` and fonts load, while `SplashScreen` stays visible).
- Inside `src/app/(app)/_layout.tsx`, render `<Slot key={`${user.id}:${user.role}`} />` (or keyed `<Stack>` wrapping `(tabs)`) so switching between `owner` and `kasir` on a shared store device unmounts the entire tab tree and discards all previous component state and history.
- Inside `src/app/(app)/(tabs)/_layout.tsx`, use `import { Tabs } from "expo-router"` (JavaScript Bottom Tabs, NOT `NativeTabs`) with `screenOptions` applying Velocity Blue `#ffffff` tab background, `#e2e8f0` top border, `#00478d` active tint, `#727783` inactive tint, and Lucide icons (`ShoppingBag` or `Calculator` for `Kasir`, `Package` for `Produk`, `ReceiptText` for `Pesanan`, `Settings` for `Pengaturan`).

### Pattern 3: `expo-build-properties` & iOS ATS Networking (`D-09`)
- **`app.config.ts` Android Cleartext:** `expo-build-properties@58.0.12` reads `android.usesCleartextTraffic: true` in `withAndroidCleartextTraffic` (`src/android.ts:257-285`) and writes `android:usesCleartextTraffic="true"` on `<application>` in `AndroidManifest.xml`.
- **`app.config.ts` iOS ATS & Local Network Privacy:** Configure directly under `ios.infoPlist` in `app.config.ts`:
  ```ts
  ios: {
    infoPlist: {
      NSLocalNetworkUsageDescription:
        "Aplikasi memerlukan akses jaringan lokal (Wi-Fi toko) untuk terhubung ke server kasir dan printer Toko Rejeki.",
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: false,
        NSAllowsLocalNetworking: true,
      },
    },
  }
  ```
- **Light Mode Lock:** Set `userInterfaceStyle: "light"` in `app.config.ts` (overriding `expo-template-default`'s `"automatic"`), matching `Apps_Toko_Rejeki/apps/src/app/globals.css:105-113` so system dark mode does not turn navigation bars or inputs dark against Velocity Blue cards.

### Anti-Patterns to Avoid
- **Calling `response.headers.getSetCookie()` unconditionally:** Throws `TypeError` in React Native `whatwg-fetch@3.6.20` (`getSetCookie` is `undefined`).
- **Calling `GET /api/health` for pre-login `"Tes Koneksi"`:** Returns `401` when unauthenticated (`health/route.ts:8-12`); always use `GET /api/settings` pre-login.
- **Using `expo-secure-store` with `requireAuthentication: true`:** Fails in Expo Go because Expo Go lacks `NSFaceIDUsageDescription` (`SecureStore.d.ts` lines 718-719).
- **Wiping `SecureStore` session on any `403`:** Feature `403` is a role mismatch (`apiAuth.ts:88-90`); ONLY `401` (any endpoint) or `403` from `GET /api/auth/me` (`me/route.ts:69-71`) indicates revoked/disabled account session.
- **Testing Login/Logout mutations in Expo Web (`localhost:8081`):** Browser attaches `Sec-Fetch-Site: cross-site`/`same-site`, causing `middleware.ts:14` to return `403 "Permintaan lintas-situs ditolak."`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Encrypted on-device token/snapshot storage | Custom AES + AsyncStorage wrapper | `expo-secure-store` (`setItemAsync` / `getItemAsync` / `deleteItemAsync`) | Native iOS Keychain & Android Keystore encryption works in Expo Go out of the box for `<2KB` payloads. |
| Auth redirect & back-stack teardown | Manual `useEffect` + `router.replace` listeners in every screen | Expo Router `<Stack.Protected guard={...}>` + `key={id:role}` | Automatically prevents deep-link bypasses and prunes unauthorized history entries (`mapProtectedScreen.js`). |
| Server URL & form schema validation | Ad-hoc regex chains with loose `any` casts | `zod` (`^4.6.7`) | Catches malformed LAN URLs (missing protocol, accidental paths/trailing slashes, whitespace) cleanly with typed error messages. |
| Native `AndroidManifest.xml` / `Info.plist` patching | Manual `android/` & `ios/` edits committed to git | `app.config.ts` + `expo-build-properties` plugin | Keeps Continuous Native Generation (CNG) reproducible across SDK upgrades and EAS cloud builds. |
| Font asset loading & FOUT prevention | System font fallbacks or async text jumps | `@expo-google-fonts/*` + `useFonts` + `expo-splash-screen` | Guarantees `Hanken Grotesk`, `Inter`, and `JetBrains Mono` render identically to `design.md` before first paint. |

---

## Common Pitfalls

### Pitfall 1: `response.headers.getSetCookie` is `undefined` in `expo/fetch`
**What goes wrong:** Code calls `response.headers.getSetCookie()` directly on `POST /api/auth/login` response and crashes with `TypeError: response.headers.getSetCookie is not a function`.  
**Why it happens:** Verified in `expo@58.0.26/src/winter/runtime.native.ts` + `FetchResponse.ts` + `whatwg-fetch@3.6.20`: `FetchResponse.headers` instantiates `whatwg-fetch`'s `Headers`, which only implements `get`, `has`, `append`, `set`, `delete`, `forEach`, `keys`, `values`, `entries` — never `getSetCookie()`.  
**How to avoid:** Read `_rawHeaders` first, then `headers.get("set-cookie")`, then optional `getSetCookie?.()`, and match `pos_session=([A-Za-z0-9_.-]+)`. Test on a real Android/iOS device in the Phase 1 spike (`D-05` escalation gate if OS strips `HttpOnly` `Set-Cookie` completely).

### Pitfall 2: Calling `GET /api/health` in Pre-Login "Tes Koneksi"
**What goes wrong:** `"Tes Koneksi"` on Login fails with HTTP `401` even though the server is reachable.  
**Why it happens:** `apps/src/app/api/health/route.ts:9` requires `ROLES_STAFF` authentication.  
**How to avoid:** Use `GET /api/settings` for pre-login connectivity testing (`D-02`), checking `res.ok && json?.success === true` and caching `storeName` / `storeLogo` into local UI state.

### Pitfall 3: `create-expo-app` Failing in Non-Empty Workspace & `app.config.ts` Scheme/Dark Mode
**What goes wrong:** Running `npx create-expo-app@latest .` fails due to existing `GEMINI.md` / `.planning/`, or leaving `"userInterfaceStyle": "automatic"` breaks Velocity Blue light contrast when the phone has Dark Mode enabled.  
**Why it happens:** Existing GSD planning files live in the workspace root, and `expo-template-default` defaults to `"automatic"` theme.  
**How to avoid:** Scaffold into `_tmp_expo`, move files into root without touching `.git`/`.planning`/`GEMINI.md`, and explicitly configure `userInterfaceStyle: "light"` and `backgroundColor: "#f9f9ff"` in `app.config.ts`.

### Pitfall 4: `expo-secure-store` Key Characters & Biometric Crash in Expo Go
**What goes wrong:** Calling `SecureStore.setItemAsync("https://192.168.1.10:3000", ...)` or passing `{ requireAuthentication: true }` throws native exceptions on iOS/Android.  
**Why it happens:** `SecureStore.d.ts:791` restricts keys to `[A-Za-z0-9._-]`, and `requireAuthentication: true` requires `NSFaceIDUsageDescription` absent from Expo Go (`SecureStore.d.ts:718`).  
**How to avoid:** Use fixed alphanumeric keys (`pos_session_token`, `pos_user_snapshot`, `pos_server_base_url`), keep values well under 2048 bytes (`AuthSessionUser` + token + URL are ~400–600 bytes total), and omit `requireAuthentication`.

### Pitfall 5: `429` Countdown & Android Emulator `10.0.2.2` Confusion
**What goes wrong:** On `429`, UI disables login permanently or shows static error text; or developer tests `http://localhost:3000` inside Android Emulator and gets `Network request failed`.  
**Why it happens:** `login/route.ts:43-50` returns dynamic `retryAfter` seconds (`2, 4, 8, ... 60s`), while Android Emulator maps `localhost` to the emulator itself (`10.0.2.2` reaches host PC).  
**How to avoid:** Decrement `retryAfterSeconds` with a 1-second `setInterval` (cleaning up on unmount) that disables the submit button until `0`, and display `http://10.0.2.2:3000` + `http://192.168.x.x:3000` quick-fill/helper hints in the collapsible Server URL panel (`D-01`).

---

## Code Examples

### 1. `app.config.ts` (SDK 58 + Light Mode + Cleartext LAN + iOS ATS)
```ts
// Source: expo-template-default@58.0.35/app.json + expo-build-properties@58.0.12/src/android.ts
import type { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Toko Rejeki POS",
  slug: "toko-rejeki-mobile",
  version: "1.0.0",
  orientation: "portrait",
  scheme: "tokorejekipos",
  userInterfaceStyle: "light",
  backgroundColor: "#f9f9ff",
  icon: "./assets/images/icon.png",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.tokorejeki.posmobile",
    infoPlist: {
      NSLocalNetworkUsageDescription:
        "Aplikasi memerlukan akses jaringan lokal (Wi-Fi toko) untuk terhubung ke server API Toko Rejeki.",
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: false,
        NSAllowsLocalNetworking: true,
      },
    },
  },
  android: {
    package: "com.tokorejeki.posmobile",
    predictiveBackGestureEnabled: false,
    adaptiveIcon: {
      backgroundColor: "#00478d",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#00478d",
        image: "./assets/images/splash-icon.png",
        imageWidth: 96,
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          usesCleartextTraffic: true,
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
});
```

### 2. `pos_session` Cookie Extractor & Transport (`cookieParser.ts` + `apiClient.ts`)
```ts
// Source: Verified against expo@58.0.26 FetchResponse.ts, NativeRequest.kt, ExpoURLSessionTask.swift,
// whatwg-fetch@3.6.20/fetch.js, and Apps_Toko_Rejeki/apps/src/lib/session.ts:3-66
import { fetch } from "expo/fetch";

type FetchResponseWithRaw = Response & {
  _rawHeaders?: [string, string][];
  headers: Headers & { getSetCookie?: () => string[] };
};

export function extractPosSessionFromResponse(res: Response): string | null {
  const candidates: string[] = [];
  const rawRes = res as FetchResponseWithRaw;

  // 1. Standard WinterCG/Node API (available in Jest/Node test environments)
  if (typeof rawRes.headers?.getSetCookie === "function") {
    candidates.push(...rawRes.headers.getSetCookie());
  }

  // 2. Direct native header tuples on expo/fetch FetchResponse (avoids whatwg-fetch comma join)
  if (Array.isArray(rawRes._rawHeaders)) {
    for (const [key, value] of rawRes._rawHeaders) {
      if (key.toLowerCase() === "set-cookie") {
        candidates.push(value);
      }
    }
  }

  // 3. Fallback to Headers.get("set-cookie") (safe for [A-Za-z0-9_.-]+ base64url HMAC tokens)
  const headerStr = res.headers?.get?.("set-cookie");
  if (headerStr) {
    candidates.push(headerStr);
  }

  for (const raw of candidates) {
    const match = raw.match(/(?:^|,\s*|;\s*|\s)pos_session=([A-Za-z0-9_.-]+)/i);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
}

export async function apiFetch(
  baseUrl: string,
  path: string,
  options: RequestInit & { sessionToken?: string | null; timeoutMs?: number } = {}
): Promise<Response> {
  const { sessionToken, timeoutMs = 8000, headers: initHeaders, ...rest } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers = new Headers(initHeaders);
  if (sessionToken) {
    headers.set("Cookie", `pos_session=${sessionToken}`);
  }
  if (rest.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  try {
    return await fetch(`${baseUrl}${path}`, {
      ...rest,
      headers,
      credentials: "omit", // Verified: sets CookieJar.NO_COOKIES (Android) & httpShouldHandleCookies=false (iOS)
      signal: options.signal ?? controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}
```

### 3. Root `<Stack.Protected>` + Keyed `(app)/_layout.tsx` + 4-Tab Shell (`D-07`, `D-08`)
```tsx
// src/app/_layout.tsx
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { useFonts } from "expo-font";
import {
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} from "@expo-google-fonts/hanken-grotesk";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono";
import { AuthProvider, useAuth } from "@/context/AuthContext";

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { user, isHydrated } = useAuth();
  const [fontsLoaded] = useFonts({
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_500Medium,
  });

  useEffect(() => {
    if (isHydrated && fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [isHydrated, fontsLoaded]);

  if (!isHydrated || !fontsLoaded) return null;

  const isAuthenticated = Boolean(user);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}
```

```tsx
// src/app/(app)/_layout.tsx — Reset navigation stack cleanly on user/role switch (D-07)
import { Slot } from "expo-router";
import { useAuth } from "@/context/AuthContext";

export default function AuthenticatedAppLayout() {
  const { user } = useAuth();
  const navKey = user ? `${user.id}:${user.role}` : "guest";
  return <Slot key={navKey} />;
}
```

---

## Physical Device & Emulator Spike Protocol (Phase 1 Exit Gate)

Before Phase 1 is signed off (and before starting Phase 2), execute this live transport verification against the running `Apps_Toko_Rejeki` Next.js server (`npm run start` or `npm run dev` on port `3000` with Windows Firewall allowing inbound TCP `3000` on private LAN):

1. **Pre-Flight Environment Setup:**
   - PC Host LAN IP (e.g., `http://192.168.x.x:3000`) reachable from phone on same Wi-Fi, OR Android Emulator (`Medium_Phone`) using `http://10.0.2.2:3000`.
   - Start Phase 1 app in **Expo Go** on physical Android (and physical iOS if available) plus Android Emulator.
2. **Test 1 — Pre-Login Server URL & Reachability (`AUTH-02`):**
   - Open collapsible `"Alamat Server API"`, enter `http://<PC_IP>:3000`, tap `"Tes Koneksi"`.
   - **Pass criterion:** `GET /api/settings` returns `200`, banner turns emerald, and Login header updates with `storeName` / `storeLogo`.
3. **Test 2 — `Set-Cookie` Capture & Login Matrix (`AUTH-01`, `D-03`):**
   - Test empty inputs (`400`), wrong password (`401`), repeated failures (`429` live countdown timer), disabled test user (`403`), and valid `kasir`/`admin`/`owner` credentials (`200`).
   - **Critical instrumentation check (Spike Gate):** Log/verify in `__DEV__` telemetry (never logging the raw token value itself, only boolean + length!) that `extractPosSessionFromResponse(res)` extracted a non-empty `pos_session` string and persisted it in `expo-secure-store`.
4. **Test 3 — Cold-Kill + Offline Relaunch (`AUTH-03`):**
   - Log in as valid user → confirm 4-tab shell opens.
   - **Force-kill** the Expo Go / app process completely (Android Recents swipe-away + Wait 5s; NOT Fast Refresh).
   - Enable **Airplane Mode** (or disconnect Wi-Fi) → reopen app.
   - **Pass criterion:** App boots directly into the 4-tab shell (`Kasir`) displaying cached user name/role without kicking back to Login.
5. **Test 4 — Cold-Kill + Online Revalidation (`AUTH-03`, `D-04`):**
   - Re-enable Wi-Fi (while `Apps_Toko_Rejeki` is online) → force-kill and reopen app.
   - **Pass criterion:** `GET /api/auth/me` receives the manual `Cookie: pos_session=...` header and returns HTTP `200` (NOT `401`!).
   - **Stop & Consult Trigger (`D-05`):** If `extractPosSessionFromResponse(res)` returns `null` (because Android `OkHttp` or iOS `URLSession` / Expo Go strips `HttpOnly` `Set-Cookie` from `_rawHeaders` & `headers`) OR if `GET /api/auth/me` returns `401` after cold relaunch when `pos_session` was valid, **HALT Phase 1 immediately** and consult the user with exact device logs before proposing a small backwards-compatible `Authorization: Bearer` opt-in in `Apps_Toko_Rejeki/apps/src/lib/apiAuth.ts` & `login/route.ts` (or switching to `expo-dev-client` + native cookie manager).
6. **Test 5 — Revocation, DB-Offline & Account Switch (`AUTH-03`, `AUTH-04`, `NAV-04`):**
   - Stop PostgreSQL (keeping Next.js up -> `503` on writes, `200 { offline: true }` on `/me`) → relaunch app → verify user stays logged in.
   - Deactivate user or change password on PC → trigger `/api/auth/me` → verify `403` (inactive) / `401` (`pw_stamp` mismatch) logs user out cleanly to Login.
   - Verify Logout modal while Airplane Mode is ON (`POST /api/auth/logout` fails network) still clears `SecureStore` and navigates to Login (`AUTH-04`).
   - Log in as `owner`, switch to `Pengaturan`, log out, log in as `kasir` → verify `Produk` shows Read-Only badge/banner and Android Back button cannot pop to prior `owner` state (`D-07`, `D-08`).
7. **Test 6 — Standalone Cleartext Check (Optional / Pre-Phase 3 Gate):**
   - Verify `npx expo prebuild --platform android --clean` (or inspect generated `android/app/src/main/AndroidManifest.xml`) confirms `android:usesCleartextTraffic="true"` is emitted by `expo-build-properties`.

---

## State of the Art

| Old Approach | Current Approach (SDK 58) | Impact for Phase 1 |
|--------------|---------------------------|--------------------|
| `expo-router` `<Redirect />` in effect hooks | `<Stack.Protected guard={...}>` (`Protected.d.ts`) | Declarative auth & role gating with automatic stack cleanup when guards flip. |
| `@react-native-async-storage/async-storage` + `@react-native-cookies/cookies` | `expo-secure-store` (small auth) + `expo/fetch` (`credentials: "omit"`, manual `Cookie`) | Works 100% in Expo Go; avoids deprecated legacy-bridge cookie packages. |
| `create-expo-app` older JS/TS templates | `create-expo@5.1.9` + `expo-template-default@58.0.35` (`src/app/`, `typescript@~6.0.3`) | Routes live cleanly under `src/app/` out of the box with `typedRoutes: true`. |
| ESLint `.eslintrc.js` | Flat `eslint.config.js` via `eslint-config-expo/flat` (`58.0.4`) | Supports TypeScript, React 19, and platform suffixes (`.ios.ts`, `.android.ts`). |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Physical Android and iOS Expo Go expose `Set-Cookie` for `pos_session` (`httpOnly: true`) via `_rawHeaders` or `headers.get("set-cookie")` without OS/proxy stripping | Pattern 1 / Spike | Caught immediately by Phase 1 Physical Device Spike (`D-05`), triggering user consultation for `Authorization: Bearer` fallback on `Apps_Toko_Rejeki`. |
| A2 | `npx create-expo-app@latest` rejects non-empty root containing `GEMINI.md` / `.planning/`, so temp-dir scaffolding is safest | Installation | Zero risk: temp-dir move works regardless of `create-expo` allowlist rules. |
| A3 | Physical iOS device is tested via Expo Go over LAN (since Windows host has no Xcode/iOS Simulator) | Environment Availability | If no physical iOS device is available during Phase 1, Android Emulator + physical Android device prove the Android transport path while iOS ATS config is verified statically via `expo config --type public` / `prebuild`. |

---

## Open Questions (RESOLVED)

1. **Physical Device `Set-Cookie` Visibility on Target Android/iOS Hardware:**
   - What we know: `expo@58.0.26` Kotlin (`NativeResponse.kt`) and Swift (`NativeResponse.swift`) forward response headers to JS `_rawHeaders`, and `credentials: "omit"` disables native cookie jars (`CookieJar.NO_COOKIES` / `httpShouldHandleCookies = false`).
   - What's unclear: Whether any target Android OEM WebView/OkHttp stack or iOS `URLSession` in Expo Go strips `HttpOnly` `Set-Cookie` before `createResponseInit` runs.
   - **RESOLVED:** Handled deterministically via the Phase 1 Physical Device / Emulator Cold-Kill Spike (`D-03`, `D-05` in `01-CONTEXT.md`, executed in final Phase 1 spike verification plan): `authApi.ts` emits safe `__DEV__` `getSessionCaptureDiagnostics` telemetry (`{ captured, length }`), and if `captured: false` or `/api/auth/me` returns `401` on cold relaunch, execution halts immediately (`checkpoint:human-verify`, `gate="blocking-human"`) to consult the user before proposing any `Authorization: Bearer` opt-in on `Apps_Toko_Rejeki`.
2. **Physical iOS Testing Availability on Windows Host:**
   - What we know: Host OS is Windows with Android SDK (`Medium_Phone` AVD) installed, no macOS/Xcode.
   - **RESOLVED:** Phase 1 runtime verification runs on the local Android `Medium_Phone` AVD (`http://10.0.2.2:3000`) plus physical Android device over LAN Wi-Fi (`http://192.168.x.x:3000`), and optionally a physical iPhone with Expo Go over LAN if available; iOS ATS keys (`NSAllowsLocalNetworking`, `NSLocalNetworkUsageDescription`) are verified statically via `npx expo config --type public` until EAS Cloud / macOS builds run.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Expo CLI, Jest, TypeScript | ✓ | `v24.22.1` | — |
| npm | Package management | ✓ | `11.19.1` | — |
| Git | Version control | ✓ | `2.56.1.windows.1` | — |
| Java JDK | Android Gradle / keytool (if local prebuild/build) | ✓ | `17.0.17.0` | — |
| Android SDK (`adb`, `emulator`) | Emulator API verification (`10.0.2.2:3000`) | ✓ | `android-36`, `android-37.0` (AVD: `Medium_Phone`) | Physical Android + Expo Go |
| Expo Go / Physical Phone | Phase 1 LAN + cold-kill spike | External device | SDK 58 Expo Go | Android `Medium_Phone` AVD for initial automated/ADB spike |
| Xcode / iOS Simulator | Local iOS Simulator builds | ✗ (Windows host) | — | Physical iPhone + Expo Go (Dev/prod IPA via EAS Cloud later) |
| Sibling `Apps_Toko_Rejeki` Server | Live auth & `/api/settings` testing | ✓ (workspace sibling) | Next.js `16.4.6` | Jest unit mocks for offline CI |

---

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`. All Phase 1 checks must run cleanly before phase verification.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `jest` (`^30.x`) + `jest-expo` (`~58.0.15`) + `@testing-library/react-native` (`^14.1.0`) + `expo-router/testing-library` |
| Config files (Wave 0) | `jest.config.js` (`preset: "jest-expo"`), `__tests__/setup.ts` |
| Typecheck command | `npx tsc --noEmit` |
| Lint / Health commands | `npx expo lint` (`eslint-config-expo/flat`) and `npx expo-doctor` |
| Quick unit run command | `npx jest --bail` |
| Full suite command | `npx jest && npx tsc --noEmit && npx expo lint` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Login form validation, password visibility toggle, `400`/`401`/`403` errors, live `429` `retryAfter` countdown | component + unit | `npx jest __tests__/authContext.test.tsx -x` | ❌ Wave 0 |
| AUTH-02 | Server URL validation/normalization (`http://`, `https://`, `10.0.2.2`), pre-login `GET /api/settings` reachability check | unit + component | `npx jest __tests__/serverConfig.test.ts -x` | ❌ Wave 0 |
| AUTH-03 | `pos_session` extraction (`_rawHeaders` / `set-cookie` / `getSetCookie`), `SecureStore` cold boot hydration, `401` & `/me 403` clear vs feature `403` / `5xx` / network preserve | unit + spike | `npx jest __tests__/cookieParser.test.ts __tests__/apiClient.test.ts -x` + Physical Device Cold-Kill Spike | ❌ Wave 0 |
| AUTH-04 | Logout confirmation modal triggers `POST /api/auth/logout` and clears `SecureStore` even when fetch rejects offline | component + unit | `npx jest __tests__/authContext.test.tsx -x` | ❌ Wave 0 |
| NAV-01 | Root `<Stack.Protected>` switches `(auth)` ↔ `(app)` and renders 4 bottom tabs (`Kasir`, `Produk`, `Pesanan`, `Pengaturan`) | integration (`renderRouter`) | `npx jest __tests__/routingRbac.test.tsx -x` | ❌ Wave 0 |
| NAV-04 | `kasir` sees Read-Only banner on `Produk`; `admin`/`owner` do not; account switch `user.id:user.role` key resets route stack | integration (`renderRouter`) | `npx jest __tests__/routingRbac.test.tsx -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx jest --bail && npx tsc --noEmit`
- **Per wave merge:** `npx jest && npx tsc --noEmit && npx expo lint`
- **Phase gate:** Full suite green + `npx expo-doctor` clean + Physical Device / Emulator Cold-Kill Spike checklist signed off before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `jest.config.js` — `preset: "jest-expo"`, `setupFilesAfterEnv: ["<rootDir>/__tests__/setup.ts"]`, `testMatch: ["**/__tests__/**/*.test.[jt]s?(x)"]`, `moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" }`
- [ ] `__tests__/setup.ts` — In-memory `expo-secure-store` mock (`getItemAsync`/`setItemAsync`/`deleteItemAsync`), `expo-font` / `expo-splash-screen` / `expo-network` / `expo-haptics` stubs
- [ ] `__tests__/cookieParser.test.ts` — Tests `Set-Cookie` extraction from `_rawHeaders`, `headers.get("set-cookie")` with `Expires` commas, and `getSetCookie()`
- [ ] `__tests__/serverConfig.test.ts` — Tests `zod` URL validation, trailing-slash normalization, and `GET /api/settings` test-connection helper
- [ ] `__tests__/apiClient.test.ts` — Tests `Cookie` header injection (`credentials: "omit"`), `401`, `/api/auth/me` `403`, feature `403`, `503`, and network offline behavior
- [ ] `__tests__/authContext.test.tsx` — Tests cold-boot snapshot hydration, `429` countdown state, and fail-safe offline logout
- [ ] `__tests__/routingRbac.test.tsx` — Uses `expo-router/testing-library` (`renderRouter`, `screen`) to verify `<Stack.Protected>`, 4 tabs, `kasir` read-only indicator, and `user.id:user.role` stack reset
- [ ] Framework install: `npx expo install --dev jest-expo eslint-config-expo && npm install -D jest@^30.0.0 @types/jest@^30.0.0 @testing-library/react-native@^14.1.0 eslint@^9`

---

## Security Domain

`security_enforcement` is enabled (`true`) in `.planning/config.json` (ASVS Level 1).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Never store plaintext passwords on device; enforce server `429` throttle countdown UI without client bypass; rely on server `pw_stamp` revocation (`401`). |
| V3 Session Management | Yes | Store `pos_session` HMAC token ONLY in encrypted `expo-secure-store` (never `AsyncStorage` or logs); wipe `pos_session` + snapshot cleanly on logout (`maxAge: 0`), `401`, or `/api/auth/me` `403`; send `credentials: "omit"` with explicit `Cookie` header. |
| V4 Access Control | Yes | Declarative `<Stack.Protected>` guards at root and nested levels + `key={`${user.id}:${user.role}`}` stack reset on account switch; UI capability flags never replace backend `requireApiAuth`. |
| V5 Input Validation | Yes | Validate Server URL scheme (`http:` or `https:` only) and trim/validate login username/password lengths (`<= 100` / `<= 256`) with `zod`. |
| V6 Cryptography | Yes (delegated) | Do NOT attempt to verify or re-sign `pos_session` HMAC on mobile (keeps `SESSION_SECRET` exclusively on `Apps_Toko_Rejeki`). |

### Known Threat Patterns for Mobile POS Client

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Plaintext credential / token leakage on shared device | Information Disclosure | Store `pos_session` and minimal user snapshot solely in `expo-secure-store`; never log `Cookie` or `Set-Cookie` values in console/telemetry; enforce logout confirmation. |
| Stale Back-stack privilege escalation after role switch | Elevation of Privilege | Key authenticated navigator by `${user.id}:${user.role}` and wrap restricted sub-trees in `<Stack.Protected>`. |
| Accidental `403` session wipe or silent cleartext exposure outside store LAN | Denial of Service / Tampering | Distinguish `/api/auth/me` `403` from feature `403`; restrict iOS ATS to `NSAllowsLocalNetworking: true` (`NSAllowsArbitraryLoads: false`) and recommend HTTPS tunnel (`Cloudflare`) when outside store Wi-Fi. |

---

## Sources

### Primary (Verified via In-Repo Source Inspection & Live Package Manifests)
- `../Apps_Toko_Rejeki/apps/src/app/api/auth/login/route.ts`, `me/route.ts`, `logout/route.ts`, `settings/route.ts`, `health/route.ts` — Exact status codes, JSON responses, cookie attributes, and pre-auth vs staff auth requirements.
- `../Apps_Toko_Rejeki/apps/src/lib/session.ts`, `apiAuth.ts`, `loginThrottle.ts`, `auth.ts`, `db.ts`, `middleware.ts`, `types/index.ts` — `SESSION_COOKIE_NAME`, HMAC token shape, RBAC roles, backoff math, CSRF `sec-fetch-site` guard.
- `../Apps_Toko_Rejeki/design.md`, `apps/src/app/globals.css`, `apps/src/app/login/page.tsx`, `apps/src/components/Sidebar.tsx`, `apps/src/context/AuthContext.tsx` — Velocity Blue tokens, font families, role badges, and UI parity contracts.
- `unpkg.com/expo@58.0.26/` (`bundledNativeModules.json`, `src/winter/runtime.native.ts`, `src/winter/fetch/fetch.ts`, `FetchResponse.ts`, `android/src/main/java/expo/modules/fetch/NativeRequest.kt`, `ios/Expo/Fetch/ExpoURLSessionTask.swift`) & `whatwg-fetch@3.6.20/fetch.js` — Verified `credentials: "omit"` native cookie jar behavior and absence of `Headers.prototype.getSetCookie`.
- `unpkg.com/expo-router@58.0.32/` (`Protected.d.ts`, `StackClient.js`, `TabsClient.d.ts`, `mapProtectedScreen.js`, `testing-library/index.d.ts`) — Verified `<Stack.Protected>` and `renderRouter` APIs.
- `unpkg.com/expo-build-properties@58.0.12/src/android.ts`, `expo-secure-store@58.0.3/build/SecureStore.d.ts`, `expo-template-default@58.0.35/`, `jest-expo@58.0.15/jest-preset.js`, `eslint-config-expo@58.0.4/flat.js`, `lucide-react-native@1.75.0/dist/types/lucide-react-native.d.ts`.
- Live npm registry (`npm view`) and `gsd-tools query package-legitimacy check` (run 2026-11-18).

### Secondary (Official Expo Docs via `search_web`)
- `docs.expo.dev` — Expo SDK 58 release notes (`react-native@0.88`, Strict TS API, iOS 27 scene lifecycle), Expo Router Protected Routes (`Stack.Protected`), `expo-build-properties` (`usesCleartextTraffic`), `expo-secure-store` 2048-byte guidance, `expo/fetch`, and `jest-expo` + `expo-router/testing-library` docs.

---

## Metadata

**Confidence breakdown:**
- Backend API & Design Tokens (`Apps_Toko_Rejeki`): **HIGH** (100% directly read from sibling repo source files)
- SDK 58 Packages, `expo/fetch` Internals & `<Stack.Protected>` API: **HIGH** (verified directly in `unpkg.com` package files and `bundledNativeModules.json`)
- Physical Android/iOS Expo Go Cold-Kill `Set-Cookie` Behavior: **MEDIUM** (code-inspected; requires on-device Phase 1 spike execution per `D-05`)

**Research date:** 2026-11-18  
**Valid until:** 2026-12-18 (stable SDK 58 APIs; re-verify `SUS` package patch tags before running install)
