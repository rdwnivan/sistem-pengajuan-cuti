import { test, expect, login, rentangDelegasi, seninDepan } from "./helpers";

// Serial: semua test di file ini berbagi 1 baris delegasi atasan1→atasan2.
// NB: Shell me-render children 2× (desktop + mobile) → semua locator pakai .first().
test.describe.configure({ mode: "serial" });

test.describe("Delegasi — atasan menunjuk pengganti", () => {
  test("atasan1 mendelegasikan ke atasan2, lalu membatalkan", async ({ page }) => {
    await login(page, "atasan");
    await page.goto("/delegasi");
    await expect(page.getByRole("heading", { name: "Delegasi Persetujuan" })).toBeVisible();

    const { mulai, selesai } = rentangDelegasi();
    await page.locator('select[name="keId"]').first().selectOption({ label: "Atasan Dua (atasan2@anime.id)" });
    await page.locator('input[name="tglMulai"]').first().fill(mulai);
    await page.locator('input[name="tglSelesai"]').first().fill(selesai);
    await page.getByRole("button", { name: "Simpan Delegasi" }).first().click();
    await page.waitForURL("/delegasi", { timeout: 15_000 });
    // Kartu daftar delegasi menampilkan nama penerima (bukan <option> dropdown)
    await expect(page.locator("form", { hasText: "Atasan Dua" }).first()).toBeVisible();

    // Batalkan agar tidak memengaruhi test lain.
    // NB: aksiBatalDelegasi hanya set aktif=false — baris lama tetap tampil "(nonaktif)".
    await page.getByRole("button", { name: "Batalkan" }).first().click();
    await page.waitForURL("/delegasi", { timeout: 15_000 });
    await expect(page.getByText("(nonaktif)").first()).toBeVisible({ timeout: 15_000 });
  });

  test("validasi: submit tanpa penerima tetap di halaman", async ({ page }) => {
    await login(page, "atasan2");
    await page.goto("/delegasi");
    const { mulai, selesai } = rentangDelegasi();
    await page.locator('input[name="tglMulai"]').first().fill(mulai);
    await page.locator('input[name="tglSelesai"]').first().fill(selesai);
    await page.getByRole("button", { name: "Simpan Delegasi" }).first().click();
    // required pada select mencegah submit — tetap di halaman delegasi
    await expect(page).toHaveURL(/\/delegasi/);
  });

  test("karyawan tidak bisa buka halaman delegasi", async ({ page }) => {
    await login(page, "karyawan");
    await page.goto("/delegasi");
    await expect(page).toHaveURL(/\/$/);
  });

  /**
   * Persetujuan via delegasi, end-to-end dalam satu test:
   * 1. atasan1 delegasi → atasan2
   * 2. karyawan1 (bawahan atasan1) ajukan cuti → approverId = atasan2 (via delegasi)
   * 3. atasan2 melihat badge "delegasi" di antrean dan menyetujui
   * 4. cleanup: pemilik membatalkan + delegasi dibatalkan
   */
  test("atasan2 menyetujui cuti bawahan atasan1 selama delegasi aktif", async ({ page }) => {
    // 1. atasan1 → atasan2
    await login(page, "atasan");
    await page.goto("/delegasi");
    const { mulai, selesai } = rentangDelegasi();
    await page.locator('select[name="keId"]').first().selectOption({ label: "Atasan Dua (atasan2@anime.id)" });
    await page.locator('input[name="tglMulai"]').first().fill(mulai);
    await page.locator('input[name="tglSelesai"]').first().fill(selesai);
    await page.getByRole("button", { name: "Simpan Delegasi" }).first().click();
    await page.waitForURL("/delegasi", { timeout: 15_000 });

    // 2. karyawan1 ajukan cuti
    const cuti = seninDepan();
    await login(page, "karyawan");
    await page.goto("/cuti/baru");
    await page.locator('select[name="jenisId"]').selectOption({ label: "Duka (min H-0)" });
    await page.locator('input[name="tglMulai"]').fill(cuti.mulai);
    await page.locator('input[name="tglSelesai"]').fill(cuti.selesai);
    await page.locator('textarea[name="alasan"]').fill("Cuti via delegasi untuk uji persetujuan delegasi aktif");
    await page.getByRole("button", { name: "Kirim Pengajuan" }).click();
    await page.waitForURL(/\/cuti\/[a-z0-9]{20,}$/, { timeout: 20_000 });
    const url = page.url();

    // 3. atasan2 melihat badge delegasi di antrean dan menyetujui
    await login(page, "atasan2");
    await page.goto("/persetujuan");
    await expect(page.getByText("delegasi").first()).toBeVisible({ timeout: 15_000 });
    await page.goto(url);
    await expect(page.getByRole("heading", { name: "Detail Pengajuan" })).toBeVisible({ timeout: 15_000 });
    await page.locator('button[name="aksi"][value="setuju"]').click();
    await expect(page.getByText("Menunggu HR").first()).toBeVisible({ timeout: 15_000 });

    // 4. cleanup: pemilik membatalkan (antrean HR kembali kosong), lalu batalkan delegasi
    await login(page, "karyawan");
    await page.goto(url);
    await expect(page.getByRole("heading", { name: "Detail Pengajuan" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Batalkan Pengajuan" }).click();
    await page.waitForURL("/", { timeout: 15_000 });

    await login(page, "atasan");
    await page.goto("/delegasi");
    await page.getByRole("button", { name: "Batalkan" }).first().click();
    await expect(page.getByText("(nonaktif)").first()).toBeVisible({ timeout: 15_000 });
  });
});
