import { test, expect, login, isoLocal } from "./helpers";
import type { Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

/**
 * Validasi bisnis pengajuan cuti (guard di server action):
 * min H-, masa kerja, anti-bentrok, kuota tidak cukup.
 * Serial (worker 1); test yang membuat data membersihkan diri.
 */
test.describe.configure({ mode: "serial" });

/** Senin–Selasa, minimal `minHari` hari dari sekarang (dijamin hari kerja). */
function seninSetelah(minHari: number): { mulai: string; selesai: string } {
  const d = new Date();
  d.setDate(d.getDate() + minHari);
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); // Senin berikutnya
  const mulai = isoLocal(d);
  const besok = new Date(d);
  besok.setDate(besok.getDate() + 1);
  return { mulai, selesai: isoLocal(besok) };
}

/** Senin–Selasa pada (tahun sekarang + offset), untuk isolasi per-tahun. */
function seninDiTahunOffset(offset: number): { mulai: string; selesai: string } {
  const d = new Date();
  d.setFullYear(d.getFullYear() + offset);
  d.setMonth(5, 10); // 10 Juni
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  const mulai = isoLocal(d);
  const besok = new Date(d);
  besok.setDate(besok.getDate() + 1);
  return { mulai, selesai: isoLocal(besok) };
}

function dbUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const m = fs.readFileSync(path.resolve(__dirname, "..", ".env"), "utf8").match(/^DATABASE_URL="([^"]+)"/m);
  return m?.[1] ?? "";
}

async function isiDanKirim(page: Page, jenisLabel: string, mulai: string, selesai: string, alasan: string) {
  await page.goto("/cuti/baru");
  await page.waitForFunction(() => document.querySelectorAll('select[name="jenisId"] option').length > 1, {}, { timeout: 8000 });
  await page.locator('select[name="jenisId"]').selectOption({ label: jenisLabel });
  await page.locator('input[name="tglMulai"]').fill(mulai);
  await page.locator('input[name="tglSelesai"]').fill(selesai);
  await page.locator('textarea[name="alasan"]').fill(alasan);
  await page.getByRole("button", { name: "Kirim Pengajuan" }).click();
}

test("validasi min H- ditolak (Tahunan min H-3, ajukan besok)", async ({ page }) => {
  await login(page, "karyawan");
  const besok = new Date();
  besok.setDate(besok.getDate() + 1);
  const lusa = new Date();
  lusa.setDate(lusa.getDate() + 2);
  await isiDanKirim(page, "Tahunan (min H-3)", isoLocal(besok), isoLocal(lusa), "Uji validasi minimal hari pengajuan");
  await expect(page.getByText(/Minimal pengajuan H-3/).first()).toBeVisible({ timeout: 10000 });
  await expect(page).toHaveURL(/\/cuti\/baru/);
});

test("validasi masa kerja ditolak (Besar butuh 60 bulan, karyawan baru)", async ({ page }) => {
  await login(page, "karyawan5");
  const r = seninSetelah(30);
  await isiDanKirim(page, "Besar (min H-14)", r.mulai, r.selesai, "Uji validasi masa kerja minimal");
  await expect(page.getByText(/butuh masa kerja 60 bulan/).first()).toBeVisible({ timeout: 10000 });
  await expect(page).toHaveURL(/\/cuti\/baru/);
});

test("anti-bentrok: pengajuan kedua yang tumpang tindih ditolak", async ({ page }) => {
  await login(page, "karyawan");
  const r = seninSetelah(60);
  await isiDanKirim(page, "Duka (min H-0)", r.mulai, r.selesai, "Pengajuan pertama untuk uji bentrok");
  await page.waitForURL(/\/cuti\/[a-zA-Z0-9]{20,}$/, { timeout: 20000 });
  const url = page.url();

  await isiDanKirim(page, "Duka (min H-0)", r.mulai, r.selesai, "Pengajuan kedua yang harus bentrok");
  await expect(page.getByText(/Bentrok dengan pengajuan lain/).first()).toBeVisible({ timeout: 10000 });

  // Cleanup: batalkan pengajuan pertama
  await page.goto(url);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Batalkan Pengajuan" }).click();
  await page.waitForURL("/", { timeout: 20000 });
});

test("kuota tidak cukup ditolak (kuota tahun tertentu dihabiskan)", async ({ page }) => {
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl() } } });
  const offset = 7;
  try {
    const kw = await prisma.user.findUnique({ where: { email: "karyawan1@anime.id" } });
    const jenis = await prisma.jenisCuti.findUnique({ where: { nama: "Menikah" } });
    if (!kw || !jenis) throw new Error("data seed tidak ditemukan");
    const tahun = new Date().getFullYear() + offset;
    await prisma.kuota.upsert({
      where: { userId_jenisId_tahun: { userId: kw.id, jenisId: jenis.id, tahun } },
      update: { jatah: 1, terpakai: 1 },
      create: { userId: kw.id, jenisId: jenis.id, tahun, jatah: 1, terpakai: 1 },
    });

    await login(page, "karyawan");
    const r = seninDiTahunOffset(offset);
    await isiDanKirim(page, "Menikah (min H-3)", r.mulai, r.selesai, "Uji validasi kuota tidak mencukupi");
    await expect(page.getByText(/Sisa kuota tidak cukup/).first()).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/cuti\/baru/);
  } finally {
    await prisma.$disconnect();
  }
});
