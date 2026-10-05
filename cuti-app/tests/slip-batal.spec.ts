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
  // Tunggu server action aksiBuatSlip benar-benar selesai SEBELUM navigasi berikutnya.
  // PENTING: `waitForURL(/\/hr\/slip-gaji/)` TIDAK menunggu apa pun di sini, karena URL
  // saat itu (`/hr/slip-gaji?buat=1`) sudah cocok dengan regex-nya. Akibatnya form filter
  // di bawah (GET → navigasi penuh) bisa membatalkan POST server action yang masih berjalan,
  // slip tidak jadi dibuat, dan kartu "Terbit" tidak pernah ada (flake CI 2026-10-06).
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/hr/slip-gaji")),
    page.getByRole("button", { name: "Terbitkan Slip" }).first().click(),
  ]);
  expect(resp.status()).toBeLessThan(500);
  // Pastikan redirect dari action sudah mendarat: form `?buat=1` harus sudah tertutup.
  await page.waitForURL((u) => !u.searchParams.has("buat"), { timeout: 20000 });

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
