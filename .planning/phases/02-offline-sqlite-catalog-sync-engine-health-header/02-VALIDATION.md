---
phase: "02"
slug: "offline-sqlite-catalog-sync-engine-health-header"
status: ready
nyquist_compliant: true
wave_0_complete: false
created: "2026-11-19"
validated: "2026-11-19"
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution of Phase 2 (`Offline SQLite Catalog, Sync Engine & Health Header`).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (Mobile)** | `jest` (`^30.5.2`) + `jest-expo` (`~58.0.15`) + `@testing-library/react-native` (`^14.1.0`) + `expo-router/testing-library` + Node `v24.22.1` built-in `node:sqlite` (`DatabaseSync`, SQLite `3.53.4`) |
| **Framework (Sibling Backend)** | `eslint` (`eslint-config-next` targeted on modified `sync/*` routes) + `next build --webpack` (`../Apps_Toko_Rejeki/apps`) + `psql` (`pos_supabase_db`) |
| **Config file** | `jest.config.js` (`preset: "jest-expo"`) & `__tests__/setup.ts` (extended with `node:sqlite` mock & `resetTestDatabase()` in Plan `02-03`) |
| **Quick run command** | `npx jest --bail; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx tsc --noEmit` |
| **Full suite command** | `npx jest; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx tsc --noEmit; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx expo lint` |
| **Estimated runtime** | ~24 seconds baseline (`7/7` Phase 1 suites, `48/48` tests measured `24.044 s`) |

---

## Sampling Rate

- **After every task:** Run `npx tsc --noEmit; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx expo lint` (or targeted `npx jest __tests__/<changed>.test.ts(x)` on implementation/test tasks)
- **After every plan wave:** Run wave test suites + `npx tsc --noEmit; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx expo lint` (plus `npm --prefix ../Apps_Toko_Rejeki/apps run build` on Wave 1 & Wave 8)
- **Before `/gsd-verify-work`:** Full mobile suite (`12` Jest suites) + `npx expo-doctor` + sibling backend targeted lint & build + Live Device / Emulator Phase 2 Verification Spike (`02-SPIKE-EVIDENCE.md`) signed off
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | SYNC-01, SYNC-02, SYNC-03 | T-02-02 | Blocking-human `D-12` `one-way` & `GEMINI.md` gate before modifying sibling `../Apps_Toko_Rejeki` or running PostgreSQL DDL | checkpoint | `manual (blocking-human gate before sibling backend edits)` | N/A | ⬜ pending |
| 02-01-02 | 01 | 1 | SYNC-01, SYNC-02, SYNC-03 | T-02-01, T-02-02, T-02-01-SC | Author `mini_catalog_migration.sql`, align `production_full_migration.sql`, and branch `?scope=mini` statically in `sync/full` & `sync/delta` (`400` on invalid scope, `'mini_catalog'` checkpoint, narrowed `catch (error: unknown)` at `full/route.ts:200` & `delta/route.ts:289`, zero dynamic table interpolation) | static + lint + build | `node -e "const fs=require('fs');const sql=fs.readFileSync('../Apps_Toko_Rejeki/mini_catalog_migration.sql','utf8');const prod=fs.readFileSync('../Apps_Toko_Rejeki/production_full_migration.sql','utf8');const full=fs.readFileSync('../Apps_Toko_Rejeki/apps/src/app/api/sync/full/route.ts','utf8');const delta=fs.readFileSync('../Apps_Toko_Rejeki/apps/src/app/api/sync/delta/route.ts','utf8');for(const t of ['mini_categories','mini_units','mini_products','mini_product_units','mini_wholesale_tiers']){if(!sql.includes('CREATE TABLE IF NOT EXISTS public.'+t)||!prod.includes('CREATE TABLE IF NOT EXISTS public.'+t)||!full.includes(t)||!delta.includes(t))throw new Error(t);}if(sql.includes('INSERT INTO public.mini_')||!sql.includes('WHERE deleted_at IS NULL'))throw new Error('SQL constraint');if(!full.includes('mini_catalog')||!delta.includes('mini_catalog'))throw new Error('checkpoint');"; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npm --prefix ../Apps_Toko_Rejeki/apps run lint -- src/app/api/sync/full/route.ts src/app/api/sync/delta/route.ts; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npm --prefix ../Apps_Toko_Rejeki/apps run build` | ❌ Wave 1 (`../Apps_Toko_Rejeki/mini_catalog_migration.sql`) | ⬜ pending |
| 02-01-03 | 01 | 1 | SYNC-01, SYNC-02, SYNC-03 | T-02-02 | Idempotent double-run of `mini_catalog_migration.sql` against `pos_supabase_db` confirming 5 `public.mini_*` tables exist with `0` initial rows | db migration | `node -e "const fs=require('fs'),cp=require('child_process');const sql=fs.readFileSync('../Apps_Toko_Rejeki/mini_catalog_migration.sql','utf8');for(let i=0;i<2;i++){cp.execFileSync('docker',['exec','-e','PGPASSWORD=Rejeki46','-i','pos_supabase_db','psql','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1'],{input:sql,stdio:['pipe','inherit','inherit']});}const checkSql='SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=\x27public\x27 AND table_name IN (\x27mini_categories\x27,\x27mini_units\x27,\x27mini_products\x27,\x27mini_product_units\x27,\x27mini_wholesale_tiers\x27);';const tblCount=cp.execFileSync('docker',['exec','-e','PGPASSWORD=Rejeki46','-i','pos_supabase_db','psql','-U','supabase_admin','-d','postgres','-tAc',checkSql],{encoding:'utf8'}).trim();const rowSql='SELECT (SELECT COUNT(*) FROM public.mini_categories)+(SELECT COUNT(*) FROM public.mini_units)+(SELECT COUNT(*) FROM public.mini_products)+(SELECT COUNT(*) FROM public.mini_product_units)+(SELECT COUNT(*) FROM public.mini_wholesale_tiers);';const rows=cp.execFileSync('docker',['exec','-e','PGPASSWORD=Rejeki46','-i','pos_supabase_db','psql','-U','supabase_admin','-d','postgres','-tAc',rowSql],{encoding:'utf8'}).trim();if(tblCount!=='5'||rows!=='0')process.exit(1);"` | ❌ Wave 1 (`pos_supabase_db`) | ⬜ pending |
| 02-02-01 | 02 | 2 | SYNC-01, SYNC-02 | T-02-03, T-02-02-SC | Catalog/Dual-URL types, 5 UI-SPEC `TOKENS.colors` tokens, `pos_server_config_v2` (preserving explicit `{ primaryUrl: null, fallbackUrl: null }`) & `pos_client_uuid` storage, Dual-URL `zod` validation & legacy migration | compile + lint | `npx tsc --noEmit; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx expo lint` | ✅ (extend `src/types/index.ts`, `tokens.ts`, `secureStorage.ts`, `serverConfig.ts`) | ⬜ pending |
| 02-02-02 | 02 | 2 | SYNC-01, SYNC-02, SYNC-03 | T-02-04, T-02-05 | Sticky Smart Auto Dual-URL failover (`2000ms` LAN -> Cloud only on network/502+, never on `401`/`403`/`429`/JSON `503`), `healthApi` root-JSON parser, `?scope=mini` `syncApi`, and authenticated `fetchAuthenticatedSettings` | compile + lint + unit | `npx tsc --noEmit; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx expo lint; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx jest __tests__/cookieParser.test.ts __tests__/serverConfig.test.ts __tests__/apiClient.test.ts` | ❌ Wave 2 (`healthApi.ts`, `syncApi.ts`) + extend `apiClient.ts`, `authApi.ts` | ⬜ pending |
| 02-03-01 | 03 | 3 | SYNC-01, SYNC-02, SYNC-03 | T-02-06, T-02-03-SC | `AuthContext` Dual-URL `serverConfig`, `saveServerConfig`, `testDualServerUrl`, post-auth `fetchAuthenticatedSettings`, and Wave 0 `node:sqlite` in-memory mock (`__tests__/setup.ts` + `resetTestDatabase()`) | compile + lint | `npx tsc --noEmit; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx expo lint` | ✅ (extend `AuthContext.tsx`, `__tests__/setup.ts`) | ⬜ pending |
| 02-03-02 | 03 | 3 | SYNC-01, SYNC-02, SYNC-03 | T-02-03, T-02-04, T-02-05, T-02-06 | Updated Dual-URL transport, nullable cleared config, and URL-routed `/api/settings` `authContext.test.tsx` unit suites | unit | `npx jest __tests__/cookieParser.test.ts __tests__/serverConfig.test.ts __tests__/apiClient.test.ts __tests__/authContext.test.tsx __tests__/tabScreens.test.tsx __tests__/routingRbac.test.tsx; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx tsc --noEmit; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx expo lint` | ✅ (extend `serverConfig.test.ts`, `apiClient.test.ts`, `authContext.test.tsx`) | ⬜ pending |
| 02-04-01 | 04 | 4 | SYNC-01 | T-02-07, T-02-08, T-02-04-SC | Singleton WAL `expo-sqlite` (`busy_timeout = 5000`, in-txn PRAGMA, no catalog FKs), FIFO `syncMutex`, fail-closed `sanitizeProductForRole` (`kasir` `costPrice` strip), `catalogEvents` | compile + lint | `npx tsc --noEmit; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx expo lint` | ❌ Wave 4 (`src/db/sqlite.ts`, `syncMutex.ts`, `productNormalizer.ts`, `catalogEvents.ts`) | ⬜ pending |
| 02-04-02 | 04 | 4 | SYNC-01, SYNC-02, SYNC-03, SYNC-04 | T-02-07, T-02-08 | `catalogRepo` chunked writes & role-filtered reads, bounded `syncMetaRepo` (`deleteSyncMetaKey`) & session-safe `resetCatalogCache()`, UTC+7 `syncEngine` (`10:00 WIB` recording `last_daily_sync_date` only when `serverWibNow.hour >= 10`, `>48h`, `server_time`, `client_id`, `0`-row `mini_*` support) | compile + lint | `npx tsc --noEmit; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx expo lint` | ❌ Wave 4 (`catalogRepo.ts`, `syncMetaRepo.ts`, `syncEngine.ts`) | ⬜ pending |
| 02-04-03 | 04 | 4 | SYNC-01, SYNC-02, SYNC-03, SYNC-04 | T-02-07, T-02-08 | Real `node:sqlite` unit suites for SQLite WAL/mutex/`kasir` `costPrice` isolation/reset preservation and UTC+7 WIB (`08:30 WIB` bootstrap -> `10:05 WIB` `SCHEDULED_10AM_WIB` trigger)/delta/full sync rules | unit (`node:sqlite`) | `npx jest __tests__/catalogDb.test.ts __tests__/syncEngine.test.ts; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx tsc --noEmit; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx expo lint` | ❌ Wave 4 (`__tests__/catalogDb.test.ts`, `__tests__/syncEngine.test.ts`) | ⬜ pending |
| 02-05-01 | 05 | 5 | NAV-03, SYNC-03 | T-02-09, T-02-05-SC | `SystemStatusContext` 10s `/api/health`, `15s->30s` backoff, `AppState`/`expo-network`, 30s LAN re-probe, non-flicker `isManualChecking`, safe fallback | compile + lint | `npx tsc --noEmit; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx expo lint` | ❌ Wave 5 (`src/context/SystemStatusContext.tsx`) | ⬜ pending |
| 02-05-02 | 05 | 5 | SYNC-02, SYNC-03, SYNC-04 | T-02-09, T-02-10 | `SyncEngineContext` 5s foreground delta poll, `checkpointWalPassive`, backoff, `DB_RECONNECTED` initial retry, `resetAndResyncCatalog`, and `(app)/_layout.tsx` provider stack outside keyed `<Slot>` | compile + lint | `npx tsc --noEmit; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx expo lint` | ❌ Wave 5 (`SyncEngineContext.tsx`) + extend `(app)/_layout.tsx` | ⬜ pending |
| 02-05-03 | 05 | 5 | NAV-03, SYNC-02, SYNC-03, SYNC-04 | T-02-09, T-02-10 | Fake-timer & lifecycle tests for `SystemStatusContext` + `SyncEngineContext` + `(app)/_layout.tsx` `routingRbac` continuity | unit + integration | `npx jest __tests__/syncEngineContext.test.tsx __tests__/catalogDb.test.ts __tests__/syncEngine.test.ts __tests__/routingRbac.test.tsx; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx tsc --noEmit; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx expo lint` | ❌ Wave 5 (`__tests__/syncEngineContext.test.tsx`) | ⬜ pending |
| 02-06-01 | 06 | 6 | NAV-03, SYNC-02 | T-02-11, T-02-06-SC | `EmptyStateCard` (`iconBadgeVariant`), `TabScreenHeader` global sub-bar (`LAN Online`/`Cloud Online`/`Standby Baca Saja`/`Offline`/`Memeriksa...` + Sync pill, `50px` `hitSlop`), and `InitialSyncBanner` + `CatalogBootstrapEmptyState` | compile + lint | `npx tsc --noEmit; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx expo lint` | ❌ Wave 6 (`InitialSyncBanner.tsx`) + extend `EmptyStateCard.tsx`, `TabScreenHeader.tsx` | ⬜ pending |
| 02-06-02 | 06 | 6 | SYNC-04 | T-02-11, T-02-12 | `ResetCacheConfirmModal` and universal `SyncControlCard` (metric tiles, WIB timestamps, 3 action buttons, 5–10 `sync_audit` entries) | compile + lint | `npx tsc --noEmit; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx expo lint` | ❌ Wave 6 (`ResetCacheConfirmModal.tsx`, `SyncControlCard.tsx`) | ⬜ pending |
| 02-06-03 | 06 | 6 | NAV-03, SYNC-02, SYNC-04 | T-02-11, T-02-12 | Component suites `systemStatusHeader.test.tsx` + `pengaturanSync.test.tsx` and existing `tabScreens.test.tsx` continuity | component | `npx jest __tests__/systemStatusHeader.test.tsx __tests__/pengaturanSync.test.tsx __tests__/tabScreens.test.tsx; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx tsc --noEmit; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx expo lint` | ❌ Wave 6 (`systemStatusHeader.test.tsx`, `pengaturanSync.test.tsx`) | ⬜ pending |
| 02-07-01 | 07 | 7 | SYNC-02 | T-02-13, T-02-07-SC | Dual-URL `ServerUrlPanel` (LAN + Cloud inputs, 3 hint chips, cleared-config auto-expand) + `login.tsx` unconfigured banner guard | compile + lint | `npx tsc --noEmit; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx expo lint` | ✅ (extend `ServerUrlPanel.tsx`, `login.tsx`) | ⬜ pending |
| 02-07-02 | 07 | 7 | NAV-03, SYNC-02, SYNC-04 | T-02-14 | `pengaturan.tsx` (`SyncControlCard`, active route badges, `ResetCacheConfirmModal`), `kasir.tsx`, and `produk.tsx` empty/populated role-safe states | compile + lint | `npx tsc --noEmit; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx expo lint` | ✅ (extend `pengaturan.tsx`, `kasir.tsx`, `produk.tsx`) | ⬜ pending |
| 02-07-03 | 07 | 7 | NAV-03, SYNC-02, SYNC-04 | T-02-13, T-02-14 | Updated `loginScreen.test.tsx` (defaults + `{ primaryUrl: null, fallbackUrl: null }` cleared-config branch) + `tabScreens.test.tsx`, and full 12-suite mobile regression gate | component + full suite | `npx jest; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx tsc --noEmit; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx expo lint` | ✅ (update `loginScreen.test.tsx`, `tabScreens.test.tsx`) | ⬜ pending |
| 02-08-01 | 08 | 8 | NAV-03, SYNC-01, SYNC-02, SYNC-03, SYNC-04 | T-02-15, T-02-08-SC | Complete mobile + sibling backend pre-flight (`jest`, `tsc`, `expo lint`, `expo-doctor`, `expo config`, targeted backend `eslint` + `next build`) and environment setup in `02-SPIKE-EVIDENCE.md` | pre-flight | `npx jest; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx tsc --noEmit; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx expo lint; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx expo-doctor; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; node -e "const c=JSON.parse(require('child_process').execSync('npx expo config --type public --json',{encoding:'utf8'}));const checks=[c.userInterfaceStyle==='light',Boolean(c.ios?.infoPlist?.NSAppTransportSecurity?.NSAllowsLocalNetworking),(c.plugins||[]).some(p=>Array.isArray(p)?p[0]==='expo-build-properties':false),Boolean((c.plugins||[]).find(p=>Array.isArray(p)?p[0]==='expo-build-properties':false)?.[1]?.android?.usesCleartextTraffic)];if(checks.includes(false)){console.error('Missing light/cleartext/ATS config');process.exit(1)}"; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npm --prefix ../Apps_Toko_Rejeki/apps run lint -- src/app/api/sync/full/route.ts src/app/api/sync/delta/route.ts; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npm --prefix ../Apps_Toko_Rejeki/apps run build` | ❌ Wave 8 (`02-SPIKE-EVIDENCE.md`) | ⬜ pending |
| 02-08-02 | 08 | 8 | NAV-03, SYNC-01, SYNC-02, SYNC-03, SYNC-04 | T-02-15 | Live Device / Emulator Phase 2 Verification Spike (`blocking-human` gate) | checkpoint | `manual (on-device LAN<->Cloud failover, SQLite WAL cold-kill, ?scope=mini, E1-E5 360px checks)` | ❌ Wave 8 (`02-SPIKE-EVIDENCE.md`) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 & Phase 2 Test Inventory

- [ ] `__tests__/setup.ts` — Extended in Plan `02-03` with in-memory `node:sqlite` (`DatabaseSync(":memory:")`) `expo-sqlite` mock + `resetTestDatabase()`
- [ ] `__tests__/serverConfig.test.ts` — Extended in Plan `02-03` for Dual-URL defaults, explicit `{ primaryUrl: null, fallbackUrl: null }` cleared-config preservation, legacy URL migration, LAN-only/Cloud-only validation, and LAN->Cloud test probe
- [ ] `__tests__/apiClient.test.ts` — Extended in Plan `02-03` for sticky `activeRoute`, 2s LAN->Cloud failover preserving `pos_session`, strict no-failover on `401`/`403`/`429`/JSON `503`, `/api/health` root JSON, `?scope=mini` sync transports, and `fetchAuthenticatedSettings`
- [ ] `__tests__/authContext.test.tsx` — Extended in Plan `02-03` with URL-routed `/api/settings` mocks (`120-200`, `340-390`) plus `serverConfig`, `saveServerConfig`, `testDualServerUrl`, and post-auth `fetchAuthenticatedSettings`
- [ ] `__tests__/catalogDb.test.ts` — Created in Plan `02-04` testing WAL/busy_timeout PRAGMAs, chunked >500-ID deletes, `syncMutex` FIFO queuing, `kasir` `costPrice` isolation, and `resetCatalogCache()` preservation
- [ ] `__tests__/syncEngine.test.ts` — Created in Plan `02-04` testing UTC+7 `10:00 WIB` (including `08:30 WIB` pre-10AM sync -> `10:05 WIB` `SCHEDULED_10AM_WIB` trigger) & clock-skew math, `>48h` force full sync, verbatim `server_time` cursor, Hermes-safe `client_id`, empty `mini_*` (`0` rows) success, and offline retention
- [ ] `__tests__/syncEngineContext.test.tsx` — Created in Plan `02-05` testing 10s `/api/health`, 5s foreground delta poll, `AppState` pause + `checkpointWalPassive`, `expo-network` recovery, `15s -> 30s` backoff, 30s LAN re-probe, and non-throwing context fallbacks
- [ ] `__tests__/systemStatusHeader.test.tsx` — Created in Plan `02-06` testing `E1`/`E3` header status pills, `hitSlop`, Reduce Motion, tap-to-refresh/delta, anti-flicker, `InitialSyncBanner`, and `EmptyStateCard` `iconBadgeVariant`
- [ ] `__tests__/pengaturanSync.test.tsx` — Created in Plan `02-06` testing `E4`/`E5` `SyncControlCard`, WIB timestamps, 5–10 `sync_audit` entries, manual Delta/Full triggers, and `ResetCacheConfirmModal`
- [ ] `__tests__/loginScreen.test.tsx` — Updated in Plan `02-07` for Dual-URL defaults (`192.168.1.100:3000` + `kasir.tokorejeki.my.id`), cleared `{ primaryUrl: null, fallbackUrl: null }` auto-expand, `server-lan-input`/`server-cloud-input`, `Cloud` hint chip, and LAN/Cloud test banners
- [ ] `__tests__/tabScreens.test.tsx` — Updated in Plan `02-07` for Dual-URL `Pengaturan`, `Katalog Lokal Belum Tersinkron` vs `Katalog Kasir Mini Masih Kosong`, and standalone `<AuthProvider>` rendering

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Status |
|----------|-------------|------------|-------------------|--------|
| Smart Auto LAN (`192.168.x.x:3000`) ↔ Cloud (`https://kasir.tokorejeki.my.id`) failover & 30s/tap LAN recovery with `pos_session` continuity | SYNC-02, SYNC-03, NAV-03 | Requires real mobile networking, LAN timeout behavior, and Cloudflare HTTPS tunnel routing | Test in Expo Go on physical phone/emulator: connect over LAN (`LAN Online`), sever/timeout LAN URL -> observe ~2s automatic switch to `Cloud Online` without logout -> restore LAN -> observe automatic switch back to `LAN Online` within 30s or upon tapping `db-health-pill` | ⬜ pending |
| Empty & populated `?scope=mini` sync + OS force-kill offline SQLite WAL survival + `kasir` `costPrice` isolation + `Reset Cache Lokal` | SYNC-01, SYNC-02, SYNC-03, SYNC-04 | Requires native `expo-sqlite` WAL file handle across OS process termination and live PostgreSQL `mini_*` tables | Confirm `0`-row `Katalog Kasir Mini Masih Kosong` initially; seed 1 temporary `mini_*` item via `psql`, watch 5s foreground delta update count to `1`, force-kill app, toggle Airplane Mode ON, reopen app and confirm count `1` & `Offline` pill; switch `owner` -> `kasir` (`Produk` read-only, no `costPrice`), run `Reset Cache Lokal` confirming session/URLs remain; delete temporary test row | ⬜ pending |
| `02-UI-SPEC.md` `E1`–`E5` `360px` & 150–200% OS font scaling visual backstops | NAV-03, SYNC-02, SYNC-04 | Native font scaling, pill wrapping, touch target feel, and modal scrolling require visual inspection on device | Verify on ~360px phone/emulator and elevated OS font size: header pills (`Standby Baca Saja` + `Sync Penuh...`), `ServerUrlPanel` summary/inputs/chips, `Pengaturan` 3 tiles/3 buttons/5–10 `sync_audit` rows, and `ResetCacheConfirmModal` scroll inside `90%` height without clipping or horizontal overflow | ⬜ pending |

---

## Nyquist Requirement-to-Test Coverage Audit

| Requirement | Status | Automated Test Suites | Live / Device Evidence |
|-------------|--------|-----------------------|------------------------|
| `NAV-03` | **COVERED** | `__tests__/apiClient.test.ts`, `__tests__/syncEngineContext.test.tsx`, `__tests__/systemStatusHeader.test.tsx`, `__tests__/tabScreens.test.tsx` | `02-SPIKE-EVIDENCE.md` (Steps 1, 2, 4) |
| `SYNC-01` | **COVERED** | `__tests__/catalogDb.test.ts`, `__tests__/apiClient.test.ts`, `__tests__/serverConfig.test.ts`, `__tests__/tabScreens.test.tsx` | `02-SPIKE-EVIDENCE.md` (Steps 2, 3) |
| `SYNC-02` | **COVERED** | `__tests__/syncEngine.test.ts`, `__tests__/syncEngineContext.test.tsx`, `__tests__/systemStatusHeader.test.tsx` | `02-SPIKE-EVIDENCE.md` (Steps 2, 3) |
| `SYNC-03` | **COVERED** | `__tests__/syncEngine.test.ts`, `__tests__/syncEngineContext.test.tsx`, `__tests__/apiClient.test.ts` | `02-SPIKE-EVIDENCE.md` (Steps 1, 2) |
| `SYNC-04` | **COVERED** | `__tests__/catalogDb.test.ts`, `__tests__/syncEngineContext.test.tsx`, `__tests__/pengaturanSync.test.tsx`, `__tests__/tabScreens.test.tsx` | `02-SPIKE-EVIDENCE.md` (Steps 3, 4) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or checkpoint/Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers `node:sqlite` harness + all new & updated Phase 2 test suites
- [x] No watch-mode flags
- [x] Feedback latency < 30s (baseline `24.044 s`, quick runs per suite `< 10 s`)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
