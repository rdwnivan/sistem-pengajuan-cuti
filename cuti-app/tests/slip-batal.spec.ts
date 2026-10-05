import { test, expect, login } from "./helpers";

/**
 * HR batalkan slip gaji yang sudah terbit (aksiBatalSlip) → status DIBATALKAN.
 * Serial (worker 1). Pakai Karyawan 3 agar tidak bentrok unique slip
 * dengan slip-rincian.spec.ts (yang memakai Karyawan 4, bulan sama).
 */
test.describe.configure({ mode: "serial" });

test("HR terbitkan lalu batalkan slip gaji", async ({ page }) => {
  const now = new Date();
  const bulan = String(now.getMonth() + 1);

  await login(page, "hr");
  await page.goto("/hr/slip-gaji?buat=1");
  await page.locator('select[name="userId"]').first().selectOption({ label: "Karyawan 3 (Staff)" });
  await page.locator('select[name="bulan"]').first().selectOption(bulan);
  await page.getByRole("button", { name: "Terbitkan Slip" }).first().click();
  await page.waitForURL(/\/hr\/slip-gaji/, { timeout: 20000 });

  // Filter ke Karyawan 3 agar hanya barisnya yang tampil
  await page.locator('select[name="akun"]').first().selectOption({ label: "Karyawan 3" });
  await page.getByRole("button", { name: "Filter" }).first().click();
  await page.waitForLoadState("networkidle");

  // Shell me-render children 2× (desktop + mobile). Ambil kartu yang TERLIHAT
  // dan berisi tombol "Batalkan" → otomatis mengecualikan form filter (yang
  // juga rounded-xl & memuat teks "Karyawan 3" dari <option>) dan salinan tersembunyi.
  const kartu = page
    .locator("div.rounded-xl:visible", { hasText: "Karyawan 3" })
    .filter({ hasText: "Batalkan" })
    .first();
  await expect(kartu.getByText("Terbit").first()).toBeVisible({ timeout: 10000 });

  page.once("dialog", (d) => d.accept());
  await kartu.getByRole("button", { name: "Batalkan" }).click();
  await page.waitForURL(/\/hr\/slip-gaji/, { timeout: 20000 });
  await expect(page.getByText("Dibatalkan").first()).toBeVisible({ timeout: 10000 });
});
