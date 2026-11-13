import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createECDH, randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { createServer } from "node:net";
import { test, expect, login } from "./helpers";
import { terbitkanSesi } from "../src/lib/sesi-store";

test("push menolak endpoint internal sebelum menyimpannya", async ({ page }) => {
  const db = new PrismaClient();
  const endpoint = `https://127.0.0.1:19443/${randomUUID()}`;
  const key = createECDH("prime256v1"); key.generateKeys();
  try {
    await login(page, "karyawan");
    const response = await page.request.post("/api/push/subscribe", { data: {
      endpoint, keys: { p256dh: key.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") },
    } });
    expect(response.status()).toBe(400);
    expect(await db.pushSubscription.count({ where: { endpoint } })).toBe(0);
  } finally {
    await db.pushSubscription.deleteMany({ where: { endpoint } });
    await db.$disconnect();
  }
});

test("push menolak tipe body yang salah dengan 400", async ({ page }) => {
  await login(page, "karyawan");
  for (const body of [null, [], { endpoint: {}, keys: { p256dh: "x", auth: "x" } }]) {
    expect((await page.request.post("/api/push/subscribe", { data: JSON.stringify(body), headers: { "content-type": "application/json" } })).status()).toBe(400);
    expect((await page.request.delete("/api/push/subscribe", { data: JSON.stringify(body), headers: { "content-type": "application/json" } })).status()).toBe(400);
  }
});

test("subscription internal yang sudah tersimpan tidak menyebabkan koneksi saat approval", async ({ page }) => {
  const db = new PrismaClient();
  const key = createECDH("prime256v1"); key.generateKeys();
  let connections = 0;
  const receiver = createServer((socket) => { connections++; socket.destroy(); });
  await new Promise<void>((resolve, reject) => { receiver.once("error", reject); receiver.listen(0, "127.0.0.1", resolve); });
  const address = receiver.address();
  if (!address || typeof address === "string") throw new Error("Receiver audit tidak tersedia");
  const owner = await db.user.findUniqueOrThrow({ where: { email: "karyawan1@anime.id" } });
  const endpoint = `https://127.0.0.1:${address.port}/${randomUUID()}`;
  const subscription = await db.pushSubscription.create({ data: { userId: owner.id, endpoint, p256dh: key.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") } });
  const report = await db.laporanLapangan.create({ data: { pembuatId: owner.id, approverId: owner.atasanId, tglLaporan: new Date(), lokasi: "Uji lokal", judul: "Fixture push aman", isi: "Receiver internal tidak boleh dihubungi", status: "MENUNGGU" } });
  try {
    await login(page, "atasan");
    expect((await (await page.request.get("/api/push/subscribe")).json()).publicKey).toBeTruthy();
    expect((await page.request.post(`/api/laporan-lapangan/${report.id}`, { multipart: { aksi: "setuju", catatan: "Uji lokal" } })).status()).toBe(200);
    expect(connections).toBe(0);
  } finally {
    await db.auditLog.deleteMany({ where: { laporanId: report.id } });
    await db.notifikasi.deleteMany({ where: { laporanId: report.id } });
    await db.laporanLapangan.delete({ where: { id: report.id } });
    await db.pushSubscription.delete({ where: { id: subscription.id } });
    await new Promise<void>((resolve, reject) => receiver.close((error) => error ? reject(error) : resolve()));
    await db.$disconnect();
  }
});

test("ganti password mencabut semua cookie lama dan mempertahankan sesi baru", async ({ page, context, browser }) => {
  const db = new PrismaClient();
  const token = randomBytes(32).toString("hex");
  const tokenLain = randomBytes(32).toString("hex");
  const user = await db.user.create({ data: { nama: "Uji Pencabutan Sesi", email: `session-${randomUUID()}@anime.id`, passwordHash: await bcrypt.hash("anime123", 10) } });
  const other = await browser.newContext({ baseURL: "http://localhost:3000" });
  try {
    await db.sesi.createMany({ data: [token, tokenLain].map((value) => ({ token: value, userId: user.id, expiresAt: new Date(Date.now() + 86400000) })) });
    await context.addCookies([{ name: "sesi-cuti", value: token, url: "http://localhost:3000" }]);
    await other.addCookies([{ name: "sesi-cuti", value: tokenLain, url: "http://localhost:3000" }]);
    await page.goto("/profil");
    await page.locator('input[name="lama"]:visible').fill("anime123");
    await page.locator('input[name="baru"]:visible').fill("password-baru-audit");
    await page.getByRole("button", { name: "Simpan Password", exact: true }).click();
    await expect(page).toHaveURL(/\/profil\?ok=1/);
    expect((await other.request.get("/api/approver")).status()).toBe(401);
    expect(await db.sesi.count({ where: { token: { in: [token, tokenLain] } } })).toBe(0);
    expect((await page.request.get("/api/approver")).status()).toBe(200);
  } finally {
    await other.close();
    await db.sesi.deleteMany({ where: { userId: user.id } });
    await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  }
});

test("login yang sudah memeriksa hash lama tidak menerbitkan sesi setelah reset", async () => {
  const db = new PrismaClient();
  const oldHash = await bcrypt.hash("password-awal", 10);
  const user = await db.user.create({ data: { nama: "Race Sesi", email: `race-${randomUUID()}@anime.id`, passwordHash: oldHash } });
  const oldAttemptToken = randomBytes(32).toString("hex");
  const newHash = await bcrypt.hash("password-reset", 10);
  try {
    // Deterministic ordering: an in-flight login has already verified oldHash.
    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { passwordHash: newHash } }),
      db.sesi.deleteMany({ where: { userId: user.id } }),
    ]);
    expect(await terbitkanSesi(user.id, oldHash, oldAttemptToken, new Date(Date.now() + 60000))).toBe(false);
    expect(await db.sesi.count({ where: { token: oldAttemptToken } })).toBe(0);
    expect(await terbitkanSesi(user.id, newHash, randomBytes(32).toString("hex"), new Date(Date.now() + 60000))).toBe(true);
  } finally {
    await db.sesi.deleteMany({ where: { userId: user.id } });
    await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  }
});

test("reset password oleh HR mencabut sesi target", async ({ page, browser }) => {
  const db = new PrismaClient();
  const token = randomBytes(32).toString("hex");
  const user = await db.user.create({ data: { nama: "Fixture Reset HR", email: `reset-${randomUUID()}@anime.id`, nip: `9${Date.now()}`, passwordHash: await bcrypt.hash("password-awal", 10) } });
  const target = await browser.newContext({ baseURL: "http://localhost:3000" });
  try {
    await db.sesi.create({ data: { userId: user.id, token, expiresAt: new Date(Date.now() + 60000) } });
    await target.addCookies([{ name: "sesi-cuti", value: token, url: "http://localhost:3000" }]);
    expect((await target.request.get("/api/approver")).status()).toBe(200);
    await login(page, "hr");
    await page.goto(`/hr/karyawan/${user.id}`);
    await page.locator('input[name="password"]').fill("password-reset-hr");
    await page.getByRole("button", { name: "Simpan", exact: true }).click();
    await expect(page).toHaveURL(/\/hr\/karyawan\/?$/);
    expect((await target.request.get("/api/approver")).status()).toBe(401);
    expect(await bcrypt.compare("password-reset-hr", (await db.user.findUniqueOrThrow({ where: { id: user.id } })).passwordHash)).toBe(true);
  } finally {
    await target.close();
    await db.sesi.deleteMany({ where: { userId: user.id } });
    await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  }
});

test("laporan mobile tidak melebar dan shell hanya memasang satu form", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "karyawan");
  await page.goto("/laporan");
  await expect(page.getByRole("heading", { name: "Laporan Lapangan" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.getByRole("link", { name: "Dikembalikan", exact: true })).toBeInViewport();
  await page.goto("/profil");
  await expect(page.locator('input[name="lama"]')).toHaveCount(1);
});

test("lampiran lama hanya terbaca melalui otorisasi dan URL publik ditutup", async ({ page, browser }) => {
  const db = new PrismaClient();
  const filename = `legacy-${randomUUID()}.png`;
  const root = path.join(process.cwd(), "public", "uploads");
  const bytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jk9sAAAAASUVORK5CYII=", "base64");
  const owner = await db.user.findUniqueOrThrow({ where: { email: "karyawan1@anime.id" } });
  const jenis = await db.jenisCuti.findUniqueOrThrow({ where: { nama: "Sakit" } });
  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, filename), bytes, { flag: "wx" });
  const record = await db.pengajuan.create({ data: { pemohonId: owner.id, jenisId: jenis.id, tglMulai: new Date("2099-01-06"), tglSelesai: new Date("2099-01-06"), jumlahHariKerja: 1, alasan: "Fixture lampiran lama privat", lampiranPath: `/uploads/${filename}`, status: "DIBATALKAN" } });
  const anonymous = await browser.newContext({ baseURL: "http://localhost:3000" });
  try {
    for (const url of [`/uploads/${filename}`, `/uploads%2F${filename}`, `/Uploads/${filename}`, `/.private/uploads/${filename}`]) expect((await anonymous.request.get(url)).status()).toBe(404);
    expect((await anonymous.request.get(`/api/lampiran/cuti/${record.id}`)).status()).toBe(401);
    await login(page, "karyawan");
    const response = await page.request.get(`/api/lampiran/cuti/${record.id}`);
    expect(response.status()).toBe(200);
    expect(await response.body()).toEqual(bytes);
    await login(page, "atasan");
    expect((await page.request.get(`/api/lampiran/cuti/${record.id}`)).status()).toBe(200);
    await login(page, "karyawan2");
    expect((await page.request.get(`/api/lampiran/cuti/${record.id}`)).status()).toBe(404);
  } finally {
    await anonymous.close();
    await db.pengajuan.delete({ where: { id: record.id } });
    await unlink(path.join(root, filename));
    await db.$disconnect();
  }
});
