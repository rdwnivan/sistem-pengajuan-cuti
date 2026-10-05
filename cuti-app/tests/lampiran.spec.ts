import { test, expect, login, isoLocal } from "./helpers";
import type { Page } from "@playwright/test";

/**
 * Upload lampiran cuti: wajib-lampiran kosong, file valid diterima,
 * file spoof (magic bytes tidak cocok) ditolak. Serial (worker 1).
 * Halaman /cuti/baru tidak memakai Shell → tidak ada duplikasi children.
 */
test.describe.configure({ mode: "serial" });

function seninSetelah(minHari: number): { mulai: string; selesai: string } {
  const d = new Date();
  d.setDate(d.getDate() + minHari);
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  const mulai = isoLocal(d);
  const besok = new Date(d);
  besok.setDate(besok.getDate() + 1);
  return { mulai, selesai: isoLocal(besok) };
}

const PNG_VALID = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 0x42)]);
const PNG_SPOOF = Buffer.from("<html><script>alert(1)</script></html>", "utf8");

async function bukaForm(page: Page, jenisLabel: string, mulai: string, selesai: string) {
  await page.goto("/cuti/baru");
  await page.waitForFunction(() => document.querySelectorAll('select[name="jenisId"] option').length > 1, {}, { timeout: 8000 });
  await page.locator('select[name="jenisId"]').selectOption({ label: jenisLabel });
  await page.locator('input[name="tglMulai"]').fill(mulai);
  await page.locator('input[name="tglSelesai"]').fill(selesai);
  await page.locator('textarea[name="alasan"]').fill("Uji lampiran pengajuan cuti otomatis");
}

test("jenis wajib lampiran tanpa file ditolak", async ({ page }) => {
  await login(page, "karyawan");
  const r = seninSetelah(14);
  await bukaForm(page, "Melahirkan (min H-7)", r.mulai, r.selesai);
  await page.getByRole("button", { name: "Kirim Pengajuan" }).click();
  await expect(page.getByText(/Lampiran wajib untuk jenis cuti ini/).first()).toBeVisible({ timeout: 10000 });
  await expect(page).toHaveURL(/\/cuti\/baru/);
});

test("file valid (PNG) diterima dan tampil di detail", async ({ page }) => {
  await login(page, "karyawan");
  const r = seninSetelah(5); // 2 hari kerja → Sakit butuh lampiran (>1 hari)
  await bukaForm(page, "Sakit (min H-0)", r.mulai, r.selesai);
  await page.locator('input[name="lampiran"]').setInputFiles({ name: "bukti.png", mimeType: "image/png", buffer: PNG_VALID });
  await page.getByRole("button", { name: "Kirim Pengajuan" }).click();
  await page.waitForURL(/\/cuti\/[a-zA-Z0-9]{20,}$/, { timeout: 20000 });
  await expect(page.getByRole("link", { name: "Lihat lampiran" }).first()).toBeVisible();

  // Cleanup
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Batalkan Pengajuan" }).click();
  await page.waitForURL("/", { timeout: 20000 });
});

test("file spoof (HTML diklaim PDF) ditolak", async ({ page }) => {
  await login(page, "karyawan");
  const r = seninSetelah(5);
  await bukaForm(page, "Sakit (min H-0)", r.mulai, r.selesai);
  await page.locator('input[name="lampiran"]').setInputFiles({ name: "palsu.pdf", mimeType: "application/pdf", buffer: PNG_SPOOF });
  await page.getByRole("button", { name: "Kirim Pengajuan" }).click();
  await expect(page.getByText(/tidak sesuai jenis yang diklaim/).first()).toBeVisible({ timeout: 10000 });
  await expect(page).toHaveURL(/\/cuti\/baru/);
});
