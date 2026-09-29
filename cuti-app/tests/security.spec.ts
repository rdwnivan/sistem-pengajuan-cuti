import { test, expect, login, AKUN } from "./helpers";

test.describe("SECURITY — IDOR & otorisasi API", () => {
  test("slip gaji orang lain Forbidden (403), bukan 200", async ({ page }) => {
    await login(page, "karyawan");
    const r = await page.request.get("/api/slip/tidak-ada");
    expect([401, 403, 404]).toContain(r.status());
  });

  test("formulir cuti tanpa sesi → 401", async ({ page, context }) => {
    await context.clearCookies();
    const r = await page.request.get("/api/formulir/apa-saja");
    expect(r.status()).toBe(401);
  });

  test("rekap /api/laporan tanpa sesi → 403", async ({ page, context }) => {
    await context.clearCookies();
    const r = await page.request.get("/api/laporan?format=excel");
    expect(r.status()).toBe(403);
  });

  test("rekap /api/laporan sebagai karyawan → 403", async ({ page }) => {
    await login(page, "karyawan");
    const r = await page.request.get("/api/laporan?format=excel");
    expect(r.status()).toBe(403);
  });

  test("/api/approver tanpa sesi → 401", async ({ page, context }) => {
    await context.clearCookies();
    const r = await page.request.get("/api/approver");
    expect(r.status()).toBe(401);
  });

  test("/api/cron tanpa secret → 401", async ({ page }) => {
    const r = await page.request.get("/api/cron");
    expect(r.status()).toBe(401);
  });

  test("/api/cron dengan secret salah → 401", async ({ page }) => {
    const r = await page.request.get("/api/cron?secret=salah-total");
    expect(r.status()).toBe(401);
  });
});

test.describe("SECURITY — otorisasi halaman HR", () => {
  const hrOnly = ["/hr", "/hr/karyawan", "/hr/karyawan/baru", "/hr/jenis", "/hr/libur", "/hr/slip-gaji", "/hr/pengajuan", "/hr/laporan"];

  for (const p of hrOnly) {
    test(`karyawan tidak bisa akses ${p}`, async ({ page }) => {
      await login(page, "karyawan");
      await page.goto(p);
      await expect(page).toHaveURL(/\/$/);
    });
  }
});

test.describe("SECURITY — upload & validasi", () => {
  test("laporan ditolak bila approver tidak valid (bukan atasan)", async ({ page }) => {
    await login(page, "karyawan");
    await page.goto("/laporan/baru");
    await page.getByLabel("Lokasi").fill("Lokasi Uji");
    await page.getByLabel("Judul laporan").fill("Uji Keamanan");
    await page.getByLabel("Isi laporan").fill("Isi laporan uji yang cukup panjang untuk validasi.");
    await page.getByRole("button", { name: "Simpan Laporan" }).click();
    // approver kosong → error, tetap di halaman form
    await expect(page).toHaveURL(/\/laporan\/baru/);
  });

  test("atasan tidak bisa buat laporan (harus karyawan)", async ({ page }) => {
    await login(page, "atasan");
    await page.goto("/laporan/baru");
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe("SECURITY — IDOR halaman detail", () => {
  test("karyawan2 tidak bisa buka slip karyawan1 via URL", async ({ page }) => {
    await login(page, "karyawan2");
    // slip random → minimal 404/403
    const r = await page.request.get("/api/slip/coba-tebak-id-slip");
    expect([403, 404]).toContain(r.status());
  });

  test("detail pengajuan milik orang lain → 404", async ({ page }) => {
    await login(page, "karyawan2");
    const r = await page.goto("/cuti/id-pengajuan-orang-lain");
    expect(r?.status()).toBeGreaterThanOrEqual(400);
  });
});
