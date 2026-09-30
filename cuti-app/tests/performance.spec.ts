import { test, expect, login } from "./helpers";

type Peran = "karyawan" | "atasan" | "hr";

const PAGES: { path: string; name: string; role: Peran }[] = [
  { path: "/", name: "Dashboard", role: "karyawan" },
  { path: "/cuti/baru", name: "Form Cuti", role: "karyawan" },
  { path: "/slip-gaji", name: "Slip Gaji", role: "karyawan" },
  { path: "/laporan", name: "Daftar Laporan", role: "karyawan" },
  { path: "/laporan/baru", name: "Form Laporan", role: "karyawan" },
  { path: "/persetujuan", name: "Antrean Persetujuan", role: "atasan" },
  { path: "/hr", name: "Panel HR", role: "hr" },
  { path: "/hr/slip-gaji", name: "HR Slip Gaji", role: "hr" },
  { path: "/hr/karyawan", name: "HR Karyawan", role: "hr" },
];

const hasil: { name: string; ms: number; status: number }[] = [];

test.describe("Performance — page load timing", () => {
  for (const p of PAGES) {
    test(`${p.name} (${p.path})`, async ({ page }) => {
      await login(page, p.role);
      const t0 = Date.now();
      const res = await page.goto(p.path, { waitUntil: "networkidle" });
      const ms = Date.now() - t0;
      const status = res?.status() ?? 0;
      hasil.push({ name: p.name, ms, status });
      console.log(`PERF|${p.name}|${ms}|${status}`);
      expect(status).toBeLessThan(400);
      expect(ms).toBeLessThan(15000);
    });
  }

  test.afterAll(() => {
    console.log("\n=== RINGKASAN PERFORMA ===");
    const urut = [...hasil].sort((a, b) => b.ms - a.ms);
    for (const h of urut) console.log(`  ${h.name.padEnd(22)} ${String(h.ms).padStart(6)}ms  status ${h.status}`);
    if (hasil.length) {
      const rata = Math.round(hasil.reduce((s, h) => s + h.ms, 0) / hasil.length);
      console.log(`  Rata-rata: ${rata}ms`);
    }
  });
});
