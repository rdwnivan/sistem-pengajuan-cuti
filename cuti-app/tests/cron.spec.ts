import { test, expect, login, seninDepan } from "./helpers";

/**
 * Cron reminder/eskalasi via API.
 * Butuh CRON_SECRET yang valid (dibaca dari cuti-app/.env) dan antrean
 * MENUNGGU (dibuat oleh test ini sendiri).
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

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

test.describe("Cron — reminder & eskalasi", () => {
  test("cron tanpa secret → 401", async ({ request }) => {
    const r = await request.get("/api/cron");
    expect(r.status()).toBe(401);
  });

  test("cron dengan secret benar → 200 + struktur hasil", async ({ request, page }) => {
    // Pastikan ada antrean: karyawan ajukan cuti
    const { mulai, selesai } = seninDepan();
    await login(page, "karyawan2");
    await page.goto("/cuti/baru");
    await page.locator('select[name="jenisId"]').selectOption({ label: "Duka (min H-0)" });
    await page.locator('input[name="tglMulai"]').fill(mulai);
    await page.locator('input[name="tglSelesai"]').fill(selesai);
    await page.locator('textarea[name="alasan"]').fill("Cuti untuk memicu antrean cron reminder eskalasi");
    await page.getByRole("button", { name: "Kirim Pengajuan" }).click();
    await page.waitForURL(/\/cuti\/[a-z0-9]{20,}$/, { timeout: 20_000 });
    const url = page.url();

    const secret = cronSecret();
    expect(secret.length).toBeGreaterThanOrEqual(32);
    const r = await request.get(`/api/cron?secret=${encodeURIComponent(secret)}`);
    expect(r.status()).toBe(200);
    const j = await r.json();
    expect(j.ok).toBe(true);
    expect(typeof j.reminder).toBe("number");
    expect(typeof j.eskalasi).toBe("number");
    expect(Array.isArray(j.detail)).toBe(true);
    // Pengajuan baru berumur < 1 hari → belum ada reminder/eskalasi, tapi endpoint jalan
    expect(j.reminder).toBeGreaterThanOrEqual(0);

    // Cleanup: batalkan agar antrean HR kembali kosong untuk test lain
    await page.goto(url);
    await expect(page.getByRole("heading", { name: "Detail Pengajuan" })).toBeVisible({ timeout: 15_000 });
    page.on("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Batalkan Pengajuan" }).click();
    await page.waitForURL("/", { timeout: 15_000 });
  });

  test("cron via header Authorization Bearer juga diterima", async ({ request }) => {
    const r = await request.get("/api/cron", { headers: { authorization: `Bearer ${cronSecret()}` } });
    expect(r.status()).toBe(200);
  });

  test("umur H+1 memicu reminder, umur H+3 memicu eskalasi", async ({ request, page }) => {
    // 1. Buat pengajuan via UI sebagai karyawan2 (atasan: atasan2 -> pimpinan)
    const { mulai, selesai } = seninDepan(2);
    await login(page, "karyawan2");
    await page.goto("/cuti/baru");
    await page.locator('select[name="jenisId"]').selectOption({ label: "Duka (min H-0)" });
    await page.locator('input[name="tglMulai"]').fill(mulai);
    await page.locator('input[name="tglSelesai"]').fill(selesai);
    await page.locator('textarea[name="alasan"]').fill("Cuti uji reminder dan eskalasi cron H+1 H+3");
    await page.getByRole("button", { name: "Kirim Pengajuan" }).click();
    await page.waitForURL(/\/cuti\/[a-z0-9]{20,}$/, { timeout: 20_000 });
    const id = page.url().split("/cuti/")[1];
    expect(id.length).toBeGreaterThan(10);

    const secret = cronSecret();
    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl() } } });
    try {
      // 2. Simulasikan umur H+1: updatedAt 2 hari lalu, belum pernah di-reminder
      await prisma.$executeRaw`UPDATE "Pengajuan" SET "updatedAt" = NOW() - INTERVAL '2 days', "lastReminderAt" = NULL, "reminderCount" = 0 WHERE id = ${id}`;
      let r = await request.get(`/api/cron?secret=${encodeURIComponent(secret)}`);
      expect(r.status()).toBe(200);
      let j = await r.json();
      expect(j.reminder).toBeGreaterThanOrEqual(1);
      expect(j.detail.join(" ")).toContain(id.slice(0, 6));
      const hitung1 = await prisma.pengajuan.findUnique({ where: { id }, select: { reminderCount: true } });
      expect(hitung1?.reminderCount).toBe(1);
      console.log("OK|umur H+1 memicu reminder");

      // Reminder kedua langsung (lastReminderAt baru saja) tidak boleh dobel:
      // reminderCount harus tetap 1
      r = await request.get(`/api/cron?secret=${encodeURIComponent(secret)}`);
      expect(r.status()).toBe(200);
      const hitung2 = await prisma.pengajuan.findUnique({ where: { id }, select: { reminderCount: true } });
      expect(hitung2?.reminderCount).toBe(1);
      console.log("OK|reminder tidak dobel dalam hari yang sama");

      // 3. Simulasikan umur H+3: updatedAt 4 hari lalu, belum dieskalasi
      await prisma.$executeRaw`UPDATE "Pengajuan" SET "updatedAt" = NOW() - INTERVAL '4 days', "dieskalasi" = false, "eskalasiKeId" = NULL WHERE id = ${id}`;
      const sebelum = await prisma.pengajuan.findUnique({ where: { id }, select: { approverId: true } });
      r = await request.get(`/api/cron?secret=${encodeURIComponent(secret)}`);
      expect(r.status()).toBe(200);
      j = await r.json();
      expect(j.eskalasi).toBeGreaterThanOrEqual(1);
      const sesudah = await prisma.pengajuan.findUnique({ where: { id }, select: { approverId: true, dieskalasi: true } });
      expect(sesudah?.dieskalasi).toBe(true);
      expect(sesudah?.approverId).not.toBe(sebelum?.approverId);
      console.log("OK|umur H+3 memicu eskalasi + approver pindah");
    } finally {
      await prisma.$disconnect();
    }

    // 4. Cleanup: batalkan agar antrean kembali kosong
    await page.goto(`/cuti/${id}`);
    await expect(page.getByRole("heading", { name: "Detail Pengajuan" })).toBeVisible({ timeout: 15_000 });
    page.on("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Batalkan Pengajuan" }).click();
    await page.waitForURL("/", { timeout: 15_000 });
  });
});
