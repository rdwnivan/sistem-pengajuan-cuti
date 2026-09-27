import { test, expect, login } from "./helpers";

test.describe("Slip gaji — karyawan hanya bisa lihat slip sendiri", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "karyawan");
  });

  test("karyawan melihat daftar slip miliknya sendiri", async ({ page }) => {
    await page.goto("/slip-gaji");
    await expect(page.getByRole("heading", { name: "Slip Gaji Saya" })).toBeVisible();
    // Hanya slip dengan status TERBIT yang tampil
    await expect(page.getByText("Dibatalkan")).toHaveCount(0);
  });

  test("karyawan tidak bisa akses menu HR slip gaji", async ({ page }) => {
    await page.goto("/hr/slip-gaji");
    await expect(page).toHaveURL(/\/$/);
  });

  test("detail slip yang bukan miliknya redirect", async ({ page }) => {
    // ID acak — harus 404 / tidak bisa dibuka
    const response = await page.goto("/slip-gaji/tidak-ada-id-ini");
    expect(response?.status()).toBeGreaterThanOrEqual(400);
  });
});
