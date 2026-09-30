import { test, expect, login } from "./helpers";
import type { Page } from "@playwright/test";

async function buatLaporanKebun(page: Page, judul: string): Promise<string> {
  await login(page, "karyawan");
  await page.goto("/laporan/baru");
  await page.getByLabel("Lokasi").fill("Afdeling 1");
  await page.getByLabel("Blok / Afdeling").fill("Blok A1");
  await page.getByLabel("Kegiatan / pekerjaan").fill("Panen TBS");
  await page.getByLabel("Jumlah tenaga kerja").fill("12");
  await page.getByLabel("Hasil / output").fill("2,5 ton TBS");
  await page.getByLabel("Cuaca").fill("Cerah");
  await page.getByLabel("Judul laporan").fill(judul);
  await page.getByLabel("Isi laporan").fill("Panen berjalan lancar, tidak ada kendala berarti di lapangan.");
  await page.getByLabel("Kirim ke atasan").selectOption({ label: "Atasan Satu (Manajer Operasional)" });
  await page.getByRole("button", { name: "Simpan Laporan" }).click();
  await page.waitForURL(/\/laporan\/[a-z0-9]{20,}$/, { timeout: 20_000 });
  return page.url();
}

test.describe("Laporan kebun — field operasional", () => {
  test("buat laporan dengan blok/kegiatan/TK/hasil/cuaca, tampil di detail", async ({ page }) => {
    const url = await buatLaporanKebun(page, "Laporan Panen Blok A1");
    await expect(page.getByText("Blok A1").first()).toBeVisible();
    await expect(page.getByText("Panen TBS").first()).toBeVisible();
    await expect(page.getByText("12 orang").first()).toBeVisible();
    await expect(page.getByText("2,5 ton TBS").first()).toBeVisible();
    await expect(page.getByText("Cerah").first()).toBeVisible();
    // kirim ke atasan → MENUNGGU
    await page.getByRole("button", { name: "Kirim ke Atasan" }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Menunggu Acc").first()).toBeVisible({ timeout: 15_000 });
    // cleanup: atasan tolak agar antrean kosong
    await login(page, "atasan");
    await page.goto(url);
    await page.locator('textarea[name="catatan"]').first().fill("cleanup test");
    await page.locator('button[name="aksi"][value="tolak"]').first().click();
    await expect(page.getByText("Ditolak").first()).toBeVisible({ timeout: 15_000 });
  });

  test("rute blok/rekap yang dihapus mengembalikan 404", async ({ page }) => {
    await login(page, "hr");
    const blok = await page.goto("/hr/blok");
    expect(blok?.status()).toBe(404);
    const rekap = await page.goto("/hr/laporan-lapangan");
    expect(rekap?.status()).toBe(404);
  });
});
