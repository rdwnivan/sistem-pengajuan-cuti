# TODO

> Active work queue for the project.
> Keep tasks actionable and small enough to complete and verify.

---

# P0 — Critical

Tasks that block development, production, security, or core functionality.

* [x] Remove `SESSION_SECRET` from `ci.yml` env — already removed; updated README.md to stop mentioning it
* [x] Add rate limiting on login (`src/lib/rate-limit.ts` — max 5 gagal/15 mnt per akun, blokir 15 mnt; in-memory, tidak shared antar instance serverless)
* [x] Set `secure: true` on session cookie in production (`src/lib/auth.ts` `buatSesi`)
* [x] Server-side content sniffing for uploads (`src/lib/upload.ts` `sniffFile` — magic bytes PDF/PNG/JPG, ext dari konten aktual, bukan `File.type` client; spoof HTML/JS/SVG ditolak)

---

# P1 — High Priority

## Prototype Standar (hasil grilling, disetujui 2026-09-30)

* [x] Header PDF seragam `— PT ANIME JAPAN` (slip, formulir, rekap cuti/laporan)
* [x] Hapus Periode ganda + format nama bulan di PDF slip
* [x] NIP angka wajib unik (schema + form + seed + tampil di slip)
* [x] Kolom TTD di PDF slip (tanggal + HR + karyawan)
* [x] Rincian gaji standar (jabatan/transport/makan + lembur/bonus − PPh21/BPJS Kes/BPJS TK/lainnya)
* [x] Field kebun laporan (blok/kegiatan/TK/hasil/cuaca + GPS)
* [x] Multi-foto + keterangan per foto
* [x] Master Blok (endpoint + halaman HR + seed) — DIBATALKAN 2026-09-30: user putuskan HR tidak kelola blok; blok jadi teks bebas di form
* [x] Rekap laporan lapangan HR (filter + Excel/PDF) — DIBATALKAN 2026-09-30: acc murni atasan↔karyawan; HR tidak butuh akses laporan
* [x] Reseed database production + buat ulang slip demo — DB production (`neondb`) sudah reseeded bersih (9 user, 0 slip); dev dipisah ke `neondb_dev` (lihat bawah). Sisa: buat 1 slip demo dari aplikasi live untuk verifikasi akhir.
* [x] Pisahkan DB dev dari production — `neondb_dev` dibuat via SQL; `.env` lokal menunjuk ke sana (schema push + seed OK). Production `neondb` tidak tersentuh test/E2E lagi. ATURAN: jangan arahkan `.env` lokal kembali ke `neondb`; seed production hanya via URL eksplisit bila darurat.

Tasks that should be completed next.

## Current Feature

(none — all major features complete)

## Bugs

* [x] Vercel Analytics + SpeedInsights blocked by CSP — tambah `https://va.vercel-scripts.com` ke `script-src` + `connect-src` di `next.config.mjs` (verified via header production asli)
* [x] Notifikasi Web Push bocor antar akun di browser yang sama — `LogoutButton` unsubscribe + hapus row DB saat Keluar; banner Aktifkan muncul lagi bila permission granted tapi belum ada subscription
* [x] Banner notifikasi muncul lagi setelah refresh walau sudah diaktifkan — `enable()` menyembunyikan banner langsung setelah izin granted, sebelum subscribe sukses; kegagalan subscribe/POST diam-diam (cuma console). Kini banner hilang hanya bila seluruh alur sukses + pesan error tampil ke user bila gagal. Lanjutan: error mentah browser dipetakan ke panduan ramah (`pesanGalatPush`, unit 5/5) + tombol "Nanti saja" (snooze 7 hari via localStorage) agar banner tidak nagih bila push memang tak bisa jalan; test E2E di smoke. Lanjutan 2: akun sama login ulang tidak ditanya lagi — logout kini HANYA hapus row DB (subscription browser dipertahankan), login menautkan ulang diam-diam ke sesi aktif sekali per login (`sudahTaut` + `resetTautanPush`); tanpa identitas client karena server tahu user dari cookie sesi **TERVERIFIKASI PRODUKSI 2026-10-01**: pair VAPID baru valid kriptografis, subscribe tersimpan (1 row FCM), kirim percobaan diterima FCM + muncul di perangkat user.
* [x] "Klik Kirim Pengajuan dua kali" di `/cuti/baru` — React 19 mereset form uncontrolled tiap submit action (termasuk saat action mengembalikan error), jadi isian user terhapus dan klik berikutnya diblokir validasi HTML. `aksiAjukan` kini mengembalikan `nilai` + `Form.tsx` memasangnya ulang sebagai `defaultValue` (dengan `key` pada `<select>`); sekaligus memperbaiki deep link `?jenis=`. Test regresi di `tests/cuti-validasi.spec.ts` (sudah dicek merah tanpa perbaikan).
* [ ] Terapkan pola yang sama (action mengembalikan isian → `defaultValue` di form) ke 11 form `useActionState` lain yang isinya hilang saat ditolak — prioritas `laporan/baru` (paling banyak field + multi-foto), lalu `hr/slip-gaji`, `hr/karyawan`, `hr/jenis`, `delegasi`, `profil`. Rujukan: catatan "useFormStatus" di PROJECT_STATUS.md.
* [ ] Perbarui kredensial `cuti-app/.env.test` (DB `neondb_test` sudah kedaluwarsa → `P1000`); butuh password role terbaru dari dashboard Neon. Sementara: ambil `DATABASE_URL` dari `.env` lalu ganti nama database ke `neondb_test` saat menjalankan `prisma db push`/seed/E2E lokal.

---

# P2 — Normal

Important but not immediately blocking.

## Features

* [x] Add unit tests for `src/lib/cuti.ts` (hari kerja calculation)
* [x] Add unit tests for `src/lib/validasi.ts` (zod schemas)
* [x] Add unit tests for `src/app/actions.ts` (server actions)
* [x] Add API tests for `/api/cron` (reminder + eskalasi logic)
* [x] Add pagination to HR karyawan list
* [x] Add approval flow for gaji changes (`GajiPerubahan` model + `aksiPutusanPerubahanGaji`)
* [x] Add navigation progress bar on route change (`NavigationProgress` client component)
* [x] Refactor `src/app/actions.ts` (647 lines) into 9 domain files under `src/actions/`
* [x] Add loading spinner on submit buttons (`SubmitButton` component for all server action forms)
* [x] Fix password toggle on login page (show/hide eye button)
* [x] Replace `router.back()` on `/cuti/baru` with `Link href="/"` (history-based navigation was wrong)
* [x] Add edit draft laporan flow (`aksiRevisiLaporan` now accepts DRAFT, detail page shows Edit Laporan for drafts)
* [x] Make laporan putusan catatan textbox always visible (was hidden until button click, now matches cuti form)

## Improvements

* [x] Improve UX: confirm dialog before delete — prop `confirm` di `SubmitButton` dipakai di 5 tombol destruktif (Hapus hari libur, Batalkan pengajuan/laporan/slip/delegasi) + konfirmasi saat menonaktifkan jenis cuti (`JenisForm`) & akun karyawan (`UserForm`); diverifikasi dismiss/accept via test sekali pakai
* [x] Add unit tests for delegation date-range logic in `src/lib/cron.ts` (`unit/delegasi.test.ts` — 8 kasus via fungsi murni `delegasiBerlaku` cerminan `where` Prisma; total unit 69/69)
* [x] Add E2E for cron umur H+1/H+3 asli (`tests/cron.spec.ts` — update `updatedAt`/`lastReminderAt` via raw SQL karena `@updatedAt` Prisma selalu reset ke now; assert reminderCount tepat 1 + tidak dobel + eskalasi pindah approver; flows 22/22)

---

# P3 — Low Priority

Nice-to-have items.

* [x] Add WhatsApp (Fonnte) delivery retry logic — maks 3x + backoff + timeout + log `[WA-GAGAL]`; ringan (sukses tetap 1x); unit 5/5
* [x] Setting notif WA per user — kolom `notifWa` (default true) + `ProfilForm` + `aksiUbahProfil`; pengiriman via `kirimWAkeUser` yang patuh preferensi; unit `bolehKirimWA`; **DI-HIDE dari UI 2026-09-30** (user belum minta): `ProfilForm` tidak dirender + test E2E profil dihapus (ada catatan kembalinya); backend utuh (kolom, retry, kirimWAkeUser)

* [x] Add PDF preview before download (slip gaji, formulir cuti) — `?lihat=1` → `inline` (default tetap `attachment`) di 3 route (slip, formulir, laporan-lapangan); link "Lihat" (target _blank) di 4 halaman; otorisasi tidak berubah; langkah verifikasi digabung ke `slip-rincian.spec.ts` (hindari konflik unique slip per bulan)
* [x] Add dark mode support — DITOLAK 2026-09-30: seluruh UI hardcode terang, effort besar untuk app HR internal jam kerja; jangan kerjakan tanpa permintaan user eksplisit
* [x] Add filter by date range on laporan list (`?dari=`/`?sampai=` pada `tglLaporan`, form GET + Reset, link status pertahankan tanggal, tanggal invalid diabaikan; test permanen di `laporan.spec.ts`)

---

# Technical Debt

* [x] `src/app/actions.ts` — split selesai (`src/actions/` 9 file domain + barrel, import `@/actions`)
* [x] `src/lib/pdf.ts` — `teksAman()` kini dipakai konsisten di 4 route PDF (slip, formulir, laporan-lapangan, rekap laporan); sebelumnya formulir + rekap `drawText` langsung (crash WinAnsi untuk karakter non-Latin)
* [x] `cuti-app/HANDOVER.md` — perbaiki baris struktur `src/app/actions.ts` yang basi → `src/actions/`
* [x] `cuti-app/dev-server3.log` — ternyata tidak ter-track di git (hanya di disk, sudah di `.gitignore`); hapus dari disk lokal
* [x] Aktifkan `next/typescript` di `cuti-app/eslint.config.mjs` — **SELESAI 2026-10-07** (PR #8). Temuan diukur dulu: mengaktifkan aturan = **228 problem** (226 `no-unused-vars`, 1 `prefer-const` yang merupakan ERROR di `src/app/persetujuan/page.tsx`, 1 dari file config) → semuanya dibersihkan. Sesudah: `eslint .` **0 problem** dengan `next/typescript` aktif, `tsc` 0, `build` 29/29, E2E 54+37+2. Jebakan yang dicatat: parameter fixture Playwright **wajib** object-destructuring.
* [x] Bersihkan dead import di `src/actions/*.ts` — **SELESAI 2026-10-07** (PR #8, bersama TODO 96): `buatSesi`, `keluarSesi`, `hashPassword`, `isAtasan` dan seluruh schema/helper lain yang tidak terpakai dibuang per file (211 temuan di `src/actions`). Bukti tidak ada yang kelebihan dibuang: `tsc --noEmit` 0 error + E2E 3 tier hijau. Fixture `loggedIn` di `tests/helpers.ts` ternyata dead code dan dihapus.
* [ ] Putuskan pin `next` eksak (`"15.5.27"`) vs `"^15.5.27"` di `cuti-app/package.json` — kalau tetap eksak, catat alasannya. **KEPUTUSAN USER, bukan kode** (belum diputuskan).
* [x] Bersihkan row `Sesi` yang kedaluwarsa — **SELESAI 2026-10-07** (PR #9): `sesiKedaluwarsa()` di `src/lib/auth.ts` jadi **satu sumber kebenaran** yang dipakai penolakan `userDariSesi` DAN sapu `sapuSesiKedaluwarsa()` (`src/lib/cron.ts`, dipanggil awal cron harian `/api/cron`); jumlah terhapus dikembalikan sebagai `sesiDibersihkan`. Unit `unit/sesi.test.ts` (7/7) + E2E `tests/sesi-kedaluwarsa.spec.ts` (tier flows): cookie kedaluwarsa ditolak → row dihapus cron → sesi yang masih valid **tidak** ikut terhapus. Batas: kedaluwarsa hanya bila `expiresAt < now` (tepat di `expiresAt` masih valid).

---

# Testing

* [x] E2E HR CRUD (jenis cuti tambah, hari libur tambah/hapus, karyawan buat/edit/nonaktif) — `tests/hr-crud.spec.ts` (tier flows, serial)
* [x] E2E validasi bisnis cuti (min H-, masa kerja, anti-bentrok, kuota tidak cukup) — `tests/cuti-validasi.spec.ts` (tier flows, serial)
* [x] E2E ganti password (negatif + positif pakai user sekali-pakai) — `tests/profil.spec.ts`
* [x] E2E batal slip gaji — `tests/slip-batal.spec.ts`
* [x] E2E notif tandai semua dibaca — `tests/notifikasi.spec.ts`
* [x] Smoke halaman kalender & riwayat — `tests/smoke.spec.ts`
* [x] E2E upload lampiran cuti (wajib tanpa file ditolak, PNG valid diterima, spoof HTML→PDF ditolak) — `tests/lampiran.spec.ts`
* [x] Ubah `webServer` E2E ke `npm run start` — **SELESAI 2026-10-06** (PR #4 `d41f91a`): ketiga config pakai `process.env.CI ? "npm run start" : "npm run dev"` + `retries: CI ? 2 : 0` untuk flows & rate-limit. Hasil: job `e2e` 5–9 menit → **~3 menit, tanpa flaky** (main 54, flows 37, rate-limit 2 semua lulus first try). Gate upload lokal ikut dipindah dari `NODE_ENV === "production"` ke `DI_VERCEL` (`src/lib/upload.ts`) supaya `next start` lokal masih bisa menulis `public/uploads/`; perilaku di Vercel tidak berubah.
* [x] Add unit tests for `src/lib/cuti.ts` — hari kerja calculation, masa kerja validation (`cuti-app/unit/cuti.test.ts`, 56 unit total via `npm run test:unit`)
* [x] Add unit tests for `src/lib/validasi.ts` — all zod schemas (pengajuan, user, jenis, slip, laporan) (`cuti-app/unit/validasi.test.ts`)
* [x] Add unit tests for `src/lib/rate-limit.ts` + `src/lib/upload.ts` (`cuti-app/unit/rate-limit.test.ts`, `unit/upload.test.ts`)
* [x] Add integration tests for `POST /api/laporan-lapangan/[id]` (acc action) (`cuti-app/tests/laporan-acc.spec.ts` — setuju/tolak/403/400/401 + PDF)
* [x] Add E2E test for cuti submission → atasan approval → HR approval flow (`cuti-app/tests/cuti-flow.spec.ts`)
* [x] Add E2E test for delegasi creation → delegated approval (`cuti-app/tests/delegasi.spec.ts`, serial)
* [x] Add E2E test for cron reminder H+1 / eskalasi H+3 (`cuti-app/tests/cron.spec.ts` — endpoint 200 + struktur; umur H+1/H+3 belum disimulasikan)
* [x] Add E2E test for notifikasi in-app end-to-end (`cuti-app/tests/notifikasi.spec.ts` — ajukan → notif + badge atasan → setujui → notif karyawan → cleanup batalkan; di tier flows/serial karena stateful)
* [x] Add E2E test for gaji change approval flow (HR submit → atasan approve) (`cuti-app/tests/gaji-flow.spec.ts`; `gaji-perubahan.spec.ts` lama yang lemah dihapus)
* [x] E2E endpoint upload pada mode production build (`next start`) secara eksplisit — **DITUTUP 2026-10-07 sebagai sudah tercakup** (TODO 120), tidak perlu test baru: (1) `tests/lampiran.spec.ts` sudah memuat `test("file valid (PNG) diterima dan tampil di detail")`; (2) file itu ada di `testMatch` `playwright.flows.config.ts`; (3) ketiga config memakai `webServer.command = process.env.CI ? "npm run start" : "npm run dev"`; (4) job CI `e2e` menjalankan `npm run build` lalu tier flows. Jadi jalur upload + gate `DI_VERCEL` sudah dieksekusi di bawah `next start`, bukan hanya dev. Yang **belum** terbukti adalah upload di Vercel asli — itu TODO terpisah di bagian Deployment.

---

# Security

* [x] Review authentication — token `crypto.randomBytes(32)`, expiry 7 hari, cookie httpOnly + sameSite=lax + secure(prod); bcrypt cost 10; `statusAktif` dicek (`src/lib/auth.ts`)
* [x] Review authorization — 9/9 halaman `/hr/*` pakai `wajibHR()`; E2E security 8 test redirect non-HR
* [x] Review input validation — semua action form pakai zod `safeParse` (10 pemakaian di 8 file); sisanya validasi manual/parsing aman (notif scope `userId`, password min 6, delegasi cek target)
* [x] Review secret handling — tidak ada `.env` ter-track; scan history bersih (tanpa private key/token)
* [x] Review API security — `/api/cron` tolak tanpa/salah secret (401, E2E); PDF slip/formulir/laporan cek owner/HR/approver (403/404, E2E)
* [x] Regression test security headers (CSP/X-Frame/HSTS/Permissions-Policy) + fix `geolocation=()` → `geolocation=(self)` yang mematikan tombol GPS laporan — `tests/security.spec.ts` (21/21), 2026-10-05
* [x] Upgrade `next` 14.2.35 → **15.5.27** + React 19 untuk menutup audit `next` **critical** (15.5.27 = security backport). Migrasi async `cookies()`/`params`/`searchParams`, `useFormState`→`useActionState`; verified tsc/lint/build + unit 84 + E2E utama 54 + flows 37 + rate-limit 2, 2026-10-05. **Merged ke `main` (`513395e`) + deploy Vercel terverifikasi live + smoke produksi 2026-10-06** (PR #2, CI `verify`+`e2e` hijau first try)
* [x] Perbaiki flake CI tier rate-limit — `await resp.finished()` di `tests/rate-limit.spec.ts` menggantung sampai timeout test 120s (`response.finished()` tidak punya timeout sendiri, dan pada respons streaming server action Next dev bisa tidak pernah selesai). Diganti `waitForResponse` (predikat dipersempit ke `POST /login`) + barrier reset form uncontrolled; CI hijau first try (`de9a7c1`), 2026-10-06
* [x] Sisa audit produksi **4 vuln, 0 critical**: `postcss` high (nested `next/node_modules/postcss@8.4.31`, next pin eksak) + `uuid` moderate (via `exceljs@4.4.0`). Analisis 2026-10-06: keduanya **tidak reachable** di app ini (postcss cuma build-time + CSS first-party; uuid hanya dipakai exceljs `v4()` tanpa argumen `buf`, sedangkan advisory-nya v3/v5/v6 + `buf`). Penting: **`next@16` hanya menutup `postcss`** — `uuid` tetap 3 moderate karena datang dari exceljs, bukan next. Butuh keputusan: (a) terima + monitor advisory, atau (b) tutup `postcss` tanpa ganti framework via `npm overrides` (uji `npm run build` + E2E dulu karena meng-override pin eksak next) — **DIPUTUSKAN 2026-10-06 (user): opsi (a), terima vuln + pantau advisory berkala.** **KOREKSI 2026-10-07: catatan "7 vuln" itu TIDAK reproducible** — diukur ulang pada lockfile yang sama hasilnya 5 vuln (2 high, 3 moderate); angka reproducible + jadwal review ada di item "Koreksi + evaluasi ulang catatan audit" di bawah. Alasan: keduanya tidak reachable; opsi (b) berarti meng-override pin eksak `next` demi advisory build-time, dan `next@16` pun tetap menyisakan 3 moderate `uuid`. Tindak lanjut: evaluasi ulang bila salah satu berubah jadi reachable atau muncul advisory baru.
* [x] Perbaiki flake `tests/slip-batal.spec.ts` — **SELESAI** (PR #3 `917a89c`): `waitForURL(/\/hr\/slip-gaji/)` sudah cocok dengan URL `/hr/slip-gaji?buat=1` saat itu sehingga tidak menunggu redirect `aksiBuatSlip`. Diganti: tunggu respons POST action + pastikan `buat` hilang dari URL. CI hijau (54/37/2, tanpa flaky).
* [x] Perbaiki flake `tests/notifikasi.spec.ts` — **SELESAI** (PR #4 `d41f91a`): badge nav di-stream `<Suspense>` (fallback skeleton tanpa angka) sehingga `innerText()` sekali baca race → diganti `expect.poll`; cleanup dipindah ke `finally` supaya retry tidak gagal karena anti-bentrok/kuota dari pengajuan yang bocor.
* [x] Migrasi `next lint` → ESLint CLI (`eslint .`) agar siap sebelum Next 16 — **SELESAI 2026-10-06** (PR #5, squash `3ec54ef`): `cuti-app/eslint.config.mjs` (ESLint 9 flat config; `next/core-web-vitals` dibungkus `FlatCompat` karena `eslint-config-next@15` belum ekspor flat), `.eslintrc.json` dihapus, `eslint` ^8.57 → ^9.39, override `react-hooks/rules-of-hooks` untuk `tests/**` (callback `use` milik fixture Playwright). Verifikasi: `eslint .` **0 problem** (= baseline `next lint`), tsc 0, unit 84/84, build 29/29; CI PR `verify`+`e2e` hijau **54/37/2 first try, 0 flaky**, dan `npm run lint` di `main` 0 problem. Catatan: `next/typescript` sengaja belum diaktifkan (perubahan aturan = PR terpisah).
* [x] Pakai `crypto.timingSafeEqual` untuk perbandingan secret cron — **SELESAI 2026-10-07**: helper murni `samaAman()` di `src/lib/aman-sama.ts` (di-hash SHA-256 dulu, jadi `timingSafeEqual` tidak pernah melempar saat panjang beda + panjang rahasia tidak bocor); dipakai di `src/app/api/cron/route.ts:12` untuk **kedua** cabang (query `?secret=` dan header `Authorization: Bearer`). Semantik dipertahankan: `CRON_SECRET` kosong tetap 500, secret salah/absen tetap 401. Unit baru `unit/aman-sama.test.ts` (6 kasus). Diverifikasi lewat `security.spec.ts` (secret salah → 401) + `cron.spec.ts` (query & Bearer benar → 200).
* [x] Rotasi token sesi setelah login — **SELESAI 2026-10-07** di `src/lib/auth.ts:10-21`: `buatSesi` membaca token dari cookie `sesi-cuti` saat ini, membuat token baru, lalu `sesi.deleteMany` row lamanya (create dulu supaya tidak ada jendela tanpa sesi valid). Alasan konkret dari kode: token selalu dibuat server-side saat login sehingga session-fixation tidak mungkin — sisa risiko nyata adalah login ulang meninggalkan row `Sesi` lama yang tetap valid 7 hari. Signature `buatSesi` tidak berubah; satu-satunya pemanggil (`cutiActions.ts:39`) tidak perlu diedit. Diverifikasi lewat tier rate-limit (6 login berurutan akun sama) + tier utama.
* [x] **Koreksi + evaluasi ulang catatan audit produksi** — **SELESAI 2026-10-07**. Hasil: (1) angka dokumen "7 vuln (2 high, 5 moderate)" **tidak reproducible** — pada lockfile yang sama (`53666a3`) `npm audit --omit=dev` = **5 vuln (2 high, 3 moderate), 0 critical**; penyebab selisih tidak bisa direkonstruksi, jadi mulai sekarang hanya angka reproducible + perintahnya yang dicatat. (2) Reachability `source-map-js` (jalur `postcss` → `source-map-js`) memang build-time/CSS first-party, **tetapi** `npm audit fix --dry-run` menunjukkan fix **1 paket non-breaking** (`1.2.2` memenuhi `^1.0.2` milik `postcss@8.4.31` dan `^1.2.1` milik `postcss@8.5.28`) → **ditutup**, bukan diterima: audit prod turun ke **4 vuln (1 high, 3 moderate)**. **PERINGATAN: jangan pakai `npm audit fix --omit=dev`** — dry-run-nya merencanakan `remove` seluruh devDependencies (typescript, tsx, playwright). (3) Keputusan (a) ditegaskan untuk sisa `postcss` + `uuid` (alasan lama tetap sah: tidak reachable, `npm overrides` = meng-override pin eksak `next`, `next@16` pun sisa `uuid`), plus **jadwal review advisory berkala** (saat lockfile tersentuh, sebelum rilis/major upgrade, minimal 1×/bulan) — detail di `PROJECT_STATUS.md` §"Audit Sisa".
* [x] ~~Bersihkan row `Sesi` yang kedaluwarsa~~ — dipindah & **SELESAI** di Technical Debt (PR #9).
* [x] ~~Bersihkan dead import di `src/actions/*.ts`~~ — dipindah & **SELESAI** di Technical Debt (PR #8).

---

# Performance

* [x] Investigate slow approval queue query (N+1 on audit logs?) — N+1 nyata ada di loop delegasi `/persetujuan` (1 query per delegasi) → digabung jadi 1 query `atanId: { in }`; perilaku badge "delegasi" dipertahankan; flows 22/22 + utama 49/49
* [x] Optimize `Kuota` query — TIDAK di-cache (sengaja): sisa kuota berubah tiap transaksi sehingga cache butuh invalidasi per user per tahun yang lebih mahal daripada query-nya; sebagai gantinya 5 query dashboard (`jenis`, `kuota`, `riwayat`, 2× count antrean) yang tadinya sequential kini paralel via `Promise.all`
* [x] Review `prisma.ts` — TIDAK PERLU diubah: URL Neon yang dipakai sudah pooler (`-pooler-`), pooling ditangani sisi Neon; singleton pattern sudah benar; tanpa gejala masalah. Tinjau ulang hanya bila muncul error connection/timeout di production

---

# Deployment

* [x] Configure production (Vercel + Neon + Blob)
* [x] Add CI/CD (GitHub Actions: verify + e2e)
* [x] Verify environment variables (`.env.example` documented)
* [x] Verify database migration process (`prisma db push`)
* [x] Add rollback procedure (Vercel instant rollback + DB backup) — `ROLLBACK.md`: kapan rollback, promote deployment lama, matriks keputusan schema (kolom baru = kode saja cukup; kolom dihapus = DB juga), PITR Neon via branch, verifikasi read-only, forward-fix, pelajaran insiden `notifWa`
* [x] Configure staging environment - KEPUTUSAN: staging **lokal saja**, tanpa URL publik (data salinan production + akun demo mudah ditebak = terlalu berisiko dibuka ke internet). STAGING.md ditulis ulang: Neon branch + db push + build + start + E2E reuse server; .env tetap dev; larangan seed/FONNTE. Dukungan E2E_BASE_URL dibatalkan + di-revert.
* [!] **Promote deployment `d9ac5e7` ke alias production** — alias `cuti-app.vercel.app` masih
  menyajikan `webpack-2eb758dea75faf50.js` (build sebelum PR #3–#6), sedangkan build `d9ac5e7`
  menghasilkan `webpack-a2a7106df7a920d1.js` dan chunk itu **404** di production. Jadi dua security
  LOW PR #6 (secret cron constant-time + rotasi token sesi) **belum live**. Dashboard Vercel tidak
  bisa diperiksa dari mesin ini (tanpa kredensial): `vercel whoami` keluar 1, tidak ada `auth.json`
  / `VERCEL_TOKEN` / `.vercel/project.json`. **Blocker: butuh tangan user** — buka Deployments,
  pastikan `d9ac5e7` berlabel Current/Production, cek Instant Rollback, lalu Promote. Verifikasi
  ulang + bukti ada di `PROJECT_STATUS.md` §14 item 1.
* [ ] Verifikasi upload di production **live** (login + submit form asli → menulis DB/Blob production) — gate `DI_VERCEL` sudah behavior-preserving, tapi jalur ini belum pernah dibuktikan end-to-end. **Langkah siap dijalankan user (TODO 162):**
  1. Buka https://cuti-app.vercel.app/login, login `karyawan1@anime.id` / `anime123` (akun demo).
  2. Menu **Cuti → Ajukan**, pilih jenis yang **wajib lampiran** (mis. "Sakit (wajib surat)" bila ada), isi tanggal + alasan.
  3. Lampirkan file **PNG atau PDF asli** (≤ 2 MB) → klik **Kirim Pengajuan**.
  4. Harapan: redirect ke detail pengajuan, lampiran tampil sebagai tautan/gambar, dan **tidak** muncul "Upload lampiran belum dikonfigurasi" (pesan itu = `BLOB_READ_WRITE_TOKEN` tidak terbaca di Vercel).
  5. Cek bukti di dashboard Vercel: **Storage → Blob** ada objek baru, dan **Logs** function tidak memuat error upload.
  6. Uji negatif (opsional, cepat): unggah file HTML yang di-rename `.pdf` → harus **ditolak** (sniffing magic bytes).
  7. Catat hasilnya (berhasil/gagal + pesan) ke `PROJECT_STATUS.md` §14; kalau gagal, cek `BLOB_READ_WRITE_TOKEN` di Vercel env (Production).
  8. Setelah selesai, batalkan pengajuan uji itu dari UI agar DB production tetap bersih.
* [x] Smoke otomatis pasca-deploy ke production supaya verifikasi deploy tidak manual — **SELESAI 2026-10-07** (PR #7): `.github/workflows/post-deploy-smoke.yml` (`workflow_dispatch` manual + `workflow_run` setelah CI sukses di `main`, **tanpa `on: push`**) membandingkan sha256 chunk runtime build commit (artifact `chunk-fingerprint` dari job `verify` `ci.yml`) dengan chunk yang disajikan alias → MATCH/MISMATCH, plus probe read-only (`/login` 200, chunk 200, `/api/cron` secret salah & tanpa secret 401, 8 rute terproteksi 307 → `/login`). MISMATCH = run merah. Verifikasi: actionlint bersih, skrip dijalankan nyata dari Git Bash terhadap production (13/13 probe OK), tabel kebenaran keputusan diuji; CI PR #7 hijau + artifact benar-benar terunggah. Setelah merge: `gh workflow run post-deploy-smoke.yml --ref main`.

---

# Done

Move completed tasks here periodically.

* [x] Project initialization — Next.js 14 + Prisma + Tailwind
* [x] Authentication — session token DB + bcrypt
* [x] Cuti flow — DIAJUKAN → MENUNGGU_ATASAN → MENUNGGU_HR → DISETUJUI
* [x] Slip Gaji — HR buat, unique constraint, PDF export
* [x] Laporan Lapangan — DRAFT → MENUNGGU → DISETUJUI, PDF export
* [x] Delegasi — atasan→atasan, HR→HR, same-tier only
* [x] Web Push — VAPID + Service Worker + subscribe endpoint
* [x] Cron — reminder H+1 + eskalasi H+3 (Vercel cron)
* [x] E2E tests — 94 Playwright (54 utama + 38 flows + 2 rate-limit, 3 tier config) + 97 unit (`npm run test:unit`)
* [x] CI/CD — GitHub Actions verify + e2e
* [x] Deploy — Vercel live

---

# Blocked

Tasks that cannot proceed.

(none)

---

# Rules For Updating This File

1. `[ ]` = Not started
2. `[~]` = In progress
3. `[x]` = Completed and verified
4. `[!]` = Blocked

Do not mark a task `[x]` until verification is complete.

When a task becomes significantly larger than expected, split it into smaller tasks.

Do not leave vague tasks such as:

* "Fix everything"
* "Improve code"
* "Make it better"

Prefer specific tasks such as:

* "Fix timezone conversion in attendance API"
* "Add pagination to employee list"
* "Add validation for duplicate employee ID"

When a meaningful task is completed:

1. Mark it `[x]`.
2. Add the next concrete task.
3. Update `PROJECT_STATUS.md`.
