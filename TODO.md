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
* [x] Sisa audit produksi **4 vuln, 0 critical**: `postcss` high (nested `next/node_modules/postcss@8.4.31`, next pin eksak) + `uuid` moderate (via `exceljs@4.4.0`). Analisis 2026-10-06: keduanya **tidak reachable** di app ini (postcss cuma build-time + CSS first-party; uuid hanya dipakai exceljs `v4()` tanpa argumen `buf`, sedangkan advisory-nya v3/v5/v6 + `buf`). Penting: **`next@16` hanya menutup `postcss`** — `uuid` tetap 3 moderate karena datang dari exceljs, bukan next. Butuh keputusan: (a) terima + monitor advisory, atau (b) tutup `postcss` tanpa ganti framework via `npm overrides` (uji `npm run build` + E2E dulu karena meng-override pin eksak next) — **DIPUTUSKAN 2026-10-06 (user): opsi (a), terima 4 vuln + pantau advisory berkala.** Alasan: keduanya tidak reachable; opsi (b) berarti meng-override pin eksak `next` demi advisory build-time, dan `next@16` pun tetap menyisakan 3 moderate `uuid`. Tindak lanjut: evaluasi ulang bila salah satu berubah jadi reachable atau muncul advisory baru.
* [x] Perbaiki flake `tests/slip-batal.spec.ts` — **SELESAI** (PR #3 `917a89c`): `waitForURL(/\/hr\/slip-gaji/)` sudah cocok dengan URL `/hr/slip-gaji?buat=1` saat itu sehingga tidak menunggu redirect `aksiBuatSlip`. Diganti: tunggu respons POST action + pastikan `buat` hilang dari URL. CI hijau (54/37/2, tanpa flaky).
* [x] Perbaiki flake `tests/notifikasi.spec.ts` — **SELESAI** (PR #4 `d41f91a`): badge nav di-stream `<Suspense>` (fallback skeleton tanpa angka) sehingga `innerText()` sekali baca race → diganti `expect.poll`; cleanup dipindah ke `finally` supaya retry tidak gagal karena anti-bentrok/kuota dari pengajuan yang bocor.
* [x] Migrasi `next lint` → ESLint CLI (`eslint .`) agar siap sebelum Next 16 — **SELESAI 2026-10-06** (PR #5, squash `3ec54ef`): `cuti-app/eslint.config.mjs` (ESLint 9 flat config; `next/core-web-vitals` dibungkus `FlatCompat` karena `eslint-config-next@15` belum ekspor flat), `.eslintrc.json` dihapus, `eslint` ^8.57 → ^9.39, override `react-hooks/rules-of-hooks` untuk `tests/**` (callback `use` milik fixture Playwright). Verifikasi: `eslint .` **0 problem** (= baseline `next lint`), tsc 0, unit 84/84, build 29/29; CI PR `verify`+`e2e` hijau **54/37/2 first try, 0 flaky**, dan `npm run lint` di `main` 0 problem. Catatan: `next/typescript` sengaja belum diaktifkan (perubahan aturan = PR terpisah).
* [ ] Pakai `crypto.timingSafeEqual` untuk perbandingan secret cron di `src/app/api/cron/route.ts` (sekarang `q !== secret`, tidak constant-time) — LOW dari security review
* [ ] Rotasi token sesi setelah login di `src/lib/auth.ts` — LOW dari security review (atau dokumentasikan keputusan untuk tidak merotasi)

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
* [x] E2E tests — 73 Playwright (49 utama + 22 flows + 2 rate-limit, 3 tier config) + 78 unit (`npm run test:unit`)
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
