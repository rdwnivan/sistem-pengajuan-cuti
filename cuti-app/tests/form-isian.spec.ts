import { test, expect, login, AKUN } from "./helpers";

// Business errors only: these submissions must not create or update records.
test.describe.configure({ mode: "default" });

test("laporan mempertahankan teks, GPS, approver dan file setelah upload ditolak", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: -2.2, longitude: 113.9 });
  await login(page, "karyawan");
  await page.goto("/laporan/baru");
  const form = page.locator("form").first();
  await form.getByLabel("Tanggal laporan").fill("2026-11-10");
  await form.getByLabel("Lokasi", { exact: true }).fill("Kebun uji");
  await form.getByLabel("Blok / Afdeling").fill("Blok C7");
  await form.getByLabel("Kegiatan / pekerjaan").fill("Pemupukan");
  await form.getByLabel("Jumlah tenaga kerja").fill("7");
  await form.getByLabel("Hasil / output").fill("Tujuh petak");
  await form.getByLabel("Cuaca").fill("Mendung");
  await form.getByLabel("Shift", { exact: true }).fill("Pagi");
  await form.getByLabel("Judul laporan").fill("Laporan yang harus bertahan");
  await form.getByLabel("Isi laporan").fill("Seluruh isi laporan tetap ada setelah server menolak file.");
  await form.getByLabel("Kirim ke atasan").selectOption({ label: "Atasan Satu (Manajer Operasional)" });
  const approver = await form.getByLabel("Kirim ke atasan").inputValue();
  await form.getByRole("button", { name: "Ambil lokasi HP" }).click();
  await expect(form.locator('[name="lat"]')).toHaveValue("-2.2");
  await form.locator('[name="lampiran"]').setInputFiles({ name: "invalid.png", mimeType: "image/png", buffer: Buffer.from("<html>invalid</html>") });
  await form.getByRole("button", { name: "+ Tambah foto" }).click();
  await form.locator('[name="fotos"]').setInputFiles({ name: "bukti.png", mimeType: "image/png", buffer: Buffer.from("89504e470d0a1a0a", "hex") });
  await form.getByPlaceholder("Keterangan foto").fill("Petak tujuh");
  await form.getByRole("button", { name: "Simpan Laporan" }).click();
  await expect(form.getByText(/file tidak sesuai jenis yang diklaim/)).toBeVisible();
  await expect(form.getByLabel("Lokasi", { exact: true })).toHaveValue("Kebun uji");
  await expect(form.getByLabel("Tanggal laporan")).toHaveValue("2026-11-10");
  await expect(form.getByLabel("Blok / Afdeling")).toHaveValue("Blok C7");
  await expect(form.getByLabel("Kegiatan / pekerjaan")).toHaveValue("Pemupukan");
  await expect(form.getByLabel("Jumlah tenaga kerja")).toHaveValue("7");
  await expect(form.getByLabel("Hasil / output")).toHaveValue("Tujuh petak");
  await expect(form.getByLabel("Cuaca")).toHaveValue("Mendung");
  await expect(form.getByLabel("Shift", { exact: true })).toHaveValue("Pagi");
  await expect(form.getByLabel("Judul laporan")).toHaveValue("Laporan yang harus bertahan");
  await expect(form.getByLabel("Isi laporan")).toHaveValue("Seluruh isi laporan tetap ada setelah server menolak file.");
  await expect(form.getByLabel("Kirim ke atasan")).toHaveValue(approver);
  await expect(form.locator('[name="lng"]')).toHaveValue("113.9");
  await expect(form.getByPlaceholder("Keterangan foto")).toHaveValue("Petak tujuh");
  expect(await form.locator('[name="lampiran"]').evaluate((node: HTMLInputElement) => node.files?.[0]?.name)).toBe("invalid.png");
  expect(await form.locator('[name="fotos"]').evaluate((node: HTMLInputElement) => node.files?.[0]?.name)).toBe("bukti.png");
});

test("slip mempertahankan periode dan catatan ketika gaji bersih negatif", async ({ page }) => {
  await login(page, "hr");
  await page.goto("/hr/slip-gaji?buat=1");
  const form = page.locator("form").filter({ has: page.locator('[name="userId"]') }).first();
  await form.locator('[name="userId"]').selectOption({ label: "Karyawan 1 (Staff)" });
  await form.getByLabel("Tahun", { exact: true }).fill("2040");
  await form.locator('[name="bulan"]').selectOption("2");
  await form.locator('[name="potonganLain"]').fill("999999999");
  await form.getByLabel("Catatan (opsional)").fill("Rincian harus tetap tersimpan");
  await form.getByRole("button", { name: "Terbitkan Slip" }).click();
  await expect(form.getByText(/Potongan melebihi gaji/)).toBeVisible();
  await expect(form.getByLabel("Tahun", { exact: true })).toHaveValue("2040");
  await expect(form.locator('[name="bulan"]')).toHaveValue("2");
  await expect(form.getByLabel("Catatan (opsional)")).toHaveValue("Rincian harus tetap tersimpan");
  await expect(form.locator('[name="potonganLain"]')).toHaveValue("999999999");
});

test("karyawan baru mempertahankan identitas, checkbox dan password saat NIP duplikat", async ({ page }) => {
  await login(page, "hr");
  await page.goto("/hr/karyawan/baru");
  const form = page.locator("form").first();
  await form.getByLabel("Nama", { exact: true }).fill("Karyawan Isian Uji");
  await form.getByLabel("Email", { exact: true }).fill("isian-uji@example.test");
  await form.getByLabel("NIP", { exact: true }).fill("100001");
  await form.getByLabel("Password", { exact: true }).fill("uji-isian-123");
  await form.getByLabel("Tanggal masuk").fill("2024-03-12");
  await form.locator('[name="role"]').selectOption("HR_ADMIN");
  await form.getByLabel("Akun aktif").uncheck();
  await form.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(form.getByText("NIP sudah dipakai karyawan lain")).toBeVisible();
  await expect(form.getByLabel("Nama", { exact: true })).toHaveValue("Karyawan Isian Uji");
  await expect(form.getByLabel("Email", { exact: true })).toHaveValue("isian-uji@example.test");
  await expect(form.getByLabel("NIP", { exact: true })).toHaveValue("100001");
  await expect(form.getByLabel("Password", { exact: true })).toHaveValue("uji-isian-123");
  await expect(form.getByLabel("Tanggal masuk")).toHaveValue("2024-03-12");
  await expect(form.locator('[name="role"]')).toHaveValue("HR_ADMIN");
  await expect(form.getByLabel("Akun aktif")).not.toBeChecked();
});

test("jenis cuti mempertahankan angka dan checkbox saat nama duplikat", async ({ page }) => {
  await login(page, "hr");
  await page.goto("/hr/jenis");
  const form = page.locator("form").first();
  await form.getByLabel("Nama", { exact: true }).fill("Tahunan");
  await form.getByLabel("Kuota (hari)").fill("23");
  await form.getByLabel("Min H- (hari)").fill("7");
  await form.getByLabel("Potong kuota").uncheck();
  await form.getByLabel("Lampiran wajib", { exact: true }).check();
  await form.getByRole("button", { name: "Tambah", exact: true }).click();
  await expect(form.getByText("Nama jenis cuti sudah ada")).toBeVisible();
  await expect(form.getByLabel("Nama", { exact: true })).toHaveValue("Tahunan");
  await expect(form.getByLabel("Kuota (hari)")).toHaveValue("23");
  await expect(form.getByLabel("Min H- (hari)")).toHaveValue("7");
  await expect(form.getByLabel("Potong kuota")).not.toBeChecked();
  await expect(form.getByLabel("Lampiran wajib", { exact: true })).toBeChecked();
});

test("delegasi mempertahankan penerima dan tanggal saat rentang ditolak", async ({ page }) => {
  await login(page, "atasan");
  await page.goto("/delegasi");
  const form = page.locator("form").first();
  await form.getByLabel("Didelegasikan ke").selectOption({ label: "Atasan Dua (atasan2@anime.id)" });
  const penerima = await form.getByLabel("Didelegasikan ke").inputValue();
  await form.getByLabel("Mulai", { exact: true }).fill("2040-03-10");
  await form.getByLabel("Selesai", { exact: true }).fill("2040-03-09");
  await form.getByRole("button", { name: "Simpan Delegasi" }).click();
  await expect(form.getByText("Tanggal selesai sebelum mulai")).toBeVisible();
  await expect(form.getByLabel("Didelegasikan ke")).toHaveValue(penerima);
  await expect(form.getByLabel("Mulai", { exact: true })).toHaveValue("2040-03-10");
  await expect(form.getByLabel("Selesai", { exact: true })).toHaveValue("2040-03-09");
});

test("login mempertahankan isian lalu berhasil dikoreksi lewat keyboard", async ({ page }) => {
  await page.goto("/login");
  const form = page.locator("form").first();
  await form.getByLabel("Email", { exact: true }).fill(AKUN.karyawan.email);
  await form.locator("#password").fill("password-salah");
  await form.locator("#password").press("Enter");
  await expect(form.getByText("Email atau password salah", { exact: true })).toBeVisible();
  await expect(form.getByLabel("Email", { exact: true })).toHaveValue(AKUN.karyawan.email);
  await expect(form.locator("#password")).toHaveValue("password-salah");
  await form.locator("#password").fill(AKUN.karyawan.password);
  await form.locator("#password").press("Enter");
  await page.waitForURL((url) => url.pathname !== "/login");
  await expect(page.getByText("Karyawan 1", { exact: false }).first()).toBeVisible();
});

test("password mempertahankan kedua isian hanya di browser setelah error", async ({ page }) => {
  await login(page, "karyawan");
  await page.goto("/profil");
  const form = page.locator("form").filter({ has: page.locator('[name="lama"]') }).first();
  await form.getByLabel("Password lama").fill("password-salah");
  await form.getByLabel("Password baru (min 6)").fill("baru-uji-123");
  await form.getByRole("button", { name: "Simpan Password" }).click();
  await expect(form.getByText("Password lama salah")).toBeVisible();
  await expect(form.getByLabel("Password lama")).toHaveValue("password-salah");
  await expect(form.getByLabel("Password baru (min 6)")).toHaveValue("baru-uji-123");
});
