# Hasil pengujian aplikasi — 13 November 2026 WIB

> Ini snapshot **sebelum perbaikan**. Implementasi dan verifikasi lanjutan (285 tes PASS) ada di [SECURITY_FIXES_2026-11-13.md](SECURITY_FIXES_2026-11-13.md). Penutupan URL Blob public lama di production masih menunggu rollout/migrasi.

Baseline kode: `3ca45ced11f45ecbfb958e97ab109b977c8694aa`.
Pengujian selesai sekitar 18:22 WIB. Audit ini menambahkan pengujian dan dokumentasi; temuan runtime di bawah **belum diperbaiki**.

## Hasil utama

**238 automated tests PASS**, tanpa retry/flaky: 109 unit, 7 SDK, 4 dependency compatibility, 3 tooling compatibility, dan 115 E2E. Namun pengujian eksploratif menemukan **2 risiko High, 1 Medium, 1 Low**, serta satu masalah tampilan mobile. Lulusnya suite regresi tidak berarti aplikasi bebas celah.

* `npx prisma generate`, `npx tsc --noEmit`, `npm run lint`, dan `npm run build`: PASS. Build menghasilkan 29 halaman.
* `npm run test:unit`: **109/109 PASS**.
* `npm run test:sdk`, `npm run test:dependencies`, `npm run test:tooling`: **7 + 4 + 3 PASS**.
* E2E dengan `CI=1`, `TZ=Asia/Jakarta`, `--retries=0`, build produksi lokal: utama **56/56** (122,5 detik), flows **57/57** (sekitar 3,9 menit), rate limit **2/2** (9,2 detik). JSON reporter mencatat skipped/unexpected/flaky = 0 pada ketiga tier.
* `npm audit --json` dan `npm audit --omit=dev --json`: **0 vulnerability** pada snapshot sesi ini. Tidak ada dependency/lockfile yang diubah.
* Tambahan permanen: `cuti-app/tests/security-real-objects.spec.ts`, **10 tes**, terdaftar pada tier flows. Objek cuti, slip, dan laporan nyata dibuat sebagai fixture lalu dihapus. Pengguna lain ditolak 403/404; pemilik memperoleh ketiga PDF 200 dengan signature `%PDF-`.

## Lingkungan dan batas keamanan pengujian

Server adalah `next start` di localhost. Database khusus `neondb_test`, schema baru `codex_security_20261113_a`, dibuat setelah memastikan namespace tersebut belum ada. Seed hanya menyentuh schema baru ini. Schema public test/dev, schema pengujian lama, dan data bisnis production tidak di-reset.

Token Blob, Fonnte, dan VAPID dikosongkan pada proses uji. Probe push memakai kunci dummy yang dibuat khusus untuk pengujian. Bukti jaringan SSRF hanya menyasar penerima TCP milik pengujian pada `127.0.0.1:19443`; tidak memindai jaringan, metadata cloud, atau layanan pihak lain. Semua server/browser/penerima TCP yang dibuat sesi ini sudah dihentikan.

Schema uji beserta data yang ditinggalkan suite lama, sesi login uji, dan file upload lokal dipertahankan untuk reproduksi. Fixture dari 10 tes IDOR serta fixture/row push khusus probe sudah dibersihkan. Password dan status aktif akun seed yang sempat diubah oleh probe telah dipulihkan.

## Temuan yang harus ditindaklanjuti

### SEC-01 — High: endpoint push dapat mengarahkan koneksi keluar ke alamat internal

Lokasi: `cuti-app/src/app/api/push/subscribe/route.ts:14`, `:22`; `cuti-app/src/lib/web-push.ts:26`.

API hanya memeriksa keberadaan `endpoint` dan dua key. Tidak ada pembatasan tujuan URL. Pengguna login berhasil menyimpan endpoint HTTPS loopback dengan key kriptografis valid. Saat laporan uji disetujui melalui API aplikasi, respons persetujuan **200** dan penerima TCP lokal mencatat **1 koneksi dari server**. Jadi input pengguna mencapai koneksi jaringan server, bukan hanya tersimpan di database.

Reproduksi: login sebagai pembuat laporan; daftarkan endpoint HTTPS ke receiver loopback beserta key dummy valid; buat laporan MENUNGGU; setujui sebagai atasan; amati koneksi receiver. Seluruh langkah dijalankan terhadap schema uji.

**Batas bukti:** yang terbukti adalah koneksi TCP/TLS keluar terarah melalui alur push. Receiver sengaja menutup socket; pembacaan respons internal, pengambilan metadata, RCE, dan eksploitasi jaringan Vercel **tidak diuji/tidak diklaim**. Dampak High bergantung pada jangkauan jaringan host yang menjalankan aplikasi. `sendNotification` juga tidak diberi timeout eksplisit dan kegagalannya ditelan.

Tindak lanjut: validasi URL/key dengan schema; batasi tujuan pada penyedia push yang didukung; cegah tujuan internal termasuk hasil resolusi DNS; tetapkan timeout dan pencatatan kegagalan yang aman. Dasar pembatasan tujuan dan jaringan: [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).

### SEC-02 — High untuk dokumen rahasia: URL lampiran tidak memerlukan sesi

Lokasi: `cuti-app/src/actions/cutiActions.ts:112`, `:119`; `cuti-app/src/actions/shared.ts:33`, `:39`, `:67`.

Lampiran PNG yang benar-benar dibuat oleh suite upload diambil memakai browser context tanpa cookie. Hasil: **200, image/png, 72 byte**. Otorisasi halaman pengajuan tidak melindungi file pada `public/uploads/`. Pengajuan tersebut sudah dibatalkan oleh test, tetapi file masih dapat diambil.

Reproduksi: unggah lampiran melalui form; ambil URL file dari detail sebagai pemilik; buka URL yang sama dengan context kosong tanpa sesi. Tidak ada penebakan nama atau listing direktori pada probe ini.

**Batas bukti:** akses anonim diukur pada penyimpanan lokal. Jalur Blob production dibaca dari kode dan secara eksplisit memakai `access: "public"`; tidak ada unduhan baru dokumen production dalam audit ini. URL acak mengurangi kemungkinan ditebak, tetapi siapapun yang memperoleh URL dapat mengaksesnya. Kategori High didasarkan pada penggunaan lampiran untuk dokumen cuti/sakit yang semestinya rahasia; isi file uji sendiri tidak sensitif.

Tindak lanjut: simpan dokumen secara privat dan layani lewat endpoint yang mengecek owner/HR/approver, atau akses sementara setelah otorisasi. Rencanakan penanganan URL publik lama serta retensi file ketika pengajuan dibatalkan; memindahkan tautan UI saja tidak mencabut akses file lama.

### SEC-03 — Medium: ganti password tidak mencabut sesi perangkat lain

Lokasi: `cuti-app/src/actions/authActions.ts:12`, `:22`.

Dua context login sebagai akun yang sama. Context A berhasil mengganti password; hash berubah dan password lama tidak cocok lagi. Context B tetap memperoleh **200** dari `/api/approver` dengan sesi lamanya. Jadi mengganti password belum menghentikan seseorang yang sudah memegang cookie sesi. Sebagai kontrol terpisah, menonaktifkan akun menghasilkan **401**.

Tindak lanjut: terapkan kebijakan pencabutan sesi saat perubahan/reset password secara atomik, disertai regresi dua perangkat. [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) membahas pembaruan/pencabutan sesi setelah perubahan keamanan akun.

### SEC-04 — Low: tipe payload push yang salah menghasilkan HTTP 500

Lokasi: `cuti-app/src/app/api/push/subscribe/route.ts:14`, `:22`; DELETE juga hanya memakai type assertion.

POST terautentikasi dengan `endpoint` berupa objek dan key string masuk ke Prisma lalu menghasilkan **500**. JSON yang sintaksnya rusak menghasilkan **400** pada runtime Next yang diuji; tidak dilaporkan sebagai 500. Cast TypeScript tidak memvalidasi data runtime.

Tindak lanjut: `safeParse` body POST/DELETE, tolak tipe/bentuk/panjang yang tidak valid dengan 400 sebelum query database. Pertahankan 401 untuk context tanpa sesi. Tidak ada kebocoran secret yang dibuktikan oleh probe ini.

### UI-01 — P2: filter status laporan melebar pada mobile

Lokasi: `cuti-app/src/app/laporan/page.tsx`, baris status `className="flex gap-1 text-xs font-semibold"`.

Pada viewport **390 px**, `documentElement.scrollWidth` menjadi **419 px**. Tab **Dikembalikan** mencapai x=419 karena enam tab tidak membungkus atau memiliki wadah scroll tersendiri. Screenshot diperiksa. Dari 14 kombinasi (7 halaman karyawan × 2 ukuran), 13 tidak mengalami overflow dokumen dan satu ini gagal. Semua respons halaman 200.

Tindak lanjut: bungkus tab atau beri wadah scroll terbatas, lalu tambahkan assertion lebar dokumen dan akses tab terakhir di mobile. Navigasi bawah memang memiliki scroll sendiri; tab navigasi di luar viewport tidak dihitung sebagai penyebab overflow dokumen ini.

## Kontrol keamanan yang lulus

* Akses API dan halaman HR tanpa hak ditolak; suite IDOR baru memakai ID yang benar-benar ada, termasuk unduhan/preview PDF, JSON laporan, dan upaya memutus laporan orang lain tanpa perubahan status.
* Cookie sesi: **HttpOnly=true, Secure=true, SameSite=Lax** pada build produksi lokal.
* Login ulang merotasi token: replay token lama **401**, token baru **200**. Logout membuat API yang memerlukan sesi menjadi **401**.
* Server Action dengan Origin penyerang ditolak **500** oleh pemeriksaan origin framework. Ini bukti penolakan, bukan keberhasilan aksi atau bukti seluruh route handler punya proteksi CSRF yang sama.
* Teks laporan berisi tag `<img onerror=...>` tampil sebagai teks; flag JavaScript tidak berjalan dan tidak ada elemen gambar hasil injeksi. Ini satu jalur stored-XSS yang diperiksa, bukan cakupan seluruh sink.
* Login brute force diblokir sesuai suite rate limit; satu akun yang terblokir tidak memblokir akun lain.
* Upload HTML yang mengaku PDF ditolak; PNG valid diterima; lampiran wajib dan batas validasi diuji oleh suite yang ada.
* Header keamanan lulus; `.env`, `.git/config`, schema Prisma, dan source map dari satu aset JavaScript nyata menghasilkan **404** pada localhost. Tidak ada `.env` berisi credential yang ter-track (`.env.example` adalah template).

## Performa, UI, dan observasi tambahan

* Sembilan halaman pada suite performance menghasilkan 200. Waktu navigasi terukur **728–2.910 ms**, rata-rata **1.791 ms**. Suite memakai `networkidle`; angka ini bukan Core Web Vitals atau SLA produksi.
* Smoke API `/api/jenis`: **20 request**, concurrency **5**, **0 error**, p50 **183 ms**, p95 **241 ms**. Aplikasi lokal dan database uji remote; ini tidak menetapkan kapasitas/batas beban production.
* Dashboard desktop 1365×900 dan mobile 390×844 diperiksa dari screenshot. Pada pemeriksaan khusus halaman laporan mobile tidak ada `pageerror`; dua field tanggal terlihat mempunyai label. Tidak dilakukan klaim audit WCAG penuh.
* `Shell` merender `{children}` dua kali (`src/components/shell.tsx:25,27`) lalu menyembunyikan salah satunya dengan CSS. Profil memiliki **2 form password dalam DOM, 1 terlihat**. Ini observasi struktur/performa dan penyebab locator audit awal ambigu; tidak dihitung sebagai dua form terlihat atau celah keamanan tersendiri.
* Endpoint push yang sama dapat dipindahkan dari user A ke B (kedua POST 200, row berubah ke B). Penautan ulang perangkat bersama memang dirancang oleh UI logout/login. Jangan menggantinya dengan penolakan universal yang merusak pergantian akun. Evaluasi bukti kepemilikan subscription bila model ancaman menganggap endpoint bisa diketahui pengguna lain; tidak ada bukti pembacaan notifikasi korban dari probe ini.
* Rate limiter tetap berupa Map per proses, sesuai batas yang sudah didokumentasikan. Multi-instance/cold-start serverless tidak diuji dalam audit satu-instance ini; lulusnya dua test rate limit bukan bukti proteksi terdistribusi.

## Review workflow dan celah pengujian CI

* **P1 supply-chain hardening:** `actions/checkout@v4` dan `actions/setup-node@v4` pada kedua workflow belum dipin ke SHA immutable. Terlihat di `.github/workflows/ci.yml:19,20,85,86` dan `post-deploy-smoke.yml:68,72`. Tag yang dapat berubah adalah ketergantungan pada keamanan upstream, bukan bukti kompromi saat ini. Pin ke SHA versi yang diverifikasi dan perbarui terkontrol.
* **P2 least privilege:** CI checkout memakai default `persist-credentials`; tidak ada kebutuhan push. Set `persist-credentials: false` dan persempit `permissions: read-all` sesuai kebutuhan job (contents read; smoke juga actions read).
* `workflow_run` smoke diperiksa: guard sukses + branch main, token read-only, tidak checkout head fork, dan nama chunk dari artifact divalidasi sebagai diagnostik. Tidak ditemukan rantai eksekusi kode fork pada konteks ini; trigger saja tidak dijadikan klaim kompromi/P0.
* **Celah gate:** CI menjalankan compatibility/typecheck/lint/build/E2E, tetapi belum menjalankan `npm run test:unit`. Tambahkan 109 unit test tersebut ke job verify. Tidak ada perubahan workflow dalam audit ini.
* Org/repo settings, branch protection, izin efektif organisasi, keamanan source action upstream, serta konfigurasi jaringan Vercel tidak diperiksa melalui akses administratif.

## Smoke production baru, tanpa login

`https://cuti-app.vercel.app/api/version`: **200**, env production, SHA **3ca45ced11f45ecbfb958e97ab109b977c8694aa**, sama dengan baseline lokal.

Login 200 dengan CSP/nosniff/frame header; cron tanpa/salah secret 401. Delapan halaman `/`, `/hr`, `/persetujuan`, `/laporan`, `/slip-gaji`, `/kalender`, `/riwayat`, `/notifikasi`: **307 → /login**. Tidak ada login, approval, upload, atau penulisan data bisnis production pada sesi ini.

## Reproduksi dan bukti

Perintah standar dari `cuti-app/`, setelah menyiapkan database **uji** dan build dengan environment yang sama:

```powershell
npm run test:unit
npm run test:sdk
npm run test:dependencies
npm run test:tooling
npx tsc --noEmit
npm run lint
npm run build
# CI=1 dan TZ=Asia/Jakarta harus diset sebelum ketiga perintah ini.
npx playwright test --retries=0 --reporter=line
npx playwright test --config=playwright.flows.config.ts --retries=0 --reporter=line
npx playwright test --config=playwright.rate-limit.config.ts --retries=0 --reporter=line
# Menjalankan tambahan IDOR saja:
npx playwright test --config=playwright.flows.config.ts tests/security-real-objects.spec.ts --retries=0
```

Bukti lokal berada di direktori chat `C:/Users/ridwa/.codex/visualizations/2026/11/13/01a1d495-0dc1-7760-8ed3-e56c5153753c/`: `main-results.json`, `flows-results.json`, `rate-results.json`, `e2e-*.log`, `exploratory-results.json`, `production-readonly.json`, `ui-results.json`, `audit-mobile.png`, `audit-desktop.png`, dan `laporan-mobile-overflow.png`. Harness `test-runner.cjs`, `explore.cjs`, dan `ui-check.cjs` berada di direktori yang sama, di luar repository; runner menolak database selain neondb_test dan menolak reseed schema yang sudah ada.

Dua kegagalan awal harness eksploratif (locator form ganda dan asumsi semua halaman memiliki `<main>`) diperbaiki dengan locator elemen terlihat/heading. Keduanya bukan kegagalan dari 115 E2E; bukti yang belum selesai dijalankan ulang pada tahap surface. Temuan keamanan dan overflow tidak diubah menjadi klaim PASS.

Tidak dilakukan stress/DoS produksi, pentest jaringan, pengujian Firefox/WebKit/perangkat fisik, validasi pengiriman WA/FCM asli baru, AV/PDF sanitization, audit aksesibilitas lengkap, atau pengukuran coverage baris kode. Tidak ada commit, PR, merge, atau deployment dari perubahan sesi audit ini.
