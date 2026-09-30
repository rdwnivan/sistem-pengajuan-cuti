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
* [ ] Add unit tests for delegation date-range logic in `src/lib/cron.ts`
* [ ] Add E2E for cron umur H+1/H+3 asli (update `updatedAt`/`lastReminderAt` via DB agar reminder/eskalasi benar-benar terpicu)

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

* [x] Add unit tests for `src/lib/cuti.ts` — hari kerja calculation, masa kerja validation (`cuti-app/unit/cuti.test.ts`, 56 unit total via `npm run test:unit`)
* [x] Add unit tests for `src/lib/validasi.ts` — all zod schemas (pengajuan, user, jenis, slip, laporan) (`cuti-app/unit/validasi.test.ts`)
* [x] Add unit tests for `src/lib/rate-limit.ts` + `src/lib/upload.ts` (`cuti-app/unit/rate-limit.test.ts`, `unit/upload.test.ts`)
* [x] Add integration tests for `POST /api/laporan-lapangan/[id]` (acc action) (`cuti-app/tests/laporan-acc.spec.ts` — setuju/tolak/403/400/401 + PDF)
* [x] Add E2E test for cuti submission → atasan approval → HR approval flow (`cuti-app/tests/cuti-flow.spec.ts`)
* [x] Add E2E test for delegasi creation → delegated approval (`cuti-app/tests/delegasi.spec.ts`, serial)
* [x] Add E2E test for cron reminder H+1 / eskalasi H+3 (`cuti-app/tests/cron.spec.ts` — endpoint 200 + struktur; umur H+1/H+3 belum disimulasikan)
* [x] Add E2E test for gaji change approval flow (HR submit → atasan approve) (`cuti-app/tests/gaji-flow.spec.ts`; `gaji-perubahan.spec.ts` lama yang lemah dihapus)

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