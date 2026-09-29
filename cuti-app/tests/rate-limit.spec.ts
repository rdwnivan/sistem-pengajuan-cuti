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
  const stamp = Date.now();
  await page.locator("input[name=email]").fill(`rate-${stamp}@test.id`);
  for (let i = 0; i < 6; i++) {
    await page.locator("#password").fill(`salah-${i}`);
    const masuk = page.getByRole("button", { name: "Masuk" });
    await masuk.click();
    // Tunggu submit selesai (error muncul atau tombol siap lagi) sebelum iterasi berikutnya
    await expect
      .poll(async () => {
        const err = await page.getByText(/Email atau password salah|Terlalu banyak percobaan/).count();
        const ready = await masuk.count();
        return err > 0 || ready > 0 ? "done" : "wait";
      }, { timeout: 15000 })
      .toBe("done");
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
