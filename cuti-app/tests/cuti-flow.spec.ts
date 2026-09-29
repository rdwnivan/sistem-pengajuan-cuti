import { test, expect, login, seninDepan, sabtuDepan } from "./helpers";
import type { Page } from "@playwright/test";

/**
 * Alur cuti penuh: karyawan ajukan → atasan setuju → HR setuju (DISETUJUI).
 * Tiap test yang submit memakai JENIS BERBEDA — kuota Duka/Menikah kecil (2/3 hari)
 * dan terpakai permanen, jadi reuse jenis yang sama antar test akan gagal kuota.
 * - alur-penuh → Tahunan (kuota 12, karyawan3 masa kerja > 12 bln, min H-3 terpenuhi)
 * - alur-tolak  → Menikah (kuota 3)
 */
async function ajukanCuti(page: Page, opt: { jenis: string; alasan: string; plusMinggu?: number }): Promise<string> {
  const { mulai, selesai } = seninDepan(opt.plusMinggu ?? 0);
  await login(page, "karyawan3");
  await page.goto("/cuti/baru");
  await page.locator('select[name="jenisId"]').selectOption({ label: opt.jenis });
  await page.locator('input[name="tglMulai"]').fill(mulai);
  await page.locator('input[name="tglSelesai"]').fill(selesai);
  await page.locator('textarea[name="alasan"]').fill(opt.alasan);
  await page.getByRole("button", { name: "Kirim Pengajuan" }).click();
  await page.waitForURL(/\/cuti\/[a-z0-9]{20,}$/, { timeout: 20_000 });
  return page.url();
}

async function putuskan(page: Page, url: string, aksi: "setuju" | "tolak" | "kembalikan", catatan = "") {
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Detail Pengajuan" })).toBeVisible({ timeout: 15_000 });
  if (catatan) await page.locator('textarea[name="catatan"]').fill(catatan);
  await page.locator(`button[name="aksi"][value="${aksi}"]`).click();
}

test.describe("Cuti — alur penuh karyawan → atasan → HR", () => {
  test("karyawan mengajukan, atasan menyetujui, HR verifikasi final → DISETUJUI", async ({ page }) => {
    const url = await ajukanCuti(page, {
      jenis: "Tahunan (min H-3)",
      alasan: "Cuti tahunan keluarga ke luar kota keperluan mendesak",
    });
    await expect(page.getByText("Menunggu Atasan").first()).toBeVisible({ timeout: 15_000 });

    // Atasan (atasan1 = atasan langsung karyawan3) menyetujui → MENUNGGU_HR
    await login(page, "atasan");
    await putuskan(page, url, "setuju");
    await expect(page.getByText("Menunggu HR").first()).toBeVisible({ timeout: 15_000 });

    // HR verifikasi final → DISETUJUI + tombol PDF muncul
    await login(page, "hr");
    await putuskan(page, url, "setuju");
    await expect(page.getByText("Disetujui").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: /Cetak \/ Unduh Formulir PDF/ })).toBeVisible();
  });

  test("atasan menolak dengan catatan → DITOLAK", async ({ page }) => {
    const url = await ajukanCuti(page, {
      jenis: "Menikah (min H-3)",
      alasan: "Cuti menikah saudara kandung di kampung halaman",
      plusMinggu: 1,
    });
    await login(page, "atasan");
    await putuskan(page, url, "tolak", "Operasional sedang padat minggu ini");
    await expect(page.getByText("Ditolak").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Operasional sedang padat minggu ini").first()).toBeVisible();
  });

  test("validasi: tanggal selesai sebelum mulai ditolak", async ({ page }) => {
    await login(page, "karyawan3");
    await page.goto("/cuti/baru");
    await page.locator('select[name="jenisId"]').selectOption({ label: "Duka (min H-0)" });
    const { mulai } = seninDepan(2);
    await page.locator('input[name="tglMulai"]').fill(mulai);
    await page.locator('input[name="tglSelesai"]').fill("2020-01-01");
    await page.locator('textarea[name="alasan"]').fill("Tanggal terbalik untuk uji validasi server");
    await page.getByRole("button", { name: "Kirim Pengajuan" }).click();
    await expect(page.getByText("Tanggal selesai sebelum tanggal mulai")).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/cuti\/baru/);
  });

  test("validasi: akhir pekan saja ditolak (tidak ada hari kerja)", async ({ page }) => {
    await login(page, "karyawan3");
    await page.goto("/cuti/baru");
    await page.locator('select[name="jenisId"]').selectOption({ label: "Duka (min H-0)" });
    const { mulai, selesai } = sabtuDepan();
    await page.locator('input[name="tglMulai"]').fill(mulai);
    await page.locator('input[name="tglSelesai"]').fill(selesai);
    await page.locator('textarea[name="alasan"]').fill("Akhir pekan saja untuk uji validasi hari kerja");
    await page.getByRole("button", { name: "Kirim Pengajuan" }).click();
    await expect(page.getByText("tidak memuat hari kerja")).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/cuti\/baru/);
  });
});
