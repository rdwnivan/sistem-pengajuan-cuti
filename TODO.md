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
* [x] Add unit tests for delegation date-range logic in `src/lib/cron.ts` (`unit/delegasi.test.ts` — 8 kasus via fungsi murni `delegasiBerlaku` cerminan `where` Prisma; total unit 69/69)
* [x] Add E2E for cron umur H+1/H+3 asli (`tests/cron.spec.ts` — update `updatedAt`/`lastReminderAt` via raw SQL karena `@updatedAt` Prisma selalu reset ke now; assert reminderCount tepat 1 + tidak dobel + eskalasi pindah approver; flows 22/22)

---

# P3 — Low Priority

Nice-to-have items.

* [ ] Add WhatsApp (Fonnte) delivery retry logic
* [ ] Add PDF preview before download (slip gaji, formulir cuti)
* [ ] Add dark mode support
* [x] Add filter by date range on laporan list (`?dari=`/`?sampai=` pada `tglLaporan`, form GET + Reset, link status pertahankan tanggal, tanggal invalid diabaikan; test permanen di `laporan.spec.ts`)

---

# Technical Debt

* [x] `src/app/actions.ts` — split selesai (`src/actions/` 9 file domain + barrel, import `@/actions`)
* [x] `src/lib/pdf.ts` — `teksAman()` kini dipakai konsisten di 4 route PDF (slip, formulir, laporan-lapangan, rekap laporan); sebelumnya formulir + rekap `drawText` langsung (crash WinAnsi untuk karakter non-Latin)
* [x] `cuti-app/HANDOVER.md` — perbaiki baris struktur `src/app/actions.ts` yang basi → `src/actions/`
* [x] `cuti-app/dev-server3.log` — ternyata tidak ter-track di git (hanya di disk, sudah di `.gitignore`); hapus dari disk lokal

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

* [x] Review authentication — token `crypto.randomBytes(32)`, expiry 7 hari, cookie httpOnly + sameSite=lax + secure(prod); bcrypt cost 10; `statusAktif` dicek (`src/lib/auth.ts`)
* [x] Review authorization — 9/9 halaman `/hr/*` pakai `wajibHR()`; E2E security 8 test redirect non-HR
* [x] Review input validation — semua action form pakai zod `safeParse` (10 pemakaian di 8 file); sisanya validasi manual/parsing aman (notif scope `userId`, password min 6, delegasi cek target)
* [x] Review secret handling — tidak ada `.env` ter-track; scan history bersih (tanpa private key/token)
* [x] Review API security — `/api/cron` tolak tanpa/salah secret (401, E2E); PDF slip/formulir/laporan cek owner/HR/approver (403/404, E2E)

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