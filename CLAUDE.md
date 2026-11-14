# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

The full project instructions (session workflow, source-of-truth rules, and the repo-specific technical reference) live in `AGENTS.md` and are imported here so there is one source:

@AGENTS.md

## Additions for Claude Code

### Session start
`AGENTS.md` §2 requires reading `PROJECT_STATUS.md` and `TODO.md` first. `PROJECT_STATUS.md` is large (>120 KB): read the top/current-phase sections and search it for the topic at hand instead of loading it whole.

### Test commands not listed in AGENTS.md (run from `cuti-app/`)
- Unit tests: `npm run test:unit` (`tsx --test unit/*.test.ts`, Node test runner, no DB needed). Single file: `npx tsx --test unit/validasi.test.ts`.
- Compatibility checks (CI runs these before unit tests): `npm run test:dependencies && npm run test:sdk && npm run test:tooling`.
- E2E suites by config: default `npx playwright test` (`tests/*.spec.ts`), stateful flows `npm run test:e2e:flows`, rate limit `npx playwright test --config=playwright.rate-limit.config.ts`. Flow and rate-limit suites run serially with one worker — don't parallelize them.

### Layout pointers
- Server actions: `cuti-app/src/actions/`; shared domain logic (validation, leave-day math, notifications, Web Push, uploads/attachments, rate limiting, cron) in `cuti-app/src/lib/`. Unit tests in `cuti-app/unit/` target the `src/lib` modules; Playwright specs in `cuti-app/tests/`.
- Deployment/ops docs at repo root: `STAGING.md`, `ROLLBACK.md`, and `cuti-app/SECURITY_ROLLOUT.md` (follow it for any Blob/attachment change).

### Known doc drift
The root `README.md` quick start still says to fill `BLOB_READ_WRITE_TOKEN`; uploads now use `BLOB_PRIVATE_READ_WRITE_TOKEN` (see Env in `AGENTS.md`). Trust `cuti-app/.env.example`.
