# Prosedur Rollback Production

> Dibuat 2026-09-30. Project ini **tanpa staging**: `main` → auto-deploy Vercel.
> Build production (`prisma generate && next build`) **tidak** menjalankan migrasi DB,
> jadi rollback kode dan rollback DB adalah dua keputusan terpisah.

---

## 1. Kapan rollback

- Halaman production error massal (500 / crash saat load).
- Data salah tulis akibat deploy baru.
- Prinsip: kalau ragu dan user terdampak, rollback dulu, investigasi belakangan.

## 2. Rollback kode — Vercel instant rollback (~1 menit)

1. Buka Vercel Dashboard → project `cuti-app` → tab **Deployments**.
2. Cari deployment terakhir yang **sehat** (status Ready, sebelum deploy rusak).
3. Klik `⋯` → **Promote to Production**. Instant, tanpa rebuild.
4. Tunggu status Production menunjuk ke deployment lama.

Alternatif (lebih lambat): `git revert <commit-rusak>` + push → tunggu CI + build + deploy.

## 3. Nilai apakah DB ikut bermasalah

Cek apakah deploy rusak mengubah schema:

```powershell
git diff <commit-sehat>..<commit-rusak> -- cuti-app/prisma/schema.prisma
```

- **Tidak ada perubahan schema** → selesai. Rollback kode cukup.
- **Ada perubahan schema** → lanjut ke langkah 4. Aturannya:
  - Kolom **baru ditambah** (contoh: `notifWa`): kode lama mengabaikan kolom baru → rollback kode saja **aman**, DB tidak perlu disentuh.
  - Kolom/tabel **dihapus atau diubah**: kode lama butuh struktur lama → rollback kode saja akan **crash**. DB harus dikembalikan juga.

## 4. Rollback DB — Neon

> Data yang terhapus (DROP TABLE/COLUMN) **hanya** kembali via backup.
> `prisma db push` tidak mengembalikan data yang hilang.

1. Buka Neon dashboard → project production (`neondb`, **bukan** `neondb_dev`).
2. Pilih **point-in-time** sebelum waktu rusak (retensi PITR ±7 hari, cek paket di dashboard).
3. Restore ke **branch baru** dulu (jangan langsung timpa main) → dapat connection string branch.
4. Verifikasi data di branch (cek tabel inti: User, Pengajuan, SlipGaji).
5. Kalau OK, arahkan production ke hasil restore (promote branch / ganti `DATABASE_URL` di Vercel env) **atau** restore in-place bila yakin.
6. Manual backup sebelum migrasi berisiko:
   ```powershell
   pg_dump $env:DATABASE_URL > backup-YYYYMMDD.sql
   ```

## 5. Verifikasi setelah rollback (read-only, jangan kotori data produksi)

1. Buka `https://cuti-app.vercel.app/` — login HR + karyawan berhasil.
2. Dashboard, `/persetujuan`, daftar slip terbuka tanpa error.
3. Cek Vercel → Deployments (status Production benar) + Runtime Logs (tidak ada error berulang).
4. Opsional: panggil `/api/cron?secret=...` sekali, pastikan 200.

## 6. Setelah stabil: forward-fix

- Jangan bertahan di deployment rollback. Perbaiki di `main`, uji lokal
  (re-seed dev + `tsc`/`lint`/`build` + E2E 3 tier), lalu deploy normal.
- Pelajaran insiden `notifWa` (2026-09-30): urutan wajib untuk perubahan schema
  adalah `migrate diff` → `db push` ke production **dulu** → baru push kode.
  Dan selalu `migrate diff` sebelum push untuk melihat kejutan (contoh: tabel
  `Blok` sisa prototype yang ikut ter-drop).
