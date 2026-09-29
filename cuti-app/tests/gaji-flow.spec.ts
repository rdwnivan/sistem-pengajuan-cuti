import { test, expect, login } from "./helpers";

/**
 * Alur gaji penuh: HR ubah gaji karyawan → GajiPerubahan MENUNGGU (approver = atasan1)
 * → atasan1 setuju di /persetujuan → gaji user ter-update.
 *
 * NB: halaman HR & /persetujuan memakai Shell yang me-render children 2×
 * (desktop + mobile) → semua locator pakai .first().
 */
test.describe("Perubahan gaji — alur penuh HR → atasan", () => {
  test("HR mengajukan perubahan gaji, atasan menyetujui, gaji ter-update", async ({ page }) => {
    const gajiBaru = String(5000000 + (Math.floor(Date.now() / 1000) % 100000));

    // 1. HR ubah gaji karyawan1
    await login(page, "hr");
    await page.goto("/hr/karyawan");
    await page.getByRole("link", { name: /Karyawan 1/ }).first().click();
    await page.waitForURL(/\/hr\/karyawan\//, { timeout: 15_000 });
    const pokokInput = page.locator('input[name="gajiPokok"]').first();
    await expect(pokokInput).toBeVisible();
    await pokokInput.clear();
    await pokokInput.fill(gajiBaru);
    await page.locator('button:has-text("Simpan")').first().click();
    await page.waitForURL("/hr/karyawan", { timeout: 15_000 });

    // 2. atasan1 melihat kartu perubahan gaji di /persetujuan dan menyetujui
    await login(page, "atasan");
    await page.goto("/persetujuan");
    await expect(page.getByText("Perubahan Gaji").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Karyawan 1").first()).toBeVisible();
    await page.locator('button[name="aksi"][value="setuju"]').first().click();
    await page.waitForURL("/persetujuan", { timeout: 15_000 });

    // 3. Verifikasi gaji ter-update di form HR
    await login(page, "hr");
    await page.goto("/hr/karyawan");
    await page.getByRole("link", { name: /Karyawan 1/ }).first().click();
    await page.waitForURL(/\/hr\/karyawan\//, { timeout: 15_000 });
    await expect(page.locator('input[name="gajiPokok"]').first()).toHaveValue(gajiBaru);
  });
});
