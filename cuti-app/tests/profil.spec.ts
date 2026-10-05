import { test, expect, login } from "./helpers";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

/**
 * Profil: ubah password. Kasus positif pakai user sekali-pakai (dibuat via
 * Prisma) agar password akun seed tidak berubah dan merusak test lain.
 * Serial (worker 1).
 */
test.describe.configure({ mode: "serial" });

function dbUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const m = fs.readFileSync(path.resolve(__dirname, "..", ".env"), "utf8").match(/^DATABASE_URL="([^"]+)"/m);
  return m?.[1] ?? "";
}

test("ubah password: password lama salah ditolak (akun tidak berubah)", async ({ page }) => {
  await login(page, "karyawan");
  await page.goto("/profil");
  await page.locator('input[name="lama"]').first().fill("salah-banget");
  await page.locator('input[name="baru"]').first().fill("passwordbaru123");
  await page.getByRole("button", { name: "Simpan Password" }).first().click();
  await expect(page.getByText("Password lama salah").first()).toBeVisible({ timeout: 10000 });
});

test("ubah password: berhasil lalu login dengan password baru", async ({ page }) => {
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl() } } });
  const email = `uji.profil.${Date.now()}@anime.id`;
  try {
    await prisma.user.create({ data: { nama: "Uji Profil", email, passwordHash: await bcrypt.hash("anime123", 10) } });

    // login awal
    await page.goto("/login");
    await page.locator('input[name="email"]').fill(email);
    await page.locator("#password").fill("anime123");
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });

    // ubah password
    await page.goto("/profil");
    await page.locator('input[name="lama"]').first().fill("anime123");
    await page.locator('input[name="baru"]').first().fill("passwordbaru123");
    await page.getByRole("button", { name: "Simpan Password" }).first().click();
    await page.waitForURL(/\/profil\?ok=1/, { timeout: 15000 });

    // logout, login dengan password baru
    await page.getByRole("button", { name: /^Keluar/ }).click();
    await page.waitForURL(/\/login/, { timeout: 15000 });
    await page.locator('input[name="email"]').fill(email);
    await page.locator("#password").fill("passwordbaru123");
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });
    await expect(page.getByText("Uji Profil").first()).toBeVisible();
  } finally {
    await prisma.$disconnect();
  }
});
