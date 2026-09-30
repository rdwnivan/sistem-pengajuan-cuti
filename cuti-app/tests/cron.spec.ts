import { test, expect, login, seninDepan } from "./helpers";

/**
 * Cron reminder/eskalasi via API.
 * Butuh CRON_SECRET yang valid (dibaca dari cuti-app/.env) dan antrean
 * MENUNGGU (dibuat oleh test ini sendiri).
 */
import fs from "node:fs";
import path from "node:path";

function cronSecret(): string {
  if (process.env.CRON_SECRET) return process.env.CRON_SECRET;
  const envPath = path.resolve(__dirname, "..", ".env");
  const m = fs.readFileSync(envPath, "utf8").match(/^CRON_SECRET="([^"]+)"/m);
  return m?.[1] ?? "";
}

test.describe("Cron — reminder & eskalasi", () => {
  test("cron tanpa secret → 401", async ({ request }) => {
    const r = await request.get("/api/cron");
    expect(r.status()).toBe(401);
  });

  test("cron dengan secret benar → 200 + struktur hasil", async ({ request, page }) => {
    // Pastikan ada antrean: karyawan ajukan cuti
    const { mulai, selesai } = seninDepan();
    await login(page, "karyawan2");
    await page.goto("/cuti/baru");
    await page.locator('select[name="jenisId"]').selectOption({ label: "Duka (min H-0)" });
    await page.locator('input[name="tglMulai"]').fill(mulai);
    await page.locator('input[name="tglSelesai"]').fill(selesai);
    await page.locator('textarea[name="alasan"]').fill("Cuti untuk memicu antrean cron reminder eskalasi");
    await page.getByRole("button", { name: "Kirim Pengajuan" }).click();
    await page.waitForURL(/\/cuti\/[a-z0-9]{20,}$/, { timeout: 20_000 });
    const url = page.url();

    const secret = cronSecret();
    expect(secret.length).toBeGreaterThanOrEqual(32);
    const r = await request.get(`/api/cron?secret=${encodeURIComponent(secret)}`);
    expect(r.status()).toBe(200);
    const j = await r.json();
    expect(j.ok).toBe(true);
    expect(typeof j.reminder).toBe("number");
    expect(typeof j.eskalasi).toBe("number");
    expect(Array.isArray(j.detail)).toBe(true);
    // Pengajuan baru berumur < 1 hari → belum ada reminder/eskalasi, tapi endpoint jalan
    expect(j.reminder).toBeGreaterThanOrEqual(0);

    // Cleanup: batalkan agar antrean HR kembali kosong untuk test lain
    await page.goto(url);
    await expect(page.getByRole("heading", { name: "Detail Pengajuan" })).toBeVisible({ timeout: 15_000 });
    page.on("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Batalkan Pengajuan" }).click();
    await page.waitForURL("/", { timeout: 15_000 });
  });

  test("cron via header Authorization Bearer juga diterima", async ({ request }) => {
    const r = await request.get("/api/cron", { headers: { authorization: `Bearer ${cronSecret()}` } });
    expect(r.status()).toBe(200);
  });
});
