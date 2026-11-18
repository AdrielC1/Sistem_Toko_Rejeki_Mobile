# Phase 1: Auth, LAN Transport Spike & Role-Protected Shell - Context

**Gathered:** 2026-11-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 delivers a bootable **Expo SDK 58 + Expo Router + TypeScript** mobile application shell for **Apps Toko Rejeki Mobile**, styled with the **Velocity Blue** design system (`../Apps_Toko_Rejeki/design.md`), featuring configurable **Server URL** input and connection test (`AUTH-02`), username/password authentication against `POST /api/auth/login` with password toggle and `400`/`401`/`403`/`429` handling (`AUTH-01`), offline-resilient session persistence (`pos_session` + user snapshot via `expo-secure-store`, verified by an on-device LAN/HTTP transport spike) (`AUTH-03`), fail-safe confirmation Logout (`AUTH-04`), and a **4-tab Bottom Navigation Bar** (`Kasir`, `Produk`, `Pesanan`, `Pengaturan`) enforced by `<Stack.Protected>` RBAC guards where `kasir` accesses `Produk` in read-only policy (`NAV-01`, `NAV-04`).

</domain>

<decisions>
## Implementation Decisions

### Server URL & Connectivity (`AUTH-02`)
- **D-01:** Layar Login menyediakan panel **"Alamat Server API"** yang dapat dibuka/tutup (collapsible) untuk mengubah dan menyimpan URL server (`http://192.168.x.x:3000` atau HTTPS tunnel) beserta hint helper (`http://10.0.2.2:3000` untuk Android Emulator / IP LAN PC toko).
- **D-02:** Panel Server URL menyertakan tombol **"Tes Koneksi"** yang memanggil `GET /api/settings` atau `GET /api/health` untuk memverifikasi keterjangkauan server sebelum login.

### Session & Cookie Transport Strategy (`AUTH-03`)
- **D-03:** Autentikasi menangkap cookie `pos_session` dari header `Set-Cookie` lewat `expo/fetch`, menyimpannya bersama snapshot profil pengguna (`{ id, username, fullName, role }`) ke `expo-secure-store`, dan mengirimkannya pada setiap request API lewat header `Cookie` dengan `credentials: "omit"`.
- **D-04:** Revalidasi `GET /api/auth/me` saat aplikasi dibuka online hanya menghapus sesi lokal bila server membalas `401` atau `/api/auth/me` membalas `403` (akun nonaktif/token dicabut); error jaringan atau `5xx` tetap mempertahankan sesi lokal agar staf tetap bisa masuk mode offline.
- **D-05:** Apabila hasil uji cold-kill pada perangkat fisik menunjukkan OS memblokir pembacaan `Set-Cookie` `httpOnly`, agen wajib berhenti dan **berkonsultasi dengan pengguna terlebih dahulu** sebelum mengajukan perubahan backend pada `Apps_Toko_Rejeki` (mis. fallback `Authorization: Bearer`).

### Login UI & 4-Tab RBAC Shell (`AUTH-01`, `AUTH-04`, `NAV-01`, `NAV-04`)
- **D-06:** Layar Login mengadaptasi desain kartu putih *Velocity Blue* dari `Apps_Toko_Rejeki/apps/src/app/login/page.tsx` dengan logo/inisial `TR` dan nama toko (dimuat dari cache lokal atau `GET /api/settings`), toggle tampil/sembunyi kata sandi, banner error jelas, serta countdown timer saat menerima HTTP `429`.
- **D-07:** Setelah autentikasi berhasil, pengguna masuk ke Bottom Navigation Bar **4 tab** (`Kasir`, `Produk`, `Pesanan`, `Pengaturan`) menggunakan Expo Router `<Stack.Protected>` yang di-key oleh `user.id:user.role` agar pergantian akun mereset stack navigasi secara bersih.
- **D-08:** Keempat tab tetap tampil untuk semua peran (`kasir`, `admin`, `owner`); tab `Produk` menampilkan badge/banner penanda mode *read-only* saat login sebagai `kasir`, sementara tab `Pengaturan` di Phase 1 sudah memuat kartu profil user aktif, badge role, info Server URL, dan tombol **Keluar** dengan modal konfirmasi (`POST /api/auth/logout` fail-safe offline). Tab `Kasir`, `Produk`, dan `Pesanan` menampilkan kerangka placeholder bersih siap isi untuk Phase 2–4.

### Expo Runtime & Native Networking (`app.config.ts`)
- **D-09:** Proyek dibuat menggunakan **Expo SDK 58** dengan dependensi yang 100% berjalan di **Expo Go** selama Phase 1–2 untuk iterasi cepat, sekaligus mengonfigurasi `app.config.ts` (`expo-build-properties` dengan `usesCleartextTraffic: true` Android serta `NSAllowsLocalNetworking` & `NSLocalNetworkUsageDescription` iOS) agar siap dipakai pada Development Build (`expo-dev-client`) mulai Phase 3 (modul printer Bluetooth).

### Agent's Discretion
- Detail tata letak internal komponen kartu, ukuran padding responsif, pemetaan ikon Lucide yang setara dengan Material Symbols web (`point_of_sale` -> `Calculator`/`ShoppingBag`, `inventory_2` -> `Package`, `receipt_long` -> `ReceiptText`, `settings` -> `Settings`), dan struktur utilitas pengujian unit Jest untuk auth/RBAC/storage.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets (Reference Sibling Web Project: `../Apps_Toko_Rejeki`)
- `../Apps_Toko_Rejeki/design.md` — Palet warna *Velocity Blue* (`primary: #00478d`, `primary-container: #005eb8`, `background: #f9f9ff`, `surface-card: #ffffff`, `border-subtle: #e2e8f0`, `success: #10b981`, `warning: #f59e0b`, `error: #ef4444`) dan skala tipografi (`Hanken Grotesk`, `Inter`, `JetBrains Mono`).
- `../Apps_Toko_Rejeki/apps/src/types/index.ts` — Kontrak tipe `AuthSessionUser` dan `UserRole`.
- `../Apps_Toko_Rejeki/apps/src/app/login/page.tsx` — Tata letak login, fallback nama/logo toko via `GET /api/settings`, dan pesan validasi error.
- `../Apps_Toko_Rejeki/apps/src/context/AuthContext.tsx` — Logika offline snapshot survival (`401`/`403` vs `500`/network error).
- `../Apps_Toko_Rejeki/apps/src/components/Sidebar.tsx` — Label 4 menu utama, role badge colors (`owner` purple, `admin` primary blue, `kasir` emerald), dan konfirmasi logout.

### Established Patterns
- Backend API auth (`apps/src/app/api/auth/login/route.ts`, `me/route.ts`, `logout/route.ts`) menggunakan `httpOnly` cookie `pos_session`, mengembalikan `{ success, data, error, retryAfter }`.
- Middleware (`apps/src/middleware.ts`) mengizinkan request mutasi non-browser tanpa header `sec-fetch-site`.

### Integration Points
- Workspace target `C:/Users/adrie/Desktop/Project/Apps_Toko_Rejeki_Mobile` masih kosong (baru diinisialisasi Git dan `.planning/`), sehingga Phase 1 sekaligus melakukan bootstrap proyek Expo SDK 58 + Expo Router + TypeScript.

</code_context>

<specifics>
## Specific Ideas

- Tampilan mengikuti desain mobile web `Apps Toko Rejeki` (*Velocity Blue*), hanya memindahkan navigasi utama dari Sidebar/Drawer menjadi Bottom Navigation Bar 4 tab.
- Setiap kebutuhan perubahan ke backend `Apps_Toko_Rejeki` harus dikomunikasikan kepada pengguna terlebih dahulu.

</specifics>

<deferred>
## Deferred Ideas

- Sinkronisasi katalog SQLite (`/api/sync/full`, `/api/sync/delta`) dan header status DB (`/api/health` polling 10 detik) → Phase 2
- Fitur Kasir lengkap & cetak printer Bluetooth/Built-in HP → Phase 3
- Daftar Produk lengkap, Detail Produk, CRUD Produk, dan Detail Pesanan Aktif → Phase 4
- Sub-halaman Pengaturan Owner & Profil Toko / Tentang Aplikasi lengkap → Phase 5

</deferred>
