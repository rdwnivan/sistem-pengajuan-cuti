import { test, expect, login } from "./helpers";
import type { Page } from "@playwright/test";

async function buatLaporanKebun(page: Page, judul: string): Promise<string> {
  await login(page, "karyawan");
  await page.goto("/laporan/baru");
  await page.getByLabel("Lokasi").fill("Afdeling 1");
  await page.locator('select[name="blok"]').selectOption({ label: "Blok A1 (Afdeling 1)" });
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

  test("API blok butuh login, mengembalikan daftar blok aktif", async ({ page }) => {
    await login(page, "karyawan");
    const r = await page.request.get("/api/blok");
    expect(r.status()).toBe(200);
    const j = await r.json();
    expect(Array.isArray(j)).toBe(true);
    expect(j.length).toBeGreaterThanOrEqual(5);
    expect(j[0].nama).toBeTruthy();
  });

  test("API blok tanpa sesi → 401", async ({ page, context }) => {
    await context.clearCookies();
    const r = await page.request.get("/api/blok");
    expect(r.status()).toBe(401);
  });
});

test.describe("HR — master blok + rekap laporan", () => {
  test("HR tambah blok baru lalu nonaktifkan", async ({ page }) => {
    await login(page, "hr");
    await page.goto("/hr/blok");
    await expect(page.getByRole("heading", { name: "Master Blok / Afdeling" })).toBeVisible();
    const namaBlok = `Blok T${Date.now() % 100000}`;
    await page.getByLabel("Nama blok").first().fill(namaBlok);
    await page.getByLabel("Keterangan").first().fill("Blok test otomatis");
    await page.getByRole("button", { name: "Tambah", exact: true }).first().click();
    await page.waitForURL("/hr/blok", { timeout: 15_000 });
    await expect(page.getByText(namaBlok).first()).toBeVisible();
    // nonaktifkan kembali agar tidak mengotori dropdown
    const baris = page.locator("form", { hasText: namaBlok }).first();
    await baris.getByRole("button", { name: "Nonaktifkan" }).click();
    await page.waitForURL("/hr/blok", { timeout: 15_000 });
  });

  test("HR buka rekap laporan + unduh Excel", async ({ page }) => {
    await buatLaporanKebun(page, "Laporan Untuk Rekap");
    await login(page, "hr");
    await page.goto("/hr/laporan-lapangan");
    await expect(page.getByRole("heading", { name: /Rekap Laporan Lapangan/ })).toBeVisible();
    await expect(page.getByText("Laporan Untuk Rekap").first()).toBeVisible({ timeout: 15_000 });
    // filter blok
    await page.locator('select[name="blok"]').first().selectOption("Blok A1");
    await page.getByRole("button", { name: "Filter" }).first().click();
    await expect(page.getByText("Laporan Untuk Rekap").first()).toBeVisible({ timeout: 15_000 });
    // unduh excel
    const dl = await Promise.all([
      page.waitForEvent("download", { timeout: 30_000 }),
      page.getByRole("link", { name: "Unduh Excel" }).first().click(),
    ]);
    const path = await dl[0].path();
    expect(path).toBeTruthy();
  });
});
