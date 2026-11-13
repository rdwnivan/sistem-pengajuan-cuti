import { test, expect, AKUN } from "./helpers";
import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { catatGagal, kunciLogin, reset } from "../src/lib/rate-limit";

/**
 * Test brute force dipisah ke file sendiri karena BERAT:
 * 6× bcrypt.compare (cost 10) berurutan.
 * Dijalankan serial dengan worker 1 agar tidak membuat Next dev
 * single-process macet saat full suite berjalan paralel:
 *
 *   npx playwright test tests/rate-limit.spec.ts --workers=1
 */
test.describe.configure({ mode: "serial", timeout: 120000 });

test("brute force diblokir setelah 5 percobaan gagal", async ({ page }) => {
  await page.goto("/login");
  const email = `rate-${Date.now()}@test.id`;
  // ActionForm mempertahankan isian, termasuk setelah error rate limit.
  for (let i = 0; i < 6; i++) {
    await page.locator("input[name=email]").fill(email);
    await page.locator("#password").fill(`salah-${i}`);
    // Tunggu POST server action halaman ini saja (bukan POST lain di halaman).
    // JANGAN pakai response.finished(): pada respons streaming Next dev promise
    // itu tidak punya timeout sendiri, jadi bisa menggantung sampai timeout test
    // 120s (pernah terjadi di CI). Header balik sudah cukup — server selesai
    // memproses action sebelum body-nya dikirim.
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/login")),
      page.getByRole("button", { name: /Masuk|Memproses/ }).click(),
    ]);
    expect(resp.status()).toBeLessThan(500);
    // Tunggu Action selesai, bukan reset form yang kini memang dicegah.
    await expect(page.locator("form").first()).toHaveAttribute("aria-busy", "false", { timeout: 30000 });
    await expect(page.locator("input[name=email]")).toHaveValue(email);
    await expect(page.locator("#password")).toHaveValue(`salah-${i}`);
  }
  // setelah 5× gagal, error rate limit harus muncul
  await expect(page.getByText("Terlalu banyak percobaan")).toBeVisible({ timeout: 8000 });
  // An independent database client sees the block; it survives process restarts.
  const db = new PrismaClient();
  try {
    const key = createHash("sha256").update(`login:${email}`).digest("hex");
    const state = await db.loginRateLimit.findUniqueOrThrow({ where: { key } });
    expect(state.gagal).toBe(5);
    expect(state.blokirSampai.getTime()).toBeGreaterThan(Date.now());
  } finally { await db.$disconnect(); }
});

test("login valid tetap berfungsi setelah rate limit aktif untuk akun lain", async ({ page }) => {
  await page.goto("/login");
  await page.locator("input[name=email]").fill(AKUN.karyawan.email);
  await page.locator("#password").fill(AKUN.karyawan.password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((url) => url.pathname !== "/login", { timeout: 15000 });
  expect(page.url()).not.toContain("/login");
});

test("lima kegagalan bersamaan tidak hilang dan blokir terbaca proses baru", async () => {
  const key = `distributed-${Date.now()}@test.id`;
  const db = new PrismaClient();
  try {
    await Promise.all(Array.from({ length: 5 }, () => catatGagal(key)));
    expect((await db.loginRateLimit.findUniqueOrThrow({ where: { key: kunciLogin(key) } })).gagal).toBe(5);
    const req = createRequire(path.join(process.cwd(), "package.json"));
    const result = spawnSync(process.execPath, [req.resolve("tsx/cli"), "-e",
      `import { cekRateLimit } from './src/lib/rate-limit'; import { prisma } from './src/lib/prisma'; cekRateLimit(${JSON.stringify(key)}).then(r => console.log(JSON.stringify(r))).finally(() => prisma.$disconnect());`,
    ], { cwd: process.cwd(), env: process.env, encoding: "utf8", timeout: 20000 });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ ok: false });
  } finally {
    await reset(key);
    await db.$disconnect();
  }
});
