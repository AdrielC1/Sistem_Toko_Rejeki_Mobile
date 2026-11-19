# Phase 2: Offline SQLite Catalog, Sync Engine & Health Header - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-19
**Phase:** 2-offline-sqlite-catalog-sync-engine-health-header
**Areas discussed:** Header Status Global (`NAV-03`), Pemicu & Aturan Sync + Failover Dual Server (`SYNC-01`..`SYNC-03`), Kontrol Sync di Pengaturan (`SYNC-04`), UX Sync Awal (`SYNC-02`)

---

## Header Status Global (`NAV-03`)

### Layout Badge Status
| Option | Description | Selected |
|--------|-------------|----------|
| Sub-baris status kompak di bawah judul header | Judul tab tetap lega, 2 pill (Status DB & Status Sync) muat rapi di layar 360px pada semua 4 tab | ✓ |
| Sejajar di sisi kanan judul (`rightSlot`) | Satu pill ringkas di kanan judul | |
| Banner status terpisah hanya muncul saat bermasalah | Meluas saat Standby Read-Only atau Offline | |

### Aksi Saat Badge Diketuk
| Option | Description | Selected |
|--------|-------------|----------|
| Ketuk langsung memicu refresh (`/api/health` & delta sync) | Sama seperti web `Header.tsx`, cepat satu ketukan tanpa pop-up | ✓ |
| Ketuk membuka modal/sheet ringkasan | Detail server aktif, waktu sync, + tombol Cek Ulang | |
| Indikator pasif saja | Kontrol manual hanya lewat tab Pengaturan | |

### Detail Teks Label Status DB
| Option | Description | Selected |
|--------|-------------|----------|
| Label ringkas ramah kasir ("DB Terhubung", "Standby Baca Saja", "Offline (Lokal)") | Detail jalur hanya di Pengaturan | |
| Sertakan keterangan jalur aktif di pill ("LAN Online" vs "Cloud Online" vs "Offline") | Membedakan koneksi `192.168.1.100:3000` vs `kasir.tokorejeki.my.id` secara langsung | ✓ |

**User's choice:** Sub-baris kompak pada 4 tab, ketuk langsung refresh, label menampilkan `LAN Online` vs `Cloud Online` vs `Standby Baca Saja` vs `Offline`.

---

## Pemicu, Aturan Sync & Failover Dual Server (`SYNC-01`–`SYNC-03`)

### Topologi Fallback `https://kasir.tokorejeki.my.id`
| Option | Description | Selected |
|--------|-------------|----------|
| Server toko yang sama (via Cloudflare Tunnel / proxy HTTPS ke PC toko) | Cookie sesi & data produk identik dengan `192.168.1.100:3000` | ✓ |
| Server cloud terpisah | Database/SESSION_SECRET berbeda | |

### Perilaku Failover LAN ↔ Cloud
| Option | Description | Selected |
|--------|-------------|----------|
| Failover otomatis + prioritas balik ke LAN | Coba `192.168.1.100:3000` cepat (~2 dtk); bila gagal pakai `kasir.tokorejeki.my.id`, dan kembali ke LAN saat Wi-Fi pulih (tetap dapat di-override di Pengaturan) | ✓ |
| Failover sekali saat buka app (Sticky) | Tetap di Cloud sampai app dibuka ulang | |

### Polling Delta 5 Detik Saat Kedua Server Offline / 503
| Option | Description | Selected |
|--------|-------------|----------|
| Pertahankan SQLite lokal & backoff (15–30 dtk) saat kedua URL gagal beruntun | Hemat baterai dan otomatis kembali ke 5 detik begitu koneksi pulih | ✓ |
| Tetap polling persis tiap 5 detik tanpa jeda tambahan | Tanpa backoff | |
| Pause polling otomatis sampai user tap refresh | Manual resume | |

### Penanganan `costPrice` di SQLite Saat `kasir` Login
| Option | Description | Selected |
|--------|-------------|----------|
| Simpan katalog lengkap di SQLite lokal & blokir `costPrice` pada query/UI khusus role `kasir` | Ganti akun `kasir` ke `admin`/`owner` tidak perlu full-sync ulang | ✓ |
| Strip/nol-kan kolom `costPrice` di SQLite jika user `kasir` | Wajib full-sync ulang bila ganti role | |

**User's choice:** Server production utama `http://192.168.1.100:3000` dengan fallback HTTPS `https://kasir.tokorejeki.my.id` (server/DB sama via tunnel); failover otomatis dengan prioritas balik ke LAN; backoff 15–30 dtk saat kedua server offline; simpan penuh di SQLite namun blokir `costPrice` pada query/UI khusus `kasir`.

---

## Kontrol Sync & Telemetri di Pengaturan (`SYNC-04`)

### Hak Akses `Reset Cache Lokal`
| Option | Description | Selected |
|--------|-------------|----------|
| Semua staf (`kasir`, `admin`, `owner`) dengan dialog konfirmasi | Sama seperti web, membantu staf troubleshooting mandiri | ✓ |
| Hanya `admin` & `owner` | Disembunyikan dari `kasir` | |

### Efek Setelah Konfirmasi `Reset Cache Lokal`
| Option | Description | Selected |
|--------|-------------|----------|
| Hapus tabel katalog SQLite + metadata sync lalu langsung picu Full Sync otomatis bila online | Sesi login, Server URL, & nota tertunda lokal TIDAK dihapus | ✓ |
| Kosongkan katalog SQLite saja tanpa auto Full Sync | Staf perlu klik Sinkronisasi Penuh manual | |

### Detail Telemetri di Pengaturan
| Option | Description | Selected |
|--------|-------------|----------|
| Kartu ringkasan + 5–10 riwayat log terakhir (`sync_audit`) | Menampilkan total produk/kategori/satuan, timestamp WIB full/delta sync, jalur aktif (LAN/Cloud), serta log sukses/gagal | ✓ |
| Ringkasan angka & timestamp saja | Tanpa daftar log | |

**User's choice:** Semua staf dengan konfirmasi, auto Full Sync sesudah reset bila online (sesi/URL/nota aman), tampilkan ringkasan + 5–10 log `sync_audit`.

---

## UX Sinkronisasi Awal Saat Login (`SYNC-02`)

### Tampilan Saat Initial Full Sync Berjalan (SQLite Kosong)
| Option | Description | Selected |
|--------|-------------|----------|
| Banner progres non-blocking di dalam shell 4 tab | User langsung masuk ke shell, banner & animasi pill Sync otomatis hilang saat selesai | ✓ |
| Overlay loading penuh di atas 4 tab | Layar ditahan sampai Full Sync selesai | |

### Tampilan Jika Gagal Saat SQLite Masih 0 Produk
| Option | Description | Selected |
|--------|-------------|----------|
| Empty state informatif + tombol "Sinkronkan Sekarang" | Plus otomatis Full Sync begitu jaringan LAN/Cloud pulih | ✓ |
| Pesan peringatan memblokir di tengah shell | Menahan UI | |

**User's choice:** Non-blocking progress banner + empty state informatif dengan tombol `Sinkronkan Sekarang` dan auto-retry saat jaringan kembali.

---

## the agent's Discretion
- Detail indeks SQLite tambahan, antrean `syncMutex`, angka tepat backoff (15–30 dtk), dan layout komponen log audit mengikuti token *Velocity Blue*.

## Deferred Ideas
- Layar list/detail/CRUD Produk (`/api/products/**?scope=mini`), Kasir multi-tab POS & printing, serta manajemen kategori/satuan Kasir Mini (`/api/categories/**?scope=mini`, `/api/units/**?scope=mini`), toko & akun Owner tetap dijadwalkan di Phase 3–5.

---

## Isolasi Katalog Kasir Mini (`mini_*` PostgreSQL Tables & `?scope=mini`)

### Pendekatan Pemisahan Katalog Kasir Utama vs Kasir Mini
| Option | Description | Selected |
|--------|-------------|----------|
| 2 tabel kembar di PostgreSQL `Apps_Toko_Rejeki` (`mini_*`) + parameter `?scope=mini` | Struktur kolom sama persis dengan Kasir Utama namun isi terpisah total (disetujui untuk migrasi backend) | ✓ |
| 1 set tabel + kolom penanda `catalog_scope` | Single product table | |
| Tanpa ubah backend + filter kategori di mobile | Read-only existing endpoint | |

### Kategori, Satuan, Seed Awal, & Manajemen Web
| Option | Description | Selected |
|--------|-------------|----------|
| Pisahkan juga `mini_categories` & `mini_units` | Isolasi penuh kategori & satuan khusus Kasir Mini | ✓ |
| Mulai kosong (0 produk di `mini_products`) | Admin/Owner isi bersih dari awal tanpa produk nyasar | ✓ |
| Fokus backend API `?scope=mini` tanpa ubah UI Web PC | Web PC Kasir Utama tetap bersih tidak diubah | ✓ |

**User's choice:** Buat 5 tabel kembar terpisah di PostgreSQL `Apps_Toko_Rejeki` (`mini_categories`, `mini_units`, `mini_products`, `mini_product_units`, `mini_wholesale_tiers`) dimulai kosong (0 baris), dengan dukungan backend API `?scope=mini` untuk sync (Phase 2) dan manajemen via Mobile Admin/Owner (Phase 4–5) tanpa mengubah UI Web PC.
