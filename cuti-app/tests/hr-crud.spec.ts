import { test, expect, login } from "./helpers";

/**
 * HR CRUD: jenis cuti, hari libur, karyawan.
 * Serial (worker 1) karena mengubah konfigurasi global & membuat user.
 * NB: Shell me-render children 2× → semua locator pakai .first().
 */
test.describe.configure({ mode: "serial" });

function uniq(prefix: string) {
  return `${prefix} ${Date.now()}`;
}
function tanggalLiburUnik() {
  // Tanggal jauh di masa depan + hari acak → minim bentrok unik.
  const hari = String((Date.now() % 27) + 1).padStart(2, "0");
  const bulan = String((Math.floor(Date.now() / 1000) % 12) + 1).padStart(2, "0");
  return `2087-${bulan}-${hari}`;
}

test("HR tambah jenis cuti (nonaktif) muncul di daftar", async ({ page }) => {
  await login(page, "hr");
  await page.goto("/hr/jenis");
  const nama = uniq("Uji Jenis");
  const formTambah = page.locator("form").first();
  await formTambah.getByLabel("Nama").fill(nama);
  // Nonaktifkan agar tidak muncul di dropdown Ajukan / dashboard.
  await formTambah.getByLabel("Aktif").uncheck();
  await formTambah.getByRole("button", { name: "Tambah" }).click();
  await expect(page.getByText(nama).first()).toBeVisible({ timeout: 15000 });
  await expect(page.locator("div", { hasText: nama }).first()).toContainText("(nonaktif)");
});

test("HR tambah lalu hapus hari libur (confirm)", async ({ page }) => {
  await login(page, "hr");
  await page.goto("/hr/libur");
  const ket = uniq("Libur Uji");
  const formTambah = page.locator("form").first();
  await formTambah.getByLabel("Tanggal").fill(tanggalLiburUnik());
  await formTambah.getByLabel("Keterangan").fill(ket);
  await formTambah.getByRole("button", { name: "Tambah" }).click();
  await expect(page.getByText(ket).first()).toBeVisible({ timeout: 15000 });

  const row = page.locator("form", { hasText: ket }).first();
  page.once("dialog", (d) => d.accept());
  await row.getByRole("button", { name: "Hapus" }).click();
  await expect(page.getByText(ket)).toHaveCount(0, { timeout: 15000 });
});

test("HR buat, edit, lalu nonaktifkan karyawan (confirm)", async ({ page }) => {
  await login(page, "hr");
  await page.goto("/hr/karyawan/baru");
  const nama = uniq("Uji Karyawan");
  const email = `uji${Date.now()}@anime.id`;
  const nip = String(Date.now()).slice(-8);
  let f = page.locator("form").first();
  await f.getByLabel("Nama").fill(nama);
  await f.getByLabel("Email").fill(email);
  await f.getByLabel("NIP").fill(nip);
  await f.getByLabel("Password", { exact: true }).fill("anime123");
  await f.getByLabel("Tanggal masuk").fill("2024-01-15");
  await f.getByRole("button", { name: "Simpan" }).click();
  await page.waitForURL(/\/hr\/karyawan\/?$/, { timeout: 20000 });
  await expect(page.locator("a", { hasText: nama }).first()).toBeVisible();

  // Buka edit
  await page.locator("a", { hasText: nama }).first().click();
  await page.waitForURL(/\/hr\/karyawan\/[a-z0-9]+$/, { timeout: 15000 });

  // Edit jabatan + nonaktifkan (butuh konfirmasi)
  f = page.locator("form").first();
  await f.getByLabel("Jabatan").fill("Staff Uji");
  await f.getByLabel("Akun aktif").uncheck();
  page.once("dialog", (d) => d.accept());
  await f.getByRole("button", { name: "Simpan" }).click();
  await page.waitForURL(/\/hr\/karyawan\/?$/, { timeout: 20000 });
  await expect(page.locator("a", { hasText: nama }).first()).toContainText("(nonaktif)");
});
