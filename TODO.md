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

Tasks that should be completed next.

## Current Feature

(none — all major features complete)

## Bugs

* [ ] Vercel Analytics + SpeedInsights blocked by CSP (`script-src` lacks `https://va.vercel-scripts.com`) — analytics/speed data not collected in production

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

* [ ] Improve UX: confirm dialog before delete (jenis cuti, karyawan)
* [ ] Add unit tests for delegation date-range logic in `src/lib/cron.ts`

---

# P3 — Low Priority

Nice-to-have items.

* [ ] Add WhatsApp (Fonnte) delivery retry logic
* [ ] Add PDF preview before download (slip gaji, formulir cuti)
* [ ] Add dark mode support
* [ ] Add filter by date range on laporan list

---

# Technical Debt

* [ ] `src/app/actions.ts` — 557 lines; split into `cutiActions.ts`, `slipActions.ts`, `laporanActions.ts`
* [ ] `src/lib/pdf.ts` — consolidate WinAnsi sanitization logic
* [ ] `cuti-app/HANDOVER.md` — may be stale, verify against actual code
* [ ] `cuti-app/dev-server3.log` — committed log file, should be removed (already in `.gitignore` but not yet removed from repo)

---

# Testing

* [ ] Add unit tests for `src/lib/cuti.ts` — hari kerja calculation, masa kerja validation
* [ ] Add unit tests for `src/lib/validasi.ts` — all zod schemas (pengajuan, user, jenis, slip, laporan)
* [ ] Add integration tests for `POST /api/laporan-lapangan/[id]` (acc action)
* [ ] Add E2E test for cuti submission → atasan approval → HR approval flow
* [ ] Add E2E test for delegasi creation → delegated approval
* [ ] Add E2E test for cron reminder H+1 / eskalasi H+3
* [ ] Add E2E test for gaji change approval flow (HR submit → atasan approve)

---

# Security

* [ ] Review authentication — session token entropy, expiry, cookie flags
* [ ] Review authorization — verify `wajibHR()` guard on all HR routes
* [ ] Review input validation — zod schemas cover all server actions
* [ ] Review secret handling — verify no secrets in git history
* [ ] Review API security — `/api/cron` secret validation, PDF access control

---

# Performance

* [ ] Investigate slow approval queue query (N+1 on audit logs?)
* [ ] Optimize `Kuota` query — cache sisa kuota on dashboard
* [ ] Review `prisma.ts` — connection pooling config for serverless (Vercel)

---

# Deployment

* [x] Configure production (Vercel + Neon + Blob)
* [x] Add CI/CD (GitHub Actions: verify + e2e)
* [x] Verify environment variables (`.env.example` documented)
* [x] Verify database migration process (`prisma db push`)
* [ ] Add rollback procedure (Vercel instant rollback + DB backup)
* [ ] Configure staging environment

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
* [x] E2E tests — 18 Playwright tests (smoke, slip-gaji, laporan)
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