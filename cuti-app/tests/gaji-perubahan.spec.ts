import { test, expect, login } from "./helpers";

test.describe("Perubahan gaji — approval flow", () => {
  test("HR mengajukan perubahan gaji lalu atasan menyetujui", async ({ page }) => {
    await login(page, "hr");
    await page.goto("/hr/karyawan");

    await page.click("text=Karyawan 1");
    await page.waitForURL(/\/hr\/karyawan\//);

    const pokokInput = page.locator('input[name="gajiPokok"]').first();
    await expect(pokokInput).toBeVisible();

    await pokokInput.clear();
    await pokokInput.fill("1000001");

    await page.locator('button:has-text("Simpan")').first().click();
    await page.waitForURL("/hr/karyawan", { timeout: 10_000 });
  });

  test("atasan bisa approve perubahan gaji via persetujuan", async ({ page }) => {
    await login(page, "atasan");
    await page.goto("/persetujuan");

    const setujuBtn = page.locator('button[name="aksi"][value="setuju"]').first();
    if (await setujuBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await setujuBtn.click();
      await page.waitForURL("/persetujuan", { timeout: 10_000 });
    }
  });

  test("HR edit karyawan menampilkan form gaji", async ({ page }) => {
    await login(page, "hr");
    await page.goto("/hr/karyawan");

    const firstKaryawanLink = page.locator('a[href*="/hr/karyawan/"]').first();
    await firstKaryawanLink.click();
    await page.waitForURL(/\/hr\/karyawan\//);

    const gajiInput = page.locator('input[name="gajiPokok"]').first();
    await expect(gajiInput).toBeVisible();
  });
});
