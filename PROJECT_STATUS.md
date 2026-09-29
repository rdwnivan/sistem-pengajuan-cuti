# PROJECT STATUS

> Living memory of the current state of the project.
> Keep this file concise, factual, and up to date.

## Last Updated

* Date: 2026-09-30
* Session: Prototype standar selesai — slip rincian + NIP + TTD, laporan kebun + blok + rekap (semua hijau)

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

## Issues Remaining

| Sev | Issue | Lokasi |
|-----|-------|--------|
| LOW | Perbandingan secret cron tidak constant-time (`q !== secret`) — timing attack teoretis | `src/app/api/cron/route.ts:9` |
| LOW | Session token tidak dirotasi setelah login | `src/lib/auth.ts` |
| INFO | CSP `script-src 'unsafe-inline'` melemahkan proteksi XSS (dibutuhkan Next.js bootstrap) | `next.config.mjs` |
o | Vercel Analytics + SpeedInsights **diblokir CSP** — `script-src` tidak memuat `https://va.vercel-scripts.com`, jadi analitik tidak jalan di production | `next.config.mjs` + `layout.tsx` |

## Design Notes (bukan bug)

* `isAtasan(userId)` mengecek **relasi** (`atasanId`), bukan `role` — user yang punya bawahan dianggap "atasan" terlepas dari field `role`. Ini memang desain yang dipakai di seluruh app.
* `wajibHR()` hanya redirect, tidak throw — dipakai di server component, bukan API route.

---

# 1. Project Overview

## Project Name

Sistem Pengajuan Cuti Online — Anime Japan

## Description

Aplikasi web pengajuan dan persetujuan cuti karyawan dengan alur berlapis (Atasan → HR), slip gaji, laporan lapangan, delegasi wewenang, dan notifikasi (in-app + Web Push + WA). Mobile-first, berbahasa Indonesia.

## Current Stage

Production — live at https://cuti-app.vercel.app/ (Next 14.2.35)

---

# 2. Current Development Phase

## Active Feature

Prototype standar (hasil grilling): slip rincian + NIP + TTD, laporan kebun + blok + rekap.

## Current Task

Selesai dan ter-commit (`19c1860`): `tsc`/`lint`/`build` PASS. Unit 61/61 PASS. Suite utama 37/37 PASS, flows 24/24 PASS, rate-limit 2/2 PASS.

## Current Status

Semua P0 security selesai:
- **Cookie `secure`** — `buatSesi` kini set `secure: true` saat `NODE_ENV === "production"` (tetap HTTP di dev agar login lokal tidak rusak).
- **Rate limiting login** — `src/lib/rate-limit.ts` (in-memory): maks 5 gagal per 15 menit per akun, blokir 15 menit. Key = **email saja** (bukan IP+email) — `x-forwarded-for` tidak stabil di dev Playwright (`::1`/`127.0.0.1`/null berganti antar request virtual), membuat counter terpecah. Rate limit per akun juga sudah tepat sasaran karena brute force menarget satu akun. Test brute-force dipisah ke `tests/rate-limit.spec.ts` (serial, timeout 120s, worker 1) karena 6× bcrypt cost 10 membuat Next dev single-process macet saat suite penuh berjalan paralel.
- **Content sniffing upload** — `src/lib/upload.ts` `sniffFile`: magic bytes PDF/PNG/JPG, ekstensi dari konten aktual, bukan `File.type` client. Spoof HTML/JS/SVG ditolak. Terintegrasi di `shared.ts` (`unggahFoto`) dan `cutiActions.ts` (`aksiAjukan`).
- **CI cleanup** — `SESSION_SECRET` sudah dihapus dari `.github/workflows/ci.yml` (sudah tidak terpakai sejak auth pakai token DB). README.md diperbaiki agar tidak lagi meminta `SESSION_SECRET`.
- **Test rate-limit dipisah** — `tests/rate-limit.spec.ts` dengan config sendiri `playwright.rate-limit.config.ts` (serial, worker 1, timeout 120s). CI workflow diupdate jalankan terpisah.

## Catatan Teknis Penting

### E2E wajib dari DB bersih
Test E2E **order/state-dependent**: setiap run menumpuk pengajuan & laporan, sehingga test seperti "HR melihat antrean kosong" gagal kalau DB sudah ada data. **Selalu re-seed sebelum `npx playwright test`:**
```powershell
$env:SEED_FORCE="true"; npx tsx prisma/seed.ts; $env:SEED_FORCE=$null
```
Seed script sudah diperbaiki urutan `deleteMany`-nya (FK-safe) — sebelumnya gagal karena tidak menghapus `GajiPerubahan`, `LaporanLapangan`, `SlipGaji`, `Notifikasi`, `PushSubscription`.

### Root `loading.tsx` dilarang
Root `src/app/loading.tsx` **tidak boleh** ditambahkan. Root `loading.tsx` membuat Suspense boundary yang menelan `notFound()`, sehingga halaman yang seharusnya 404 (`cuti/[id]`, `slip-gaji/[id]`, `laporan/[id]`, `hr/karyawan/[id]`) mengembalikan status 200 — verified dengan E2E yang gagal. Loading navigasi diimplementasikan via `src/components/NavigationProgress.tsx` (client-side progress bar di root layout) yang tidak menyentuh server rendering.

### React 18 — `useFormStatus` tidak tersedia
Project pakai React 18.3.1. `useFormStatus` (React 19) **tidak ada** di `react-dom` — memanggilnya merusak render. `SubmitButton` memakai pendekatan manual: `onClick` → set pending, reset via `pathname` change atau timeout 4 detik. **Jangan tambahkan `disabled={pending}`** — itu memblokir form submit (React men-disable button sebelum browser menyelesaikan submit).

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

* Framework: Next.js 14.2.35 (App Router) — API routes + Server Actions
* Language: TypeScript (strict mode)
* Database: PostgreSQL
* ORM: Prisma 5
* API style: REST (Next.js API routes + Server Actions)
* Auth: Session token DB (`Sesi` model) + bcrypt, cookie `sesi-cuti`

## Frontend

* Framework: Next.js 14 App Router
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

None.

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

# 12. Recent Changes

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

Awaiting new requirements. No active task.

## Files To Inspect

* `AGENTS.md` — project instructions
* `cuti-app/HANDOVER.md` — deploy/security checklists
* `cuti-app/prisma/schema.prisma` — database schema
* `cuti-app/src/lib/auth.ts` — auth guards

## Expected Outcome

N/A — no active task.

## Things To Watch

* `SESSION_SECRET` in ci.yml is unused — can be removed from CI env if desired
* `cuti-app/HANDOVER.md` may become stale — verify against actual code before relying on it

---

# 14. Current Health

## Build

PASS (CI green)

## Tests

PASS (E2E: 18 tests — smoke, slip-gaji, laporan)

## Lint

PASS

## Deployment

PASS (live at https://cuti-app.vercel.app/)

## Overall State

Stable