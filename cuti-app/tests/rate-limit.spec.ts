import { test, expect, AKUN } from "./helpers";

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
  // React 19 mereset form (uncontrolled) setelah tiap server action, jadi email
  // wajib diisi ulang tiap iterasi — kalau tidak, `required` memblokir submit.
  for (let i = 0; i < 6; i++) {
    await page.locator("input[name=email]").fill(email);
    await page.locator("#password").fill(`salah-${i}`);
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST"),
      page.getByRole("button", { name: /Masuk|Memproses/ }).click(),
    ]);
    await resp.finished();
  }
  // setelah 5× gagal, error rate limit harus muncul
  await expect(page.getByText("Terlalu banyak percobaan")).toBeVisible({ timeout: 8000 });
});

test("login valid tetap berfungsi setelah rate limit aktif untuk akun lain", async ({ page }) => {
  await page.goto("/login");
  await page.locator("input[name=email]").fill(AKUN.karyawan.email);
  await page.locator("#password").fill(AKUN.karyawan.password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((url) => url.pathname !== "/login", { timeout: 15000 });
  expect(page.url()).not.toContain("/login");
});
