# Walking Skeleton — Apps Toko Rejeki Mobile

**Phase:** 1
**Generated:** 2026-11-18T11:25:00Z

## Capability Proven End-to-End

> A store staff member (`kasir`, `admin`, or `owner`) can configure and test the Toko Rejeki LAN/HTTPS Server URL, sign in via `POST /api/auth/login` with `pos_session` cookie persistence in `expo-secure-store`, survive a process cold-kill in offline mode inside a Velocity Blue 4-tab `<Stack.Protected>` shell, and safely log out.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Expo SDK 58 (`expo@~58.0.26`), Expo Router (`~58.0.32`), React Native `0.88.1`, React `19.3.0`, TypeScript strict (`~6.0.3`) | Mandatory stack per `GEMINI.md` and `D-09`; supports Expo Go in Phases 1–2 and CNG prebuild (`expo-dev-client`) from Phase 3. |
| Storage & Persistence | `expo-secure-store` (for `pos_session` token + compact `AuthSessionUser` snapshot) + `expo-sqlite/kv-store` (`server_base_url` + `pos_store_settings` with `storeLogo`) | Keeps Keychain/Keystore entries well below the 2048-byte native limit while enabling synchronous cold-start reads and preparing `expo-sqlite` for Phase 2 WAL catalog sync. |
| Auth & LAN Transport | `expo/fetch` (`credentials: "omit"`, manual `Cookie: pos_session=...` header, `_rawHeaders` + `set-cookie` + `getSetCookie` extraction) against `Apps_Toko_Rejeki` `/api/auth/*` and `/api/settings` | Avoids deprecated bridge cookie packages and Android/iOS native `CookieJar` flush races across force-kills and plain LAN `http://` servers (`D-03`, `D-04`, `D-05`). |
| Native Networking & Theme | `app.config.ts` with `userInterfaceStyle: "light"`, `expo-build-properties` (`usesCleartextTraffic: true`), iOS `NSAllowsLocalNetworking: true` (`NSAllowsArbitraryLoads: false`) | Guarantees LAN HTTP (`http://192.168.x.x:3000` / `http://10.0.2.2:3000`) works cleanly while locking Velocity Blue light-mode contrast (`D-09`). |
| Navigation & RBAC Shell | Root `<Stack.Protected>` (`!(auth)` / `(app)`), `(app)/_layout.tsx` keyed by `${user.id}:${user.role}`, JS `<Tabs>` 4-tab bar (`Kasir`, `Produk`, `Pesanan`, `Pengaturan`) | Automatically purges unauthorized history on logout/revocation and resets navigation stack on account switch (`D-07`, `D-08`). |
| Styling & Icons | `StyleSheet.create` + typed `src/theme/tokens.ts` (Velocity Blue `#00478d` / `#f9f9ff`) + `lucide-react-native` + `@expo-google-fonts/*` (`Hanken Grotesk`, `Inter`, `JetBrains Mono`) | Zero Metro/Babel plugin risk on RN `0.88.1` and 1:1 visual/icon parity with `Apps_Toko_Rejeki/design.md`. |
| Test Infrastructure | Jest 30 + `jest-expo` + `@testing-library/react-native` + `expo-router/testing-library` + `eslint-config-expo/flat` | Provides < 30s automated Nyquist verification for cookie extraction, URL validation, auth epoch/status matrix, and `<Stack.Protected>` routing. |

## Stack Touched in Phase 1

- [ ] **Plan `01-01` (Wave 1):** Pre-install `SUS` Package Legitimacy Gate (`expo-sqlite` included) + Project scaffold (`package.json`, `app.config.ts`, `tsconfig.json`, `eslint.config.js`, `jest.config.js`, `__tests__/setup.ts`, clean placeholder `_layout.tsx`/`index.tsx`, `npx expo-doctor`, `npx expo lint`)
- [ ] **Plan `01-02` (Wave 2):** Local Storage & Transport Core — `src/types/index.ts`, `expo-secure-store` (`pos_session_token`, `pos_user_snapshot`), `expo-sqlite/kv-store` (`pos_server_base_url`, `pos_store_settings`), `serverConfig.ts`, `cookieParser.ts`, `apiClient.ts`, `authApi.ts` (`__DEV__` diagnostics + `token === null` stale session cleanup), plus unit tests
- [ ] **Plan `01-03` (Wave 3):** Auth UI & State — Velocity Blue tokens/primitives, `RoleBadge`, collapsible `ServerUrlPanel`, `AuthContext` (`saveServerUrl` vs `testServerUrl` `ok: true` rule), `(auth)/login.tsx`, `__tests__/authContext.test.tsx`, and `__tests__/loginScreen.test.tsx`
- [ ] **Plan `01-04` (Wave 4):** Tab Screens & Logout Modal — `LogoutConfirmModal.tsx` and `(app)/(tabs)/` screens (`kasir.tsx`, `produk.tsx`, `pesanan.tsx`, `pengaturan.tsx`)
- [ ] **Plan `01-05` (Wave 5):** Routing & RBAC Integration — `<Stack.Protected>` root gate (`_layout.tsx`, `index.tsx`), keyed `(app)/_layout.tsx` (`user.id:user.role`), 4-tab JS `<Tabs>` bar (`(tabs)/_layout.tsx`), and `__tests__/routingRbac.test.tsx`
- [ ] **Plan `01-06` (Wave 6):** Local full-stack run & spike — full automated pre-flight (`jest`, `tsc`, `expo lint`, `expo-doctor`) and Physical Device / Emulator Cold-Kill Spike (`01-SPIKE-EVIDENCE.md`, `D-05` gate) against sibling `Apps_Toko_Rejeki` Next.js server

## Out of Scope (Deferred to Later Slices)

- Local SQLite relational product/category/unit schema, `/api/sync/full` (10:00 WIB / >48h), `/api/sync/delta` (5s foreground loop), and authenticated `/api/health` global header → **Phase 2**
- Kasir catalog/cart UI, multi-tab persistent `Nota`, tiered wholesale & Open Price math, web-parity checkout (`cashGiven = grandTotal`), thermal receipt preview, Server `/api/print` + `/api/wa-log`, and Bluetooth ESC/POS or Built-in HP printing → **Phase 3**
- Searchable/sortable `Produk` list → `Detail Produk`, online `admin`/`owner` CRUD & 30-day Trash Bin, live `Pesanan` tab badge, and `Detail Pesanan` resume flow → **Phase 4**
- Universal `Profil Toko & Tentang Aplikasi` page and Owner management for store logo upload, printers, staff accounts, and categories/units → **Phase 5**

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- **Phase 2:** Offline SQLite WAL catalog, foreground `/api/sync/full` + 5s `/api/sync/delta` engine, global `/api/health` status header, and manual sync controls in `Pengaturan`
- **Phase 3:** Kasir mobile POS (`Katalog`/`Nota`), multi-tab persistent orders, wholesale/Open Price math, web-parity checkout, receipt preview, and Server / Bluetooth / Built-in HP thermal printing
- **Phase 4:** `Produk` List → `Detail Produk` + online `admin`/`owner` CRUD/Trash and `Pesanan Aktif` List + badge → `Detail Pesanan` resume flow
- **Phase 5:** `Pengaturan` hub, `Profil Toko & Tentang Aplikasi` screen, and Owner store profile/logo, printer, staff, and category/unit administration
