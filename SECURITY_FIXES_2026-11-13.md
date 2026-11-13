# Perbaikan hasil audit — 13 November 2026 WIB

Perbaikan kode selesai dan diverifikasi lokal: **285 tes PASS**, tanpa retry/flaky. Perubahan belum di-commit/PR/deploy. **SEC-02 belum ditutup di production**: private Blob belum dikonfigurasi dan URL public lama belum dicabut.

## Perubahan

* **SEC-01:** validasi endpoint dan key Web Push bersama pada POST dan sender; hanya FCM, Mozilla, Apple, dan host Microsoft WNS yang didukung. DNS harus menghasilkan IP publik dan hasilnya dipin pada koneksi, sehingga tidak ada lookup kedua yang dapat melakukan rebinding. DNS dibatasi 3 detik, HTTPS 5 detik; redirect tidak diikuti. Subscription internal yang sudah ada ditolak saat pengiriman. Error pengiriman/cleanup dicatat tanpa endpoint/key; tidak membatalkan approval yang sudah committed. Tanpa pasangan VAPID fitur nonaktif secara eksplisit.
* **SEC-04:** POST/DELETE memvalidasi body runtime, termasuk null/array/tipe salah, dan membatasi body 8 KiB. Payload tidak valid 400, tanpa sesi tetap 401. Penautan ulang perangkat bersama tetap bekerja dengan key subscription yang sama; endpoint saja tidak cukup untuk mengganti pemilik dengan key lain. Kondisi pemilikan diperiksa kembali secara atomik saat update.
* **SEC-02, kode:** upload baru memakai private Blob (`BLOB_PRIVATE_READ_WRITE_TOKEN`) atau `.private/uploads/` lokal. `/api/lampiran/{cuti|laporan|foto}/{id}` mengecek owner/HR/direct/delegated/escalated approver sesuai aturan domain yang sudah ada; laporan/foto tetap owner/approver. File tidak di-cache bersama. UI, JSON laporan dan teks PDF menggunakan endpoint berotorisasi, bukan URL storage mentah. Path `public/uploads` lama ditutup oleh middleware; file lama lokal masih dapat dibaca melalui handler berotorisasi.
* **SEC-02, migrasi:** CLI `npm run migrate:attachments` default dry-run. Fase apply menyalin/verifikasi SHA-256 dan memperbarui referensi dalam transaksi. Sumber tidak dihapus secara default. Pencabutan memerlukan `--revoke-old --exclusive-storage`; inventory tanpa referensi dipisahkan dan opt-in. Journal privat terikat database/schema, dapat diberi nama per environment, dan mendukung resume setelah copy/referensi/pencabutan terputus. Salinan rusak tidak menghapus sumber. Lihat [panduan rilis](cuti-app/SECURITY_ROLLOUT.md).
* **SEC-03:** perubahan password memperbarui hash, mencabut semua cookie lama dan membuat sesi pengganti dalam satu transaksi; perangkat saat ini tetap di `/profil?ok=1`. Reset HR/nonaktif target mencabut sesi target. Penerbitan sesi login mengunci baris User dan memeriksa ulang hash/status, sehingga login dengan hash lama yang telah diverifikasi sebelum reset tidak dapat mengeluarkan sesi sesudah reset.
* **UI-01 dan form ganda:** tab laporan membungkus pada mobile; Shell merender konten sekali untuk desktop/mobile. Lebar dokumen kini 390 px pada viewport 390 px dan 1365 px pada viewport 1365 px; satu form password pada kedua ukuran.
* **Rate limit lintas instance:** Map diganti tabel PostgreSQL `LoginRateLimit`, key akun SHA-256, atomic UPSERT dan waktu database. Lima gagal/15 menit tetap berlaku; state terbaca proses baru. Cron menyapu catatan lama; kegagalan DB tidak membuat login melewati gate. Raw SQL menggunakan schema terkonfigurasi melalui `tabelPrisma`, bukan bergantung pada search_path koneksi pool.
* **CI:** checkout v4.3.1 dan setup-node v4.4.0 dipin ke SHA yang diverifikasi terhadap tag dan manifest node20; credential tidak dipersist pada checkout. Izin CI contents:read, smoke contents:read + actions:read. Unit suite ditambahkan ke verify; VAPID dummy dibuat saat E2E agar sender security test benar-benar berjalan dengan fitur aktif. Tidak ada key layanan production yang dipakai test.

## Verifikasi akhir

* `prisma generate`, `npx tsc --noEmit`, `npm run lint`, `npm run build`: **PASS**. Build mencakup route lampiran dan middleware baru.
* `npm run test:unit`: **144/144 PASS**.
* SDK **9/9**, dependency compatibility **4/4**, tooling **3/3 PASS**. SDK private PUT memastikan header access private; SDK private GET memakai bearer dummy dan membaca byte melalui MockAgent tanpa jaringan luar.
* E2E `CI=1`, `TZ=Asia/Jakarta`, `--retries=0`: **56/56 utama**, **66/66 flows**, **3/3 rate limit**. Total **125**; skipped/unexpected/flaky seluruhnya 0. Durasi reporter: 108,5 detik / 282,1 detik / 13,5 detik.
* Empat regresi awal terbukti merah pada build lama: endpoint internal expected 400/actual 200; tipe body expected 400/actual 500; cookie lama expected 401/actual 200; viewport expected <=390/actual 419. Sesudah perbaikan, regresi yang diperluas juga memeriksa reset HR, hash login stale, receiver TCP internal dengan VAPID aktif, file lama/baru dan akses lintas akun.
* Uji migrasi CLI memakai filesystem sandbox dan fixture DB: dry-run tidak mengubah referensi; tiga jenis referensi berpindah bersama setelah copy; file lain yang tidak dirujuk tidak dihapus; copy yang dirusak menolak revocation; resume dan pengulangan sesudah pencabutan berhasil.
* Screenshot desktop/mobile laporan ditinjau; tab terakhir terlihat, tidak overflow, satu form, tanpa pageerror pada probe tersebut. Mesin Impeccable tidak tersedia pada host; inspeksi dilakukan langsung lewat Playwright/screenshot.
* `npm audit --json` dan `npm audit --omit=dev --json`: **0 vulnerability**, seluruh severity 0. Tidak menambah/mengubah dependency atau lockfile; package.json hanya menambah command migrasi.
* Kedua workflow dapat diparse YAML; seluruh action SHA-pinned dan unit gate diperiksa. **GitHub Actions belum dijalankan untuk perubahan lokal ini**, sehingga hasil lokal tidak disebut CI hijau.

## Lingkungan, kegagalan perantara dan sisa state

Hasil akhir memakai schema baru **`codex_security_fixes_20261113_c` di neondb_test**, kosong sebelum seed. Schema/DB lain dan data bisnis production tidak di-reset. Runtime memakai koneksi pool, sedangkan setup schema C memakai koneksi langsung. Blob/Fonnte asli kosong; VAPID sementara dihasilkan dalam proses uji dan tidak dicetak.

Satu run flow sebelumnya menghasilkan 63 PASS/1 FAIL pada simulasi cron. Raw UPDATE test belum mengualifikasi schema sehingga update fixture tidak terjadi; test kini memakai `tabelPrisma`, mengharuskan affected-row=1, dan membersihkan fixture walau assertion gagal. Verifikasi ulang pada schema C lulus seluruhnya. Setup schema B via pooler juga gagal dengan `constraint ... already exists`; tidak dilanjutkan dengan seed/reset. Schema B parsial serta schema A dipertahankan, bukan dihapus. Tidak menganggap perbaikan raw query ini sebagai bukti akar internal error DDL pooler sudah diselidiki sepenuhnya.

Server/browser/receiver TCP pengujian telah ditutup. Fixture khusus IDOR/push/password/migrasi dibersihkan; akun seed tetap aktif dengan password demo awal. Data yang memang ditinggalkan suite lama, sesi uji, file private dan sandbox migrasi dipertahankan untuk reproduksi. Tidak ada migrasi file production, penghapusan Blob live, perubahan environment live, commit, push, merge atau deployment baru.

Artefak akhir: `C:/Users/ridwa/.codex/visualizations/2026/11/13/01a1d495-0dc1-7760-8ed3-e56c5153753c/security-final/` berisi reporter JSON/log, build log, kedua audit dependency, cleanup-check, serta screenshot/hasil UI. Artefak run perantara ada pada direktori `security-fixes/` dan audit awal pada direktori induk.

## Standards

Review independen menemukan lima hal yang diperbaiki: race login setelah reset, deadline DNS, kegagalan cleanup subscription yang dapat mengaburkan approval committed, risiko menghapus sumber yang dipakai schema lain, dan kompatibilitas Microsoft WNS. Follow-up sumber tidak menemukan blocker tambahan. Ini review sumber; verifier tidak mengakses data live atau menjalankan seluruh suite ulang secara independen.

## Spec

Review independen menemukan tiga kekurangan yang diperbaiki: pencabutan sesi harus mencakup login yang sedang berjalan, timeout harus mencakup DNS, dan scope pencabutan file harus menghormati pemakaian lintas environment. Verifier juga menjalankan subset 34 unit PASS pada tahap review. Penutupan public Blob live tetap merupakan syarat operasional yang belum tercapai.

Standards: 5 temuan ditangani/0 blocker kode tersisa; risiko awal terbesar penghapusan sumber lintas schema. Spec: 3 temuan ditangani/0 blocker kode tersisa; risiko awal terbesar scope migrasi bersama. Penilaian kedua sumbu dipertahankan terpisah.

## Sisa untuk production

Metadata environment Vercel dibaca dengan **decrypt=false**, hanya nama/target diperiksa: production masih memiliki `BLOB_READ_WRITE_TOKEN`, belum `BLOB_PRIVATE_READ_WRITE_TOKEN`. Nilai credential tidak dibaca/dicetak. Karena itu rilis harus mengikuti [SECURITY_ROLLOUT.md](cuti-app/SECURITY_ROLLOUT.md): private store/env → additive db push `LoginRateLimit` → rilis kode → migrasi setiap konsumen → pencabutan sumber lama → verifikasi URL lama tidak lagi 200.

Jangan menandai SEC-02 selesai di live sebelum langkah terakhir terbukti. Code rollback sesudah pointer privat memerlukan handler privat; jangan mempublikasikan ulang dokumen rahasia. Pengiriman FCM/WA ke perangkat asli, kondisi jaringan cloud sebenarnya, dan pengukuran kapasitas production tetap di luar verifikasi lokal ini.
