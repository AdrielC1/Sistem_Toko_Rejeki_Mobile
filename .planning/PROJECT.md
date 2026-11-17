# Apps Toko Rejeki Mobile

## What This Is

Apps Toko Rejeki Mobile adalah aplikasi kasir (POS) mobile mandiri berbasis **Expo + Expo Router + TypeScript** yang mereferensikan desain antarmuka mobile dan menghubungkan langsung ke layanan API (Web Service) dari proyek web **Apps Toko Rejeki**. Aplikasi ini digunakan oleh staf toko (**Kasir**, **Admin**, dan **Owner**) untuk melayani transaksi harian, memantau katalog produk beserta harga grosir, mengelola nota tertunda secara lokal, serta mengakses pengaturan dan profil aplikasi lewat navigasi Bottom Navigation Bar 4 tab.

## Core Value

Transaksi kasir dan pengelolaan katalog produk Toko Rejeki berjalan cepat dan konsisten di perangkat mobile—tetap dapat dipakai saat koneksi terputus melalui persistensi sesi dan sinkronisasi katalog lokal, serta tersinkron dengan server API Toko Rejeki saat online.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Autentikasi login/logout ke `/api/auth/login`, `/api/auth/me`, dan `/api/auth/logout` dengan persistensi sesi lokal agar tetap masuk saat offline
- [ ] Bottom Navigation Bar 4 tab (`Kasir`, `Produk`, `Pesanan`, `Pengaturan`) dengan kontrol akses peran (`kasir` dapat mengakses `Produk` dalam mode *read-only*)
- [ ] Halaman Kasir mobile (toggle `Katalog` & `Nota`, pencarian/filter kategori, multi-tab nota, satuan konversi & harga grosir, Open Price kustom, diskon, preview struk, cetak ke Printer Bluetooth / Built-in HP / Server `/api/print`, dan log `/api/wa-log`)
- [ ] Halaman Daftar Produk + Halaman Detail Produk + CRUD Produk (`admin`/`owner`) melalui `/api/products`, `/api/products/[id]`, dan `/api/products/trash`
- [ ] Halaman Pesanan Aktif tersimpan lokal di perangkat dengan daftar nota tertunda yang dapat diklik ke Halaman Detail Pesanan
- [ ] Halaman Pengaturan yang memuat Profil Akun, Status Koneksi & Sinkronisasi Offline (`/api/sync/full`, `/api/sync/delta`), Profil Toko & Tentang Aplikasi (untuk semua peran), serta sub-halaman manajemen khusus `owner` (`/api/settings`, `/api/users`, `/api/categories`, `/api/units`)
- [ ] Memenuhi seluruh 5 kriteria proyek mobile (API Web Service sendiri, Bottom Navigation Bar, minimal 5 halaman, minimal 2 halaman list → halaman detail, dan 1 halaman Profile/About aplikasi)

### Out of Scope

- Pencatatan uang diterima, kalkulator kembalian, maupun metode pembayaran — diselaraskan dengan alur kasir web `Apps_Toko_Rejeki` yang berfokus langsung ke cetak struk (`cashGiven = grandTotal`, `change = 0`)
- Pembuatan backend/database baru dari nol — aplikasi mengonsumsi API Next.js yang sudah ada di proyek web `Apps_Toko_Rejeki`
- Pemindaian barcode via kamera HP pada v1 — pencarian produk menggunakan input teks SKU/barcode/nama seperti versi web mobile terlebih dahulu
- Sinkronisasi Pesanan Aktif (nota tertunda) ke tabel database server — disimpan lokal di perangkat sesuai perilaku web `POSCartContext`
- Perubahan diam-diam pada backend web `Apps_Toko_Rejeki` — segala kebutuhan perubahan backend harus dikomunikasikan kepada pengguna terlebih dahulu

## Context

- **Proyek Referensi Web**: Terletak di direktori saudara `../Apps_Toko_Rejeki` (`apps/`), dibangun menggunakan Next.js App Router (`next` ^16.4.6), TypeScript, dan PostgreSQL (`postgres`).
- **Sistem Desain**: Menggunakan palet dan tipografi **Velocity Blue** (`../Apps_Toko_Rejeki/design.md`), antara lain warna `primary: #00478d`, `primary-container: #005eb8`, `background: #f9f9ff`, `surface-card: #ffffff`, `success: #10b981`, `warning: #f59e0b`, `error: #ef4444`.
- **Struktur Navigasi Web yang Diadaptasi**: Sidebar 4 item (`Kasir`, `Daftar Produk`, `Pesanan Aktif`, `Pengaturan`) diadaptasi menjadi Bottom Navigation Bar 4 tab, dengan Halaman Profile/About digabungkan ke tab `Pengaturan` (tersedia untuk seluruh peran).
- **Catatan Teknis API & Auth**: Backend web menggunakan cookie sesi `httpOnly` (`SESSION_COOKIE_NAME`) serta pengecekan `sec-fetch-site` di `middleware.ts`. Di lingkungan React Native, persistensi cookie/sesi saat online maupun saat aplikasi dibuka ulang dalam keadaan offline menjadi area penting untuk diverifikasi di fase awal.

## Constraints

- **Tech Stack**: React Native dengan **Expo + Expo Router + TypeScript** — wajib menggunakan stack ini untuk aplikasi mobile mandiri
- **Backend Compatibility**: Mengonsumsi endpoint API yang sudah ada di `Apps_Toko_Rejeki`; setiap perubahan yang diperlukan pada backend wajib dikomunikasikan ke user terlebih dahulu sebelum dilakukan
- **Rubric Compliance**: Wajib memenuhi 5 kriteria: (1) API Web Service buatan sendiri, (2) Bottom Navigation Bar, (3) minimal 5 halaman, (4) minimal 2 halaman utama ber-list dengan klik item menuju halaman detail, (5) 1 halaman Profile/About aplikasi
- **Offline Resilience**: Sesi login dan katalog lokal harus tetap terbaca saat offline, dan nota tertunda pada `Pesanan Aktif` tersimpan persisten di perangkat

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Expo + Expo Router + TypeScript | Setup dan iterasi mobile paling cepat, mendukung file-based routing untuk tab + stack halaman detail, serta dukungan storage/jaringan yang matang | — Pending |
| Bottom Navigation Bar 4 tab (`Kasir`, `Produk`, `Pesanan`, `Pengaturan`) | Selaras 1:1 dengan 4 menu utama web sekaligus memastikan tersedia minimal 2 halaman utama ber-list → halaman detail (`Produk` & `Pesanan`) | — Pending |
| Tab `Produk` tampil *read-only* untuk peran `kasir` | Menjaga Bottom Navigation tetap utuh 4 tab untuk semua peran sekaligus membantu kasir mengecek detail produk/harga tanpa hak ubah | — Pending |
| Checkout v1 mendukung cetak Server (`/api/print`), Bluetooth Termal, & Built-in HP | Memenuhi fungsi aplikasi kasir mobile di lapangan (termasuk HP POS built-in atau printer Bluetooth portabel saat offline) sekaligus tetap mendukung printer utama toko di server, dengan catatan modul Bluetooth native memerlukan `expo-dev-client` / build native Android | — Pending |
| Pesanan Aktif disimpan lokal di perangkat | Sesuai perilaku `POSCartContext` di web dan menghindari perubahan skema database server tanpa kebutuhan mendesak | — Pending |
| Konsultasi sebelum ubah backend web | Menjaga kode produksi/web `Apps_Toko_Rejeki` tetap aman dan terkendali bila ditemukan kendala cookie/CORS di mobile | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-11-17 after initialization*
