# Staging Lokal

> Keputusan: staging **hanya di lokal**, tidak ada URL publik.
> Project Vercel `cuti-app-staging` sudah **dihapus** (2026-09-30) — kalau masih
> melihat URL-nya di истории/docs, abaikan, sudah tidak ada.
>

> Keputusan: staging **hanya di lokal**, tidak ada URL publik.
> Alasannya: staging berisi salinan data production — kalau live, siapa pun
> bisa membuka dan login pakai akun demo yang mudah ditebak.
>
> Cara kerja: build production (`next build` + `next start`) dijalankan di
> laptop menunjuk ke database branch `staging` di Neon. Mirip production
> (mode production beneran), tapi 100% privat.

---

## 1. Database staging — Neon branch (sekali saja, di dashboard)

1. Buka Neon console → project production → **Branches** → **New Branch**.
2. Parent: branch production. Nama: `staging`. Sertakan **data + schema**.
3. Buka branch `staging` → salin **Connection string** → simpan di notepad.

> Jangan pakai `neondb_dev` untuk staging. `neondb_dev` milik coding harian
> dan di-seed ulang berkali-kali. Staging butuh data mirip production.

## 2. Jalankan staging lokal

Dari folder `cuti-app`, berurutan:

```powershell
# 0. Pastikan tidak ada server nyangkut di port 3000
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# 1. Arahkan ke DB staging HANYA untuk sesi perintah ini
#    (.env lokal JANGAN diubah permanen — tetap neondb_dev)
$env:DATABASE_URL="<connection-string-branch-staging>"

# 2. Sinkronkan schema bila ada perubahan (aman, aditif)
npx prisma db push

# 3. Build production (menangkap error yang hanya muncul di build)
npm run build

# 4. Jalankan mode production
npm run start
# -> http://localhost:3000 (Coba login akun demo, klik alur kritis)
```

Untuk E2E ke server staging yang sedang jalan, buka shell **baru**:

```powershell
cd cuti-app
npx playwright test
# Playwright memakai server yang sudah jalan (reuseExistingServer).
```

Selesai? Matikan server (`Ctrl+C` di shell `npm run start`) lalu bersihkan env:

```powershell
$env:DATABASE_URL=$null
```

## 3. Larangan di staging lokal

- **Jangan re-seed** (`SEED_FORCE=true npm run db:seed` menghapus semua data
  lalu isi demo). Kalau datanya rusak, hapus branch di dashboard lalu buat
  ulang dari production — hitungan detik.
- **Jangan ubah `.env` permanen** menunjuk ke staging. Selalu override via
  `$env:DATABASE_URL=...` per perintah. `.env` tetap `neondb_dev`.
- **Jangan isi `FONNTE_TOKEN`** saat menjalankan staging. Cron Vercel tidak
  jalan lokal, tapi server action tetap bisa memicu `kirimWA` — token kosong
  = mode log, tidak ada WA beneran yang terkirim.
- **Jangan jalankan rate-limit spec ke staging** — 6× login gagal
  mengotori rate-limit store (in-memory, hilang saat restart, tapi tetap).

## 4. Alur kerja yang disarankan

1. Push ke `main` → CI hijau.
2. Perlu keyakinan ekstra (khususnya ada perubahan schema): staging lokal
   langkah 2 di atas → klik manual halaman kritis + E2E bila perlu.
3. Lolos → biarkan auto-deploy production jalan seperti biasa.
4. Bermasalah di production → `ROLLBACK.md`.
