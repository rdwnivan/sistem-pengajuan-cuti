# PROJECT STATUS

> Living memory of the current state of the project.
> Keep this file concise, factual, and up to date.

## Last Updated

* Date: 2026-10-07 (WIB), lanjutan
* Session: P1/P2/P3 lanjutan — **alias production ternyata nyangkut** di build sebelum PR #3–#6
  (chunk live `webpack-2eb758dea75faf50.js` vs build `d9ac5e7` = `webpack-a2a7106df7a920d1.js`,
  404 di production) → hardening cron + rotasi sesi PR #6 **belum terbukti live**; butuh Promote
  (dashboard tidak bisa diakses dari mesin ini). Selesai: TODO 163 smoke pasca-deploy + artifact
  sidik jari (PR #7), TODO 96+142 `next/typescript` + 228 temuan (PR #8), TODO 141 sapu `Sesi`
  kedaluwarsa (PR #9), TODO 120 ditutup sebagai sudah tercakup. Sesi sebelumnya: koreksi catatan
  audit (**snapshot live 5 vuln, bukan 7**) + tutup `source-map-js` HIGH lewat bump non-breaking
  `1.2.1 → 1.2.2` (audit prod jadi **4 vuln: 1 high, 3 moderate**), `crypto.timingSafeEqual` untuk
  secret cron (`src/lib/aman-sama.ts`), dan rotasi token sesi saat login (`buatSesi`).

---

# 0. Security Review (2026-09-29)

## Verified PASS (automated security tests)

* Semua API route punya auth check → 401/403 tanpa sesi
* IDOR protection: `/api/slip/[id]`, `/api/formulir/[id]`, `/api/laporan` — 403/404 untuk data orang lain
* HR-only routes (`/hr/*`) redirect non-HR ke `/`
* `/api/cron` menolak tanpa secret / secret salah → 401
* Session token: 32 bytes `crypto.randomBytes`, httpOnly, sameSite=lax, 7-day expiry, `secure` di production
* Password: bcrypt hash (cost 10), `statusAktif` dicek saat login
* Rate limiting login: maks 5 gagal/15 mnt per akun → blokir 15 mnt (`tests/rate-limit.spec.ts`)
* Upload: magic-bytes sniffing (`src/lib/upload.ts`) + batas 2MB — spoof HTML/JS/SVG ditolak
* CSP & security headers lengkap (`X-Frame-Options`, `X-Content-Type-Options`, HSTS, `frame-ancestors`, `object-src 'none'`)
* `.env` tidak ter-commit (`.gitignore` cover `.env*` kecuali `.env.example`)

## Issues Resolved (sesi ini)

* [x] HIGH — rate limiting login (`src/lib/rate-limit.ts`)
* [x] HIGH — cookie `secure` di production (`src/lib/auth.ts`)
* [x] MED — content sniffing upload (`src/lib/upload.ts`)
* [x] MED — `SESSION_SECRET` sudah tidak ada di ci.yml; README.md diperbaiki agar tidak menyebutnya lagi
* [x] LOW — perbandingan secret cron sekarang constant-time (`samaAman()` di `src/lib/aman-sama.ts`,
  dipakai `src/app/api/cron/route.ts:12`); unit `unit/aman-sama.test.ts`
* [x] LOW — token sesi dirotasi saat login (`buatSesi` hapus row `Sesi` lama yang ditunjuk cookie
  setelah token baru dibuat) — `src/lib/auth.ts:10-21`
* [x] INFO — CSP Analytics: `https://va.vercel-scripts.com` sudah masuk `script-src` + `connect-src`
  (`next.config.mjs:9-14`) — baris ini dulu masih tercatat sebagai issue di tabel bawah

## Issues Remaining

| Sev | Issue | Lokasi |
|-----|-------|--------|
| INFO | CSP `script-src 'unsafe-inline'` melemahkan proteksi XSS (dibutuhkan Next.js bootstrap) | `next.config.mjs` |
| INFO | Row `Sesi` kedaluwarsa tidak pernah dibersihkan (`userDariSesi` cuma mengembalikan `null`) — baris menumpuk, bukan celah auth | `src/lib/auth.ts:23` |

## Security + Performance Testing (2026-10-05)

* `tests/security.spec.ts` **21/21 PASS** (+2 test header baru: CSP/X-Frame/HSTS + `Permissions-Policy`), `tests/rate-limit.spec.ts` **2/2 PASS**, `tests/performance.spec.ts` **9/9 PASS** (dev, rata-rata ~2.5s; bukan angka produksi).
* **BUG ditemukan & diperbaiki** — `Permissions-Policy: geolocation=()` men-disable geolocation sepenuhnya (termasuk same-origin), mematikan tombol GPS di `/laporan/baru` (`src/app/laporan/baru/LaporanForm.tsx:35`). Diubah ke `geolocation=(self)`; regression test ditambahkan di `security.spec.ts`.
* Audit dependensi produksi (`npm audit --omit=dev`): `next` **critical** (banyak GHSA: DoS Server Components/Actions, SSRF, RCE Windows-hosted), `postcss` high (bundled di next), `uuid` moderate (via exceljs). Fix `npm audit fix --force` = upgrade `next@16` (breaking) — BELUM dikerjakan, butuh keputusan (lihat TODO).

## Framework Upgrade (2026-10-05) — Next 14.2.35 → 15.5.27 + React 19

* **Tujuan**: menutup audit `next` **critical** (Next 15.5.27 = jalur security backport; install 16.3.8 hanya untuk sisa `postcss`, tapi butuh migrasi ESLint 9 flat config + `next lint` dihapus → tidak dipilih). Blocker ESLint-nya sendiri **sudah dibereskan** 2026-10-06 (PR #5, merged `3ec54ef`) — lihat "Housekeeping + Migrasi ESLint CLI".
* **Perubahan kode (breaking Next 15)**:
  * `cookies()` jadi async → `await cookies()` di `src/lib/auth.ts`.
  * `params`/`searchParams` jadi Promise → `await` di 3 API route (`slip`, `formulir`, `laporan-lapangan` GET/POST) + 8 halaman (`kalender`, `laporan`, `laporan/baru`, `hr/slip-gaji`, `profil`, `slip-gaji/[id]`, `cuti/[id]`, `hr/karyawan/[id]`, `laporan/[id]`).
  * `cuti/baru/page.tsx` (client page) dipecah → server `page.tsx` + client `Form.tsx` (menghindari searchParams Promise di client).
  * React 18 → 19; `useFormState` (deprecated) → `useActionState` di 12 form.
* **Perilaku baru React 19 (penting)**: form uncontrolled **direset otomatis** setelah tiap server action → field email di login kosong setelah gagal. `tests/rate-limit.spec.ts` diperbarui: isi ulang email tiap iterasi (pakai `waitForResponse` agar deterministik).
* **Verifikasi**: `tsc` 0, `lint` 0, `build` 0, unit **84/84**, E2E utama **54/54**, flows **37/37**, rate-limit **2/2**. (Dua flake dev lokal: kalender `server-side exception` sewaktu suite paralel — lolos terisolasi & rerun penuh; catatan flakiness lama tetap berlaku.)
* **Sisa audit** (`npm audit --omit=dev`, snapshot 2026-10-05): `postcss` high (bundled di next, build-time) + `uuid` moderate (via exceljs) — 4 vuln, tanpa critical. Bisa ditutup dengan `next@16` (breaking) bila diinginkan. **Angka terbaru (2026-10-07, diukur ulang) = 4 vuln (1 high, 3 moderate)** setelah `source-map-js` ditutup — lihat "Audit Sisa — Koreksi Analisis".
* Catatan: CI Node 20 sudah cocok; `next lint` (deprecated) sudah **diganti** ESLint CLI di PR #5 — lihat "Housekeeping + Migrasi ESLint CLI".

## Merge + Deploy Upgrade ke Production (2026-10-06)

* **CI di branch fitur sebelumnya TIDAK PERNAH JALAN.** `.github/workflows/ci.yml` hanya trigger
  `push` ke `main` dan `pull_request`; branch `chore/upgrade-next-15` di-push tanpa PR, jadi
  `verify` + `e2e` tidak pernah dieksekusi untuk `df43aae`. Klaim "CI hijau" di sesi sebelumnya
  untuk branch ini tidak akurat — yang ada hanya verifikasi lokal.
  **ATURAN: branch fitur wajib lewat PR, kalau tidak CI tidak jalan.**
* PR #2 dibuat supaya CI benar-benar jalan:
  * Attempt 1: `verify` ✓ (1m15s), `e2e` ✗ — tier rate-limit gagal.
  * Rerun attempt 1: ✓ → menandakan flake, bukan regresi produk.
* **Bug di test, bukan di produk**: `tests/rate-limit.spec.ts:25` `await resp.finished()` menggantung
  sampai timeout test 120s. `response.finished()` tidak punya timeout sendiri, dan pada respons
  streaming server action Next dev promise itu bisa tidak pernah selesai. Diperbaiki di `de9a7c1`:
  buang `finished()`, sempitkan predikat `waitForResponse` ke `POST /login`, dan tunggu React selesai
  mereset form uncontrolled sebagai barrier antar-iterasi (semua wait punya timeout eksplisit).
  Assertion diperiksa masih bisa gagal (loop dimutasi 6→3 percobaan → merah), lalu dikembalikan.
* CI `de9a7c1`: `verify` ✓ 1m7s, `e2e` ✓ 5m55s (rate-limit ✓) — **hijau first try**.
* **Merge**: PR #2 di-merge `--rebase` (main historis linear, tanpa merge commit) → `main` = `513395e`.
  Tidak ada perubahan schema (`cuti-app/prisma/` tidak tersentuh) → **tidak perlu `db push`**.
* **Deploy Vercel** auto dari `main`, terverifikasi live. Bukti fingerprint build dari `/login`
  (nama chunk ber-hash): sebelum `117-f1c2a667b15caa05.js` / `fd9d1056-87da80e0c187477b.js` /
  `webpack-04d67e51c452a149.js` (build Next 14) → sesudah `255-ce8c7c75002f810b.js` /
  `4bd1b696-c023c6e3521b1417.js` / `webpack-2eb758dea75faf50.js`, yang **sama persis** dengan output
  `npm run build` Next 15 di lokal.
* **Smoke produksi** (tanpa sesi): `/login` **200** (halaman publik — memang bukan 307), dan
  `/slip-gaji`, `/hr`, `/persetujuan`, `/laporan`, `/kalender`, `/riwayat`, `/` semua **307** →
  `https://cuti-app.vercel.app/login`. Header keamanan utuh, termasuk
  `Permissions-Policy: geolocation=(self)` (fix GPS ikut live).
* **CI `main` flaky (1×)**: run `37346398429` gagal di tier flows — `tests/slip-batal.spec.ts:10`
  tidak menemukan badge "Terbit" (timeout 10s); test lain di tier yang sama lolos, termasuk
  `slip-rincian.spec.ts` yang juga membuat slip → pembuatan slip sendiri baik-baik saja. Rerun dengan
  kode sama **hijau** (5m7s) → flake. Akar masalah: `aksiBuatSlip` berakhir
  `redirect("/hr/slip-gaji")`, sedangkan test memakai `waitForURL(/\/hr\/slip-gaji/)` yang **sudah
  cocok dengan URL saat itu** (`/hr/slip-gaji?buat=1`) sehingga tidak menunggu apa pun; filter
  berikutnya lalu berlomba dengan server action yang masih berjalan.
  `playwright.flows.config.ts` `retries: 0`, jadi satu flake langsung memerahkan job.
  **Diperbaiki** di PR #3 (`917a89c`): tunggu respons POST `aksiBuatSlip` (punya timeout) lalu
  pastikan redirect mendarat lewat predikat yang tidak cocok dengan URL `?buat=1`.

## Infrastruktur E2E — Server Produksi di CI + Retries (2026-10-06, lanjutan)

**Masalah**: tier E2E flaky ~50% di CI — 3 test berbeda gagal dalam 4 run (`rate-limit`,
`slip-batal`, `notifikasi`). Akarnya bukan satu test, tapi lingkungan + kebijakan retry:
CI memakai **dev server** untuk 91 test (React StrictMode merender 2×, kompilasi on-demand, HMR),
dan tier flows/rate-limit memakai `retries: 0` padahal tier utama sudah `retries: CI ? 2 : 0`.

**Perubahan** (PR #4, `d41f91a`):

* `webServer.command` di 3 config Playwright → `process.env.CI ? "npm run start" : "npm run dev"`.
  Job `e2e` CI sudah menjalankan `npm run build` sebelum test, jadi tanpa biaya tambahan.
* `retries: process.env.CI ? 2 : 0` untuk tier flows & rate-limit (disamakan dengan tier utama).
  Playwright tetap menandai test `flaky`, jadi tidak ada kegagalan yang disembunyikan.
* **Gate upload lokal dipindah dari `NODE_ENV === "production"` ke `DI_VERCEL`**
  (`src/lib/upload.ts`, dipakai di `cutiActions.ts` + 2 tempat di `shared.ts`).
  Sebab: dengan `next start` lokal, `NODE_ENV=production` sehingga `tests/lampiran.spec.ts:42`
  gagal 3/3 attempt ("Upload lampiran belum dikonfigurasi"). Alasan gate itu sebenarnya adalah
  **FS Vercel read-only**, bukan mode produksi. Perilaku di Vercel **tidak berubah**
  (`VERCEL`/`VERCEL_ENV` selalu di-set di sana). `sniffFile` (validasi magic bytes) tidak disentuh.
* `tests/notifikasi.spec.ts`: badge nav di-stream lewat `<Suspense>` dengan fallback skeleton
  **tanpa angka** (`shell.tsx:63-69`), jadi `innerText()` sekali baca itu race → dapat 0;
  diganti `expect.poll`. Cleanup (batalkan pengajuan) dipindah ke `finally` — kalau bocor,
  percobaan retry gagal karena anti-bentrok/kuota jenis "Duka", bukan karena penyebab aslinya
  (terbukti: attempt 1 bocor → attempt 2 & 3 gagal di `waitForURL`).

**Hasil** (CI hijau di PR #4 dan PR #3, keduanya tanpa flaky sama sekali):

| Tier | Sebelum (dev) | Sesudah (produksi) |
|---|---|---|
| main 54 test | ~5–6 menit | **27–33 detik** |
| flows 37 test | ~4–7 menit, sering flaky | **28–33 detik**, 37/37 |
| rate-limit 2 test | ~2 menit | **2 detik** |
| job `e2e` total | 5–9 menit | **~3 menit** |

Pelajaran: `slip-batal` yang tadinya flaky ~50% **lolos first try** setelah pindah ke server
produksi (bahkan sebelum fix PR #3 masuk) — jadi sumber utamanya memang nondeterminisme dev
server, bukan test-nya. Dua fix test (PR #3 dan `notifikasi`) tetap dipertahankan karena
menutup bug nyata: `waitForURL` yang sudah cocok URL saat itu, dan satu kali baca nilai
yang di-stream Suspense.

> Catatan penting: `next start` menyalakan `secure: true` pada cookie sesi
> (`NODE_ENV === "production"` di `auth.ts`). Login E2E tetap berhasil di `http://localhost`
> karena Chromium memperlakukan localhost sebagai secure context. Sudah diverifikasi —
> kalau tidak, seluruh test login akan gagal.

## Audit Sisa — Koreksi Analisis (2026-10-06; snapshot diukur ulang 2026-10-07)

> **Snapshot 2026-10-07 (WIB), DIUKUR ULANG — dan angkanya bukan 7.**
> Pada tree yang sama (`53666a3`, lockfile belum disentuh) `npm audit --omit=dev` hari ini
> menghasilkan **5 vuln (2 high, 3 moderate), 0 critical** dari 4 paket: `postcss`
> (nested `next/node_modules/postcss@8.4.31`, high), `source-map-js@1.2.1`
> (high, `GHSA-68fv-2mgg-jv7q`), `uuid@8.3.2` (moderate, via `exceljs@4.4.0`), plus `next` +
> `exceljs` yang ikut tertandai sebagai pembawa. Catatan "7 vuln (2 high, 5 moderate)" yang
> ditulis sesi sebelumnya **tidak bisa direproduksi**; penyebabnya tidak bisa direkonstruksi
> (kemungkinan penggabungan advisory yang berbeda antar versi npm/registry) — mulai sekarang
> yang dicatat adalah angka yang bisa direproduksi beserta perintahnya.
> **Bukan akibat PR #5**: versi resolved `postcss` + `source-map-js` identik sebelum (`02ecf27`)
> dan sesudah (`3ec54ef`) PR — advisory di registry yang bergerak, bukan isi lockfile.
> Pelajaran: angka audit bergerak tanpa perubahan kode, jadi selalu tulis tanggal snapshot.
>
> **Sesudah tindakan sesi ini** (`source-map-js` di-bump `1.2.1 → 1.2.2`): `npm audit --omit=dev`
> = **4 vuln (1 high, 3 moderate), 0 critical** — sisa `postcss` (high) + `uuid`/`next`/`exceljs`.

* `npm audit --omit=dev` (snapshot 2026-10-06) = **4 vuln (1 high, 3 moderate), 0 critical**.
* **`source-map-js` SUDAH DITUTUP (2026-10-07)** — sebelumnya `1.2.1` (high, `GHSA-68fv-2mgg-jv7q`:
  event-loop DoS lewat indeks section source map). `npm audit fix --dry-run` menunjukkan fix
  **1 paket, non-breaking** (`1.2.2` masih memenuhi range `^1.0.2` milik `postcss@8.4.31` dan
  `^1.2.1` milik `postcss@8.5.28`), jadi tidak butuh `npm overrides` — cukup
  `npm audit fix` (bukan `--omit=dev`, lihat catatan di bawah). Reachability-nya memang build-time
  (`postcss` → `source-map-js`, CSS first-party Tailwind), tapi karena fixnya gratis dan menutup
  satu HIGH, ini dikerjakan alih-alih diterima.
  **JANGAN pakai `npm audit fix --omit=dev`**: dry-run-nya merencanakan `remove` seluruh
  devDependencies (typescript, tsx, playwright) — destruktif.
* Yang vulnerable **bukan** postcss top-level (8.5.28, sudah aman), melainkan
  `next/node_modules/postcss@8.4.31` — `next` mem-pin eksak. `next@16.3.8` membawa postcss **8.5.23**.
* **`next@16` TIDAK menutup `uuid`.** `uuid@8.3.2` masuk lewat `exceljs@4.4.0`, bukan `next`. Jadi naik
  ke Next 16 menyisakan 3 moderate (uuid), bukan 0. `npm audit fix --force` menyarankan
  `exceljs@3.4.0` yaitu **turun versi** — saran itu tidak masuk akal.
* `exceljs@4.4.0` adalah rilis stabil terakhir (hanya ada `4.4.1-prerelease.0`) → **tidak ada** rilis
  upstream yang memakai `uuid >= 11.1.1`.
* **`uuid` tidak reachable**: exceljs memakai uuid hanya di
  `lib/xlsx/xform/sheet/cf-ext/cf-rule-ext-xform.js` sebagai `const {v4: uuidv4} = require('uuid')`
  lalu `uuidv4()` **tanpa argumen**. Advisory `GHSA-w5hq-g745-h8pq` hanya mengenai v3/v5/v6 **saat
  `buf` diberikan** → jalur kodenya tidak terpakai. exceljs sendiri hanya dipakai di `/api/laporan`
  (export Excel HR).
* **`postcss` tidak reachable**: advisory-nya butuh CSS dari penyerang (stringify `</style>`,
  `sourceMappingURL` di komentar). Di app ini CSS first-party (Tailwind) dan diproses build-time.
* Koreksi catatan lama: `uuid@11.1.1` **bukan** ESM-only — paketnya punya `main: dist/cjs/index.js`
  plus `exports.require`; override CJS secara teknis mungkin, tapi tidak perlu karena tidak reachable.
* `next@16.3.8` butuh Node `>= 20.9.0` (CI Node 20 aman) dan React `^18.2.0 || ^19.0.0`.

**KEPUTUSAN (2026-10-06, oleh user): opsi (a) — terima vuln (0 critical) + pantau advisory.**
**Ditegaskan ulang 2026-10-07** untuk sisa **4 vuln (1 high: `postcss`; 3 moderate: `uuid` + `next`
+ `exceljs` yang ikut tertandai)**, dengan perubahan cakupan: `source-map-js` (yang dulu ikut
diterima) **dikeluarkan dari daftar terima dan ditutup** karena fixnya ternyata non-breaking 1 paket.
Alasan (a) tetap sah untuk sisanya: keduanya terbukti tidak reachable di jalur kode app ini
(`postcss` hanya build-time + CSS first-party; `uuid` hanya dipakai exceljs `v4()` tanpa argumen
`buf`), menutup `postcss` lewat `npm overrides` berarti meng-override **pin eksak `next`** (risiko
regresi framework demi advisory build-time), sedangkan `next@16` pun tetap menyisakan 3 moderate
`uuid`. Jadi **tidak** ada alasan naik ke Next 16 hanya untuk audit ini.

**Jadwal review advisory berkala**: tinjau ulang `npm audit --omit=dev` tiap kali (1) lockfile
tersentuh, (2) sebelum rilis/major upgrade, dan (3) minimal sekali per bulan — evaluasi ulang bila
salah satu berubah jadi reachable, naik severity, atau muncul advisory baru pada paket yang sama.
Selalu catat **tanggal snapshot + angka yang bisa direproduksi**, karena angka audit bergerak tanpa
perubahan kode (lihat kontradiksi 7 vs 5 di callout atas).

## Housekeeping + Migrasi ESLint CLI (2026-10-06, lanjutan)

* **Housekeeping**: 3 branch yang sudah di-merge dihapus (lokal + remote) —
  `chore/upgrade-next-15`, `ci/e2e-prod-server-retries`, `fix/flake-slip-batal`. Penting:
  ketiganya masuk `main` lewat **squash merge**, sehingga `git branch --merged main` **tidak**
  menunjukkannya (ancestry berbeda) — verifikasi dilakukan dengan membandingkan isi tree terhadap
  `main`, bukan status merged. SHA sebelum hapus (untuk restore): `de9a7c1`, `bb3ca08`, `7371346`.
* **`next lint` → ESLint CLI** (PR #5, di-merge squash sebagai `3ec54ef`): `next lint`
  deprecated dan **dihapus di Next 16**, jadi gate lint dipindah ke ESLint CLI `eslint .`.
  * `cuti-app/eslint.config.mjs` (baru) — flat config ESLint 9. `eslint-config-next@15.5.27`
    belum mengekspor flat config, jadi `next/core-web-vitals` dibungkus `FlatCompat`
    (`@eslint/eslintrc` ^3). `extends` sengaja **tetap sama** seperti `.eslintrc.json` lama —
    `next/typescript` **tidak** diaktifkan supaya hasil lint tidak berubah (itu perubahan terpisah).
  * `.eslintrc.json` dihapus (tidak dibaca lagi di flat config); `eslint` ^8.57 → **^9.39**;
    script `lint` → `eslint .`.
  * Cakupan jadi lebih luas: `next lint` hanya melint `app/pages/components/lib/src`,
    `eslint .` juga melint `tests/`, `unit/`, dan file config. `ignores` eksplisit ditambahkan
    untuk `.next/`, `next-env.d.ts`, `playwright-report/`, `test-results/`, `public/uploads/`.
  * Satu temuan baru: `react-hooks/rules-of-hooks` salah menandai fixture Playwright
    (`async ({ page }, use) => ...`) sebagai React Hook → aturan itu dimatikan khusus `tests/**`
    (bukan kode React, jadi aturan itu memang tidak berlaku di sana).
  * Verifikasi lokal: `eslint .` **0 problem** (identik dengan baseline `next lint`
    "No ESLint warnings or errors"), `tsc` 0, unit **84/84**, `build` **29/29 halaman**. Tidak ada
    kode runtime yang berubah (devDependency + tooling saja).
  * Verifikasi CI (PR #5, `verify` + `e2e`): **54 + 37 + 2 lulus first try, 0 flaky**, job `e2e`
    3m14s. Setelah merge, `npm run lint` di `main` juga 0 problem.
  * Catatan Next 16: Next 15.5.27 **sudah sadar flat config** di jalur build
    (`next/dist/lib/eslint/runLintCheck.js` mencari `eslint.config.mjs` lalu `loadESLint({useFlatConfig:true})`),
    jadi langkah lint saat `next build` tetap berjalan — bukan diam-diam jadi no-op.

## Design Notes (bukan bug)

* `isAtasan(userId)` mengecek **relasi** (`atasanId`), bukan `role` — user yang punya bawahan dianggap "atasan" terlepas dari field `role`. Ini memang desain yang dipakai di seluruh app.
* `wajibHR()` hanya redirect, tidak throw — dipakai di server component, bukan API route.

## Flow Decisions (grilling 2026-09-30, disetujui user)

* Slip gaji: HR isi manual → langsung TERBIT tanpa checker; salah → Batalkan + buat ulang.
* Laporan lapangan: hanya karyawan lapangan boleh buat (atasan/HR ditolak).
* Alur laporan: DRAFT → Kirim → MENUNGGU → DISETUJUI/DITOLAK/DIKEMBALIKAN, bisa revisi + kirim ulang.
* Approver laporan: wajib atasan (pilih manual per laporan), HR tidak bisa acc.
* HR tidak lihat/acc laporan sama sekali — murni karyawan↔atasan.

---

# 1. Project Overview

## Project Name

Sistem Pengajuan Cuti Online — Anime Japan

## Description

Aplikasi web pengajuan dan persetujuan cuti karyawan dengan alur berlapis (Atasan → HR), slip gaji, laporan lapangan, delegasi wewenang, dan notifikasi (in-app + Web Push + WA). Mobile-first, berbahasa Indonesia.

## Current Stage

Production — live at https://cuti-app.vercel.app/ (Next 15.5.27, React 19)

---

# 2. Current Development Phase

## Active Feature

Prototype standar (hasil grilling): slip rincian + NIP + TTD, laporan kebun + blok + rekap.

## Current Task

**P0 yang tertunda: Promote deployment `d9ac5e7` ke alias production Vercel** — alias masih
menyajikan build sebelum PR #3–#6, jadi dua security LOW PR #6 belum live (bukti di §14 item 1).
Butuh tangan user; dashboard Vercel tidak bisa diakses dari mesin ini.

Sudah selesai di kode (menunggu merge + Promote): upgrade Next 15.5.27 + React 19 live (PR #2/#3/#4),
migrasi ESLint CLI (PR #5 `3ec54ef`), security PR #6 (`d9ac5e7`), smoke pasca-deploy (PR #7),
`next/typescript` + dead import (PR #8), sapu `Sesi` kedaluwarsa (PR #9). Terbuka: TODO 97
(keputusan pin `next`, user), TODO 162 (upload di Vercel asli, butuh user), Web Push di perangkat nyata.

## Current Status

> [!CAUTION]
> **Eksperimen Suspense streaming (dashboard + persetujuan) DINYATAKAN GAGAL — jangan diulang.**
> Branch + PR #1 sudah ditutup & dihapus. Bukti: CI e2e gagal dengan
> `TypeError: Cannot read properties of null (reading 'fallback')`
> dari mesin Suspense React saat SSR dev-server (~6 menit run, bukan detik
> pertama — koreksi), diikuti kegagalan massal; satu-satunya failure main di
> periode sama ada di job `verify` (bukan e2e), dan e2e main success beruntun.
> Tantangan "mungkin E2E-nya yang salah" sudah diinvestigasi dan GUGUR:
> error-nya crash server-side, bukan timeout/flake. Hipotesis mekanisme
> (belum terbukti pasti): boundary Suspense mengelilingi async server component
> memicu crash reconciler saat streaming SSR dev. Yang tersisa dan AMAN di main:
> progress bar tegas (h-1 + glow), paralelisasi query, `SubmitButton` tanpa `disabled`.
> Syarat bila suatu hari coba lagi: branch baru → CI hijau penuh → baru merge.
> Jangan verifikasi Suspense hanya via dev lokal yang flaky.

Semua P0 security selesai:
- **Cookie `secure`** — `buatSesi` kini set `secure: true` saat `NODE_ENV === "production"` (tetap HTTP di dev agar login lokal tidak rusak).
- **Rate limiting login** — `src/lib/rate-limit.ts` (in-memory): maks 5 gagal per 15 menit per akun, blokir 15 menit. Key = **email saja** (bukan IP+email) — `x-forwarded-for` tidak stabil di dev Playwright (`::1`/`127.0.0.1`/null berganti antar request virtual), membuat counter terpecah. Rate limit per akun juga sudah tepat sasaran karena brute force menarget satu akun. Test brute-force dipisah ke `tests/rate-limit.spec.ts` (serial, timeout 120s, worker 1) karena 6× bcrypt cost 10 membuat Next dev single-process macet saat suite penuh berjalan paralel.
- **Content sniffing upload** — `src/lib/upload.ts` `sniffFile`: magic bytes PDF/PNG/JPG, ekstensi dari konten aktual, bukan `File.type` client. Spoof HTML/JS/SVG ditolak. Terintegrasi di `shared.ts` (`unggahFoto`) dan `cutiActions.ts` (`aksiAjukan`).
- **CI cleanup** — `SESSION_SECRET` sudah dihapus dari `.github/workflows/ci.yml` (sudah tidak terpakai sejak auth pakai token DB). README.md diperbaiki agar tidak lagi meminta `SESSION_SECRET`.
- **Test rate-limit dipisah** — `tests/rate-limit.spec.ts` dengan config sendiri `playwright.rate-limit.config.ts` (serial, worker 1, timeout 120s). CI workflow diupdate jalankan terpisah.
- **CSP Analytics fix (P1)** — `https://va.vercel-scripts.com` ditambahkan ke `script-src` + `connect-src` di `next.config.mjs`; verified via header CSP asli dari production server (`next start`), build + lint + smoke 6/6 PASS.
- **Confirm dialog hapus** — prop `confirm` di `SubmitButton` (`window.confirm` dicek SEBELUM `setPending`, batal = `preventDefault` + tombol tetap normal). Dipasang di 5 tombol destruktif: Hapus hari libur (satu-satunya hard delete), Batalkan pengajuan/laporan/slip/delegasi. Jenis cuti & karyawan tidak punya tombol hapus (soft-delete via checkbox Aktif) — TODO item lama sebagian stale. Test `tests/confirm-dialog.spec.ts` verifikasi dismiss → tidak submit, accept → submit. E2E terkait (`delegasi.spec.ts`, `cron.spec.ts`) dipasang `dialog` accept handler. Full suite 47/47 PASS.
- **Fix notif push bocor antar akun** — PushSubscription milik browser (satu endpoint per origin), bukan milik akun app. Setelah ganti akun di browser yang sama, notif akun lama tetap bunyi. `LogoutButton` (client) kini unsubscribe + DELETE row DB sebelum `aksiKeluar`; banner Aktifkan muncul lagi bila permission granted tapi belum ada subscription (re-subscribe ke akun aktif). Alur subscribe end-to-end tidak bisa diuji di headless CI (permission denied + butuh push service asli); terverifikasi via tsc/lint + test logout baru di smoke + full suite 48/48.
- **Bersih tech debt** — `teksAman()` kini dipakai di 4 route PDF (formulir + rekap laporan sebelumnya `drawText` langsung, crash WinAnsi untuk karakter non-Latin; verified 5/5 via tsx); HANDOVER.md baris `src/app/actions.ts` diperbaiki → `src/actions/`; `dev-server3.log` ternyata tidak ter-track (hanya di disk) → hapus lokal; item refactor actions.ts di TODO yang masih terbuka ditandai selesai.

## Catatan Teknis Penting

### Arsitektur test: 3 tier terpisah
Suite E2E dibagi 3 tier (dibuat sesi prototype, jangan digabung) — total **21 file spec, 94 test**:
1. **Suite utama** (`npx playwright test`) — 6 file, **54 test**: smoke, slip-gaji, laporan, security, performance, confirm-dialog. `testIgnore` di `playwright.config.ts` mengecualikan 14 file sisanya.
2. **Flows** (`npx playwright test --config=playwright.flows.config.ts`) — 14 file serial worker 1, **38 test**: cron, cuti-flow, cuti-validasi, delegasi, gaji-flow, hr-crud, lampiran, laporan-acc, laporan-kebun, notifikasi, profil, sesi-kedaluwarsa, slip-batal, slip-rincian. Test stateful (buat data lalu cleanup sendiri).
3. **Rate-limit** (`npx playwright test --config=playwright.rate-limit.config.ts`) — 1 file, **2 test**, serial worker 1, timeout 120s (6× bcrypt cost 10 membuat Next dev macet bila paralel).
Jalankan berurutan dari DB bersih (re-seed sekali di awal). Filter per-file via CLI (`npx playwright test tests/x.spec.ts`) sering "No tests found" misterius — gunakan full run per tier sebagai gantinya.

**Lingkungan & retry (2026-10-06)**: ketiga config memakai `webServer.command = process.env.CI ? "npm run start" : "npm run dev"` dan `retries: process.env.CI ? 2 : 0`. Di CI hasilnya job `e2e` ~3 menit (dulu 5–9 menit) tanpa flaky; di lokal tetap dev server tanpa retry. Lihat "Infrastruktur E2E" di atas.

### E2E wajib dari DB bersih
Test E2E **order/state-dependent**: setiap run menumpuk pengajuan & laporan, sehingga test seperti "HR melihat antrean kosong" gagal kalau DB sudah ada data. **Selalu re-seed sebelum `npx playwright test`:**
```powershell
$env:SEED_FORCE="true"; npx tsx prisma/seed.ts; $env:SEED_FORCE=$null
```
Seed script sudah diperbaiki urutan `deleteMany`-nya (FK-safe) — sebelumnya gagal karena tidak menghapus `GajiPerubahan`, `LaporanLapangan`, `SlipGaji`, `Notifikasi`, `PushSubscription`.

### Root `loading.tsx` dilarang
Root `src/app/loading.tsx` **tidak boleh** ditambahkan. Root `loading.tsx` membuat Suspense boundary yang menelan `notFound()`, sehingga halaman yang seharusnya 404 (`cuti/[id]`, `slip-gaji/[id]`, `laporan/[id]`, `hr/karyawan/[id]`) mengembalikan status 200 — verified dengan E2E yang gagal. Loading navigasi diimplementasikan via `src/components/NavigationProgress.tsx` (client-side progress bar di root layout) yang tidak menyentuh server rendering.

### `useFormStatus` — pendekatan manual dipertahankan
Sejak upgrade 2026-10-06 project memakai **React 19** (`useFormStatus` kini tersedia), tetapi `SubmitButton`
sengaja tetap memakai pendekatan manual: `onClick` → set pending, reset via `pathname` change atau timeout
4 detik. **Jangan tambahkan `disabled={pending}`** — itu memblokir form submit (React men-disable button
sebelum browser menyelesaikan submit). Perilaku baru React 19 yang wajib diingat: form uncontrolled
**direset otomatis** setelah tiap server action (dipakai sebagai barrier di `tests/rate-limit.spec.ts`).

### Fluidity navigasi — prefetch wajib dipertahankan
Semua halaman `ƒ` (dynamic, karena `cookies()`). Di Next 14, `<Link>` dynamic **tidak** di-prefetch kecuali `prefetch` dipasang eksplisit. Tanpa itu tiap klik tunggu round-trip server (~350–585ms ke Neon). Dengan `prefetch` di nav (`shell.tsx`) + kartu dashboard (`page.tsx`), terukur via production build: **Slip Gaji 346→75ms, Laporan 585→92ms, Notifikasi 347→68ms**. Catatan: prefetch **dinonaktifkan di dev**, jadi peningkatan hanya terasa di production — jangan buang prop `prefetch` karena "tidak terasa bedanya di localhost". Jangan pasang `prefetch` di daftar panjang tak terbatas (boros query); di app ini aman karena nav & kartu jumlahnya tetap.

### E2E makin flaky — CI pun bukan juri yang bersih
Suite E2E (kini 94 test; flows 38) melampaui kapasitas dev server lokal: run panjang bikin server jenuh → timeout masif di test belakangan (pernah 9–11 gagal, 10,8 menit) walau `.next` bersih. Test yang sama **lolos di production build lokal dan di CI** (fresh). Pola menyelesaikan: (1) jalankan spec yang dicurigai secara terisolasi dulu; (2) kalau full-run lokal gagal tapi isolasi/prod/CI hijau → itu degradasi dev, bukan bug.

**Pembaruan 2026-10-06 — flakiness juga muncul di CI**, jadi "CI sebagai juri" tidak lagi cukup sendirian. Tiga kelas flake teridentifikasi, semuanya **menunggu sinyal yang salah** (bukan bug produk):
1. `tests/rate-limit.spec.ts` — `await resp.finished()` tanpa timeout pada respons streaming. Diperbaiki di `de9a7c1`.
2. `tests/slip-batal.spec.ts` — `waitForURL(/\/hr\/slip-gaji/)` sudah cocok dengan URL saat itu sehingga tidak menunggu redirect. Diperbaiki di `917a89c`.
3. `tests/notifikasi.spec.ts` — `innerText()` sekali baca pada badge nav yang di-stream `<Suspense>` (fallback skeleton tanpa angka). Diperbaiki di `d41f91a`.

**Akar masalah sebenarnya adalah lingkungan dev server di CI** — lihat "Infrastruktur E2E — Server Produksi di CI + Retries" di atas. Setelah pindah ke `next start`, ketiga tier lolos tanpa flaky sama sekali.

**Verifikasi tiap flake dengan rerun job yang sama**: kalau rerun hijau tanpa perubahan kode, itu flake, bukan regresi produk. Lalu perbaiki: flake di gate sama merusaknya dengan gate yang tidak pernah jalan.

---

# 3. Completed Features

* [x] Project initialization
* [x] Authentication (session token DB + bcrypt)
* [x] User management (HR admin: CRUD karyawan, role, atasan)
* [x] Jenis Cuti management (kuota, syarat, lampiran)
* [x] Hari Libur management
* [x] Pengajuan Cuti (validasi server: hari kerja, kuota, anti-bentrok, H- minimal)
* [x] Approval flow: Atasan → HR (unified queue `/persetujuan`)
* [x] Slip Gaji (HR buat, karyawan lihat/unduh PDF)
* [x] Pengawasan Gaji (HR ajukan perubahan gaji → atasan approve → baru ter-apply)
* [x] Laporan Lapangan (karyawan → atasan, PDF export)
* [x] Delegasi wewenang (atasan→atasan, HR→HR)
* [x] Web Push Notification (VAPID + Service Worker)
* [x] Cron reminder H+1 + eskalasi H+3
* [x] Audit log (semua aksi tercatat)
* [x] Notifikasi in-app
* [x] E2E tests (Playwright: smoke, slip-gaji, laporan)
* [x] CI/CD (GitHub Actions: verify + e2e)
* [x] Deploy ke Vercel (Postgres + Blob + Cron)

---

# 4. Current Implementation

## Backend

* Framework: Next.js 15.5.27 (App Router) — API routes + Server Actions; React 19
* Language: TypeScript (strict mode)
* Database: PostgreSQL
* ORM: Prisma 5
* API style: REST (Next.js API routes + Server Actions)
* Auth: Session token DB (`Sesi` model) + bcrypt, cookie `sesi-cuti`

## Frontend

* Framework: Next.js 15.5.27 App Router (React 19)
* Language: TypeScript
* UI library: Tailwind CSS
* State management: React hooks (no external state lib)

## Infrastructure

* Hosting: Vercel
* Deployment: Auto-deploy from GitHub (main branch)
* CI/CD: GitHub Actions (`.github/workflows/ci.yml`)
* Storage: Vercel Blob (upload lampiran)
* Database: PostgreSQL (Neon / Supabase / Railway)
* Cron: Vercel Cron (`vercel.json` — daily `/api/cron`)

---

# 5. Architecture

## Main Modules

* Authentication (`src/lib/auth.ts`)
* Cuti / Pengajuan (`src/app/actions.ts`, `src/lib/cuti.ts`)
* Slip Gaji (`src/app/actions.ts`, `src/lib/validasi.ts`)
* Laporan Lapangan (`src/app/actions.ts`, `src/lib/validasi.ts`)
* Delegasi (`src/app/actions.ts`, `src/lib/cron.ts`)
* Notifikasi (`src/lib/notif.ts`, `src/lib/web-push.ts`)
* Cron (`src/lib/cron.ts`, `src/app/api/cron/route.ts`)
* PDF export (`src/lib/pdf.ts`)

## Important Architecture Notes

* `isAtasan(userId)` checks **relation** (count users with `atasanId = userId`), not role — `src/lib/auth.ts:51`
* `wajibHR()` checks `role === "HR_ADMIN"` — only HR admin can access HR panel
* Approver for laporan must be atasan (non-HR with bawahan) — see `api/approver/route.ts`
* `gajiBersih` computed server-side: `gajiPokok + tunjangan + tunjanganTetap - potongan`
* No migration files — schema managed via `prisma db push`
* Server actions in `src/app/actions.ts` — all mutations go through here
* Auth guards: `wajibLogin()`, `wajibHR()`, `isAtasan()` — use in server components/actions

---

# 6. Database

## Important Tables

* `User` — karyawan, atasan, HR (self-relation `AtasanBawahan`)
* `Pengajuan` — cuti requests
* `JenisCuti` — leave types with rules
* `HariLibur` — holidays
* `Kuota` — annual leave quota per user per jenis per year
* `Delegasi` — approval delegation
* `AuditLog` — all actions logged
* `Sesi` — session tokens
* `Notifikasi` — in-app notifications
* `SlipGaji` — payslips (`@@unique([userId, tahun, bulan])`)
* `LaporanLapangan` — field reports
* `PushSubscription` — web push subscriptions

## Important Relationships

* `User.atasanId` → `User.id` (self-relation, nullable, onDelete: SetNull)
* `Pengajuan.pemohonId` → `User.id` (onDelete: Restrict)
* `Pengajuan.approverId` → `User.id` (nullable, onDelete: SetNull)
* `Kuota`: `@@unique([userId, jenisId, tahun])`
* `SlipGaji`: `@@unique([userId, tahun, bulan])`

## Recent Database Changes

* (none — schema stable since initial creation)

---

# 7. API

## Important Endpoints

### Authentication

* `POST /api/auth/login` — login (server action)
* `POST /api/auth/logout` — logout (server action)

### Cuti

* `GET /api/jenis` — list active leave types (JSON)
* `GET /api/approver` — list active atasan for laporan approver dropdown
* `GET /api/formulir/[id]` — PDF formulir cuti (only if `DISETUJUI`)

### Slip Gaji

* `GET /api/slip/[id]` — PDF slip gaji (owner / HR, only `TERBIT`)

### Laporan

* `GET /api/laporan` — export Excel / PDF rekap cuti (HR only)
* `GET /api/laporan-lapangan/[id]` — JSON + PDF (owner / atasan)
* `POST /api/laporan-lapangan/[id]` — acc laporan (atasan only)

### Push

* `POST /api/push/subscribe` — subscribe/unsubscribe web push

### Cron

* `GET /api/cron?secret=CRON_SECRET` — reminder + eskalasi

## Important API Decisions

* All mutations via Server Actions in `src/app/actions.ts`
* Auth via cookie `sesi-cuti` (httpOnly, sameSite=lax, 7-day expiry)
* `CRON_SECRET` required for `/api/cron` (min 32 chars)
* `BLOB_READ_WRITE_TOKEN` required for uploads on Vercel (read-only FS without it)

---

# 8. Current Progress

## Today's Progress

### Completed

* [x] Created `AGENTS.md` with full project instructions + repo-specific technical reference
* [x] Created `PROJECT_STATUS.md` (this file)
* [x] Created `TODO.md` with task tracking template

### In Progress

* (none)

### Discovered

* `SESSION_SECRET` in ci.yml env is unused — session auth uses token DB (`Sesi` model)
* `cuti-app/HANDOVER.md` exists with deploy/security checklists — useful reference for agents

---

# 9. Current Blockers

**Alias production Vercel nyangkut di build lama** (`webpack-2eb758dea75faf50.js`), sedangkan build
`main` = `d9ac5e7` menghasilkan `webpack-a2a7106df7a920d1.js` (404 di production). Artinya dua
security LOW dari PR #6 (secret cron constant-time + rotasi token sesi) **belum live**.

* **Blocker**: butuh Promote dari dashboard Vercel. Mesin ini tidak punya kredensial Vercel —
  `npx vercel whoami` keluar 1, tidak ada `auth.json` / `VERCEL_TOKEN` / `cuti-app/.vercel/project.json`.
* **Bukan blocker kode**: hardening-nya sudah ada di `main` dan sudah terbukti di jalur non-alias
  (`/api/cron` menolak secret salah dengan 401 di E2E dan di production yang disajikan sekarang).
* **Bukti + cara verifikasi ulang + langkahnya**: §14 item 1.
* **Cara menutup**: Promote `d9ac5e7` → jalankan `gh workflow run post-deploy-smoke.yml --ref main`
  → hasilnya harus MATCH. Setelah itu perbarui §14 item 1, §15 (Deployment + Overall State), dan
  TODO.md item blocked ini.

Tidak ada blocker lain.

---

# 10. Known Bugs

| ID | Bug | Severity | Status |
| --- | --- | --- | --- |
| (none) | | | |

---

# 11. Important Technical Decisions

## Decision 1

Date: 2026-09-28

Decision:
Session auth uses token DB (`Sesi` model) instead of JWT or `SESSION_SECRET`.

Reason:
Revocable sessions, no secret rotation needed, simpler infrastructure.

Impact:
Session expiry is 7 days. Logout deletes token from DB. No `SESSION_SECRET` needed in `.env`.

---

## Decision 2

Date: 2026-09-28

Decision:
No Prisma migration files — schema managed via `prisma db push`.

Reason:
Simpler workflow for small team, no migration history needed.

Impact:
Schema changes must be pushed manually. No rollback via migrations. Backup recommended before `db push`.

---

## Decision 3

Date: 2026-09-28

Decision:
`isAtasan(userId)` checks relation (count users with `atasanId = userId`), not role.

Reason:
Atasan is not a separate role — it's a relational property. A user becomes atasan when someone has them as `atasanId`.

Impact:
Cannot determine atasan status from `role` field alone. Always use `isAtasan()` helper.

---

## Decision 4

Date: 2026-10-07

Decision:
Predikat "sesi kedaluwarsa" adalah **satu fungsi** (`sesiKedaluwarsa()` di `src/lib/auth.ts`) yang dipakai
DUA tempat: penolakan di `userDariSesi` dan penghapusan di `sapuSesiKedaluwarsa()` (`src/lib/cron.ts`,
dipanggil cron harian). Dulu hanya ada di `userDariSesi` sebagai ekspresi inline.

Reason:
Saat ini ada dua perilaku yang butuh definisi "kedaluwarsa" yang sama persis: menolak sesi, dan
menghapus row yang sudah mati. Kalau keduanya ditulis terpisah, keduanya bisa menyimpang — sapu bisa
menghapus sesi yang masih valid, atau membiarkan row yang sudah mati. Satu fungsi membuat
penyimpangan itu mustahil secara struktural.

Impact:
Perubahan aturan masa berlaku sesi harus dilakukan di `sesiKedaluwarsa()` saja, dan **kedua** jalur
ikut berubah (auth + sweeper) — termasuk testnya (`unit/sesi.test.ts`). Batas yang berlaku dan sudah
diuji: kedaluwarsa hanya bila `expiresAt < now`; tepat di `expiresAt` sesi masih valid.

---

# 12. Recent Changes

## 2026-10-07 (lanjutan) — alias production, smoke pasca-deploy, next/typescript, sapu Sesi

* **Temuan utama**: alias `cuti-app.vercel.app` **menyajikan build lama** (`webpack-2eb758dea75faf50.js`,
  build sebelum PR #3–#6), sedangkan build `d9ac5e7` = `webpack-a2a7106df7a920d1.js` yang **404** di
  production → hardening cron + rotasi sesi PR #6 belum terbukti live. Butuh Promote; dashboard tidak
  bisa diakses dari mesin ini. Detail + cara verifikasi: §14 item 1.
* **TODO 163 (PR #7)**: `post-deploy-smoke.yml` + artifact `chunk-fingerprint` (job `verify`).
  `workflow_dispatch` manual + `workflow_run` setelah CI sukses di `main`, tanpa `on: push`.
  Menjawab "deploy mendarat?" lewat perbandingan sha256 chunk; probe read-only termasuk
  `/api/cron` 401. Verifikasi: actionlint bersih, skrip dijalankan nyata ke production, CI hijau.
* **TODO 96 + 142 (PR #8)**: `next/typescript` diaktifkan; 228 temuan dibersihkan (211 di
  `src/actions`) → `eslint .` 0 problem, `tsc` 0, `build` 29/29, E2E 54+37+2.
* **TODO 141 (PR #9)**: `sesiKedaluwarsa()` jadi satu sumber kebenaran (penolakan + sapu),
  `sapuSesiKedaluwarsa()` dipanggil cron harian, `sesiDibersihkan` dikembalikan di respons.
  Unit 97/97, spec E2E baru di tier flows (37 → 38).
* **TODO 120 ditutup**: upload di mode production build sudah tercakup tier flows (`next start`),
  tidak perlu test baru. Sisa: upload di Vercel asli (TODO 162, butuh user).
* Pelajaran operasional: dengan `CI=1`, E2E menguji **hasil build** — jalankan `npm run build`
  setelah perubahan terakhir, kalau tidak akan menguji kode lama (sempat terjadi 2×).

## 2026-09-28

* Pengawasan perubahan gaji: `GajiPerubahan` model + `aksiPutusanPerubahanGaji` — HR ajukan, atasan approve
* Security: `npm audit fix` → Next 14.2.5 → 14.2.35, `eslint-config-next` 14.2.5 → 14.2.35
* Security: `.github/workflows/ci.yml` — action pinning (SHA), `permissions: read-all`, removed unused `SESSION_SECRET`
* UI: Back button `/cuti/baru`, MonthSelector `/slip-gaji/[id]`, HR slip filter (Karyawan dropdown), notif banner flash fix
* Verified: `tsc` + `lint` + `build` + 21 E2E tests PASS

## 2026-09-30

* Testing backlog selesai:
  * Unit (`cuti-app/unit/`, `npm run test:unit`, tsx --test, 0 deps baru): `cuti.test.ts` (hariKerja/bulanMasaKerja), `validasi.test.ts` (9 schema), `rate-limit.test.ts`, `upload.test.ts` (sniffFile spoof) — 56/56 PASS
  * E2E flows (`playwright.flows.config.ts`, serial worker 1, `npm run test:e2e:flows`): `cuti-flow` (alur penuh + tolak + 2 validasi), `delegasi` (CRUD delegasi + delegated approval serial), `gaji-flow` (HR→atasan→verify), `cron` (401/200-struktur/Bearer), `laporan-acc` (API setuju/tolak/403/400/401 + PDF) — 17/17 PASS
  * `gaji-perubahan.spec.ts` lama (lemah, race) dihapus diganti `gaji-flow.spec.ts`
  * CI: step baru "Run flow tests" setelah E2E utama; main config ignore flow specs
  * Helpers baru di `tests/helpers.ts`: `isoLocal`/`seninDepan`/`sabtuDepan`/`rentangDelegasi` (jangan `toISOString` — mundur 1 hari di WIB), akun atasan2/karyawan3
* Pelajaran test: kuota Duka/Menikah kecil & permanen → tiap test submit pakai jenis berbeda; `aksiBatalDelegasi` hanya nonaktifkan (baris lama tetap tampil); Shell render children 2× → locator `.first()`; cron.spec baca CRON_SECRET dari `.env` (Playwright worker tidak inherit shell env)
* Verified: `tsc` + `lint` + `build` + unit 56/56 + E2E 37/37 + flows 17/17 + rate-limit 2/2 PASS

## 2026-09-30 (prototype standar — hasil grilling, 9 keputusan disetujui)

* Slip gaji: header PDF seragam `— PT ANIME JAPAN`; Periode ganda dihapus + nama bulan;
  NIP (`User.nip`, digit 6-20, unik, wajib di form, seed 100001+); kolom TTD
  (tanggal + HR + karyawan) di PDF; rincian standar
  (jabatan/transport/makan + lembur/bonus − PPh21/BPJS Kes/BPJS TK/lainnya)
  di schema + form + action + daftar HR + detail + PDF.
* Laporan lapangan: field kebun (blok/kegiatan/jumlahTenagaKerja/hasil/cuaca/lat/lng);
  dropdown blok (`GET /api/blok`) + tombol GPS (`navigator.geolocation`);
  multi-foto maks 5 + keterangan (`LaporanFoto`, JPG/PNG only);
  detail + PDF + JSON API tampilkan semua field baru.
* Master Blok: model `Blok`, halaman `/hr/blok` (tambah/nonaktifkan), seed 5 blok,
  link di panel HR.
* Rekap laporan HR: halaman `/hr/laporan-lapangan` (filter blok/kegiatan/periode/status)
  + `GET /api/laporan-rekap` (excel/pdf-rekap). `/hr/laporan` tidak diubah (rekap cuti).
* Tests: unit 61/61 (NIP + rincian slip + field kebun); flows 24/24
  (+`slip-rincian`: terbit rincian → detail NIP/rincian → PDF 200 + NIP duplikat ditolak;
  +`laporan-kebun`: buat kebun → detail → API blok 200/401 → tambah/nonaktifkan blok → rekap + unduh Excel).
* Pelajaran: PDF pdf-lib terkompresi FlateDecode — assertion konten biner tidak bisa,
  verifikasi PDF via status/headers + tampilan halaman; seed NIP urut
  (pimpinan 100001 … karyawan5 100009); `db push --accept-data-loss` untuk kolom hapus.
* PENTING deploy: skema `SlipGaji` berubah (kolom lama dihapus) — production wajib
  `db push` + reseed + buat ulang slip demo. Tercatat di TODO P1.
* Verified: `tsc` + `lint` + `build` + unit 61/61 + E2E 37/37 + flows 24/24 + rate-limit 2/2 PASS

## 2026-09-30 (revisi: tanggal WIB + hapus blok/rekap)

* Tanggal TTD slip pakai WIB (`tglWib()` di `src/lib/pdf.ts`) — server Vercel UTC
  membuat tanggal mundur sehari bila PDF dibuat pagi hari. Berlaku untuk TTD slip.
* Hapus sesuai keputusan user: model `Blok` + seed + `/api/blok` + `/hr/blok`
  + `/api/laporan-rekap` + `/hr/laporan-lapangan` + action blok di `hrActions`.
  Alasan: HR tidak urus laporan lapangan (murni atasan↔karyawan); blok cukup teks bebas.
  Blok tetap ada sebagai field teks di laporan (form/detail/PDF/JSON).
* `tests/laporan-kebun.spec.ts` ditulis ulang: buat laporan kebun → detail →
  rute terhapus 404. Spec blok/rekap dibuang.
* Verified: `tsc` + `lint` + `build` + unit 61/61 + E2E 37/37 + flows 21/21 + rate-limit 2/2 PASS

## 2026-09-30 (pisah DB dev/production)

* Insiden: `.env` lokal menunjuk ke `neondb` yang ternyata dipakai aplikasi live
  (Neon branch `production`, database `neondb`) — reseed lokal sempat membersihkan DB live.
  Terkoreksi setelah user menunjukkan screenshot "Connection details for production".
* Perbaikan: database `neondb_dev` dibuat via `CREATE DATABASE`; `.env` lokal dialihkan
  ke sana (`db push` + seed OK, 9 user). Production `neondb`reseeded bersih
  (9 user demo, 0 slip) dan tidak tersentuh lagi oleh kerja lokal/E2E.
* ATURAN KERAS: `.env` lokal = `neondb_dev` selalu. Seed production hanya via URL
  eksplisit bila darurat, tidak pernah via `.env`.

---

# 13. Next Session

## First Task

**P0 — Promote deployment `d9ac5e7` ke alias production** (bukti + cara verifikasi di §14 item 1).
Alias masih menyajikan build sebelum PR #3–#6, jadi dua security LOW (secret cron constant-time,
rotasi token sesi) belum live. Buka dashboard Vercel → Deployments: periksa apakah deployment
`d9ac5e7` berlabel Current/Production, cek ada tidaknya Instant Rollback aktif, lalu **Promote to
Production** bila perlu. Setelah itu jalankan smoke (lihat di bawah) dan perbarui §14 + §15.

Setelah PR #7 merge, buktikan smoke end-to-end (workflow baru baru bisa di-`workflow_dispatch`
setelah ada di default branch):

```powershell
gh workflow run post-deploy-smoke.yml --ref main
gh run watch   # lihat ringkasan: MATCH = alias menyajikan build commit ini
```

Kalau hasilnya MISMATCH, itu memang artinya deploy belum mendarat — jangan dianggap kegagalan
smoke-nya.

Urutan sesi sebelumnya (dipakai sebagai handoff). Item 1–4 **selesai di sesi 2026-10-07**:

1. ~~**Koreksi + evaluasi ulang catatan audit**~~ — **SELESAI 2026-10-07**. Temuan: snapshot
   dokumen "7 vuln" **tidak reproducible** (yang terukur 5 vuln pada lockfile yang sama).
   `source-map-js` ternyata punya fix non-breaking 1 paket → ditutup (`1.2.1 → 1.2.2`),
   audit prod kini **4 vuln (1 high, 3 moderate)**; keputusan (a) ditegaskan untuk sisa
   `postcss` + `uuid`. Jadwal review advisory berkala ditulis di section "Audit Sisa".
2. ~~**Item security LOW**~~ — **SELESAI 2026-10-07**: `samaAman()` (`src/lib/aman-sama.ts`)
   dipakai `/api/cron` (constant-time, SHA-256 digest) + rotasi token sesi di `buatSesi`
   (`src/lib/auth.ts`). Unit baru `unit/aman-sama.test.ts`. **Menunggu Promote** (item P0 di atas).
3. ~~**Verifikasi yang butuh manusia/production**~~ — **SEBAGIAN**: upload di production live (TODO
   162) langkahnya sudah disiapkan di TODO.md; konfirmasi slip demo dari aplikasi live + Web Push di
   perangkat nyata masih terbuka.
4. ~~**Backlog opsional**~~ — **SELESAI**: smoke pasca-deploy (PR #7), `next/typescript` +
   dead import (PR #8), sapu `Sesi` kedaluwarsa (PR #9); TODO 120 ditutup karena sudah tercakup.
   Sisa: keputusan pin `next` eksak vs `^15.5.27` (TODO 97, keputusan user).

Belum tersentuh/terbuka: TODO 97 (keputusan user), TODO 162 (butuh tangan user), TODO 120 (ditutup),
serta PR #7/#8/#9 yang **belum di-merge** saat dokumen ini ditulis.

Sudah selesai sebelumnya: migrasi `next lint` → ESLint CLI (PR #5, squash `3ec54ef`) — CI
`verify` + `e2e` hijau (54/37/2, 0 flaky) dan `npm run lint` di `main` 0 problem.

## Files To Inspect

* `AGENTS.md` — project instructions
* `cuti-app/HANDOVER.md` — deploy/security checklists
* `cuti-app/prisma/schema.prisma` — database schema
* `cuti-app/src/lib/auth.ts` — auth guards
* `cuti-app/package.json` + `cuti-app/eslint.config.mjs` — gate lint (ESLint 9 flat config)
* `cuti-app/playwright*.config.ts` — 3 tier E2E (wajib dijalankan sebelum rilis dependensi)

## Expected Outcome

N/A — no active task.

## Things To Watch

* Branch fitur **tidak** menjalankan CI bila di-push tanpa PR (`ci.yml`: `push` hanya `main`,
  plus `pull_request`). Push branch tanpa PR = 0 job; selalu buka PR lalu cek
  `gh run list --branch <branch>`.
* Ketiga config E2E memakai `retries: process.env.CI ? 2 : 0` (lokal tanpa retry). Job CI yang
  hijau **bisa** berarti lulus di percobaan kedua — periksa penanda `flaky` di log bila meragukan.
  Job `e2e` normalnya ~3 menit; kalau kembali 5–9 menit, curigai ada test yang retry.
* E2E wajib dari DB bersih (`$env:SEED_FORCE="true"; npx tsx prisma/seed.ts`) dan `.env` lokal
  wajib tetap `neondb_dev` — jangan pernah diarahkan ke `neondb` production.
* `cuti-app/HANDOVER.md` bisa basi — verifikasi terhadap kode sebelum dipakai.

---

# 14. Sesi 2026-10-07 (lanjutan) — Alias Production & TODO 163/96/142/141/120

> Bagian ini adalah catatan kerja sesi; **§15 di bawah adalah status yang berlaku**.
> Beberapa baris di §15 masih menggambarkan keadaan sebelum Promote (lihat item 1).

## 1. Alias production MENYANGKUT — hardening cron + rotasi sesi belum live (BELUM SELESAI)

Pertanyaan sesi ini: "deploy `d9ac5e7` benar-benar live di alias production?" **Jawabannya tidak
(yang terukur), dan penyebabnya belum bisa dipastikan dari sisi saya.**

Bukti terukur (fingerprint, bukan dugaan):

| Sumber | Chunk runtime `webpack-*.js` | SHA256 |
|---|---|---|
| `https://cuti-app.vercel.app/login` (live) | `webpack-2eb758dea75faf50.js` | `31126c0e…e99f` |
| Build bersih dari commit `d9ac5e7` (lokal, `rm -rf .next`) | `webpack-a2a7106df7a920d1.js` | `e034c06b…63dc` |

* `GET https://cuti-app.vercel.app/_next/static/chunks/webpack-a2a7106df7a920d1.js` → **404**:
  build `d9ac5e7` **belum pernah** disajikan oleh alias.
* Chunk yang disajikan live **sama persis** dengan yang tercatat di "Merge + Deploy Upgrade ke
  Production" (baris `webpack-2eb758dea75faf50.js`), yaitu build `main` **sebelum** PR #3, #4, #5,
  dan #6. Artinya alias masih menunjuk build lama, jadi **secret cron constant-time + rotasi token
  sesi (PR #6) belum live**.
* Build lokal mereproduksi nama+hash yang sama dua kali (sebelum dan sesudah `rm -rf .next`), jadi
  perbandingan sidik jari ini deterministik dan sah dipakai sebagai bukti.
* `git`: `main` lokal = `origin/main` = **`d9ac5e7`** (PR #6 di-merge squash). Tidak ada
  `git branch -r` lain selain `origin/main` sampai sesi ini membuat cabang fitur baru.

**Yang TIDAK bisa saya lakukan**: memeriksa dashboard/API Vercel. Di mesin ini `npx vercel whoami`
keluar 1, tidak ada `auth.json`, tidak ada `VERCEL_TOKEN`, dan tidak ada `cuti-app/.vercel/project.json`.
Karena itu pertanyaan "deployment `d9ac5e7` berlabel Current/Production?" dan "ada Instant Rollback
aktif?" **belum terjawab** — butuh Promote dari dashboard (atau token). Setelah Promote, status ini
harus diperbarui dan diverifikasi ulang dengan perintah di bawah.

Cara memverifikasi ulang (tanpa dashboard):

```powershell
# harus menghasilkan build commit yang diharapkan, bukan build lama
(Invoke-WebRequest https://cuti-app.vercel.app/login -UseBasicParsing).Content |
  Select-String -Pattern 'chunks/(webpack-[0-9a-f.-]+\.js)' -AllMatches |
  ForEach-Object { $_.Matches.Groups[1].Value }
# build d9ac5e7 = webpack-a2a7106df7a920d1.js ; GET chunk itu harus 200, bukan 404
```

## 2. TODO 163 — smoke pasca-deploy (SELESAI, PR #7)

`post-deploy-smoke.yml` + artifact `chunk-fingerprint` dari job `verify` `ci.yml`. Menjawab
"deploy mendarat?" dengan membandingkan sha256 chunk build commit (artifact CI) vs chunk yang
disajikan alias, plus probe read-only (`/login` 200, chunk 200, `/api/cron` secret salah & tanpa
secret 401, 8 rute terproteksi 307). MISMATCH = run merah. **Tidak ada `on: push`** — hanya
`workflow_dispatch` (manual) + `workflow_run` setelah CI sukses di `main`.

Verifikasi: `actionlint` 1.7.12 bersih; skrip smoke dijalankan nyata dari Git Bash terhadap
production (13/13 probe OK); tabel kebenaran keputusan diuji langsung; CI PR #7 **hijau**
(`verify` 1m14s, `e2e` 3m9s) dan artifact `chunk-fingerprint` (351 B) benar-benar terunggah.
Bug yang ditemukan saat drill dan diperbaiki: `jq // empty` pada payload 404 mengembalikan string
`"null"` yang bocor ke panggilan API berikutnya.

Catatan: `workflow_dispatch` pada workflow **baru** baru muncul setelah file ini ada di default
branch, jadi smoke belum pernah dijalankan dari GitHub. Setelah PR #7 merge, jalankan
`gh workflow run post-deploy-smoke.yml` untuk membuktikan MATCH/MISMATCH end-to-end.

## 3. TODO 96 + 142 — `next/typescript` + dead import (SELESAI, PR #8)

Angka **diukur**, bukan perkiraan: mengaktifkan `next/typescript` = **228 problem** (226
`no-unused-vars`, 1 `prefer-const` yang merupakan **ERROR** di `src/app/persetujuan/page.tsx`, 1
`import/no-anonymous-default-export` dari file config probe). Sebaran 211 di `src/actions`.
Sesudah dibersihkan: `eslint .` **0 problem**, `tsc` 0, `build` 29/29, E2E **54 + 37 + 2**.

Jebakan yang tercatat: parameter fixture Playwright **wajib** object-destructuring
(`async ({ page }, use)`); menggantinya dengan `async (_fixtures, use)` membuat seluruh suite gagal
dimuat (`First argument must use the object destructuring pattern`) dan `tsc` tidak menangkapnya.
Fixture `loggedIn` di `tests/helpers.ts` ternyata dead code dan dihapus.

## 4. TODO 141 — sapu row `Sesi` kedaluwarsa (SELESAI, PR #9)

`sesiKedaluwarsa()` diekspor dari `src/lib/auth.ts` dan dipakai **dua** tempat: penolakan di
`userDariSesi` dan penghapusan di `sapuSesiKedaluwarsa()` (`src/lib/cron.ts`, dipanggil awal cron
harian). Satu sumber kebenaran supaya penghapusan tidak menyimpang dari penolakan. Jumlah terhapus
dikembalikan sebagai `sesiDibersihkan`.

**Batas masa berlaku (dicatat agar tidak salah lagi)**: kedaluwarsa HANYA bila `expiresAt < now`.
Tepat di `expiresAt` sesi **masih valid**; 1 ms sesudahnya baru kedaluwarsa. Ini perilaku lama yang
dipertahankan; ekspektasi awal test sempat terbalik dan **test-nya** yang diperbaiki.
Verifikasi: `unit/sesi.test.ts` 7/7, `tests/sesi-kedaluwarsa.spec.ts` (tier flows) membuktikan
cookie kedaluwarsa ditolak → row dihapus cron → dan sesi yang masih valid **tidak** ikut terhapus.

## 5. TODO 120 — upload di mode production build (SELESAI, dokumentasi saja)

Ternyata **sudah tercakup**, tidak perlu test baru:

* `tests/lampiran.spec.ts` termasuk `test("file valid (PNG) diterima dan tampil di detail")`.
* File itu ada di `testMatch` `playwright.flows.config.ts`.
* Ketiga config memakai `webServer.command = process.env.CI ? "npm run start" : "npm run dev"`.
* Job CI `e2e` menjalankan `npm run build` sebelum tier, lalu menjalankan tier flows.

Jadi jalur upload (termasuk gate `DI_VERCEL`) sudah dijalankan di bawah `next start` di CI, **bukan
hanya mode dev**. Yang belum pernah dibuktikan adalah upload di Vercel asli (TODO 162).

## 6. Operasional: jalankan `npm run build` SETELAH perubahan terakhir

Saat memverifikasi sapu `Sesi`, tier E2E `CI=1` gagal karena `next start` masih menyajikan build
**lama** (`sesiDibersihkan` undefined). Dengan `CI=1` server yang diuji adalah **hasil build**,
bukan sumber terkini — build dulu, baru E2E. Ini pernah menggigit dua kali (dulu juga pada
gate upload `lampiran.spec.ts`).

---

# 15. Current Health

## Build

PASS (`npm run build` Next 15.5.27, 29/29 halaman; CI `verify` hijau di `main`)

## Tests

PASS — unit **97/97** (9 file unit, termasuk `unit/sesi.test.ts`), E2E utama **54/54**,
flows **38/38**, rate-limit **2/2** (3 tier config, **21 file spec**). CI `e2e` hijau **tanpa
flaky** setelah pindah ke server produksi (job ~3 menit) — lihat
"Infrastruktur E2E — Server Produksi di CI + Retries".

Verifikasi 2026-10-07 (branch `security/audit-correction-low-items`): run lokal dengan dev server
sempat gagal 2 test `performance.spec.ts` + 1 `notifikasi.spec.ts`; ketiganya **hijau saat
dijalankan ulang** (performance isolasi 9/9, notifikasi isolasi 2/2) → degradasi dev server yang
sudah terdokumentasi, bukan regresi. Ketiga tier lalu dijalankan ulang dengan `CI=1`
(`npm run start`, sama seperti CI) dari DB bersih: **54/54 + 37/37 + 2/2, 0 flaky**.

Verifikasi sesi ini (2026-10-07 lanjutan): PR #8 dan PR #9 dijalankan dengan `CI=1` dari DB bersih →
**54/54 + 38/38 + 2/2**, 0 flaky.

## Lint

PASS (`npm run lint` = `eslint .`, ESLint 9 flat config, **0 problem**) dengan **`next/typescript`
AKTIF** sejak PR #8 — lihat §14 item 3. `next lint` sudah dipensiunkan (dihapus di Next 16).

## Deployment

**PERHATIAN — alias production masih menyajikan build LAMA.** Yang terukur: alias menyajikan
`webpack-2eb758dea75faf50.js` (build sebelum PR #3–#6), sedangkan build `main` = `d9ac5e7`
menghasilkan `webpack-a2a7106df7a920d1.js` (404 di production). Artinya dua security LOW PR #6
belum live. Dashboard Vercel belum bisa diperiksa dari mesin ini (tanpa kredensial) → **butuh
Promote to Production**. Bukti, cara verifikasi ulang, dan statusnya ada di §14 item 1.

`main` = **`d9ac5e7`** (merge squash PR #6).

## Overall State

Stable secara kode, dengan **satu tindakan deployment yang tertunda**: alias Vercel nyangkut di
build lama (§14 item 1). Audit produksi **4 vuln (1 high, 3 moderate), 0 critical** setelah
`source-map-js` HIGH ditutup lewat bump non-breaking `1.2.1 → 1.2.2` (2026-10-07); sisa `postcss` +
`uuid` diterima dengan alasan reachability yang didokumentasikan (lihat "Audit Sisa"). Dua security
LOW dari review 2026-09-29 sudah **di kode** (secret cron constant-time + rotasi token sesi saat
login, PR #6 `d9ac5e7`) tetapi **belum terbukti live** sampai alias di-Promote. Housekeeping row
`Sesi` kedaluwarsa ditutup di PR #9.