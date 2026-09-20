# Sistem Pengajuan Cuti Online — Anime Japan

Aplikasi pengajuan dan persetujuan cuti karyawan (Next.js 14 + Prisma). Mobile-first, berbahasa Indonesia, alur Atasan → HR, kuota, kalender tim, notifikasi, dan laporan.

**Live:** https://cuti-app.vercel.app/

Dokumentasi lengkap (fitur, alur tiap peran, API, deploy): **[cuti-app/README.md](cuti-app/README.md)**

## Mulai Cepat

```bash
cd cuti-app
npm install
copy .env.example .env   # lalu isi SESSION_SECRET & CRON_SECRET
npx prisma db push
npm run db:seed
npm run dev
```

Buka http://localhost:3000 — login demo `hr@anime.id` / password `anime123`.
