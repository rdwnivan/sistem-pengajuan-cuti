# Sistem Pengajuan Cuti Online — Anime Japan

Aplikasi pengajuan dan persetujuan cuti karyawan berbasis web. Mobile-first, berbahasa Indonesia, dengan alur persetujuan berlapis (Atasan → HR), kuota cuti, kalender tim, notifikasi (dalam aplikasi + Web Push + WA), slip gaji, dan laporan lapangan.

**Live:** https://cuti-app.vercel.app/

## Tech Stack

- **Framework:** Next.js 15.5.27 (App Router) + React 19 + TypeScript
- **Styling:** Tailwind CSS
- **Database:** Prisma ORM — PostgreSQL (dev & produksi)
- **Validasi:** Zod
- **Auth:** Session cookie (token DB) + bcrypt
- **Ekspor:** ExcelJS (`.xlsx`), pdf-lib (PDF formulir, slip gaji, rekap, laporan)
- **Notifikasi:** In-app + Web Push (VAPID) + WA via Fonnte (opsional, fallback ke log)
- **Monitoring:** Vercel Analytics + Speed Insights

## Fitur

**Karyawan**

- Ajukan cuti dengan validasi server: hari kerja (Senin–Jumat minus libur), kuota, anti-bentrok tanggal, minimal H- pengajuan, syarat masa kerja, lampiran wajib (PDF/JPG/PNG maks 2 MB)
- Lacak status pengajuan + timeline audit
- Batalkan pengajuan sebelum tanggal mulai
- Lihat sisa kuota tahun berjalan di dashboard
- **Lihat slip gaji sendiri + unduh PDF** (`TERBIT`)
- **Buat laporan lapangan** (tanggal, lokasi, shift, judul, isi, foto opsional) lalu kirim ke atasan yang dipilih
- Pantau status laporan + catatan atasan + timeline

**Atasan**

- Menyetujui / menolak / mengembalikan pengajuan bawahan
- **Acc laporan lapangan** dari antrean gabungan di `/persetujuan`
- Delegasikan wewenang persetujuan ke atasan lain + rentang tanggal
- Kalender cuti tim (tanda peringatan jika >1 orang cuti di tanggal sama)
- Pengingat otomatis H+1, eskalasi otomatis H+3 ke atasan berikutnya/HR

**HR Admin**

- Verifikasi akhir semua pengajuan (`MENUNGGU_HR`)
- Kelola karyawan, jenis cuti, hari libur
- Dashboard: antrean tertunda + lama menunggu, sedang cuti hari ini, pengajuan mendesak
- Laporan + ekspor Excel / PDF rekap pengajuan cuti
- Cetak formulir cuti PDF (hanya status `DISETUJUI`)
- **Terbitkan slip gaji** per karyawan per bulan; batalkan bila perlu bikin ulang
- Notifikasi dalam aplikasi + Web Push + WA

> **Catatan akses:** Slip gaji — karyawan hanya lihat milik sendiri; HR bisa terbitkan/batalin semua slip. Laporan lapangan — murni karyawan ↔ atasan; HR **tidak** punya akses (bikin, acc, lihat, unduh).

## Alur Status

**Cuti**
```
DIAJUKAN → MENUNGGU_ATASAN → MENUNGGU_HR → DISETUJUI
                                    ↘ DITOLAK / DIKEMBALIKAN
DIBATALKAN (oleh pemohon, sebelum tgl mulai)
```

**Slip Gaji**
```
DIBUAT (HR) → TERBIT → (karyawan lihat + unduh PDF)
                   ↘ DIBATALKAN (HR, bila salah → buat ulang)
```
Satu karyawan hanya boleh punya satu slip per bulan (`@@unique([userId, tahun, bulan])`).

**Laporan Lapangan**
```
DRAFT → MENUNGGU → DISETUJUI   (pembuat + atasan bisa unduh PDF)
                  ↘ DITOLAK / DIKEMBALIKAN
                     ↓
               revisi → MENUNGGU (langsung, tidak kembali ke DRAFT)
```

## Aturan Slip Gaji

- Pembuat: **HR** saja (`wajibHR()`), di menu **Slip Gaji**
- Input per karyawan per bulan; `gajiPokok` dan `tunjanganTetap` otomatis terisi dari data karyawan
- HR menambahkan `tunjangan` variabel (bonus/lembur) dan `potongan` (BPJS, pajak, kasbon)
- `gajiBersih` = gajiPokok + tunjangan + tunjanganTetap − potongan, dihitung server (tidak bisa dimanipulasi dari client)
- Jika `gajiBersih` negatif, slip ditolak
- `@@unique([userId, tahun, bulan])` mencegah slip dobel di bulan yang sama
- Status `TERBIT` = karyawan bisa lihat + unduh; `DIBATALKAN` = tersembunyi, HR buat baru
- Duplikat bulan = error, bukan crash
- **Notifikasi:** Slip terbit & dibatalkan → in-app + Web Push ke karyawan

## Aturan Laporan Lapangan

- Pembuat: karyawan biasa (bukan atasan/HR)
- Approver dipilih oleh pembuat — **wajib atasan** (user yang punya bawahan, bukan HR)
- HR **tidak** punya akses ke laporan lapangan sama sekali (bukan di dropdown, tidak di antrean, tidak di detail)
- Ditolak / dikembalikan → revisi → status langsung `MENUNGGU` + notifikasi ke atasan
- Hanya laporan `DISETUJUI` yang bisa diunduh (oleh pembuat + atasan)
- **Notifikasi:** Kirim ke atasan, putusan, revisi → in-app + Web Push

## Aturan Delegasi

- Hanya **atasan** (punya bawahan) dan **HR** yang bisa membuat delegasi
- **HR** hanya boleh mendelegasikan ke **HR lain**
- **Atasan** hanya boleh mendelegasikan ke **atasan lain** (bukan HR, bukan karyawan biasa)
- Selama rentang aktif, penerima delegasi bisa menyetujui bawahan si pemberi
- Delegasi lama otomatis nonaktif saat membuat yang baru
- **Notifikasi:** In-app ke penerima

## Alur Tiap Peran

### Karyawan

1. Login → dashboard menampilkan sisa kuota tahun berjalan dan 5 pengajuan terakhir.
2. Klik **+ Ajukan** (`/cuti/baru`): pilih jenis cuti, tanggal mulai–selesai, alasan (min. 10 karakter), PIC pengganti, kontak selama cuti, dan lampiran bila diwajibkan jenis cutinya.
3. Sistem memvalidasi otomatis: hanya hari kerja (Senin–Jumat minus hari libur), sisa kuota cukup, tidak bentrok tanggal dengan pengajuan aktif lain, memenuhi minimal H- pengajuan dan syarat masa kerja.
4. Pengajuan masuk status `MENUNGGU_ATASAN` (atau langsung `MENUNGGU_HR` bila tidak punya atasan). Atasan dan HR mendapat notifikasi in-app + Web Push + WA.
5. Pantau di **Riwayat** (`/riwayat`) atau halaman detail (`/cuti/[id]`) yang menampilkan status, catatan approver, dan timeline audit.
6. Kemungkinan hasil:
   - `DISETUJUI` → tombol **Cetak / Unduh Formulir PDF** muncul di halaman detail.
   - `DITOLAK` → final, kuota tidak terpotong.
   - `DIKEMBALIKAN` → perbaiki data dan ajukan ulang sebagai pengajuan baru.
7. Selama status masih `MENUNGGU_*` / `DIKEMBALIKAN` dan tanggal mulai belum lewat, pengajuan bisa dibatalkan (`DIBATALKAN`) dari halaman detail.

### Atasan

1. Menerima notifikasi (in-app + Web Push + WA) setiap ada pengajuan baru dari bawahan langsung.
2. Buka **Setujui** (`/persetujuan`): antrean gabungan **Cuti** + **Laporan Lapangan**, diurutkan dari yang terlama, lengkap dengan lama menunggu (hari) dan label `delegasi` bila berasal dari pelimpahan wewenang.
3. Buka detail pengajuan/laporan, beri putusan lewat formulir (catatan **wajib** untuk Tolak/Kembalikan):
   - **Setujui cuti** → diteruskan ke HR (`MENUNGGU_HR`). Khusus: bila pemohonnya HR, persetujuan atasan/pimpinan langsung final (`DISETUJUI`).
   - **Tolak** → `DITOLAK` (final).
   - **Kembalikan** → `DIKEMBALIKAN` agar karyawan memperbaiki dan mengajukan ulang.
   - **Acc laporan** → `DISETUJUI` / `DITOLAK` / `DIKEMBALIKAN`.
4. Bila akan berhalangan (cuti/dinas), tunjuk pengganti sementara di **Delegasi** (`/delegasi`): pilih atasan lain + rentang tanggal. Selama rentang itu penerima delegasi bisa menyetujui bawahan Anda (tercatat `DELEGASI_*` di audit). Delegasi lama otomatis nonaktif saat membuat yang baru.
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
   - **Karyawan** (`/hr/karyawan`): tambah/ubah/nonaktifkan akun, atur jabatan, no. HP (untuk WA), tanggal masuk, peran, dan atasan langsung + `gajiPokok`, `tunjanganTetap`.
   - **Jenis Cuti** (`/hr/jenis`): kuota tahunan, minimal H- pengajuan, syarat masa kerja (bulan), dan aturan lampiran wajib.
   - **Hari Libur** (`/hr/libur`): tanggal yang dikecualikan dari hitungan hari kerja.
4. Buat laporan di **Rekap & Ekspor** (`/hr/laporan`): filter rentang tanggal + status, unduh **Excel** atau **PDF rekap** (hanya pengajuan cuti).
5. Jalankan `/api/cron?secret=...` terjadwal (tiap jam/hari) untuk pengingat H+1 dan eskalasi H+3 otomatis.
6. Notifikasi keputusan otomatis terkirim ke pemohon (in-app + Web Push + WA) setiap ada putusan final.

## Mulai Cepat

```bash
cd cuti-app
npm install
cp .env.example .env   # Windows: copy .env.example .env
```

Isi `.env`:

```env
# --- Wajib ---
DATABASE_URL="postgresql://user:pass@host:5432/cuti?sslmode=require"
BLOB_READ_WRITE_TOKEN="dari-vercel-blob-store"
CRON_SECRET="isi-string-acak-min-32-karakter"

# --- Web Push (opsional, tapi butuh keduanya agar aktif) ---
VAPID_PUBLIC_KEY="BP..."
VAPID_PRIVATE_KEY="..."

# --- Opsional ---
FONNTE_TOKEN=""         # token Fonnte untuk WA; kosong = WA hanya dicatat di log
SEED_FORCE=""           # set "true" HANYA sekali untuk seed DB kosong di produksi
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
    persetujuan/          # antrean approval gabungan (cuti + laporan)
    slip-gaji/            # list + detail slip gaji milik sendiri
    slip-gaji/[id]/       # detail slip + unduh PDF
    laporan/              # list laporan milik sendiri + filter status
    laporan/baru/         # form laporan baru + revisi (kirim ke atasan)
    laporan/[id]/         # detail laporan + acc/revisi/batal
    riwayat/              # riwayat pemohon
    delegasi/             # delegasi wewenang (atasan/HR)
    kalender/             # kalender cuti tim
    notifikasi/           # notifikasi dalam aplikasi
    profil/               # profil + ubah password
    hr/                   # dashboard HR, pengajuan, karyawan, jenis, libur, laporan, slip-gaji
    api/
      jenis/              # list jenis cuti aktif (JSON)
      laporan/            # ekspor excel / pdf-rekap cuti (?format=)
      approver/           # list atasan aktif (dropdown approver laporan)
      slip/[id]           # PDF slip gaji (owner / HR)
      laporan-lapangan/[id]  # JSON + GET PDF + POST acc (owner / atasan)
      formulir/[id]/      # PDF formulir cuti disetujui
      cron/               # reminder + eskalasi (?secret=)
    actions.ts            # server actions (login, ajukan, putus, slip, laporan, delegasi)
  components/
    shell.tsx             # layout + navigasi
    ui.tsx                # badge, banner, field, input/btn style
    NotificationPermission.tsx # banner izin notifikasi Web Push
    SWRegister.tsx        # register service worker
  lib/
    auth.ts               # session, role guard, isAtasan()
    cuti.ts               # hari kerja, masa kerja, label status
    validasi.ts           # skema zod (pengajuan, user, jenis, slip, laporan)
    notif.ts              # notifikasi app + WA adapter
    web-push.ts           # kirim web push via VAPID
    pdf.ts                # helper WinAnsi + label status slip/laporan
    cron.ts               # reminder/eskalasi + delegasi efektif + approverEfektif
    prisma.ts             # prisma client
  app/public/sw.js        # service worker (push notification)
prisma/
  schema.prisma           # User, Pengajuan, JenisCuti, Kuota, HariLibur,
                          # Delegasi, AuditLog, Sesi, Notifikasi,
                          # SlipGaji, LaporanLapangan, PushSubscription
  seed.ts                 # data demo + guard production (SEED_FORCE)
```

## API

| Endpoint                     | Akses                    | Keterangan                                                |
| ---------------------------- | ------------------------ | --------------------------------------------------------- |
| `GET /api/jenis`             | Login                    | Daftar jenis cuti aktif (JSON)                        |
| `GET /api/approver`          | Login                    | List **atasan** aktif (dropdown approver laporan)     |
| `GET /api/laporan`           | HR                       | `?format=excel / pdf-rekap &dari&sampai&status`       |
| `GET /api/formulir/[id]`   | Terkait                  | PDF formulir cuti, hanya jika `DISETUJUI`             |
| `GET /api/slip/[id]`       | owner / HR               | PDF slip gaji, hanya `TERBIT`, owner-only              |
| `GET /api/laporan-lapangan/[id]` | owner / atasan       | `?format=pdf` → PDF (hanya `DISETUJUI`); POST acc    |
| `POST /api/push/subscribe`  | Login                    | subscribe/unsubscribe web push (GET/POST/DELETE)      |
| `GET /api/cron`              | Secret (`CRON_SECRET`)   | Jalankan reminder + eskalasi                            |

Contoh cron tiap jam (Linux):

```bash
curl "http://localhost:3000/api/cron?secret=ISI_CRON_SECRET"
```

Di Windows gunakan Task Scheduler dengan URL yang sama.

## Produksi (PostgreSQL)

Schema sudah `provider = "postgresql"`.

## Deploy ke Vercel

1. Buat database Postgres (Neon / Supabase / Railway), salin connection string → `DATABASE_URL`.
2. Buat Blob Store di dashboard Vercel → salin token → `BLOB_READ_WRITE_TOKEN`.
3. Import repo GitHub ke Vercel, set environment variables:
   `DATABASE_URL`, `CRON_SECRET`, `FONNTE_TOKEN` (opsional), `BLOB_READ_WRITE_TOKEN`,
   `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (opsional, tapi butuh keduanya), `SEED_FORCE`.
4. Build command otomatis (`prisma generate && next build`, lihat `vercel.json`).
5. Setelah deploy pertama, siapkan tabel + seed:

```bash
DATABASE_URL="postgresql://..." npx prisma db push
DATABASE_URL="postgresql://..." SEED_FORCE=true npm run db:seed
```

6. Cron reminder/eskalasi harian otomatis via `vercel.json` (`/api/cron`, auth query `?secret=CRON_SECRET`).

Catatan: tanpa `BLOB_READ_WRITE_TOKEN`, upload lampiran gagal di Vercel (filesystem read-only).

## Keamanan

- Jangan commit `.env`, `*.db`, `public/uploads/`, atau `*.log` (sudah di `.gitignore`).
- `CRON_SECRET` wajib acak dan berbeda antara dev/produksi (min. 32 karakter).
- `SEED_FORCE` harus diset agar `db:seed` tidak menghapus data produksi secara tidak sengaja.
- Header keamanan aktif di `next.config.mjs`: HSTS, CSP, X-Frame-Options, Referrer-Policy.
- Lampiran tersimpan di Vercel Blob — batasi akses reverse-proxy jika berisi dokumen sensitif.
- Akun demo hanya untuk pengembangan; nonaktifkan atau ganti password di produksi.

## Lisensi

MIT — lihat [LICENSE](../LICENSE).