# Requirements: Apps Toko Rejeki Mobile

**Defined:** 2026-11-17
**Core Value:** Transaksi kasir dan pengelolaan katalog produk Toko Rejeki berjalan cepat dan konsisten di perangkat mobile—tetap dapat dipakai saat koneksi terputus melalui persistensi sesi dan sinkronisasi katalog lokal, serta tersinkron dengan server API Toko Rejeki saat online.

## v1 Requirements

Requirements untuk rilis awal (v1). Setiap requirement akan dipetakan ke fase pada `ROADMAP.md`.

### Authentication & Connectivity

- [x] **AUTH-01**: Pengguna dapat login menggunakan username dan password melalui `POST /api/auth/login` dengan toggle tampil/sembunyi kata sandi serta penanganan error `400`, `401`, `403` (akun nonaktif), dan countdown `429` (throttle)
- [x] **AUTH-02**: Pengguna dapat mengonfigurasi dan menguji URL server API (`Server URL` LAN HTTP / HTTPS tunnel) dari halaman Login maupun Pengaturan
- [x] **AUTH-03**: Sesi login pengguna (`pos_session` cookie/token & profil pengguna lokal) bertahan saat aplikasi ditutup/dibuka ulang dalam mode offline dan hanya menghapus sesi ketika server memberi `401` atau `GET /api/auth/me` mengembalikan `403`
- [x] **AUTH-04**: Pengguna dapat keluar (logout) melalui modal konfirmasi yang memanggil `POST /api/auth/logout` secara fail-safe (tetap membersihkan sesi lokal saat offline)

### App Shell & Navigation

- [x] **NAV-01**: Aplikasi menampilkan Bottom Navigation Bar 4 tab utama (`Kasir`, `Produk`, `Pesanan`, `Pengaturan`) di dalam shell terproteksi (`<Stack.Protected>`) sesuai desain *Velocity Blue*
- [ ] **NAV-02**: Tab `Pesanan` pada Bottom Navigation Bar menampilkan badge jumlah nota tertunda lokal secara real-time
- [ ] **NAV-03**: Header status global menampilkan kondisi koneksi database (`/api/health`: Online / Standby Read-Only / Offline) dan status sinkronisasi katalog lokal
- [x] **NAV-04**: Sistem menegakkan hak akses peran (`kasir`, `admin`, `owner`): `kasir` melihat tab `Produk` dan `Detail Produk` dalam mode *read-only* (tanpa `costPrice` maupun aksi ubah), `admin` dapat mengelola produk, dan `owner` memiliki akses penuh termasuk sub-halaman manajemen

### Offline Catalog & Sync Engine

- [ ] **SYNC-01**: Aplikasi menyimpan katalog produk, kategori, satuan, dan pengaturan toko secara lokal di `expo-sqlite` (WAL mode) agar tetap dapat dibaca instan saat offline
- [ ] **SYNC-02**: Aplikasi melakukan sinkronisasi penuh (`GET /api/sync/full`) saat inisialisasi pertama, melewati jadwal harian 10:00 WIB, atau bila sinkronisasi terakhir lebih dari 48 jam
- [ ] **SYNC-03**: Aplikasi menjalankan polling sinkronisasi delta (`GET /api/sync/delta` berbasis `server_time` dan `client_id`) setiap 5 detik hanya saat aplikasi aktif di foreground dan koneksi tersedia
- [ ] **SYNC-04**: Pengguna dapat memicu `Cek Pembaruan (Delta)`, `Sinkronisasi Penuh`, dan `Reset Cache Lokal` secara manual serta melihat telemetri sinkronisasi di halaman Pengaturan

### Kasir POS & Checkout

- [ ] **POS-01**: Kasir dapat berpindah antara tampilan `Katalog Produk` dan `Nota Aktif` melalui segmented control serta bilah ringkasan keranjang mengambang di bawah layar
- [ ] **POS-02**: Kasir dapat mencari produk secara instan berdasarkan nama, SKU, atau barcode, memfilter berdasarkan chip kategori horizontal, dan menambahkan satuan aktif (`isActive && sellingPrice > 0`) langsung dari kartu produk
- [ ] **POS-03**: Kasir dapat mengelola beberapa nota sekaligus secara lokal (`+ Nota Baru`, pindah tab nota, `Batal`, dan `Hapus Nota` dengan konfirmasi) yang tersimpan persisten di perangkat
- [ ] **POS-04**: Sistem menghitung harga grosir bertingkat (`wholesaleTiers`) otomatis sesuai `minQty` per satuan serta mendukung penggabungan baris saat mengganti satuan
- [ ] **POS-05**: Kasir dapat mengubah kuantitas (tombol `-`/`+` dan input numerik), melakukan kustom harga satuan (*Open Price* tanpa tertimpa saat ubah qty), menghapus item, dan memberi diskon manual (`Potongan Harga`)
- [ ] **POS-06**: Kasir dapat meninjau pratinjau struk termal (`58mm`/`80mm` sesuai `previewReceiptBeforePrint` dan konfigurasi `receiptSections`) sebelum mencetak
- [ ] **POS-07**: Kasir dapat mencetak struk melalui mode **Printer Server** (`POST /api/print`, default `2x`/`3x`, `PrinterInterventionModal`: *Cetak Ulang*, *Bersihkan Antrean* `/api/print/flush`, serta peringatan `paperNearEnd`) dan memicu `POST /api/wa-log` secara non-blocking setelah cetak berhasil tanpa menghapus nota jika cetak gagal
- [ ] **POS-08**: Kasir dapat mencetak struk langsung dari perangkat mobile ke **Printer Bluetooth Termal** (ESC/POS `58mm`/`80mm`, dapat dipakai saat offline) maupun **Printer Bawaan HP / Sistem Print** (Android Print Service / terminal POS built-in) sesuai mode printer aktif pada perangkat

### Produk (List → Detail #1 & Manager CRUD)

- [ ] **PROD-01**: Pengguna dapat mencari, memfilter per kategori, dan mengurutkan daftar produk (5 mode urut: `A-Z`, `Z-A`, `Harga Terendah`, `Harga Tertinggi`, `Terbaru`) pada tab `Produk`
- [ ] **PROD-02**: Pengguna dapat mengetuk item produk untuk membuka halaman **Detail Produk** yang menampilkan SKU, barcode, kategori, daftar satuan konversi, dan harga grosir (menyembunyikan `costPrice` bagi peran `kasir`)
- [ ] **PROD-03**: Admin dan Owner dapat menambah dan mengedit produk (nama, kategori, SKU, barcode, satuan dasar dengan toggle *Tampilkan/Tidak Dijual*, satuan turunan, harga grosir) saat database online melalui `/api/products` dan `/api/products/[id]`
- [ ] **PROD-04**: Admin dan Owner dapat melakukan soft-delete produk dan mengelola **Tong Sampah 30 Hari** (pulihkan produk termasuk penanganan konflik SKU, hapus permanen, dan kosongkan sampah) melalui `/api/products/trash`

### Pesanan Aktif (List → Detail #2)

- [ ] **ORDR-01**: Pengguna dapat melihat daftar nota tertunda lokal (`items.length > 0`) atau tampilan kosong pada tab `Pesanan`
- [ ] **ORDR-02**: Pengguna dapat mengetuk item nota tertunda untuk membuka halaman **Detail Pesanan** yang menampilkan rincian barang, badge/hemat grosir, subtotal, diskon, total, rename nota lokal, aksi `Lanjutkan di Kasir`, dan `Hapus Nota`

### Pengaturan, Profile/About & Owner Admin

- [ ] **SETT-01**: Semua peran dapat melihat profil akun aktif, peran, tombol Logout, status server/DB, kontrol sinkronisasi lokal, dan mengakses halaman **Profil Toko & Tentang Aplikasi** (identitas toko, versi aplikasi, info stack/developer, dan status koneksi API)
- [ ] **SETT-02**: Owner dapat mengubah Profil & Identitas Toko termasuk memilih/mengganti dan mengompresi Logo Toko (`<= 300x300` base64) dari galeri HP melalui `PUT /api/settings` sambil tetap mempertahankan `receiptSections` dan `receiptItemConfig` yang sudah ada
- [ ] **SETT-03**: Pengguna dapat memilih mode printer perangkat (**Printer Server**, **Bluetooth Termal**, atau **Built-in / Sistem HP**), memindai & memilih perangkat printer Bluetooth, serta Owner dapat mengatur printer server (`/api/printers`), lebar kertas `58mm`/`80mm`, toggle `previewReceiptBeforePrint`, catatan kaki struk, dan `Tes Cetak` (`/api/printers/test` atau tes cetak langsung)
- [ ] **SETT-04**: Owner dapat mengelola akun staf (daftar akun, tambah akun, ubah detail/role/status aktif, reset password, dan hapus akun) melalui `/api/users` dan `/api/users/[id]`
- [ ] **SETT-05**: Owner dapat mengelola Kategori dan Satuan Barang (tambah, ubah nama, cek produk terhubung, migrasi aman antar kategori/satuan, soft-delete, serta pulihkan/hapus permanen dari Tong Sampah) melalui `/api/categories/**` dan `/api/units/**`

## v2 Requirements

Ditunda ke rilis lanjutan setelah v1 stabil.

### Checkout & Mobile Convenience

- **CHK-01**: Kasir dapat menyelesaikan transaksi secara lokal tanpa cetak printer fisik dan membagikan ringkasan struk digital ke WhatsApp / Share Sheet
- **CHK-02**: Kasir dapat memindai barcode produk langsung lewat kamera HP (`expo-camera`) pada kolom pencarian Kasir dan Produk
- **CHK-03**: Baris keranjang menampilkan saran upsell grosir (*"Tambah N lagi untuk harga grosir"*)

### Advanced POS & Admin

- **ADV-01**: Editor tata letak seksi struk drag-and-drop penuh (`ReceiptSectionBuilder`) di perangkat mobile
- **ADV-02**: Riwayat transaksi & laporan penjualan tersinkronisasi server (memerlukan penambahan skema/endpoint baru di backend)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Pencatatan uang diterima, kalkulator kembalian & metode pembayaran | Diselaraskan langsung dengan alur kasir web `Apps_Toko_Rejeki` yang langsung cetak struk (`cashGiven = grandTotal`, `change = 0`) |
| Pembuatan backend/database baru | Aplikasi mobile mengonsumsi API Next.js yang sudah ada di proyek `Apps_Toko_Rejeki` |
| Sinkronisasi `Pesanan Aktif` ke database server | Nota tertunda memang dirancang tersimpan lokal di perangkat sesuai perilaku `POSCartContext` pada web |
| Pengurangan stok barang / modul inventori kuantitas | Skema database PostgreSQL `Apps_Toko_Rejeki` tidak memiliki kolom stok barang |
| Antrean tulis offline untuk master data | Mengikuti pengaman web (`isDbOffline`) untuk mencegah konflik SKU dan harga saat offline |
| Perubahan diam-diam pada backend `Apps_Toko_Rejeki` | Setiap kebutuhan perubahan pada backend web harus dikomunikasikan kepada user terlebih dahulu |

## Traceability

Diisi otomatis saat pembuatan `ROADMAP.md`.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| NAV-01 | Phase 1 | Complete |
| NAV-02 | Phase 4 | Pending |
| NAV-03 | Phase 2 | Pending |
| NAV-04 | Phase 1 | Complete |
| SYNC-01 | Phase 2 | Pending |
| SYNC-02 | Phase 2 | Pending |
| SYNC-03 | Phase 2 | Pending |
| SYNC-04 | Phase 2 | Pending |
| POS-01 | Phase 3 | Pending |
| POS-02 | Phase 3 | Pending |
| POS-03 | Phase 3 | Pending |
| POS-04 | Phase 3 | Pending |
| POS-05 | Phase 3 | Pending |
| POS-06 | Phase 3 | Pending |
| POS-07 | Phase 3 | Pending |
| POS-08 | Phase 3 | Pending |
| PROD-01 | Phase 4 | Pending |
| PROD-02 | Phase 4 | Pending |
| PROD-03 | Phase 4 | Pending |
| PROD-04 | Phase 4 | Pending |
| ORDR-01 | Phase 4 | Pending |
| ORDR-02 | Phase 4 | Pending |
| SETT-01 | Phase 5 | Pending |
| SETT-02 | Phase 5 | Pending |
| SETT-03 | Phase 5 | Pending |
| SETT-04 | Phase 5 | Pending |
| SETT-05 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 31 total
- Mapped to phases: 31
- Unmapped: 0 ✓

---
*Requirements defined: 2026-11-17*
*Last updated: 2026-11-17 after roadmap creation*
