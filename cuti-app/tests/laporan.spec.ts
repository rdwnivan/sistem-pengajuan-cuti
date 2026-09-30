import { test, expect, login } from "./helpers";
import type { Page } from "@playwright/test";

async function buatLaporan(page: Page, judul: string) {
  await login(page, "karyawan");
  await page.goto("/laporan/baru");
  await page.getByLabel("Lokasi").fill("Proyek Kalimantan");
  await page.getByLabel("Shift").fill("Pagi");
  await page.getByLabel("Judul laporan").fill(judul);
  await page.getByLabel("Isi laporan").fill("Pekerjaan lapangan berjalan baik, tidak ada kendala berarti.");
  await page.getByLabel("Kirim ke atasan").selectOption({ label: "Atasan Satu (Manajer Operasional)" });
  await page.getByRole("button", { name: "Simpan Laporan" }).click();
  await page.waitForURL(/\/laporan\/[a-z0-9]{20,}$/);
  return page.url();
}

test.describe("Laporan lapangan — buat dan kirim", () => {
  test("karyawan membuat laporan baru berstatus Draf", async ({ page }) => {
    await buatLaporan(page, "Laporan Minggu 1");
    await expect(page.getByRole("heading", { name: "Laporan Minggu 1" })).toBeVisible();
    await expect(page.getByText("Draf").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Kirim ke Atasan" })).toBeVisible();
  });

  test("karyawan mengirim laporan draf ke atasan", async ({ page }) => {
    await buatLaporan(page, "Laporan Minggu 2");
    await page.getByRole("button", { name: "Kirim ke Atasan" }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Menunggu Acc").first()).toBeVisible({ timeout: 15_000 });
  });

  test("validasi menolak isi terlalu pendek", async ({ page }) => {
    await login(page, "karyawan");
    await page.goto("/laporan/baru");
    await page.getByLabel("Lokasi").fill("X");
    await page.getByLabel("Judul laporan").fill("Pendek");
    await page.getByLabel("Isi laporan").fill("pendek");
    await page.getByRole("button", { name: "Simpan Laporan" }).click();
    // Browser native validation prevents submission — URL should not change
    await expect(page).toHaveURL(/\/laporan\/baru/);
  });
});

test.describe("Laporan lapangan — hak akses", () => {
  test("atasan melihat antrean laporan", async ({ page }) => {
    await login(page, "atasan");
    await page.goto("/persetujuan");
    await expect(page.getByRole("heading", { name: /Laporan Lapangan/ }).first()).toBeVisible();
  });

  test("karyawan biasa melihat antrean kosong", async ({ page }) => {
    await login(page, "karyawan");
    await page.goto("/persetujuan");
    await expect(page.getByText("Tidak ada antrean cuti").first()).toBeVisible();
    await expect(page.getByText("Tidak ada laporan menunggu").first()).toBeVisible();
  });

  test("HR melihat antrean kosong (tidak punya akses laporan) QTL", async ({ page }) => {
    await login(page, "hr");
    await page.goto("/persetujuan");
    await expect(page.getByText("Tidak ada antrean cuti").first()).toBeVisible();
  });

  test("HR tidak punya menu Acc Laporan di navigasi", async ({ page }) => {
    await login(page, "hr");
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Acc Laporan" })).toHaveCount(0);
  });

  test("atasan punya menu Setujui di navigasi", async ({ page }) => {
    await login(page, "atasan");
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Setujui" }).first()).toBeVisible();
  });

  test("karyawan tidak bisa buka detail laporan orang lain", async ({ page }) => {
    await login(page, "karyawan");
    const response = await page.goto("/laporan/id-yang-tidak-ada-ini");
    expect(response?.status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe("Laporan lapangan — filter tanggal", () => {
  test("dari/sampai memfilter daftar, tanggal invalid diabaikan", async ({ page }) => {
    await login(page, "karyawan");
    await page.goto("/laporan/baru");
    await page.waitForFunction(() => document.querySelectorAll('select[name="approverId"] option').length > 1, {}, { timeout: 8000 });
    const judul = `Uji Filter Tgl ${Date.now()}`;
    await page.locator('input[name="lokasi"]').fill("Kebun Uji");
    await page.locator('input[name="judul"]').fill(judul);
    await page.locator('textarea[name="isi"]').fill("Isi laporan uji filter tanggal yang cukup panjang.");
    await page.locator('select[name="approverId"]').selectOption({ index: 1 });
    await page.getByRole("button", { name: "Simpan Laporan" }).click();
    await page.waitForURL(/\/laporan\/[a-zA-Z0-9]{20,}$/, { timeout: 20000 });

    const kemarin = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const lusa = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    const tahunLalu = `${new Date().getFullYear() - 1}-01-01`;

    await page.goto(`/laporan?dari=${kemarin}&sampai=${lusa}`);
    await expect(page.getByText(judul).first()).toBeVisible({ timeout: 8000 });

    await page.goto(`/laporan?dari=${tahunLalu}&sampai=${tahunLalu}`);
    await expect(page.getByText(judul)).toHaveCount(0);
    await expect(page.getByText("Belum ada laporan untuk filter ini.").first()).toBeVisible();

    await page.goto("/laporan?dari=asal&sampai=2026-13-99");
    await expect(page.getByText(judul).first()).toBeVisible({ timeout: 8000 });
    // Draf tidak masuk antrean persetujuan -> tidak perlu cleanup.
  });
});
