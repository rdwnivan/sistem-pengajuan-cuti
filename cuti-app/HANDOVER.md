# HANDOVER — Project Web Permohonan Cuti Agrinas Kalteng

## Ringkasan Proyek

Aplikasi web pengajuan cuti + slip gaji + laporan lapangan berbasis Next.js 14 + Prisma + PostgreSQL.

## Quickstart (Dev)

```bash
cd cuti-app
npm install
cp .env.example .env
npx prisma db push
npm run db:seed
npm run dev
```

Login: `hr@anime.id` (HR), `pimpinan@anime.id`, `atasan1@anime.id`, `karyawan1@anime.id` — password semua: `anime123`.

## Akun & Role

| Peran    | Email                   | Akses |
| -------- | ----------------------- | ----- |
| HR       | `hr@anime.id`           | Semua data HR + slip gaji + verifikasi final |
| Pimpinan | `pimpinan@anime.id`   | Override cuti (via `isAtasan()`, tidak punya `atasanId`) |
| Atasan   | `atasan1@2@anime.id`    | Acc cuti bawahan + acc laporan bawahan |
| Karyawan | `karyawan1@...`         | Lihat slip sendiri, buat laporan |

> **Pola atasan:** `isAtasan(user.id)` = cek ada user dengan `atasanId = user.id`. Bukan role baru.

## Fitur Baru (2026-09-28)

### Slip Gaji
- **HR buat manual** per karyawan per bulan
- GajiPokok & TunjanganTetap dari data karyawan (di User)
- HR input TunjanganVariabel + Potongan → GajiBersih dihitung server
- Unique constraint `[userId, tahun, bulan]` — slip dobel tidak mungkin
- Status: `TERBIT` / `DIBATALKAN`
- **HR tidak bisa lihat slip karyawan** — hanya owner + HR yang bikin bisa lihat miliknya sendiri; tapi HR bisa terbitkan/batalin
- PDF via `pdf-lib` di `/api/slip/[id]`
- Download link di halaman detail karyawan

### Laporan Lapangan
- Karyawan buat laporan: tanggal, lokasi, shift, judul, isi, foto opsional (blob)
- Approver dipilih **bebas** dari user aktif
- Status: `DRAFT → MENUNGGU → DISETUJUI / DITOLAK / DIKEMBALIKAN`
- Ditolak/dikembalikan → revisi dan kirim ulang
- Download PDF hanya setelah `DISETUJUI` (pembuat + approver)
- **HR tidak bisa lihat atau acc laporan**
- `?tipe=laporan` di `/persetujuan` untuk antrean laporan atasan

### Web Push Notification (2026-09-28)
- **Service Worker** di `/sw.js` + VAPID keys
- Banner izin notifikasi di dashboard (muncul jika permission = default)
- Subscribe/unsubscribe via `/api/push/subscribe` (endpoint + p256dh + auth)
- Push dikirim otomatis saat:
  - Cuti baru menunggu atasan/HR
  - Cuti disetujui/ditolak/dikembalikan
  - Slip gaji terbit/batal
  - Laporan dikirim ke atasan / disetujui/ditolak/dikembalikan
- Notifikasi muncul di browser (meski tab ditutup) karena Service Worker
- VAPID keys di `.env` (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`)
- Subscription disimpan di model `PushSubscription` (endpoint + p256dh + auth)

## Struktur File Penting

```
prisma/schema.prisma      # SlipGaji, LaporanLapangan, relasi User
src/lib/validasi.ts       # slipSchema, laporanSchema, putusanLaporanSchema
src/app/actions.ts        # aksiBuatSlip, aksiBatalSlip, aksiSimpanGajiPokok,
                          # aksiBuatLaporan, aksiKirimLaporan, aksiPutusanLaporan,
                          # aksiRevisiLaporan, aksiBatalLaporan, aksiSimpanUser
src/app/api/
  slip/[id]/route.ts      # GET PDF slip (owner/HR)
  approver/route.ts       # GET list user
  laporan-lapangan/[id]/route.ts  # GET JSON+PDF, POST acc
src/components/shell.tsx  # NavLinks + laporan, slip-gaji, acc laporan
src/lib/pdf.ts            # teksAman(), rupiah(), namaBulan(), LABEL_STATUS_LAPORAN
src/app/api/cron/route.ts # reminder + eskalasi
```

## Checklist Deploy ke Produksi

1. **Database** — Neon / Supabase / Railway, salin connection string ke `DATABASE_URL`
2. **Blob Store** — Vercel Dashboard > Storage > Blob > salin token ke `BLOB_READ_WRITE_TOKEN`
3. **Env Vars** — atur di Vercel Project Settings > Environment Variables:
   - `DATABASE_URL` (wajib, Postgres)
   - `CRON_SECRET` (wajib, acak 32+ char)
   - `FONNTE_TOKEN` (opsional)
   - `BLOB_READ_WRITE_TOKEN` (wajib kalau upload foto)
   - `SEED_FORCE` (wajib sekali untuk seed)
   - ~~`SESSION_SECRET` — dihapus, session pakai token DB~~
4. **Deploy pertama** — Vercel auto-deploy dari GitHub. Pastikan build command (`prisma generate && next build`) di `vercel.json`.
5. **Seed** — setelah deploy pertama, jalankan di Vercel:
   ```bash
   DATABASE_URL="..." npx prisma db push
   DATABASE_URL="..." SEED_FORCE=true npm run db:seed
   ```
   Atau lewat Vercel CLI / postdeploy hook.
6. **Cron** — otomatis via `vercel.json`, `GET /api/cron?secret=CRON_SECRET`.
7. **Domain** — set custom domain di Vercel (opsional). Otomatis HTTPS via Let's Encrypt.
8. **Backup DB** — Neon sudah auto-backup. Cek retention di dashboard. Manual dump: `pg_dump $DATABASE_URL > backup.sql`.
9. **Monitoring** — Vercel Analytics + Speed Insights sudah terintegrasi (`@vercel/analytics`, `@vercel/speed-insights`).

## Backup Database

- Neon: auto-backup daily (cek retention di dashboard Neon)
- Manual: `pg_dump` via server atau neon branch clone
- Disaster recovery: Neon point-in-time restore hingga 7 hari
- Disaster recovery untuk schema: `prisma/schema.prisma` sudah version-controlled di git

## DNS / Custom Domain

- Vercel: Settings > Domains > tambahkan domain
- Otomatis HTTPS (Let's Encrypt), automatic redirect www → apex
- DNS record di registrar: CNAME atau A (Vercel provide)
- Tidak perlu manual cert

## Security Checklist

- [x] Security headers di `next.config.mjs` (HSTS, CSP, X-Frame, Referrer-Policy)
- [x] `SEED_FORCE` guard mencegah seed tidak sengaja di production
- [x] `BLOB_READ_WRITE_TOKEN` — tanpa token, upload gagal (tidak silent fail)
- [x] `CORS` — none (App Router default, same-origin)
- [x] `CRON_SECRET` di-validate di `/api/cron`
- [x] `isAtasan()` cek relasi, bukan role (mencegah privilege escalation)
- [x] `allowed` guard di setiap API route: owner atau approver atau HR
- [x] `notFound()` di halaman detail jika tidak ada akses
- [x] `.env` di `.gitignore`
- [x] `SESSION_SECRET` dihapus — session pakai token DB (aman, revokable)

## Known Limitations

1. **Slip gaji HR bisa lihat sendiri** — HR bisa lihat slip yang HR buat (slip bukan milik HR). Ini disengaja: HR membuat slip, jadi HR bisa lihat hasil kerjanya. HR tidak bisa browse semua slip karyawan.
2. **Laporan tidak punya HR akses** — murni karyawan ↔ atasan.
3. **Tidak ada notifikasi untuk slip** — rencana: `notifApp` saat terbit/batal (sudah ada di `aksiBuatSlip`/`aksiBatalSlip`, channel `"SLIP"`).
4. **E2E tests** — 18 test Playwright di `tests/` (smoke, slip-gaji, laporan). Jalankan `npm run test:e2e` (butuh DB test). CI otomatis menjalankan E2E dengan Postgres service.
5. **Cron reminder** — belum dijalankan; perlu Vercel cron atau eksternal (cron-job).

## Developer Notes

- `isAtasan(userId)` di `src/lib/auth.ts:51` — cek apakah user punya bawahan
- `wajibHR()` di `src/lib/auth.ts:31` — guard HR admin
- `approverUntuk(pemohonId)` — dapatkan atasan dari relasi
- `LABEL_STATUS_LAPORAN`, `LABEL_STATUS_SLIP` di `src/lib/pdf.ts`
- `teksAman(s)` — sanitize untuk WinAnsi (PDF-lib)
- `namaBulan(i)` — bulan 1-12 ke string Indonesia

## Contact & Support

Tanyakan ke developer utama jika ada pertanyaan arsitektur atau deployment.

---

*Terakhir diperbarui: 2026-09-28*
*Fitur baru: Slip Gaji + Laporan Lapangan*
