# PROJECT STATUS

> Living memory of the current state of the project.
> Keep this file concise, factual, and up to date.

## Last Updated

* Date: 2026-09-28
* Session: Security hardening + UI polish (back buttons, month selector, HR slip filter)

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

Pengawasan perubahan gaji — approval flow atasan sebelum gaji slip bisa terbit.

## Current Task

Implementasi selesai, verifikasi `tsc`/`lint`/`build` PASS. Menunggu deploy + seeding test DB.

## Current Status

Semua flow berjalan. Perubahan gaji kini butuh persetujuan atasan (tidak bisa langsung di-set HR).

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