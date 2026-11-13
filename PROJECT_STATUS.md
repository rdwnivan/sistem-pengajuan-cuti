# PROJECT STATUS

> Living memory of the current state of the project.
> Keep this file concise, factual, and up to date.

## Last Updated

* Date: 2026-11-13 (WIB)
* Session: Review empat override selesai; belum ada jalur upstream aman dalam range. Dependency/lockfile tetap. Baseline main/production 4a0d7f0 dikonfirmasi ulang; bukti dan tindak lanjut di §22.

## Arsip snapshot 2026-10-07
* Session: P1/P2/P3 lanjutan. **Dua koreksi atas pekerjaan saya sendiri di sesi ini** (keduanya
  sudah dibereskan): (1) smoke pasca-deploy saya mula-mula memakai perbandingan **hash chunk antar
  lingkungan** — asumsi itu salah dan menghasilkan MISMATCH palsu; diganti verifikasi **SHA commit**
  via `/api/version` (PR #12). (2) Klaim "alias production nyangkut di build lama" **DICABUT**:
  `/api/version` membuktikan alias mengikuti `main`; metodenya yang cacat, bukan deployment-nya.
  Selesai dan merged: TODO 163 smoke pasca-deploy (PR #7) + koreksinya (PR #12), TODO 96+142
  `next/typescript` + 228 temuan (PR #8), TODO 141 sapu `Sesi` kedaluwarsa (PR #9), TODO 120 ditutup
  sebagai sudah tercakup, dokumentasi (PR #10). Dua security LOW PR #6 **live** (dikonfirmasi
  `/api/version` + probe `/api/cron` 401). Sesi sebelumnya: koreksi catatan audit (**snapshot live
  5 vuln, bukan 7**) + tutup `source-map-js` HIGH lewat bump non-breaking `1.2.1 → 1.2.2` (audit
  prod jadi **4 vuln: 1 high, 3 moderate**), `crypto.timingSafeEqual` untuk secret cron
  (`src/lib/aman-sama.ts`), dan rotasi token sesi saat login (`buatSesi`).

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

Verifikasi sisa production selesai 2026-11-12. Patch kompatibel `next` + `eslint-config-next` 15.5.29 dan `undici` 6.29.1 sudah lulus seluruh gate lokal, menunggu rilis via PR. Production masih melayani `05d6d13` pada pemeriksaan sesi ini; patch belum live. Audit lama 0 critical tidak berlaku untuk dependency production yang belum dipatch.

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

**Tidak ada.** (Dikoreksi 2026-10-07 malam.)

Sebelumnya sesi ini mencatat "alias production nyangkut di build lama" — **itu keliru dan sudah
dicabut.** Bukti pembalik yang definitif:

```
GET https://cuti-app.vercel.app/api/version
→ 200 {"sha":"9ae5f03f38714665a30baac9202eeedc32487186","env":"production"}
```

`9ae5f03` adalah commit **terbaru `main`** saat itu, dan `VERCEL_GIT_COMMIT_SHA` hanya bisa berasal
dari deployment yang benar-benar melayani request → **alias mengikuti `main`, tidak nyangkut**.

Akar kesalahan: verifikasi saya memakai perbandingan **hash isi chunk runtime antar lingkungan**,
yang ternyata **tidak sah** (build dari commit yang sama bisa menghasilkan isi chunk berbeda:
3482 vs 3864 byte untuk nama chunk yang sama). Jadi 404 pada `webpack-a2a7106df7a920d1.js` **bukan**
bukti alias basi — build dari commit lain memang menghasilkan chunk bernama lain, dan chunk dari
deployment lawas tidak selalu bisa diakses lagi.

Timeline yang membuktikan alias selalu dekat dengan `main`:

| Waktu | Kejadian |
|---|---|
| 19:34 | smoke vs `d9ac5e7` → chunk-nya 404. Commit `d9ac5e7` **tidak memuat** kode smoke (baru ada di PR #7), jadi alias saat itu sudah ≥ PR #7 |
| 22:46 | smoke vs `23f5c14` → `/api/version` **404** (endpoint baru ada di PR #10, merge 22:52) — konsisten |
| 23:18 | smoke vs `9ae5f03` → `/api/version` = `9ae5f03` → alias = HEAD `main` |

Dua security LOW PR #6 (secret cron constant-time + rotasi token sesi) karena itu **live**, dan
`/api/cron` menolak secret salah dengan 401 di production (diverifikasi smoke, tanpa perlu sesi).

Pelajarannya sudah ditulis di §14: jangan verifikasi "deploy mendarat?" dengan hash lintas
lingkungan — pakai identitas yang dilaporkan deployment itu sendiri (`/api/version`).

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

## 2026-10-07 — pertahankan isian form pengajuan cuti setelah ditolak

* `aksiAjukan` mengembalikan nilai form bersama pesan validasi agar React 19 dapat memasangnya
  kembali sebagai `defaultValue` setelah reset action. `Form.tsx` remount select saat opsi async
  dimuat supaya pilihan awal dan deep link tetap terpilih.
* Regresi ada di `tests/cuti-validasi.spec.ts`, termasuk mempertahankan input setelah penolakan
  dan memilih jenis cuti dari `?jenis=`. CI PR sebelumnya lulus untuk `verify` dan `e2e`.
* Run `37541258581` mencatat 54 test utama, 39 flows, dan 2 rate-limit test lulus.
* Catatan operasional saat PR tersebut aktif: tiga percobaan setelah PR dibuka (push dokumentasi,
  commit kosong, lalu close/reopen) tidak membuat CI run; pemeriksaan dilakukan lewat API Actions.
  Sebelum merge revisi itu, cocokkan status CI dengan SHA tip. Penyebabnya saat itu belum diketahui.

## 2026-10-07 (lanjutan) — alias production (koreksi), smoke pasca-deploy, next/typescript, sapu Sesi

* **Dua koreksi atas pekerjaan saya sendiri di sesi ini:**
  1. Klaim awal "alias `cuti-app.vercel.app` menyajikan build lama" **DICABUT**. Bukti pembalik:
     `GET /api/version` → `{"sha":"9ae5f03…","env":"production"}` = commit `main` terbaru, jadi alias
     **mengikuti `main`** dan dua security LOW PR #6 **live**. Metode saya (hash isi chunk antar
     lingkungan) yang cacat — bukan deployment-nya. Detail + timeline: §9 dan §14.
  2. Smoke versi pertama (PR #7) membandingkan hash chunk sehingga **gagal dengan MISMATCH palsu**.
     Diganti verifikasi SHA commit via `/api/version` (PR #12 `9ae5f03`); nama/hash chunk turun jadi
     diagnostik, dan artifact `ci.yml` jadi `build-identity` (+ `commit-sha.txt`).
* **TODO 163 (PR #7 + koreksi PR #12)**: `post-deploy-smoke.yml` (`workflow_dispatch` manual +
  `workflow_run` setelah CI sukses di `main`, tanpa `on: push`) + `GET /api/version`. Smoke di
  `main` **MATCH** terhadap `9ae5f03`. Probe read-only termasuk `/api/cron` 401.
* **TODO 96 + 142 (PR #8)**: `next/typescript` diaktifkan; 228 temuan dibersihkan (211 di
  `src/actions`) → `eslint .` 0 problem, `tsc` 0, `build` 29/29, E2E 54+37+2.
* **TODO 141 (PR #9)**: `sesiKedaluwarsa()` jadi satu sumber kebenaran (penolakan + sapu),
  `sapuSesiKedaluwarsa()` dipanggil cron harian, `sesiDibersihkan` dikembalikan di respons.
  Unit 97/97, spec E2E baru di tier flows (37 → 38).
* **TODO 120 ditutup**: upload di mode production build sudah tercakup tier flows (`next start`),
  tidak perlu test baru. Sisa: upload di Vercel asli (TODO 162, butuh user).
* Pelajaran operasional: (1) dengan `CI=1`, E2E menguji **hasil build** — jalankan `npm run build`
  setelah perubahan terakhir (sempat menggigit 2×). (2) Jangan verifikasi "deploy mendarat?" dengan
  hash artefak lintas lingkungan; pakai identitas yang dilaporkan deployment itu sendiri.

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

1. Periksa status PR patch 2026-11-12. Setelah CI lulus dan merge/rilis, verifikasi SHA `/api/version` terhadap commit yang benar dan jalankan smoke production. Jangan menganggap verifikasi lokal sebagai deploy.
2. Lanjutkan evaluasi upstream Zod/Blob (TODO Security), tanpa upgrade major atau override massal yang tidak diuji.
3. Periksa Web Analytics lewat dashboard Vercel bila akses tersedia; skrip insights masih 404.
4. Upload production dan slip demo sudah diverifikasi; tidak perlu mengulang atau membuat slip demo duplikat. Web Push perangkat sudah memiliki bukti historis 2026-10-01 di TODO Bugs.

---

# 14. Sesi 2026-10-07 (lanjutan) — Alias Production (koreksi) & TODO 163/96/142/141/120

> Bagian ini adalah catatan kerja sesi; **§15 di bawah adalah status yang berlaku**.
> Beberapa baris di §15 masih menggambarkan keadaan sebelum Promote (lihat item 1).

## 1. Alias production — kesimpulan awal "MENYANGKUT" DICABUT (alias ternyata mengikuti `main`)

Pertanyaan sesi ini: "deploy `d9ac5e7` benar-benar live di alias production?" **Jawabannya tidak
(yang terukur), dan penyebabnya belum bisa dipastikan dari sisi saya.**

> ### ⚠️ KOREKSI (2026-10-07 malam) — kesimpulan di item ini SALAH
>
> Kesimpulan "alias nyangkut di build lama" **dicabut**. Bukti pembalik:
> `GET https://cuti-app.vercel.app/api/version` → `{"sha":"9ae5f03…","env":"production"}`, yaitu
> commit `main` terbaru saat itu → **alias mengikuti `main`**.
>
> Yang salah adalah **metodenya**: perbandingan **hash isi chunk antar lingkungan** tidak sah
> (build commit sama bisa menghasilkan isi berbeda: 3482 vs 3864 byte pada nama chunk yang sama),
> dan 404 pada `webpack-a2a7106df7a920d1.js` hanya berarti "chunk dari deployment lain", **bukan**
> "alias basi". Rincian timeline + pelajaran ada di §9 dan item 2 di bawah. Sisa item ini
> dipertahankan apa adanya sebagai catatan proses (termasuk kesalahan saya), bukan sebagai fakta.

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
branch.

### 2b. KOREKSI: smoke berbasis hash chunk GAGAL — diganti verifikasi SHA commit (PR #12)

Setelah PR #7 merge, smoke langsung terpicu otomatis dan **gagal dua kali** dengan MISMATCH. Saya
awalnya melaporkan kegagalan itu sebagai "perilaku yang benar". **Itu keliru**: kegagalan tersebut
alarm palsu.

Bukti (semua untuk `main` = `9e6fa07`):

| Sumber | Nama chunk | Isi |
|---|---|---|
| build lokal bersih | `webpack-2eb758dea75faf50.js` | **3482 byte** |
| artifact CI | `webpack-2eb758dea75faf50.js` | sha256 `833567d5…` |
| disajikan alias | `webpack-2eb758dea75faf50.js` | **3864 byte**, sha256 `7a2c7668…` |

Nama chunk konsisten, **isinya tidak** → perbandingan hash antar lingkungan tidak sah, jadi
"expected" vs "live" bukan pembanding yang bermakna.

Perbaikan (PR #12, `9ae5f03`):

* `src/app/api/version/route.ts` → `{ sha, env }` dari `VERCEL_GIT_COMMIT_SHA` saat runtime
  (`cache-control: no-store`). Ini melaporkan deployment yang benar-benar menjawab request.
* `ci.yml`: artifact `chunk-fingerprint` → **`build-identity`** (+ `commit-sha.txt`), langkah
  inline dipindah ke `cuti-app/scripts/fingerprint.mjs` supaya bisa dijalankan lokal.
* `post-deploy-smoke.yml`: keputusan = **SHA commit vs SHA live**; nama/hash chunk jadi diagnostik.
  Input manual baru `expected_sha`. Dipertahankan: fail-fast "HTML `/login` harus menunjuk chunk
  yang benar-benar 200" + seluruh probe read-only. `/api/version` 404 → "TIDAK BISA DITENTUKAN" +
  gagal (bukan hijau diam-diam).

Verifikasi: `actionlint` bersih; `tsc` 0; `eslint .` 0; endpoint diuji di server produksi lokal
(dengan/tanpa `VERCEL_GIT_COMMIT_SHA`); skrip smoke dijalankan nyata untuk ketiga cabang keputusan
(404 → gagal, MATCH → lulus, MISMATCH → gagal). CI PR #12 hijau, dan smoke di `main` (`9ae5f03`)
**sukses dengan MATCH** terhadap `/api/version` yang melaporkan `9ae5f03`.

**Pelajaran**: untuk pertanyaan "deploy mendarat?", bandingkan **identitas yang dilaporkan
deployment itu sendiri**, jangan hash artefak lintas lingkungan.

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

## Verifikasi 2026-11-12 (WIB)

* Lokal: `next` + `eslint-config-next` **15.5.29** (pin eksak), `undici` **6.29.1**. Pin menjaga perubahan terkontrol; upgrade keamanan tetap lewat PR + lockfile + gate. Rationale ada di `cuti-app/README.md`.
* PASS: `prisma generate`, `tsc --noEmit`, `npm run lint`, **97/97 unit**, `npm run build` (**29/29 halaman**), E2E produksi lokal **54/54 + 38/38 + 2/2**, tanpa retry/flaky. E2E memakai `CI=1`, `TZ=Asia/Jakarta`, schema terisolasi `codex_verify_20261112_0203` pada `neondb_dev`; schema `public` dev dan production tidak di-reseed. Token layanan eksternal dikosongkan untuk E2E. Schema uji dipertahankan untuk reproduksi; server/browser CLI uji sudah ditutup.
* PR [#15](https://github.com/rdwnivan/sistem-pengajuan-cuti/pull/15) diperiksa ulang: head `ab5343e`, mergeable/CLEAN, verify + e2e + Vercel preview sukses, tidak ada review/request changes atau komentar inline. Squash merge mengikuti riwayat repository, pada **09:24 WIB**, menjadi `3104029a51b1185ec5763fb71e08d3eae3095cb6`.
* Vercel production [deployment](https://vercel.com/ridwansyarifudin07-3069s-projects/cuti-app/2q1WjfumkvQN7QVd4zkgwKqExHp7) sukses. `GET https://cuti-app.vercel.app/api/version` → **200**, `{"sha":"3104029a51b1185ec5763fb71e08d3eae3095cb6","env":"production"}`; patch sudah live.
* Smoke production read-only setelah deploy **PASS**: `/login` 200, chunk webpack yang dirujuk HTML 200, `/api/cron` tanpa/salah secret 401, delapan rute `/`, `/slip-gaji`, `/hr`, `/persetujuan`, `/laporan`, `/kalender`, `/riwayat`, `/notifikasi` → 307 `/login`. Identitas deploy dibandingkan lewat SHA, tidak membandingkan hash chunk lintas lingkungan. Tidak ada write/seed/reset DB atau upload baru pada sesi lanjutan ini.
* Gate setelah merge juga **PASS**: [CI main](https://github.com/rdwnivan/sistem-pengajuan-cuti/actions/runs/43141159100) verify (typecheck/lint/build) + E2E **54 + 38 + 2**, tanpa laporan retry/flaky. [Smoke otomatis](https://github.com/rdwnivan/sistem-pengajuan-cuti/actions/runs/43141675551) sukses dengan **MATCH** SHA `3104029a51b1185ec5763fb71e08d3eae3095cb6`. Tidak menjalankan ulang suite lokal karena sumber/dependency tidak diubah setelah gate PR; perubahan sesi lanjutan hanya dokumentasi (tidak punya runtime surface), diperiksa lewat diff + `git diff --check`.

## Upload production

* Akun demo Karyawan 1 mengajukan Sakit **23–24 November 2026** dengan PNG asli 1×1, 68 byte. Detail `/cuti/cmwcwflng0001bhop6kdcbey8` menautkan Vercel Blob; GET objek → **200, image/png, 68 byte**.
* Negatif PASS: dua hari Sakit tanpa file → `Lampiran wajib untuk jenis cuti ini`; HTML ber-ekstensi PDF → `file tidak sesuai jenis yang diklaim`.
* Pengajuan uji sudah **DIBATALKAN** dari UI dan tidak lagi dalam antrean aktif. Row audit/pengajuan dibatalkan, notifikasi, dan objek PNG tetap ada sesuai perilaku aplikasi (pembatalan tidak menghapus Blob). Objek uji: `lampiran/cmunbb8eu0008f31f83889jg3-1794448712229.png`.
* Dashboard Storage/Logs tidak dibuka; keberhasilan dibuktikan lewat submit UI, tautan detail, dan GET objek Blob langsung.

## Slip demo production

* Slip **DEMO November 2026**, Karyawan 1, ID `cmwcwmws40001rsb8z7udz2v3`, dibuat lewat UI HR dan dibiarkan **TERBIT** untuk demo. Catatan menyatakan angka contoh, bukan pembayaran gaji riil.
* Pokok 0 + jabatan 1.000.000 + transport 100.000 + makan 200.000 − PPh21 50.000 = **Rp1.250.000**. Rincian/NIP tampil di detail HR dan akun karyawan.
* Preview PDF: **200 application/pdf**, `Content-Disposition: inline`; download: **200 attachment**, signature `%PDF-`. Unduhan sebagai pemilik (Karyawan 1) juga 200.

## Audit produksi (snapshot 2026-11-12)

* Perintah: `npm audit --omit=dev --json`. Sebelum patch: **9 paket terdampak (1 critical, 6 high, 2 moderate)**. Setelah patch: **8 (0 critical, 5 high, 3 moderate)**. Hitungan paket termasuk pembawa transitive, bukan 8 akar masalah independen.
* Next 15.5.27 ditandai critical [SVG Image Optimization](https://github.com/advisories/GHSA-2464-fhr4-w9xw) dan high [DoS Server Actions](https://github.com/advisories/GHSA-p3m5-59mp-jv5r); patch 15.5.29 menutup keduanya. App memakai Server Actions sehingga DoS relevan. `undici` 6.29.1 menutup advisory 6.28.1 sesuai range dependency Blob; tidak ada `overrides`, downgrade, atau upgrade major.
* Sisa: **postcss high + next moderate** (Next masih mem-pin PostCSS 8.4.31, CSS first-party/build-time; keputusan historis menerima risiko tetap berlaku), **uuid + exceljs moderate** (ExcelJS hanya `uuidv4()` tanpa buffer, tidak memakai jalur advisory), serta **zod high + @vercel/cli-config/@vercel/oidc/@vercel/blob high** sebagai pembawanya.
* [Advisory Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) menyasar validasi array besar. `src/lib/validasi.ts` hanya memakai objek/scalar; tidak ada `z.array` pada aplikasi. CLI-config memvalidasi config lokal berbentuk objek/scalar. Ini analisis batas jalur saat ini, bukan klaim semua penggunaan SDK Blob bebas risiko. Upgrade Zod 3→4 dan rantai upstream perlu perubahan tersendiri; tindak lanjut tercatat di TODO Security (owner: maintainer).
* Audit diukur ulang setelah merge dengan `npm audit --omit=dev --json`: tetap **8 (0 critical, 5 high, 3 moderate)** pada lockfile yang kini live. Tidak ada perubahan dependency/lockfile pada sesi lanjutan ini.
* Pemeriksaan registry (`npm view <paket>@<versi> dependencies --json`) menemukan **belum ada jalur kompatibel yang menutup rantai Blob**: terpasang Blob 2.8.0 → OIDC 3.8.8 → CLI-config 0.2.7 → Zod **4.1.11** (pin eksak). Blob terbaru **2.9.0** masih meminta OIDC `^3.6.1`; OIDC 3.x terbaru **3.8.10** mem-pin CLI-config **0.3.1**, yang tetap mem-pin Zod **4.1.11**. Jadi memperbarui Blob/OIDC dalam range saja tidak menutup advisory.
* CLI-config terbaru **0.3.8** meminta Zod `^4.6.6`, tetapi jalur OIDC yang memakainya ialah **4.0.8** (major di luar range Blob). Zod langsung aplikasi **3.25.76** juga sudah versi terakhir 3.x; versi ditambal minimum **4.6.6**, latest **4.6.7**. Mengganti Zod langsung saja masih menyisakan Zod nested. Tidak diterapkan override pin upstream, downgrade Blob, atau `audit fix --force`.
* Tindak lanjut (maintainer): migrasi Zod langsung ke 4.6.7 dalam PR tersendiri (review perubahan email, coercion, default, integer aman, dan pesan validasi menurut [panduan migrasi](https://zod.dev/v4/changelog)); tunggu Blob mendukung OIDC yang mem-pin CLI-config >=0.3.6, atau evaluasi override upstream secara eksplisit beserta uji upload/token. Aplikasi memakai `issues[0].message`, bukan alias `.errors` yang dihapus di Zod 4. Existing unit schema + E2E seluruh form diperlukan sebelum rilis major. Advisory dan batas reachability di atas tetap berlaku.
* Review ulang minimal bulanan, setiap lockfile berubah, dan sebelum rilis. Angka audit Oktober di arsip bukan kondisi terbaru.

## Catatan operasional

* Web Push: TODO Bugs mencatat bukti FCM + notifikasi diterima perangkat pada **2026-10-01**. Permintaan verifikasi umum di handoff Oktober stale; sesi ini tidak melakukan uji perangkat baru.
* Web Analytics: `GET /_vercel/insights/script.js` → **404 text/html**; `<Analytics />` sudah ada di `src/app/layout.tsx`, tidak ada perubahan CSP. **Diagnosis terkonfirmasi lewat connector** setelah akses team tersedia: `get_project(cuti-app, teamId)` sukses, project `prj_thCQSO1rBwOdOCg2rNBJufuAotCO`; `count_pageviews` mengembalikan **400 `web_analytics_not_enabled`: "Web Analytics is not enabled for this project"**. Jadi blocker 403 team sebelumnya sudah selesai; Analytics memang belum diaktifkan dan data kunjungan belum dapat dibaca.
* **Sisa aktivasi Analytics**: connector yang tersedia menyediakan query kunjungan/event, tetapi tidak menyediakan aksi enable; schema `update_project` juga tidak menerima konfigurasi Web Analytics. [Dokumentasi resmi](https://vercel.com/docs/cli/project) menyediakan `vercel project web-analytics enable cuti-app --scope ridwansyarifudin07-3069s-projects` atau Enable pada dashboard project. CLI lokal **Logged out**, dashboard browser bawaan redirect login; inspeksi Brave dihentikan Computer Use karena URL aktif tidak dapat dipastikan untuk pemeriksaan keamanan. Perlu login dashboard/CLI oleh maintainer untuk aktivasi, lalu cek script 200, ikuti instruksi redeploy bila diminta Vercel, dan pastikan kunjungan tercatat. Tidak ada aktivasi, upgrade paket/billing, atau redeploy baru yang dilakukan untuk Analytics.
* `RTK.md` yang dirujuk instruksi user tidak ditemukan di repository pada sesi ini.
* Tidak ada perubahan schema aplikasi, auth, API, atau logika bisnis. Rilis melalui PR; jangan mengklaim CI hijau sebelum run PR selesai.

# 16. Lanjutan migrasi Zod + Analytics (2026-11-12)

* PR dokumentasi #16 squash-merged setelah verify/e2e/preview PASS; SHA `12942b8bf5336a1c0f27f1334188a5abaeee38b0` terkonfirmasi dari `/api/version` production.
* User mengaktifkan Analytics. Setelah deployment #16, script `/_vercel/insights/script.js` berubah dari 404 menjadi **200 application/javascript**. Browser Playwright memuat script 200 tanpa console error Analytics; script mengabaikan webdriver/headless sehingga tidak dipakai untuk memalsukan kunjungan. Sesudah user membuka aplikasi lewat browser biasa, `aggregate_pageviews` per jam mencatat **1 pengunjung + 1 pageview** pada bucket **09:00–10:00 WIB** tanggal 12 November. Blocker izin/enable lama di §15 sudah selesai. Query agregasi per jam dipakai karena query count membulatkan rentang ke hari dan semula mengembalikan bucket sebelum aktivasi.
* Migrasi langsung Zod **4.6.7** dipin eksak. Tes baseline 9/9 pada Zod 3 menangkap regresi panjang emoji setelah upgrade (1 gagal): Zod 4.6 memakai code point. Helper `teks()` mempertahankan batas UTF-16 lama untuk seluruh 30 constraint string dan pesan panjang yang tampil pada form. Zod 4 juga menolak integer di luar rentang aman JavaScript; ditambahkan test eksplisit. **109 unit, typecheck, lint, build 29/29 PASS**.
* Override khusus `@vercel/cli-config` → `zod: "$zod"` dipasang terpisah dari commit migrasi major. Versi Blob/OIDC/CLI-config tetap; seluruh resolusi Zod kini **4.6.7**. `npm run test:sdk`: **7/7 PASS** (parse config/token valid + penolakan invalid; pemilihan token environment pada subprocess tanpa kredensial; Blob PUT byte/bearer/store ID ke endpoint localhost untuk RW dan OIDC dummy). Tidak ada SDK request ke production atau pembacaan file kredensial. Audit produksi turun **8 → 4 (0 critical, 1 high, 3 moderate)**: sisa hanya PostCSS/Next dan UUID/ExcelJS sesuai keputusan penerimaan risiko lama. Override dihapus setelah upstream menerima Zod ditambal; rationale + command ada di README.
* Main menerima merge PR #11 (`48ea19b`) dari pekerjaan lain saat sesi berjalan; perubahan form React 19 dan `NilaiAjukan` digabung tanpa menghapus pekerjaan tersebut. Verifikasi gabungan lokal **109 unit + 7 SDK + typecheck/lint + build 29/29 PASS**. [CI kode PR #17](https://github.com/rdwnivan/sistem-pengajuan-cuti/actions/runs/43144077630) verify + **E2E 54 + 40 + 2 = 96 PASS**, tanpa retry/flaky. E2E CI memakai Postgres service terisolasi; tidak ada seed/reset production atau dev pengguna. Schema reproduksi lokal lama tetap dipertahankan.
* Rilis mengikuti squash merge [PR #17](https://github.com/rdwnivan/sistem-pengajuan-cuti/pull/17), setelah semua gate head terakhir lulus. Bukti identitas live ialah SHA merge tersebut vs `GET /api/version` env production dan workflow Post-deploy smoke pada SHA yang sama; jangan memakai hash chunk lintas lingkungan. Gate pada commit dokumentasi terakhir dan smoke tersedia pada checks/run repository. Tidak diperlukan perubahan schema, auth, atau konfigurasi layanan eksternal untuk rilis ini.

# 17. Review ulang dependency produksi (2026-11-12 WIB)

## Keadaan yang diperiksa langsung

* `AGENTS.md`, status, TODO, dan kode terkait dibaca; `RTK.md` tetap tidak ditemukan. Setelah `git fetch origin`: branch lokal `codex/zod-security-migration`, HEAD `a8f5b5b5972e873414e314753f014f98794a6e1d`, working tree awal bersih. `git diff HEAD origin/main` kosong meskipun SHA berbeda akibat squash. Remote `https://github.com/rdwnivan/sistem-pengajuan-cuti.git`; tidak ada PR terbuka saat pemeriksaan.
* PR #16 dan #17 **MERGED**. `origin/main` = `ca6118ac1246d0a3de162b803f3550b341f1ef2d`. [CI main](https://github.com/rdwnivan/sistem-pengajuan-cuti/actions/runs/43145186978) dan [smoke otomatis](https://github.com/rdwnivan/sistem-pengajuan-cuti/actions/runs/43145789144) diperiksa ulang melalui GitHub: completed/success pada SHA tersebut. Ini gate rilis yang sudah ada, bukan run baru sesi ini.
* Connector Vercel: deployment production `dpl_5H8MRZwBxeH12EGjG5grtur3YqXA` **READY**, metadata SHA sama. Probe baru `/api/version` **200**, SHA **MATCH**, env `production`; `/login` dan chunk webpack yang dirujuk **200**; dua probe cron tanpa/salah secret **401**; delapan rute terproteksi **307 /login**. Script Analytics **200 application/javascript**; tidak mengirim event atau menguji ulang jumlah pengunjung.

## Audit dan kelayakan perbaikan

* `npm audit --omit=dev --json` dijalankan ulang: **4 paket terdampak, 0 critical, 1 high, 3 moderate**; exit 1 karena advisory masih ada. Paket: `postcss` high, `next` moderate sebagai pembawa, `uuid` moderate, `exceljs` moderate sebagai pembawa. Tidak ada advisory Zod pada resolusi saat ini. Lima advisory di bawah diperiksa pada GitHub Advisory Database/API; tidak withdrawn, pembaruan terakhir sebelum review Oktober. Ini tetap risiko dependency, bukan audit nol.
* PostCSS: [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) `<8.5.10` (XSS stringify CSS), [GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q) `<=8.5.11` (baca file lewat sourceMappingURL), [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp) `<=8.5.22` (fix belum lengkap saat `from` kosong), [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849) `<=8.5.17` (traversal source map). Semuanya memerlukan kontrol atas CSS input. Penelusuran baru: `src/app/globals.css` first-party diimpor layout; config hanya Tailwind/Autoprefixer; Next CSS loader memanggil PostCSS saat build dengan `from: resourcePath`. Tidak ada runtime import PostCSS, CSS pengguna, atau sourceMappingURL dalam sumber app; upload menerima PDF/JPG/PNG, tidak meneruskannya ke PostCSS. Batas reachability tetap berlaku; perubahan pipeline CSS/upload atau dependency build tidak tepercaya wajib memicu review baru.
* Registry npm: Next backport/15.x terbaru tetap **15.5.29**, pin PostCSS **8.4.31**. PostCSS top-level terpasang **8.5.28** sudah di luar seluruh range advisory; latest **8.5.32** tidak mengganti pin nested Next. Next latest **16.4.6** membawa PostCSS **8.5.23**, tetapi merupakan upgrade major; override PostCSS juga melanggar pin eksak framework. Keduanya tidak diterapkan untuk batas reachability yang sudah diperiksa ini.
* [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq): UUID `<11.1.1` (juga range tertentu 12/13) hanya memengaruhi metode v3/v5/v6 dengan buffer output. `rg` pada `node_modules/exceljs/lib` kembali menemukan hanya `v4: uuidv4` dan dua pemanggilan `uuidv4()` tanpa argumen di `cf-rule-ext-xform.js`; app menggunakan ExcelJS untuk ekspor HR `/api/laporan`. ExcelJS stabil terbaru tetap **4.4.0** dengan UUID `^8.3.0` (terpasang **8.3.2**); patch **11.1.1** di luar range itu. Tidak downgrade ke ExcelJS 3.4.0 atau override major UUID. Koreksi aritmetika arsip: pada snapshot sekarang Next 16 hanya menghilangkan PostCSS/Next, sehingga tersisa **2 paket moderate (UUID/ExcelJS)**, bukan 3; angka lama bukan dasar keputusan.
* Rantai terpasang tetap Blob **2.8.0 → OIDC 3.8.8 → CLI-config 0.2.7**, Zod **4.6.7** melalui override `$zod`. Manifest registry terbaru: Blob **2.9.0** masih meminta OIDC `^3.6.1`; OIDC 3.x terbaru **3.8.10** mem-pin CLI-config **0.3.1**, yang masih mem-pin Zod **4.1.11**. CLI-config **0.3.8** menerima `^4.6.6`, tetapi dipakai OIDC **4.0.8**, di luar range Blob. Menghapus override sekarang mengembalikan Zod rentan; update Blob/OIDC dalam range saja tidak menyelesaikannya. **Override dipertahankan**, helper UTF-16 `teks()` dan perbaikan form PR #11 tidak disentuh.

## Keputusan dan verifikasi sesi ini

* Belum ada fix upstream dalam range yang layak diterapkan untuk sisa advisory. Keputusan penerimaan risiko PostCSS/UUID dipertahankan setelah penilaian ulang per advisory dan kode, bukan semata catatan sesi lama. Tidak mengubah dependency, lockfile, atau membuat PR dependency kosmetik.
* `npm ls next postcss uuid exceljs @vercel/blob @vercel/oidc @vercel/cli-config zod` valid; `npm run test:sdk` **7/7 PASS** (dummy/local, tanpa kredensial produksi). Perubahan hanya dua dokumen; tidak punya runtime surface. Diff dan `git diff --check` diperiksa. Typecheck/lint/unit/build/E2E tidak dijalankan ulang karena tidak ada perubahan kode/dependency; hasil 109 unit/96 E2E di §16 adalah bukti historis rilis.
* Tindak lanjut owner maintainer: review lagi **paling lambat 2026-12-12**, setiap lockfile berubah, dan sebelum rilis. Cek backport Next 15 yang mengubah pin PostCSS, ExcelJS stabil dengan UUID ditambal, serta Blob/OIDC 3.x yang menjangkau CLI-config dengan Zod >=4.6.6. Hapus override hanya setelah `npm ls zod`/audit membuktikan tidak ada resolusi rentan dan SDK + unit/typecheck/lint/build/E2E lulus dalam PR fokus. Advisory baru/naik severity atau perubahan reachability memicu evaluasi segera.
* Tidak ada write/seed/reset database, upload/demo baru, atau perubahan layanan. Schema reproduksi `codex_verify_20261112_0203`, pengajuan dibatalkan, slip DEMO terbit, histori/notifikasi/Blob tetap dipertahankan. Dokumen hasil review masih lokal sampai dicommit/diajukan terpisah.

# 18. Penutupan PostCSS/UUID atas permintaan user (2026-11-12 WIB)

* User meminta perbaikan setelah hasil §17; keputusan sesi ini mengevaluasi override teruji untuk menutup advisory, menggantikan penerimaan risiko sebelumnya bila gate lulus. Branch dibuat dari `origin/main`; dua dokumen review lokal dibawa tanpa membuang pekerjaan.
* PostCSS top-level dipin 8.5.28 (versi pipeline sebelumnya) dengan override `$postcss` untuk seluruh konsumen, termasuk Next 15.5.29. UUID 11.1.1 di-override **hanya untuk ExcelJS**. Zod 4.6.7/override, helper UTF-16, perbaikan form PR #11, dan versi Next/ExcelJS/Blob/OIDC tetap.
* Analisis UUID major 8→11: CJS `require` + named `v4()` tetap tersedia; breaking changes Node lama/UMD, state v1/v7, dan tipe tidak dipakai ekspor server app. Lisensi tetap MIT; tidak menambah dependency langsung. PostCSS tetap major 8. Rationale dan syarat penghapusan override dicatat di README.
* `scripts/dependency-compat.test.mjs`: tiga regresi keamanan **merah pada versi lama** (style-closing CSS, source map eksternal tanpa `from`, UUID v5 buffer terlalu kecil); ekspor/baca ulang workbook dengan conditional formatting tetap hijau. Setelah override: **4/4 PASS**; `npm audit --omit=dev --json` **0 vulnerability**. CI menambahkan gate dependency + SDK. E2E tambahan di `security.spec.ts` memeriksa response ekspor HR dan membaca header workbook; total yang diharapkan kini 55 utama + 40 flows + 2 rate-limit.
* Lokal **PASS**: `npm ci --ignore-scripts`, `prisma generate`, `npm ls` (tanpa invalid), **109 unit + 7 SDK + 4 dependency**, `tsc --noEmit`, lint, build **29/29**, `git diff --check`. Build menggunakan URL DB placeholder dan token layanan kosong; tidak mengakses data user. Satu error tipe pada E2E baru (Buffer Node vs deklarasi ArrayBuffer ExcelJS) diperbaiki dengan konversi `Uint8Array.from(...).buffer`, lalu typecheck/lint diulang dan lulus. Tidak ada perubahan sumber aplikasi.
* Lockfile dihasilkan npm; hanya pin root PostCSS, penghapusan nested rentan, metadata PostCSS kini juga produksi, dan UUID 8.3.2→11.1.1 yang berubah. Percobaan scoped override Next meninggalkan instalasi invalid; override `$postcss` global menyelesaikan resolusi. Churn dari percobaan dedupe/npm 10 dibuang, metadata platform asli dipertahankan; tidak mengedit generated lockfile manual.
* Audit lengkap (termasuk dev) masih **7 moderate**, semuanya tooling dev (`@typescript-eslint/*`, `minimatch`, `postcss-selector-parser`); bukan hasil audit produksi. Tindak lanjut dicatat terpisah, tidak memperluas patch runtime ini. Gate PR/E2E masih harus selesai; patch belum di-merge/deploy. Production terakhir tetap SHA §17; data dan schema reproduksi tidak disentuh.
* [PR #18](https://github.com/rdwnivan/sistem-pengajuan-cuti/pull/18) dibuka. [CI pertama](https://github.com/rdwnivan/sistem-pengajuan-cuti/actions/runs/43147480473): verify PASS, preview READY, tetapi E2E utama **54 PASS + 1 gagal** pada tes ekspor baru (`Workbook is not a constructor`, termasuk retry). Endpoint sendiri sudah 200; penyebabnya named dynamic import CommonJS ExcelJS pada tes. Diganti ke `(await import("exceljs")).default` sesuai aplikasi; impor/workbook round-trip Node native, typecheck, lint PASS. CI head koreksi harus diperiksa sebelum selesai; kegagalan pertama tidak dinyatakan flaky atau disembunyikan.
* **Gate kode koreksi sudah PASS**: [CI `4ecc175`](https://github.com/rdwnivan/sistem-pengajuan-cuti/actions/runs/43147989769), verify (instalasi bersih Linux, 4 dependency + 7 SDK, typecheck/lint/build) + E2E **55 utama + 40 flows + 2 rate-limit = 97**, tanpa retry/flaky pada run ini. Preview untuk SHA tersebut sukses; PR diperiksa **OPEN/MERGEABLE/CLEAN**, tanpa review request changes. Commit berikutnya hanya memperbarui dokumen hasil; checks pada head terakhir tetap menjadi gate merge. Implementasi dan verifikasi perbaikan selesai; belum merge atau deploy, sehingga audit 0 berlaku untuk lockfile PR dan belum diklaim live.

# 19. Penyelesaian antrean setelah PR #18 (2026-11-12 WIB)

* User menginstruksikan mengerjakan sisa antrean. PR #18 diperiksa ulang: head `0c9b578`, seluruh checks sukses, MERGEABLE/CLEAN; squash-merged menjadi **1536799218e0327a6f7303cfe73f6ce157af19c8**. Vercel production `dpl_FNu2sszmvXpCLW3VD8dxE9N3smNA` **READY**, `/api/version` mengembalikan SHA sama dan env production. [CI main](https://github.com/rdwnivan/sistem-pengajuan-cuti/actions/runs/43150571866) serta [smoke otomatis SHA MATCH](https://github.com/rdwnivan/sistem-pengajuan-cuti/actions/runs/43150985775) sukses; penutupan audit produksi sudah live.
* `.env.test` sebelumnya gagal autentikasi (`28P01`). Kredensial role dev yang masih valid diuji terhadap **neondb_test** dengan `SELECT current_database()`; PASS. Hanya `DATABASE_URL` pada file lokal yang diabaikan Git diperbarui, variabel lain dipertahankan; tidak mencetak secret, tidak mengubah password role/production, tidak menulis data saat pemeriksaan koneksi.
* E2E lokal menggunakan schema baru **codex_forms_20261112_1105** di **neondb_test**, dibuat hanya setelah membuktikan schema belum ada; `db push` + seed terbatas ke schema baru ini. Schema dev/public, production, dan reproduksi lama `codex_verify_20261112_0203` tidak disentuh. Token WA/Blob/VAPID/OIDC dikosongkan; `CI=1`, `TZ=Asia/Jakarta`, server `next start`, retry 0. Schema baru dipertahankan untuk reproduksi; jangan seed ulang tanpa pemeriksaan target.
* Akar bug form: `action` React 19 mereset semua uncontrolled input saat action mengembalikan hasil, termasuk `{error}`. Regresi laporan pada build lama **merah**: lokasi yang dikirim `Kebun uji` menjadi string kosong sesudah file ditolak. `ActionForm` mempertahankan native action untuk pre-hydration, lalu sesudah hydration mencegah submit default dan dispatch `useActionState` dalam transition dengan `FormData(form, submitter)`; React tidak menjadwalkan host reset. Tidak menyalin password/file ke state respons server. Semua 11 form tersisa diadopsi; form cuti PR #11 dan kontrak UTF-16 tidak diubah. Semua action terkait tetap memakai validasi/otorisasi/redirect lama.
* Lokal **PASS**: typecheck/lint, build 29/29, **109 unit + 7 SDK + 4 dependency**, **7 E2E baru + 2 profil + 2 rate-limit** (retry 0). Tujuh regresi mencakup laporan lengkap+file/GPS, periode slip, user/password/role/checkbox, jenis, delegasi, login error→koreksi lewat Enter, dan password. Barrier rate-limit diganti dari reset email ke `aria-busy=false` dan mengecek email/password tetap ada; batas rate limit tidak berubah. Suite CI lengkap berikutnya diharapkan 55 utama + 47 flows + 2 rate-limit.
* Koreksi grounding: `ProfilForm` WA memang tidak dirender (`profil/page.tsx`), sesuai keputusan lama. Komponen ikut memakai shell baru untuk konsistensi ketika kelak diaktifkan, tetapi **tidak diaktifkan** dan tidak diklaim teruji lewat UI aktif. Percobaan tes yang menargetkannya gagal karena tidak ada elemen; diganti regresi login yang aktif. Locator select slip diperbaiki agar menargetkan nama field alih-alih teks label yang mencakup seluruh opsi. Setelah koreksi, semua tes lokal di atas lulus. Tidak ada perubahan action/auth/API/schema. PR/CI penuh masih menunggu.
* **Selesai di PR #19**: [CI PR](https://github.com/rdwnivan/sistem-pengajuan-cuti/actions/runs/43152026125) verify + **104 E2E (55 utama + 47 flows + 2 rate-limit) PASS**, tanpa retry/flaky; preview sukses, head `ec3b238` CLEAN/MERGEABLE. Squash merge **137469d170ffa4aa0f3daad142964beceb4ff304**; `/api/version` sudah **200 SHA sama, env production**. Gate main/smoke setelah merge masih dipantau. Branch tooling mengintegrasikan merge ini sebelum pengujian gabungan; tidak membuang implementasi form.

# 20. Penutupan advisory tooling development (2026-11-12 WIB)

* Dua akar untuk 7 paket moderate: [Minimatch GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) `>=7 <11.0.1` (amplifikasi glob saat optimizationLevel>=2), serta [selector parser GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) `<6.1.5` (CPU quadratic). Pemakaian sekarang adalah lint/project-service dan CSS first-party saat build, bukan endpoint CSS/glob penyerang. `typescript-estree@8.70.1` memanggil named CJS `minimatch(filePath, pattern, {dot:true})`; parser terbaru 8.72.2 juga masih meminta Minimatch ^10.2.2, jadi update parser dalam range belum menutup advisory.
* Commit patch tersendiri: selector parser **6.1.4→6.1.6** melalui `npm update postcss-selector-parser`, tetap dalam ^6.1.x Tailwind/PostCSS-nested; tidak menambah override. Rilis security-only 6.1.5 menutup advisory, 6.1.6 menutup pola CPU lain dan mengganti cssesc dengan implementasi internal linear. Lockfile menghapus cssesc yang tidak lagi dibutuhkan.
* Commit major tersendiri: override **hanya `@typescript-eslint/typescript-estree` → minimatch 11.0.1**, tanpa mengganti ESLint/Next/TypeScript ESLint. Review manifest/release/source dan uji kontrak: named CJS API tetap, engine `18 || 20 || >=22` sesuai CI Node20/lokal24. Satu helper baru **@isaacs/nonrecursive-glob-match@1.1.0**, dev-only, BlueOak-1.0.0 permisif (sama seperti Minimatch), di-lock; matcher internal dibaca, tanpa dependency runtime/network. Minimatch 3/5 konsumen lain tidak diubah. README mencatat alasan dan syarat hapus override setelah upstream menerima patch.
* `scripts/tooling-compat.test.mjs` **3/3 PASS**: matching dotfile/ekstensi melalui resolusi estree, parser project service dengan allowDefaultProject glob dan AST bertipe, serta round-trip selector Tailwind ter-escape/pseudo. CI menjalankan `npm run test:tooling` bersama dependency/SDK. Audit lengkap **7→0** dan audit produksi tetap **0**; `npm ls` valid, `npm ci --ignore-scripts` PASS. `npm audit fix --dry-run` dievaluasi tetapi tidak diterapkan karena menawarkan churn/peer warnings tanpa menyelesaikan seluruh root.
* Verifikasi lokal gabungan dengan PR #19: tooling 3 + SDK 7 + dependency 4, typecheck/lint dan build **29/29 PASS**. Unit 109 dan E2E fokus 11 perbaikan form tercatat di §19; PR gabungan harus menjalankan 104 E2E lagi. Belum mengklaim tooling patch dirilis; tidak ada perubahan data/schema/auth/API atau aktivasi WA.
* **PR #20 sudah MERGED** menjadi **e109822b80c1616197c26326ce994045d7ba4737** setelah head `3fdc212` CLEAN/MERGEABLE, verify/e2e/preview sukses. [CI PR](https://github.com/rdwnivan/sistem-pengajuan-cuti/actions/runs/43152811478): **104 E2E (55+47+2)** tanpa retry/flaky + 3 tooling/7 SDK/4 dependency PASS. Unit gabungan lokal diulang **109/109 PASS**. Audit lengkap main diukur ulang **0 (semua severity 0)**.

# 21. Penutupan antrean dan bukti rilis (2026-11-12 WIB)

* PR #18 (PostCSS/UUID produksi) live **1536799**; PR #19 (11 form tersisa) live **137469d**; PR #20 (tooling dev) live **e109822**. [CI main form](https://github.com/rdwnivan/sistem-pengajuan-cuti/actions/runs/43152555438) dan [smoke form](https://github.com/rdwnivan/sistem-pengajuan-cuti/actions/runs/43152999893) sukses. Vercel #20 **READY**, deployment `dpl_3zks6PzAqc54zduDED9jmQSURLRZ`; `/api/version` **200**, SHA `e109822b80c1616197c26326ce994045d7ba4737`, env production.
* Probe read-only baru sesudah deploy #20 **PASS**: login dan chunk webpack yang dirujuk HTML 200, Analytics script 200 JavaScript, cron tanpa/salah secret 401, delapan halaman terproteksi 307 ke login. Tidak memakai hash chunk lintas lingkungan atau memalsukan pageview. [CI main #20](https://github.com/rdwnivan/sistem-pengajuan-cuti/actions/runs/43153315218) verify + **104 E2E PASS tanpa retry/flaky**, [smoke otomatis #20](https://github.com/rdwnivan/sistem-pengajuan-cuti/actions/runs/43153785833) **MATCH** untuk SHA yang sama. Semua gate rilis kode selesai.
* `.env.test` tetap ignored dan kredensial valid; tidak ada secret dalam commit. Schema E2E baru `codex_forms_20261112_1105` di neondb_test dipertahankan; schema lama `codex_verify_20261112_0203`, public dev, data production (pengajuan dibatalkan/slip DEMO/history/notifikasi/Blob) tidak diubah. Semua server/browser E2E yang dibuat sesi ini sudah selesai/ditutup.
* Tidak ada blocker aktif. Review berkala berikutnya paling lambat **2026-12-12**, setiap lockfile berubah, dan sebelum rilis. Pantau upstream untuk menghapus override PostCSS, UUID, Minimatch dan Zod; **jangan menghapus** sebelum resolusi aman + unit/SDK/dependency/tooling/typecheck/lint/build/E2E lulus. Blob/OIDC saat review ini masih menjangkau pin Zod rentan tanpa override; evaluasi sudah selesai, penantiannya adalah perubahan upstream. Snapshot audit 0 bukan jaminan advisory tidak akan berubah.
* Perubahan penutupan sesi hanya `PROJECT_STATUS.md` dan `TODO.md`, tanpa runtime surface; diff/whitespace diperiksa. Identitas deployment setelah merge PR dokumentasi mengikuti SHA squash PR tersebut melalui `/api/version` dan smoke otomatis, bukan SHA snapshot kode di atas. Status/checks GitHub tetap sumber bukti untuk head terbaru.

# 22. Review penghapusan override (2026-11-13 WIB)

* Pemeriksaan baru: AGENTS/status/TODO dibaca; RTK.md tetap tidak ditemukan. Working tree awal bersih pada codex/close-backlog-release-status (6c2cf79); setelah fetch, tree identik dengan origin/main **4a0d7f03378fab796b36dafaa0f255e341bc9661**. Remote rdwnivan/sistem-pengajuan-cuti; PR #18–#21 MERGED, tidak ada PR terbuka saat awal review.
* [CI main](https://github.com/rdwnivan/sistem-pengajuan-cuti/actions/runs/43364968111) dan [smoke main](https://github.com/rdwnivan/sistem-pengajuan-cuti/actions/runs/43365457424) completed/success pada SHA tersebut. Log diperiksa: 4 dependency + 7 SDK + 3 tooling dan **55+47+2 E2E PASS**, tanpa retry/flaky. Ini pemeriksaan ulang run yang ada. Vercel production **dpl_4pBBpL1xR1VKJ54GT7XD2AVfsWWo READY**, metadata SHA cocok. Probe baru /api/version 200 SHA MATCH/env production; /login + chunk webpack rujukannya 200; cron tanpa/salah secret 401; delapan rute terproteksi 307 /login.
* Audit baru baseline lengkap dan omit=dev **0 vulnerability**; npm ls konsumen valid. Manifest registry dan release notes diperiksa, tidak sekadar catatan sesi: Next 15 terbaru tetap **15.5.29 → PostCSS 8.4.31**; ExcelJS latest **4.4.0 → UUID ^8.3.0**; typescript-estree latest **8.72.2 → Minimatch ^10.2.2**; Blob 2.x latest **2.9.0 → OIDC ^3.6.1**, OIDC 3.x latest **3.8.10 → CLI-config 0.3.1 → Zod 4.1.11**. CLI-config latest 0.4.0 menerima ^4.6.6 tetapi tidak memenuhi pin OIDC. Tidak meng-upgrade dependency secara kosmetik. Next 16.4.6 membawa PostCSS 8.5.23, namun major di luar pin; tidak diterapkan.
* Empat eksperimen independen menyalin package.json + lockfile ke direktori sementara di luar repository, menghapus **satu** override per eksperimen, lalu npm install --package-lock-only --ignore-scripts --no-fund --no-audit dan npm audit --json. Semuanya berhasil resolve tetapi mengembalikan versi rentan: PostCSS **8.4.31** (2 paket terdampak: 1 high/1 moderate); UUID **8.3.2** (2 moderate); Minimatch **10.2.6** (6 moderate); Zod nested **4.1.11** (4 high). Angka termasuk konsumen pembawa, bukan jumlah akar advisory. Eksperimen lockfile ini bukan instalasi bersih dan tidak dipakai mengganti lockfile aplikasi. Karena semua kandidat gagal keamanan, tidak ada kandidat yang dilanjutkan ke instalasi bersih/penghapusan override.
* Advisory GitHub API diperiksa ulang: GHSA-fxqj-rqcc-2cmp (PostCSS <=8.5.22), GHSA-w5hq-g745-h8pq (UUID <11.1.1), GHSA-g3hv-75wg-m249 (Minimatch >=7 <11.0.1), GHSA-mrhx-c7xc-m3w5 (Zod <4.6.6), semuanya belum withdrawn. Kontrak konsumen dibaca: ExcelJS require('uuid').v4() tanpa argumen; estree named CommonJS minimatch dengan dot:true. UUID 11 memiliki export require CJS; Minimatch 11.0.1 memiliki named CJS export dan engine 18 || 20 || >=22 (Node20 CI/24 lokal sesuai). Helper teks() UTF-16, form cuti PR #11/ActionForm PR #19, dan WA tersembunyi tidak diubah.
* Verifikasi baru lokal Node **24.20.0**: **109 unit + 7 SDK + 4 dependency + 3 tooling PASS**, tsc --noEmit, lint dan build **29/29 PASS** (URL DB placeholder, token layanan kosong). Koneksi baca .env.test ke neondb_test PASS; schema codex_forms_20261112_1105 terkonfirmasi masih ada. Tidak seed/reset/write database, tidak menjalankan E2E lokal atau menyentuh schema codex_verify_20261112_0203/data production/Blob.
* Perubahan hanya dokumentasi di branch codex/review-dependency-overrides, tanpa runtime surface. Tidak menghapus override atau mengubah versi/lockfile. [PR dokumentasi #22](https://github.com/rdwnivan/sistem-pengajuan-cuti/pull/22) menjalankan gate instalasi bersih Node20, prisma generate, compatibility/typecheck/lint/build dan tiga tier E2E pada service Postgres CI terisolasi. Hasil untuk head terakhir tersedia pada checks PR; jangan menganggap push branch saja sebagai bukti CI. Audit lengkap/produksi diulang setelah perubahan dokumen: **0**, npm ls --all valid, diff/whitespace bersih. Tidak merge/deploy pada sesi ini. Review berikutnya **paling lambat 2026-12-13**, setiap lockfile berubah, dan sebelum rilis; owner maintainer. Syarat penghapusan konkret per override ada di README.
