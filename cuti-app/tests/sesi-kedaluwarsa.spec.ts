import { test, expect } from "./helpers";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

/**
 * Sesi kedaluwarsa (TODO 141).
 *
 * Sebelum perbaikan: `userDariSesi` hanya mengembalikan null untuk sesi lewat
 * masa berlaku, tetapi row `Sesi`-nya tetap ada selamanya. Sekarang:
 *   1. sesi kedaluwarsa tetap DITOLAK (dialihkan ke /login), dan
 *   2. sapu `/api/cron` menghapus row-nya.
 *
 * Tier flows (serial, worker 1) sengaja dipakai: test ini memasukkan row `Sesi`
 * kedaluwarsa secara langsung, dan sapu cron yang berjalan bersamaan di tier
 * paralel bisa menghapus row itu sebelum kita sempat membuktikannya. Tiers lain
 * (cron.spec.ts) memang menembak `/api/cron` di tier yang sama-sama serial.
 */

function cronSecret(): string {
  if (process.env.CRON_SECRET) return process.env.CRON_SECRET;
  const envPath = path.resolve(__dirname, "..", ".env");
  const m = fs.readFileSync(envPath, "utf8").match(/^CRON_SECRET="([^"]+)"/m);
  return m?.[1] ?? "";
}

function dbUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.resolve(__dirname, "..", ".env");
  const m = fs.readFileSync(envPath, "utf8").match(/^DATABASE_URL="([^"]+)"/m);
  return m?.[1] ?? "";
}

const COOKIE = "sesi-cuti";

test.describe("Sesi kedaluwarsa — ditolak + disapu cron", () => {
  test("cookie sesi kedaluwarsa ditolak ke /login, lalu row-nya dihapus sapu cron", async ({ page, context, request, baseURL }) => {
    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl() } } });
    const token = "uji-kedaluwarsa-" + Date.now().toString(16) + Math.random().toString(16).slice(2, 10);
    const pemilik = await prisma.user.findUniqueOrThrow({ where: { email: "karyawan1@anime.id" } });
    try {
      // 1. Sisipkan sesi yang masa berlakunya sudah lewat 1 jam.
      await prisma.sesi.create({
        data: { token, userId: pemilik.id, expiresAt: new Date(Date.now() - 3600_000) },
      });

      // 2. Cookie kedaluwarsa harus DITOLAK: halaman terproteksi -> /login.
      await context.addCookies([{
        name: COOKIE,
        value: token,
        url: baseURL!,
        httpOnly: true,
        sameSite: "Lax",
      }]);
      await page.goto("/riwayat");
      await page.waitForURL(/\/login/, { timeout: 20_000 });
      expect(new URL(page.url()).pathname).toBe("/login");

      // 3. Row harus masih ada (penolakan tidak menghapus), lalu sapu cron
      //    menghapusnya.
      expect(await prisma.sesi.count({ where: { token } })).toBe(1);
      const r = await request.get("/api/cron?secret=" + encodeURIComponent(cronSecret()));
      expect(r.status()).toBe(200);
      const j = await r.json();
      expect(typeof j.sesiDibersihkan).toBe("number");
      expect(j.sesiDibersihkan).toBeGreaterThanOrEqual(1);
      expect(await prisma.sesi.count({ where: { token } })).toBe(0);

      // 4. Sesi yang MASIH valid tidak boleh ikut terhapus — bukti predikat sapu
      //    sama dengan penolakan auth (bukan "hapus semua").
      const login = await prisma.sesi.create({
        data: { token: token + "-valid", userId: pemilik.id, expiresAt: new Date(Date.now() + 3600_000) },
      });
      const r2 = await request.get("/api/cron?secret=" + encodeURIComponent(cronSecret()));
      expect(r2.status()).toBe(200);
      expect(await prisma.sesi.count({ where: { id: login.id } })).toBe(1);
      await prisma.sesi.deleteMany({ where: { id: login.id } });
    } finally {
      await prisma.sesi.deleteMany({ where: { token } });
      await prisma.$disconnect();
    }
  });
});
