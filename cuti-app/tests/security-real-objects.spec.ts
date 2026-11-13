import { PrismaClient } from "@prisma/client";
import { test, expect, login } from "./helpers";

// Real records are required: a missing ID exercises 404, not ownership checks.
const db = new PrismaClient();
let cutiId: string;
let slipId: string;
let laporanId: string;

test.beforeAll(async () => {
  const owner = await db.user.findUniqueOrThrow({ where: { email: "karyawan1@anime.id" } });
  const jenis = await db.jenisCuti.findUniqueOrThrow({ where: { nama: "Tahunan" } });
  const cuti = await db.pengajuan.create({ data: {
    pemohonId: owner.id, jenisId: jenis.id, tglMulai: new Date("2099-01-05"),
    tglSelesai: new Date("2099-01-05"), jumlahHariKerja: 1,
    alasan: "Fixture otorisasi objek nyata", status: "DISETUJUI",
  } });
  cutiId = cuti.id;
  const slip = await db.slipGaji.create({ data: {
    userId: owner.id, tahun: 2099, bulan: 12, gajiPokok: 1000000,
    gajiBersih: 1000000, status: "TERBIT",
  } });
  slipId = slip.id;
  const laporan = await db.laporanLapangan.create({ data: {
    pembuatId: owner.id, approverId: owner.atasanId,
    tglLaporan: new Date("2099-01-05"), lokasi: "Lokasi uji",
    judul: "Fixture otorisasi", isi: "Konten privat untuk pengujian akses", status: "DISETUJUI",
  } });
  laporanId = laporan.id;
});

test.afterAll(async () => {
  try {
    if (laporanId) await db.laporanLapangan.delete({ where: { id: laporanId } });
    if (slipId) await db.slipGaji.delete({ where: { id: slipId } });
    if (cutiId) await db.pengajuan.delete({ where: { id: cutiId } });
  } finally {
    await db.$disconnect();
  }
});

for (const preview of [false, true]) {
  test(`PDF slip nyata milik pengguna lain ditolak${preview ? " pada preview" : " pada unduhan"}`, async ({ page }) => {
    await login(page, "karyawan2");
    const response = await page.request.get(`/api/slip/${slipId}${preview ? "?lihat=1" : ""}`);
    expect(response.status()).toBe(403);
  });
  test(`PDF cuti nyata milik pengguna lain ditolak${preview ? " pada preview" : " pada unduhan"}`, async ({ page }) => {
    await login(page, "karyawan2");
    const response = await page.request.get(`/api/formulir/${cutiId}${preview ? "?lihat=1" : ""}`);
    expect(response.status()).toBe(403);
  });
}

test("JSON laporan nyata milik pengguna lain ditolak", async ({ page }) => {
  await login(page, "karyawan2");
  expect((await page.request.get(`/api/laporan-lapangan/${laporanId}`)).status()).toBe(403);
});

test("PDF laporan nyata milik pengguna lain ditolak", async ({ page }) => {
  await login(page, "karyawan2");
  expect((await page.request.get(`/api/laporan-lapangan/${laporanId}?format=pdf&lihat=1`)).status()).toBe(403);
});

test("putusan API laporan pengguna lain ditolak dan tidak mengubah status", async ({ page }) => {
  await login(page, "karyawan2");
  const response = await page.request.post(`/api/laporan-lapangan/${laporanId}`, { multipart: { aksi: "tolak", catatan: "Uji akses ilegal" } });
  expect(response.status()).toBe(403);
  expect((await db.laporanLapangan.findUniqueOrThrow({ where: { id: laporanId } })).status).toBe("DISETUJUI");
});

test("halaman cuti nyata pengguna lain tidak membocorkan detail", async ({ page }) => {
  await login(page, "karyawan2");
  expect((await page.request.get(`/cuti/${cutiId}`)).status()).toBe(404);
});

test("pemilik tetap dapat mengunduh ketiga dokumen nyata", async ({ page }) => {
  await login(page, "karyawan");
  for (const route of [`/api/slip/${slipId}`, `/api/formulir/${cutiId}`, `/api/laporan-lapangan/${laporanId}?format=pdf`]) {
    const response = await page.request.get(route);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/pdf");
    expect((await response.body()).subarray(0, 5).toString()).toBe("%PDF-");
  }
});

test("atasan tim lain tidak dapat membaca JSON laporan nyata", async ({ page }) => {
  await login(page, "atasan2");
  expect((await page.request.get(`/api/laporan-lapangan/${laporanId}`)).status()).toBe(403);
});
