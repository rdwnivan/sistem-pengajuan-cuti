# Project Instructions

## 1. Purpose

This file contains the permanent instructions for AI agents working on this project.

The project may be developed for long daily coding sessions (~9 hours/day), often across multiple OpenCode sessions.

The agent must prioritize:

* Understanding the existing code before changing it.
* Continuing existing work instead of restarting from scratch.
* Making small, focused, verifiable changes.
* Keeping project documentation synchronized with implementation.

---

# 2. Mandatory Context Loading

At the beginning of every new OpenCode session:

1. Read `PROJECT_STATUS.md`.
2. Read `TODO.md`.
3. Inspect the current Git status.
4. Inspect recent relevant changes when necessary.
5. Identify the current active task.
6. Inspect the relevant existing code before modifying it.
7. Never assume that an unfinished task from a previous session is complete.

When context is uncertain, trust the actual repository state over assumptions from previous conversations.

---

# 3. Source of Truth

Use the following priority when determining the current state of the project:

1. Actual source code and repository state.
2. Tests and verification results.
3. `PROJECT_STATUS.md`.
4. `TODO.md`.
5. Previous AI conversation context.

The repository is the ultimate source of truth.

Do not claim that something is completed merely because it is written as completed in a documentation file. Verify the implementation when practical.

---

# 4. Development Workflow

For every meaningful task:

## Before coding

* Understand the requirement.
* Inspect relevant files.
* Identify existing patterns and architecture.
* Check whether a similar implementation already exists.
* Avoid creating duplicate functionality.
* Identify potential side effects before editing.

## While coding

* Make the smallest reasonable change.
* Reuse existing utilities/components/services when appropriate.
* Follow the project's existing architecture and naming conventions.
* Do not rewrite unrelated code.
* Do not introduce unnecessary dependencies.
* Do not modify generated files directly.
* Preserve backward compatibility unless the task explicitly requires breaking changes.

## After coding

* Run the most relevant verification available.
* Check the Git diff.
* Check for unintended changes.
* Fix obvious errors introduced by the change.
* Update `PROJECT_STATUS.md`.
* Update `TODO.md` when the task changes project progress.

---

# 5. Verification Rules

Always verify meaningful code changes.

Prefer focused verification first:

1. Type checking.
2. Linting.
3. Unit/integration tests relevant to the change.
4. Build verification when appropriate.
5. Manual verification for UI/API behavior when automated tests are insufficient.

Do not run expensive full-project verification unnecessarily when a focused check is sufficient.

When verification fails:

* Determine whether the failure is caused by the current change.
* Fix the issue when it is within the task scope.
* If it is unrelated, document it clearly in `PROJECT_STATUS.md`.

Never report a task as verified when it has not been verified.

---

# 6. Task Management

Use `TODO.md` as the active work queue.

Task states:

* `[ ]` Not started
* `[~]` In progress
* `[x]` Completed
* `[!]` Blocked

Only mark a task `[x]` after the implementation has been verified.

Keep `TODO.md` focused on actionable work.

Do not turn `TODO.md` into a general documentation file.

---

# 7. Project Memory

Use `PROJECT_STATUS.md` as the project's living memory.

Update it when any of the following changes:

* Current development phase.
* Active feature.
* Important architectural decision.
* Database structure.
* API behavior.
* Authentication/authorization behavior.
* Known bugs.
* Major implementation progress.
* Important technical limitations.
* Setup or deployment requirements.

Keep it concise and factual.

Do not store long explanations of code that can be understood directly by reading the repository.

---

# 8. Session Continuity

When continuing work from a previous session:

1. Read `PROJECT_STATUS.md`.
2. Read `TODO.md`.
3. Check Git status.
4. Inspect the last relevant changes.
5. Continue from the existing implementation.

Do not recreate a feature simply because the previous conversation is unavailable.

If an implementation already exists, extend or fix it instead of replacing it without a reason.

---

# 9. Long Coding Sessions

For long coding sessions:

* Work in logical chunks.
* Avoid keeping unnecessary assumptions in conversation memory.
* Write important decisions to project files instead of relying on chat history.
* After completing a major feature, update project status immediately.
* Before switching to another major feature, update the current task state.
* If a task becomes blocked, record the exact blocker.
* If a new bug is discovered, record it in `TODO.md` or `PROJECT_STATUS.md`.

The repository documentation must remain usable even if the current OpenCode session is closed.

---

# 10. Context Efficiency

Keep AI context efficient.

Do not repeatedly dump the entire repository into context.

Prefer:

* Reading only relevant files.
* Searching for existing implementations.
* Reading targeted sections.
* Using project documentation for high-level state.
* Reusing previous implementation patterns.

Avoid unnecessary large refactors.

---

# 11. Code Quality

Prefer code that is:

* Readable
* Maintainable
* Testable
* Consistent with the existing project
* Explicit over unnecessarily clever
* Simple over unnecessarily abstract

Do not optimize prematurely.

Do not introduce architectural complexity without a concrete reason.

---

# 12. Security

Never expose or commit secrets.

Do not print or hardcode:

* API keys
* Passwords
* Tokens
* Private keys
* Session secrets
* Production credentials

Respect `.env`, `.gitignore`, and existing secret-management patterns.

When handling authentication, authorization, payments, user data, or sensitive operations, prefer established project patterns and verify edge cases carefully.

---

# 13. Database Changes

Before changing database-related code:

* Inspect the existing schema.
* Inspect migrations.
* Understand relationships and constraints.
* Reuse the existing database access pattern.

Database schema changes must use the project's migration process.

Do not directly modify production data unless explicitly instructed and the operation is understood.

---

# 14. API Changes

Before modifying an API:

* Inspect the existing endpoint.
* Check consumers of the endpoint.
* Check request and response formats.
* Consider backward compatibility.
* Update tests when applicable.

Do not silently change API contracts.

---

# 15. UI Changes

Before modifying UI:

* Inspect existing components.
* Reuse the existing design system/patterns.
* Preserve responsive behavior.
* Consider loading, empty, error, and success states.
* Do not create duplicate components when an appropriate existing component exists.

---

# 16. Bug Fixing

When fixing a bug:

1. Reproduce or understand the failure.
2. Identify the root cause.
3. Make the smallest appropriate fix.
4. Verify the fix.
5. Check for regressions.
6. Update `PROJECT_STATUS.md` or `TODO.md` when relevant.

Do not hide symptoms while leaving the root cause unresolved.

---

# 17. Git Safety

Before making destructive changes:

* Inspect `git status`.
* Inspect the relevant diff.
* Understand whether uncommitted changes belong to the current task.

Never discard unrelated user changes.

Do not reset, checkout, clean, or overwrite unrelated work without explicit instruction.

---

# 18. Communication Style

When responding to the user:

* State what was changed.
* State what was verified.
* State any remaining issue.
* Keep explanations concise unless deeper detail is necessary.

Do not claim success without verification.

---

# 19. End-of-Task Checklist

Before considering a meaningful task complete:

* [ ] Implementation completed
* [ ] Relevant tests/checks run
* [ ] No obvious regression
* [ ] Git diff reviewed
* [ ] `PROJECT_STATUS.md` updated
* [ ] `TODO.md` updated
* [ ] Remaining limitations documented

---

# 20. Important Rule

The goal is not to maximize the amount of code written.

The goal is to leave the repository in a clear, working, verifiable state so another OpenCode session can continue the work immediately.

---

# Repo-Specific Technical Reference

## Scope
Single app in `cuti-app/` — all commands, env, Prisma, and tests run from there. Root has no `package.json`; `cd cuti-app` first.

## Commands (from `cuti-app/`)
- Install: `npm install` (local) / `npm ci` (CI) → `npx prisma generate` — required before `tsc`/`build` (Vercel `buildCommand` is `prisma generate && next build`)
- Setup: `copy .env.example .env` (Windows) then fill `DATABASE_URL`, `CRON_SECRET` (≥32 chars), `BLOB_READ_WRITE_TOKEN`; `npx prisma db push`; `npm run db:seed` (`SEED_FORCE=true` on empty/CI DB); `npm run dev` → http://localhost:3000 (demo `hr@anime.id` / `anime123`)
- Verify (CI order in `.github/workflows/ci.yml`): `npx tsc --noEmit` → `npm run lint` → `npm run build` → E2E
- DB: `npm run db:push` (`prisma db push`, no migrations) / `npm run db:seed` (`tsx prisma/seed.ts`, blocked in production without `SEED_FORCE=true`)
- E2E: `npm run test:e2e` / `npm run test:e2e:ui`; single file `npx playwright test tests/smoke.spec.ts`; filter `-g "nama test"`; config `cuti-app/playwright.config.ts` (`baseURL` localhost:3000, `webServer` `npm run dev`, `reuseExistingServer: !CI`, 120s timeout, `chromium` only)

## Env (`cuti-app/.env.example`)
- Required: `DATABASE_URL` (PostgreSQL only — `provider = "postgresql"`), `CRON_SECRET`
- `BLOB_READ_WRITE_TOKEN` — empty = local `public/uploads/` fallback; on Vercel without it uploads fail (read-only FS)
- `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` — pair or neither (Web Push)
- Optional `FONNTE_TOKEN` (WA via Fonnte) — empty = log only
- `SESSION_SECRET` is **not used** — session auth uses token DB (`Sesi` model); it's in ci.yml env but unused in source code

## Architecture
- Next.js 14 App Router + React 18 + TS (`@/*` → `src/*`, `strict:true`, `jsx: preserve`). Server actions in `src/app/actions.ts`; auth guards in `src/lib/auth.ts` (`wajibLogin`/`wajibHR`/`isAtasan`, cookie `sesi-cuti`, 7-day DB `Sesi`).
- Prisma `prisma/schema.prisma`: `User` (self-relation `AtasanBawahan`), `Pengajuan`, `JenisCuti`, `HariLibur`, `Kuota`, `Delegasi`, `AuditLog`, `Sesi`, `Notifikasi`, `SlipGaji` (`@@unique([userId,tahun,bulan])`), `LaporanLapangan`, `PushSubscription`. No migration files — use `db push`.
- Flows: Cuti `DIAJUKAN→MENUNGGU_ATASAN→MENUNGGU_HR→DISETUJUI` (+ `DITOLAK`/`DIKEMBALIKAN`/`DIBATALKAN`); Slip `DIBUAT→TERBIT↘DIBATALKAN`; Laporan `DRAFT→MENUNGGU→DISETUJUI`. Unified approval queue at `/persetujuan`.
- Cron: `vercel.json` `0 0 * * *` → `GET /api/cron?secret=CRON_SECRET` (`src/lib/cron.ts` — reminder H+1, escalate H+3, delegation windows).
- Security headers/CSP in `cuti-app/next.config.mjs`; Tailwind content `src/**/*.{ts,tsx}`.

## E2E Prerequisites
Needs Postgres `16` + `DATABASE_URL`, `CRON_SECRET` (see `ci.yml` `e2e` job). Seed step: `npx prisma generate && npx prisma db push && SEED_FORCE=true npm run db:seed` then `npx playwright install chromium --with-deps`.

## Gotchas
- Indonesian domain language in code/routes (`persetujuan`, `cuti`, `slip-gaji`, `laporan`); status values are plain uppercase strings, not Prisma enums.
- **`isAtasan(userId)` checks relation, not role** (`src/lib/auth.ts:51`) — counts users with `atasanId = userId`. Not a role-based check.
- Delegasi same-tier only: atasan→atasan, HR→HR; new delegation auto-deactivates old.
- `gajiBersih` computed server-side (`gajiPokok + tunjangan + tunjanganTetap - potongan`), must not be negative; duplicate `[userId,tahun,bulan]` is error not crash.
- Approver for laporan must be an atasan (non-HR with bawahan) — see `api/approver/route.ts`.
- Helpers in `cuti-app/tests/helpers.ts` (`AKUN`, `login(page, peran)`); existing specs `smoke.spec.ts`, `slip-gaji.spec.ts`, `laporan.spec.ts`.