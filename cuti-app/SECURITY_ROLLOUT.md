# Rilis perbaikan keamanan 13 November 2026

Hasil pelaksanaan 14 November 2026: PR #25 merged, SHA kode production `2e366a55ce83fc452e852054aed34ad61a2069c8`; CI PR/main dan smoke PASS. Private store/env dan LoginRateLimit aktif. Inventory lengkap yang ditemukan tepat3file public, seluruhnya disalin/hash diverifikasi/pointer dipindah/dicabut; tiga URL asli404, journal pendingRevocation0, store public kosong. Owner/approver mendapat byte asli melalui API, anonim/non-owner ditolak; upload baru private dan token public lama ditolak. Bukti/batas di PROJECT_STATUS.md §28; backup/journal tetap privat. Setelah credential lama dipensiunkan, jangan menjalankan ulang fase yang memerlukan token tersebut; gunakan bukti journal untuk audit.

Kode ini melindungi upload baru, akses lampiran, sesi, push dan rate limit. **URL Blob public yang sudah ada tidak menjadi privat hanya karena kode/tautan UI berubah.** SEC-02 belum selesai di production sampai migrasi dan pencabutan URL lama dibuktikan.

## Prasyarat dan urutan

1. Catat commit/deployment aktif dan inventaris database/schema/environment yang memakai store public lama. Buat backup database. Jangan seed/reset database yang berisi data.
2. Siapkan store Blob dengan access **Private**, lalu konfigurasi `BLOB_PRIVATE_READ_WRITE_TOKEN` pada environment aplikasi yang dituju. Pertahankan token store public lama **hanya pada proses migrasi** sebagai `BLOB_READ_WRITE_TOKEN`; jangan mencetak/decrypt token ke log/chat. CLI/connector harus menyimpan credential melalui alur penyimpanan secret, bukan copy ke source.
3. Tambahkan tabel `LoginRateLimit` lewat proses repository `npx prisma db push`, dengan URL target yang sudah diperiksa. Gunakan koneksi langsung untuk DDL, terpisah dari URL pooler runtime; setup uji sesi ini pernah gagal constraint pada pooler dan berhasil pada schema bersih melalui koneksi langsung. Periksa diff schema dahulu; tidak ada kebutuhan menghapus tabel/data. Tabel harus tersedia sebelum aplikasi baru melayani login.
4. Deploy kode yang sudah lolos CI/preview. Verifikasi `/api/version` terhadap SHA rilis, login/peran, upload baru, akses file sebagai owner/approver, dan penolakan tanpa sesi. Jangan mengubah referensi file ke format privat saat kode lama masih melayani aplikasi: halaman lama tidak memahami format ini.
5. Pastikan deployment lama yang masih dapat menulis lampiran public tidak menerima request baru. Gunakan perlindungan deployment/maintenance yang sesuai dan tunggu request lama selesai. Migrasikan dengan proses di bawah pada setiap database/environment yang berbagi storage.
6. Setelah seluruh referensi berpindah dan setiap sumber aman dicabut, verifikasi URL public lama tidak lagi 200. Baru kemudian hapus/revoke credential public yang tidak lagi dibutuhkan; periksa dahulu konsumen lain agar tidak memutus layanan bersama.

Pembatalan pengajuan mempertahankan dokumen privat untuk riwayat yang masih diotorisasi. File tanpa referensi bukan otomatis sampah global: bisa dimiliki schema/dev/preview lain. Pengarsipan atau retensinya harus memakai inventaris bersama yang disetujui maintainer.

## Migrasi bertahap dan resumable

Jalankan dari `cuti-app/` dengan environment target tersedia secara aman. Script tidak otomatis membaca `.env`; jalankan lewat pengelola environment yang dipakai operator. Untuk environment lokal Node modern, gunakan `node --env-file=.env.test node_modules/tsx/dist/cli.mjs scripts/migrate-attachments.ts` hanya setelah memastikan `.env.test` menunjuk database uji yang dimaksud. Jangan memakai URL production pada contoh/uji.

```powershell
# Tidak mengubah database/file; hanya angka inventaris.
npm run migrate:attachments

# Copy privat -> verifikasi SHA-256 -> update tiga jenis referensi dalam transaksi.
# Sumber public masih ada, sehingga konsumen database lain belum rusak.
npm run migrate:attachments -- --apply

# HANYA setelah memeriksa seluruh konsumen dan menyatakan storage eksklusif/aman dicabut.
npm run migrate:attachments -- --apply --revoke-old --exclusive-storage

# Opsional: file inventaris yang tidak dirujuk DB terpilih juga diarsipkan secara privat.
# Ini memerlukan review scope terpisah, bukan langkah default.
npm run migrate:attachments -- --apply --revoke-old --exclusive-storage --include-unreferenced
```

Journal `.private/lampiran-migration.json` memuat referensi sumber/tujuan dan digest (jangan dipublikasikan). Journal diikat pada host/database/schema target dan harus disimpan hingga verifikasi selesai. Gunakan `--journal-name=production.json` / `--journal-name=preview.json` untuk memisahkan journal environment pada direktori aplikasi yang sama, dan sertakan nama yang sama pada setiap fase/resume. Jangan mengganti database di bawah journal yang sama. Perintah dapat diulang: tujuan diverifikasi lagi sebelum sumber dihapus; sumber lokal yang sudah hilang dapat diselesaikan ulang. Jika copy rusak, sumber tetap ada dan proses gagal. Jika pencabutan gagal setelah referensi DB berpindah, journal menyimpan sumber untuk percobaan berikutnya.

Untuk store yang dipakai beberapa database, lakukan fase copy pada seluruh konsumen dahulu. **Jangan menyatakan `--exclusive-storage` sebelum inventaris tersebut lengkap.** Salinan privat bisa berbeda untuk setiap DB, tetapi sumber lama baru boleh dicabut ketika tidak ada konsumen yang masih memerlukannya. File Blob berukuran lebih dari 2 MB atau signature tidak valid dihentikan untuk pemeriksaan manual, tidak dibuang.

### Runner dengan secret tetap di Vercel

`node scripts/release-attachments.mjs dry-run|copy|revoke` adalah runner operasional, tidak dipanggil aplikasi/cron. Runner hanya menerima environment Production dengan database `neondb` serta kedua token storage tersedia. Jalankan melalui deployment connector dengan install command sementara `npm ci && npx prisma generate && node scripts/release-attachments.mjs dry-run` (ganti fase secara eksplisit); build aplikasi tetap memakai vercel.json. Tunggu tiap deployment selesai dan periksa log sebelum fase berikutnya. Kembalikan install command ke nilai semula setelahnya; jangan menjadikan migrasi langkah build permanen.

Runner membaca katalog seluruh database/schema pada cluster melalui koneksi langsung. Referensi Blob publik di database lain atau kolom path pada model tak dikenal menghentikan proses untuk review. Manifest sumber yang benar-benar 200 dan SHA-256, journal per production, serta hasil per fase disimpan privat di prefix `security-rollout/2026-11-13/`; log hanya angka/digest. Setiap fase memulihkan journal dan menyimpannya kembali meskipun migrator gagal. `revoke` menolak bila sumber manifest masih dirujuk database mana pun pada cluster; hasil diperiksa ulang terhadap digest sumber awal dan GET sumber lama. File tanpa referensi tetap dipertahankan. Konsumen di cluster/aplikasi luar tetap perlu inventaris operator, bukan ditebak dari katalog cluster ini.

## Penerimaan rilis

* Header file `Cache-Control: private, no-store`; owner dan approver sah mendapat file asli, anon/non-owner ditolak. Tidak ada URL storage mentah di UI/JSON laporan/PDF.
* Cek URL public lama yang benar-benar ada sebelum migrasi, termasuk lampiran pengajuan dibatalkan: 403/404/410 setelah pencabutan. Jangan menguji hanya nama file yang tidak ada. CDN/provider dapat memerlukan waktu invalidasi; script tidak menyebut sukses jika GET masih 200.
* Password baru bekerja, cookie kedua perangkat lama ditolak, login yang telah memverifikasi hash lama tidak menerbitkan sesi setelah reset.
* Catatan login gagal konsisten di proses baru, lima kegagalan bersamaan tercatat tepat lima; cron menghapus catatan yang sudah lewat masa retensi.
* Endpoint push private/loopback dan DNS ke jaringan internal tidak menghasilkan koneksi; penyedia FCM/Mozilla/Apple/Microsoft tetap diterima. DNS dibatasi 3 detik, HTTPS 5 detik, redirect tidak diikuti. Uji pengiriman pada perangkat asli terpisah diperlukan untuk memastikan delivery provider.
* CI job verify menjalankan unit + compatibility + typecheck/lint/build; seluruh tier E2E lulus. SHA pin workflow adalah checkout v4.3.1 dan setup-node v4.4.0 yang diperiksa dari tag upstream dan manifest node20.

## Rollback dan batas

Sebelum migrasi referensi, kode dapat dikembalikan ke deployment sebelumnya, tetapi risiko keamanan lama ikut kembali. Setelah referensi memakai format privat, **jangan rollback ke kode yang hanya memahami tautan public**. Rollback aman mempertahankan handler/storage privat atau memulihkan backup pointer sambil menyiapkan proxy privat yang sesuai; jangan mempublikasikan ulang file rahasia untuk memulihkan UI. Simpan salinan privat/journal. Pencabutan URL lama disengaja; URL lama tidak dipulihkan otomatis.

Penambahan tabel bersifat additive dan dapat dipertahankan saat rollback. Tidak ada penghapusan data bisnis atau perubahan status approval yang diperlukan. Pembuatan private store, konfigurasi environment production, db push live, deployment, dan pencabutan file/token live merupakan langkah operasional yang harus diselesaikan dengan akses dan cakupan yang benar; verifikasi lokal tidak membuktikan langkah tersebut sudah terjadi.
