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
