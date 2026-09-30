import { test, expect, login, rentangDelegasi } from "./helpers";

/**
 * Verifikasi dialog konfirmasi pada tombol destruktif:
 * - dismiss (Batal) → tidak ada submit, data tidak berubah
 * - accept (OK) → submit jalan seperti biasa
 */
test.describe.configure({ mode: "serial" });

test("confirm dismiss: batalkan delegasi DIBATALKAN user, data tetap aktif", async ({ page }) => {
  await login(page, "atasan");
  await page.goto("/delegasi");
  const { mulai, selesai } = rentangDelegasi();
  await page.locator('select[name="keId"]').first().selectOption({ label: "Atasan Dua (atasan2@anime.id)" });
  await page.locator('input[name="tglMulai"]').first().fill(mulai);
  await page.locator('input[name="tglSelesai"]').first().fill(selesai);
  await page.getByRole("button", { name: "Simpan Delegasi" }).first().click();
  await page.waitForURL("/delegasi", { timeout: 15_000 });

  // Dismiss dialog → tidak submit → tidak ada "(nonaktif)"
  page.on("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "Batalkan" }).first().click();
  await page.waitForTimeout(1500);
  await expect(page.getByText("(nonaktif)").first()).toHaveCount(0);
  console.log("OK|dismiss confirm -> tidak ada submit");

  // Accept dialog → submit jalan → menjadi "(nonaktif)"
  page.removeAllListeners("dialog");
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Batalkan" }).first().click();
  await expect(page.getByText("(nonaktif)").first()).toBeVisible({ timeout: 15_000 });
  console.log("OK|accept confirm -> submit jalan");
});
