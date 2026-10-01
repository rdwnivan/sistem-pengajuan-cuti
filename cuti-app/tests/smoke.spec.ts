import { test, expect, login, AKUN } from "./helpers";

test.describe("Smoke — autentikasi", () => {
  test("halaman login tampil dan bisa login", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Cuti Anime Japan" })).toBeVisible();

    await login(page, "karyawan");
    await expect(page).toHaveURL("/");
    await expect(page.getByText(/Karyawan/)).toBeVisible();
  });

  test("kredensial salah ditolak", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(AKUN.karyawan.email);
    await page.locator("#password").fill("passwordsalah");
    await page.getByRole("button", { name: "Masuk" }).click();
    await expect(page.getByText("Email atau password salah")).toBeVisible();
  });

  test("rute terlindungi redirect ke login", async ({ page }) => {
    await page.goto("/slip-gaji");
    await expect(page).toHaveURL(/\/login/);
  });

  test("tombol Keluar logout dan redirect ke login", async ({ page }) => {
    await login(page, "karyawan");
    await expect(page).toHaveURL("/");
    await page.getByRole("button", { name: /^Keluar/ }).click();
    await page.waitForURL(/\/login/, { timeout: 15000 });
    // Sesi sudah mati: halaman terproteksi redirect lagi ke login
    await page.goto("/slip-gaji");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Smoke — navigasi", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "karyawan");
  });

  test("dashboard memuat link slip gaji dan laporan", async ({ page }) => {
    await expect(page.getByRole("link", { name: "Slip Gaji" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Laporan Lapangan" }).first()).toBeVisible();
  });

  test("halaman slip gaji terbuka", async ({ page }) => {
    await page.goto("/slip-gaji");
    await expect(page.getByRole("heading", { name: "Slip Gaji Saya" }).first()).toBeVisible();
  });

  test("halaman laporan terbuka", async ({ page }) => {
    await page.goto("/laporan");
    await expect(page.getByRole("heading", { name: "Laporan Lapangan" }).first()).toBeVisible();
  });
});

test.describe("Smoke — profil notifikasi WA", () => {
  test("simpan no HP + toggle mati/nyala tersimpan dan tampil", async ({ page }) => {
    await login(page, "karyawan");
    await page.goto("/profil");
    await expect(page.getByText("Notifikasi WhatsApp").first()).toBeVisible();

    await page.locator('input[name="noHp"]').first().fill("08123456789");
    const box = page.locator('input[name="notifWa"]').first();
    if (await box.isChecked()) await box.uncheck();
    await page.getByRole("button", { name: "Simpan Profil" }).click();
    await page.waitForURL(/\/profil\?ok=2/, { timeout: 15000 });
    await expect(page.getByText("Profil berhasil disimpan.").first()).toBeVisible();
    await expect(page.getByText(/Notif WA: Mati/).first()).toBeVisible();

    // Restore: nyalakan lagi agar tidak memengaruhi test lain
    await page.locator('input[name="notifWa"]').first().check();
    await page.getByRole("button", { name: "Simpan Profil" }).click();
    await page.waitForURL(/\/profil\?ok=2/, { timeout: 15000 });
    await expect(page.getByText(/Notif WA: Aktif/).first()).toBeVisible();
  });
});
