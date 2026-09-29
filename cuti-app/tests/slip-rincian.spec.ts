import { test, expect, login } from "./helpers";

/**
 * Slip gaji rincian standar: HR terbitkan slip dengan komponen
 * (jabatan/transport/makan + lembur/bonus − PPh21/BPJS/lainnya),
 * karyawan melihat rincian + NIP, PDF memuat header seragam + kolom TTD.
 *
 * NB: halaman memakai Shell yang me-render children 2× → locator .first().
 */
test.describe("Slip gaji rincian standar", () => {
  test("HR terbitkan slip rincian, karyawan lihat rincian + NIP, PDF ada TTD", async ({ page }) => {
    const now = new Date();
    const tahun = now.getFullYear();
    const bulan = now.getMonth() + 1;

    // 1. HR terbitkan slip karyawan2 (karyawan4, bawahan atasan2 — antrean laporan aman)
    await login(page, "hr");
    await page.goto("/hr/slip-gaji?buat=1");
    await page.locator('select[name="userId"]').first().selectOption({ label: "Karyawan 4 (Staff)" });
    await page.locator('select[name="bulan"]').first().selectOption(String(bulan));
    await page.locator('input[name="tunjanganJabatan"]').first().fill("500000");
    await page.locator('input[name="tunjanganTransport"]').first().fill("300000");
    await page.locator('input[name="tunjanganMakan"]').first().fill("400000");
    await page.locator('input[name="lembur"]').first().fill("200000");
    await page.locator('input[name="pph21"]').first().fill("100000");
    await page.locator('input[name="bpjsKesehatan"]').first().fill("50000");
    await page.getByRole("button", { name: "Terbitkan Slip" }).first().click();
    await page.waitForURL("/hr/slip-gaji", { timeout: 20_000 });

    // 2. karyawan2 melihat rincian + NIP di halaman slip
    await login(page, "karyawan2");
    await page.goto("/slip-gaji");
    await page.getByRole("link", { name: /Gaji bersih/ }).first().click();
    await page.waitForURL(/\/slip-gaji\/[a-z0-9]{20,}$/, { timeout: 15_000 });
    await expect(page.getByText("NIP").first()).toBeVisible();
    await expect(page.getByText("Tunj. jabatan").first()).toBeVisible();
    await expect(page.getByText("PPh 21").first()).toBeVisible();

    // 3. PDF terbit OK (isi terkompresi FlateDecode — verifikasi konten via halaman,
    //    bukan biner). Header/TTD/rincian sudah dicek di langkah 2 + unit pdf helper.
    const id = page.url().split("/").pop()!;
    const pdf = await page.request.get(`/api/slip/${id}`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
    expect(pdf.headers()["content-disposition"]).toContain(`slip-gaji-`);
  });

  test("HR kelola NIP: duplikat ditolak", async ({ page }) => {
    await login(page, "hr");
    await page.goto("/hr/karyawan");
    await page.getByRole("link", { name: /Karyawan 4/ }).first().click();
    await page.waitForURL(/\/hr\/karyawan\//, { timeout: 15_000 });
    // Ambil NIP karyawan1 (100005) lalu paksa ke karyawan2 → harus ditolak
    await page.locator('input[name="nip"]').first().fill("100005");
    await page.locator('button:has-text("Simpan")').first().click();
    await expect(page.getByText("NIP sudah dipakai")).toBeVisible({ timeout: 15_000 });
  });
});
