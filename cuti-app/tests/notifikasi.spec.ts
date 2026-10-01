import { test, expect, login, seninDepan } from "./helpers";

/**
 * Alur notifikasi in-app ujung-ke-ujung:
 * karyawan ajukan -> atasan dapat notif + badge -> atasan setujui ->
 * karyawan dapat notif keputusan. Diakhiri cleanup (batalkan) agar
 * tidak mencemari test lain.
 */
test.describe.configure({ mode: "serial" });

test("notifikasi cuti: pengajuan baru sampai keputusan", async ({ page }) => {
  const { mulai, selesai } = seninDepan(3);
  const alasan = `Uji notif ${Date.now()}`;

  // 1. Karyawan mengajukan
  await login(page, "karyawan");
  await page.goto("/cuti/baru");
  await page.waitForFunction(() => document.querySelectorAll('select[name="jenisId"] option').length > 1, {}, { timeout: 8000 });
  await page.locator('select[name="jenisId"]').selectOption({ label: "Duka (min H-0)" });
  await page.locator('input[name="tglMulai"]').fill(mulai);
  await page.locator('input[name="tglSelesai"]').fill(selesai);
  await page.locator('textarea[name="alasan"]').fill(alasan);
  await page.getByRole("button", { name: "Kirim Pengajuan" }).click();
  await page.waitForURL(/\/cuti\/[a-zA-Z0-9]{20,}$/, { timeout: 20000 });
  const url = page.url();
  console.log("OK|pengajuan dibuat");

  // 2. Atasan: notif + badge muncul
  const ctx = await page.context().browser().newContext();
  const p2 = await ctx.newPage();
  await p2.goto("http://localhost:3000/login");
  await p2.locator("input[name=email]").fill("atasan1@anime.id");
  await p2.locator("#password").fill("anime123");
  await p2.getByRole("button", { name: "Masuk" }).click();
  await p2.waitForURL((u) => u.pathname !== "/login", { timeout: 20000 });
  await p2.goto("/notifikasi");
  await expect(p2.getByText("Pengajuan cuti baru menunggu Anda").first()).toBeVisible({ timeout: 10000 });
  console.log("OK|atasan dapat notif pengajuan baru");
  const badge = await p2.getByRole("link", { name: "Notifikasi" }).first().innerText();
  expect(Number(badge.replace(/\D/g, "")) >= 1).toBe(true);
  console.log("OK|badge notifikasi tampil angka");

  // 3. Atasan menyetujui. PENTING: jangan pakai waitForURL(/\/cuti\//) —
  // URL sudah cocok sebelum action selesai sehingga lolos instan.
  // Tunggu bukti visual status berubah sebagai tanda server selesai.
  await p2.goto(url);
  await p2.locator('textarea[name="catatan"]').fill("Setuju, silakan cuti.");
  await p2.getByRole("button", { name: "Setujui" }).click();
  await expect(p2.getByText("Menunggu HR").first()).toBeVisible({ timeout: 20000 });
  console.log("OK|atasan menyetujui");
  await ctx.close();

  // 4. Karyawan: notif keputusan muncul (atasan->HR = "Atasan menyetujui",
  // bukan "Pengajuan Anda" yang hanya untuk status final)
  await page.goto("/notifikasi");
  await expect(page.getByText("Atasan menyetujui").first()).toBeVisible({ timeout: 10000 });
  console.log("OK|karyawan dapat notif keputusan");

  // 5. Cleanup: batalkan agar antrean kosong untuk test lain
  await page.goto(url);
  const batal = page.getByRole("button", { name: "Batalkan Pengajuan" });
  if (await batal.count()) {
    page.once("dialog", (d) => d.accept());
    await batal.first().click();
    await page.waitForURL("/", { timeout: 20000 });
    console.log("OK|cleanup dibatalkan");
  }
});
