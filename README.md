# Apps Toko Rejeki Mobile

Aplikasi kasir (POS) mobile mandiri berbasis **Expo (SDK 58) + Expo Router + TypeScript** yang terhubung ke layanan API **Apps Toko Rejeki**, lengkap dengan persistensi sesi, sinkronisasi katalog lokal (SQLite), multi-nota tertunda, manajemen kategori/satuan, serta pencetakan struk 58mm/80mm.

---

## 1. Menjalankan di Mode Pengembangan

1. Install dependensi:
   ```powershell
   npm install
   ```
2. Jalankan Metro bundler:
   ```powershell
   npx expo start
   ```
3. Verifikasi tipe & unit test:
   ```powershell
   npm run typecheck
   npm test
   ```

> **Catatan Expo Go vs Build Native (APK):**
> Aplikasi tetap dapat dijalankan melalui **Expo Go** untuk pengujian UI, transaksi kasir, cetak via **Printer Server Toko**, dan **Cetak Sistem HP / PDF**. Namun, fitur **Thermal Bluetooth ESC/POS** (`react-native-bluetooth-classic`) memerlukan modul native sehingga hanya aktif pada **APK / Development Build**.

---

## 2. Cara Build APK & Install ke HP Toko

Proyek ini sudah dikonfigurasi di [eas.json](eas.json) dan [app.config.ts](app.config.ts) untuk menghasilkan file `.apk` Android secara langsung melalui **EAS Build**:

1. Install dan login ke EAS CLI (cukup dilakukan sekali):
   ```powershell
   npm install -g eas-cli
   eas login
   ```
2. Pastikan perubahan kode sudah rapi dan di-commit:
   ```powershell
   git add .
   git commit -m "chore: prepare release build"
   ```
3. Jalankan build APK (`preview` atau `production`):
   ```powershell
   eas build --platform android --profile preview
   ```
4. Setelah proses build di cloud selesai, EAS akan menampilkan **link download `.apk`** dan **QR Code**.
5. Buka link / scan QR Code di HP toko, unduh file `.apk`, lalu install (aktifkan izin *"Install from unknown sources"* jika diminta Android).

---

## 3. Alur Update Aplikasi ke HP Toko

### Cara A — Build & Install APK Baru (Alur Standar)
Gunakan alur ini setiap kali ada pembaruan aplikasi, terutama jika ada perubahan library native, izin, atau konfigurasi di `app.config.ts`:
1. Edit kode dan pastikan lulus pengecekan (`npm run typecheck` & `npm test`).
2. Commit perubahan ke Git (`git add .` & `git commit`).
3. Jalankan ulang `eas build --platform android --profile preview`.
4. Unduh APK baru di HP toko lalu **install langsung menimpa aplikasi yang lama** (tidak perlu uninstall).
   > Selama `android.package` (`com.tokorejeki.posmobile`) dan akun/keystore EAS tidak berubah, **data sesi login, pengaturan printer lokal, dan cache katalog SQLite tetap aman**.

### Cara B — Update Instan Tanpa Download APK (`eas update` / OTA) *(Opsional)*
Jika ke depan Anda sering memperbarui tampilan UI atau logika TypeScript/JavaScript tanpa menambah modul native baru:
1. Pasang `expo-updates` sekali saja (`npx expo install expo-updates`) lalu build APK baru sekali lagi agar dukungan OTA tertanam di dalam APK.
2. Untuk pembaruan UI/JS berikutnya, cukup jalankan:
   ```powershell
   eas update --branch preview --message "Deskripsi pembaruan"
   ```
3. Aplikasi di HP toko akan otomatis mengunduh pembaruan saat dibuka ulang tanpa perlu download dan install ulang file `.apk`.
   > **Catatan:** Jika Anda menambah/mengubah paket native (seperti driver hardware atau izin Android di `app.config.ts`), tetap wajib memakai **Cara A** (build APK baru).

---

## 4. Cara Menguji Cetak Struk (Termasuk HP Built-in Printer)

Di HP POS dengan *built-in printer* (seperti Sunmi, iMin, atau perangkat EDC Android sejenis), printer internal biasanya muncul sebagai **Bluetooth Paired Device** (`InnerPrinter` / `BlueTooth Printer`) atau layanan **Android Print Service**.

1. **Mode Thermal Bluetooth ESC/POS:**
   - Nyalakan Bluetooth di HP toko dan pastikan printer internal/eksternal sudah ter-*pair* di **Pengaturan Bluetooth Android**.
   - Buka aplikasi → tab **Pengaturan** → **Printer & Metode Cetak**.
   - Pilih **Thermal Bluetooth ESC/POS** dan pilih **Ukuran Kertas Struk Lokal** (**58mm** untuk mayoritas *built-in printer* genggam, atau **80mm** untuk printer meja).
   - Tekan **Pindai Printer Terpasang (Paired)**, izinkan akses Bluetooth saat diminta, lalu pilih perangkat printer.
   - Tekan **Simpan Pengaturan Printer**, lalu tekan **Tes Cetak Sekarang**.
2. **Mode Cetak Sistem HP / PDF:**
   - Pilih **Cetak Sistem HP / PDF** → **Tes Cetak Sekarang** untuk mencetak melalui dialog print bawaan Android (atau menyimpan sebagai PDF).
3. **Mode Printer Server Toko:**
   - Pilih **Printer Server Toko** untuk mengirim perintah cetak ke server kasir utama (`Apps_Toko_Rejeki`) melalui endpoint `/api/print`.
4. **Cetak Transaksi di Kasir:**
   - Tambahkan produk di tab **Kasir**, buka **Nota Aktif**, lalu pilih **Cetak Struk 1x** atau **Cetak Struk 2x** (ukuran kertas 58mm/80mm dan jumlah salinan juga bisa diubah cepat di modal Pratinjau Struk).
