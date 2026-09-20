# Sistem Pengajuan Cuti Online — Anime Japan

Aplikasi pengajuan dan persetujuan cuti karyawan berbasis web. Mobile-first, berbahasa Indonesia, dengan alur persetujuan berlapis (Atasan → HR), kuota cuti, kalender tim, notifikasi, dan laporan.

**Live:** https://cuti-app.vercel.app/

## Tech Stack

- **Framework:** Next.js 14 (App Router) + React 18 + TypeScript
- **Styling:** Tailwind CSS
- **Database:** Prisma ORM — SQLite untuk dev, PostgreSQL untuk produksi
- **Validasi:** Zod
- **Auth:** Session cookie + bcrypt
- **Ekspor:** ExcelJS (`.xlsx`), pdf-lib (PDF formulir & rekap)
- **Notifikasi WA:** Adapter Fonnte (opsional, fallback ke log server)

## Fitur

**Karyawan**

- Ajukan cuti dengan validasi server: hari kerja (Senin–Jumat minus libur), kuota, anti-bentrok tanggal, minimal H- pengajuan, syarat masa kerja, lampiran wajib (PDF/JPG/PNG maks 2 MB)
- Lacak status pengajuan + timeline audit
- Batalkan pengajuan sebelum tanggal mulai
- Lihat sisa kuota tahun berjalan di dashboard

**Atasan**

- Menyetujui / menolak / mengembalikan pengajuan bawahan
- Delegasikan wewenang persetujuan ke orang lain + rentang tanggal
- Kalender cuti tim (tanda peringatan jika >1 orang cuti di tanggal sama)
- Pengingat otomatis H+1, eskalasi otomatis H+3 ke atasan berikutnya/HR

**HR Admin**

- Verifikasi akhir semua pengajuan (`MENUNGGU_HR`)
- Kelola karyawan, jenis cuti, hari libur
- Dashboard: antrean tertunda + lama menunggu, sedang cuti hari ini, pengajuan mendesak
- Laporan + ekspor Excel / PDF rekap
- Cetak formulir cuti PDF (hanya status `DISETUJUI`)
- Notifikasi dalam aplikasi + WA

**Alur status**

```text
DIAJUKAN → MENUNGGU_ATASAN → MENUNGGU_HR → DISETUJUI
                                   ↘ DITOLAK / DIKEMBALIKAN
DIBATALKAN (oleh pemohon, sebelum tgl mulai)
```

Aturan: tidak bisa menyetujui pengajuan sendiri, setiap keputusan tercatat di audit log, kuota terpotong saat `DISETUJUI`.

## Alur Tiap Peran

### Karyawan

1. Login → dashboard menampilkan sisa kuota tahun berjalan dan 5 pengajuan terakhir.
2. Klik **+ Ajukan** (`/cuti/baru`): pilih jenis cuti, tanggal mulai–selesai, alasan (min. 10 karakter), PIC pengganti, kontak selama cuti, dan lampiran bila diwajibkan jenis cutinya.
3. Sistem memvalidasi otomatis: hanya hari kerja (Senin–Jumat minus hari libur), sisa kuota cukup, tidak bentrok tanggal dengan pengajuan aktif lain, memenuhi minimal H- pengajuan dan syarat masa kerja.
4. Pengajuan masuk status `MENUNGGU_ATASAN` (atau langsung `MENUNGGU_HR` bila tidak punya atasan). Atasan dan HR mendapat notifikasi aplikasi + WA.
5. Pantau di **Riwayat** (`/riwayat`) atau halaman detail (`/cuti/[id]`) yang menampilkan status, catatan approver, dan timeline audit.
6. Kemungkinan hasil:
   - `DISETUJUI` → tombol **Cetak / Unduh Formulir PDF** muncul di halaman detail.
   - `DITOLAK` → final, kuota tidak terpotong.
   - `DIKEMBALIKAN` → perbaiki data dan ajukan ulang sebagai pengajuan baru.
7. Selama status masih `MENUNGGU_*` / `DIKEMBALIKAN` dan tanggal mulai belum lewat, pengajuan bisa dibatalkan (`DIBATALKAN`) dari halaman detail.

### Atasan

1. Menerima notifikasi (dalam aplikasi + WA) setiap ada pengajuan baru dari bawahan langsung.
2. Buka **Setujui** (`/persetujuan`): antrean diurutkan dari yang terlama, lengkap dengan lama menunggu (hari) dan label `delegasi` bila berasal dari pelimpahan wewenang.
3. Buka detail pengajuan, beri putusan lewat formulir (catatan **wajib** untuk Tolak/Kembalikan):
   - **Setujui** → diteruskan ke HR (`MENUNGGU_HR`). Khusus: bila pemohonnya HR, persetujuan atasan/pimpinan langsung final (`DISETUJUI`).
   - **Tolak** → `DITOLAK` (final).
   - **Kembalikan** → `DIKEMBALIKAN` agar karyawan memperbaiki dan mengajukan ulang.
4. Bila akan berhalangan (cuti/dinas), tunjuk pengganti sementara di **Delegasi** (`/delegasi`): pilih karyawan + rentang tanggal. Selama rentang itu penerima delegasi bisa menyetujui bawahan Anda (tercatat `DELEGASI_*` di audit). Delegasi lama otomatis nonaktif saat membuat yang baru.
5. Pantau **Kalender** (`/kalender`): cuti `DISETUJUI` milik bawahan per bulan, dengan peringatan ⚠ bila >1 orang cuti di tanggal yang sama.
6. Otomatisasi membantu bila terlewat: pengingat H+1 ke Anda, dan bila H+3 belum diproses, pengajuan dieskalasi ke atasan di atas Anda / HR.
7. Batasan: tidak dapat memproses pengajuan milik sendiri.

### HR Admin

1. Buka **Panel HR** (`/hr`): tiga blok pemantauan — **Mendesak** (mulai ≤3 hari tapi belum disetujui), **Tertunda** (beserta lama menunggu), dan **Sedang cuti hari ini**.
2. Verifikasi akhir di **Setujui** (`/persetujuan`) — HR melihat antrean `MENUNGGU_HR` **dan** `MENUNGGU_ATASAN`:
   - **Setujui** → `DISETUJUI` + kuota pemohon otomatis terpotong.
   - **Tolak / Kembalikan** → wajib isi catatan.
   - HR juga bisa memutus pengajuan yang masih di tahap atasan (override, tercatat `OVERRIDE_ATASAN_*` di audit).
3. Kelola data master:
   - **Karyawan** (`/hr/karyawan`): tambah/ubah/nonaktifkan akun, atur jabatan, no. HP (untuk WA), tanggal masuk, peran, dan atasan langsung.
   - **Jenis Cuti** (`/hr/jenis`): kuota tahunan, minimal H- pengajuan, syarat masa kerja (bulan), dan aturan lampiran wajib.
   - **Hari Libur** (`/hr/libur`): tanggal yang dikecualikan dari hitungan hari kerja.
4. Buat laporan di **Rekap & Ekspor** (`/hr/laporan`): filter rentang tanggal + status, unduh **Excel** atau **PDF rekap**.
5. Jalankan `/api/cron?secret=...` terjadwal (tiap jam/hari) untuk pengingat H+1 dan eskalasi H+3 otomatis.
6. Notifikasi keputusan otomatis terkirim ke pemohon (aplikasi + WA) setiap ada putusan final.

## Mulai Cepat

```bash
cd cuti-app
npm install
cp .env.example .env   # Windows: copy .env.example .env
```

Isi `.env`:

```env
DATABASE_URL="file:./dev.db"
SESSION_SECRET="isi-string-acak-min-32-karakter"
FONNTE_TOKEN=""        # opsional; kosong = WA hanya dicatat di log
CRON_SECRET="isi-string-acak-untuk-cron"
```

```bash
npx prisma db push
npm run db:seed
npm run dev
```

Buka http://localhost:3000 → login dengan akun demo di bawah.

## Akun Demo (password: `anime123`)

| Peran    | Email                  |
| -------- | ---------------------- |
| HR       | `hr@anime.id`          |
| Pimpinan | `pimpinan@anime.id`    |
| Atasan   | `atasan1@anime.id`     |
| Karyawan | `karyawan1@anime.id`   |

Seed membuat 1 pimpinan, 1 HR, 2 atasan, 5 karyawan, 8 jenis cuti, dan 4 hari libur nasional 2026.

## Struktur Proyek

```text
src/
  app/
    page.tsx              # dashboard (kuota + riwayat)
    login/                # login
    cuti/baru/            # form pengajuan
    cuti/[id]/            # detail + putusan + timeline
    persetujuan/          # antrean approval
    riwayat/              # riwayat pemohon
    delegasi/             # delegasi wewenang (atasan)
    kalender/             # kalender cuti tim
    notifikasi/           # notifikasi dalam aplikasi
    profil/               # profil + ubah password
    hr/                   # dashboard HR, pengajuan, karyawan, jenis, libur, laporan
    api/
      jenis/              # list jenis cuti (JSON)
      laporan/            # ekspor excel / pdf-rekap (?format=)
      formulir/[id]/      # PDF formulir cuti disetujui
      cron/               # reminder + eskalasi (?secret=)
    actions.ts            # server actions (login, ajukan, putus, kelola HR)
  components/
    shell.tsx             # layout + navigasi
    ui.tsx                # badge, banner, field, input/btn style
  lib/
    auth.ts               # session, role guard
    cuti.ts               # hari kerja, masa kerja, label status
    validasi.ts           # skema zod
    notif.ts              # notifikasi app + WA adapter
    cron.ts               # reminder/eskalasi + delegasi efektif
    prisma.ts             # prisma client
prisma/
  schema.prisma           # User, Pengajuan, JenisCuti, Kuota, HariLibur,
                          # Delegasi, AuditLog, Sesi, Notifikasi
  seed.ts                 # data demo
```

## API

| Endpoint                  | Akses | Keterangan                                   |
| ------------------------- | ----- | -------------------------------------------- |
| `GET /api/jenis`          | Login | Daftar jenis cuti aktif (JSON)               |
| `GET /api/laporan`        | HR    | `?format=excel / pdf-rekap &dari&sampai&status` |
| `GET /api/formulir/[id]`  | Terkait | PDF formulir, hanya jika `DISETUJUI`       |
| `GET /api/cron`           | Secret | Jalankan reminder + eskalasi                |

Contoh cron tiap jam (Linux):

```bash
curl "http://localhost:3000/api/cron?secret=ISI_CRON_SECRET"
```

Di Windows gunakan Task Scheduler dengan URL yang sama.

## Produksi (PostgreSQL)

Schema sudah `provider = "postgresql"`.

## Deploy ke Vercel

1. Buat database Postgres (Neon / Supabase), salin connection string → `DATABASE_URL`.
2. Buat Blob Store di dashboard Vercel → salin token → `BLOB_READ_WRITE_TOKEN`.
3. Import repo GitHub ke Vercel, set environment variables:
   `DATABASE_URL`, `SESSION_SECRET`, `CRON_SECRET`, `FONNTE_TOKEN` (opsional), `BLOB_READ_WRITE_TOKEN`.
4. Build command otomatis (`prisma generate && next build`, lihat `vercel.json`).
5. Setelah deploy pertama, siapkan tabel + seed:

```bash
DATABASE_URL="postgresql://..." npx prisma db push
DATABASE_URL="postgresql://..." npm run db:seed
```

6. Cron reminder/eskalasi harian otomatis via `vercel.json` (`/api/cron`, auth Bearer = `CRON_SECRET`).

Catatan: tanpa `BLOB_READ_WRITE_TOKEN`, upload lampiran fallback ke `public/uploads/` (hanya untuk dev lokal — di Vercel filesystem read-only sehingga upload gagal).

## Keamanan

- Jangan commit `.env`, `*.db`, `public/uploads/`, atau `*.log` (sudah di `.gitignore`).
- `SESSION_SECRET` dan `CRON_SECRET` wajib acak dan berbeda antara dev/produksi.
- Lampiran tersimpan di `public/uploads/` — batasi akses reverse-proxy jika berisi dokumen sensitif.
- Akun demo hanya untuk pengembangan; nonaktifkan atau ganti password di produksi.

## Lisensi

MIT — lihat [LICENSE](../LICENSE).
