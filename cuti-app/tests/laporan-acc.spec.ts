import { test, expect, login } from "./helpers";
import type { Page } from "@playwright/test";

async function buatLaporanMenunggu(page: Page, judul: string): Promise<string> {
  await login(page, "karyawan");
  await page.goto("/laporan/baru");
  await page.getByLabel("Lokasi").fill("Proyek Kalimantan");
  await page.getByLabel("Judul laporan").fill(judul);
  await page.getByLabel("Isi laporan").fill("Pekerjaan lapangan berjalan baik, tidak ada kendala berarti.");
  await page.getByLabel("Kirim ke atasan").selectOption({ label: "Atasan Satu (Manajer Operasional)" });
  await page.getByRole("button", { name: "Simpan Laporan" }).click();
  await page.waitForURL(/\/laporan\/[a-z0-9]{20,}$/, { timeout: 20_000 });
  const url = page.url();
  await page.getByRole("button", { name: "Kirim ke Atasan" }).click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Menunggu Acc").first()).toBeVisible({ timeout: 15_000 });
  return url;
}

test.describe("Laporan — API acc (POST /api/laporan-lapangan/[id])", () => {
  test("approver menyetujui via API → DISETUJUI, PDF tersedia", async ({ page }) => {
    const url = await buatLaporanMenunggu(page, "Laporan API Acc");
    const id = url.split("/").pop()!;

    await login(page, "atasan");
    const r = await page.request.post(`/api/laporan-lapangan/${id}`, {
      form: { aksi: "setuju", catatan: "Bagus, lanjutkan" },
    });
    expect(r.status()).toBe(200);
    expect((await r.json()).status).toBe("DISETUJUI");

    // PDF hanya untuk laporan disetujui
    const pdf = await page.request.get(`/api/laporan-lapangan/${id}?format=pdf`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
  });

  test("bukan approver → 403", async ({ page }) => {
    const url = await buatLaporanMenunggu(page, "Laporan API Forbidden");
    const id = url.split("/").pop()!;

    await login(page, "karyawan2");
    const r = await page.request.post(`/api/laporan-lapangan/${id}`, {
      form: { aksi: "setuju", catatan: "" },
    });
    expect(r.status()).toBe(403);
  });

  test("tolak tanpa catatan → 400, dengan catatan → DITOLAK", async ({ page }) => {
    const url = await buatLaporanMenunggu(page, "Laporan API Tolak");
    const id = url.split("/").pop()!;

    await login(page, "atasan");
    const kosong = await page.request.post(`/api/laporan-lapangan/${id}`, {
      form: { aksi: "tolak", catatan: "" },
    });
    expect(kosong.status()).toBe(400);

    const tolak = await page.request.post(`/api/laporan-lapangan/${id}`, {
      form: { aksi: "tolak", catatan: "Data kurang lengkap" },
    });
    expect(tolak.status()).toBe(200);
    expect((await tolak.json()).status).toBe("DITOLAK");
  });

  test("laporan sudah final tidak bisa diputus lagi → 400", async ({ page }) => {
    const url = await buatLaporanMenunggu(page, "Laporan API Final");
    const id = url.split("/").pop()!;

    await login(page, "atasan");
    await page.request.post(`/api/laporan-lapangan/${id}`, {
      form: { aksi: "setuju", catatan: "" },
    });
    const lagi = await page.request.post(`/api/laporan-lapangan/${id}`, {
      form: { aksi: "setuju", catatan: "" },
    });
    expect(lagi.status()).toBe(400);
  });

  test("tanpa sesi → 401", async ({ page, context }) => {
    await context.clearCookies();
    const r = await page.request.post("/api/laporan-lapangan/id-apa-saja", {
      form: { aksi: "setuju", catatan: "" },
    });
    expect(r.status()).toBe(401);
  });
});
