import { defineConfig, devices } from "@playwright/test";

/**
 * Config khusus untuk E2E alur stateful (cuti/delegasi/gaji/cron/laporan-acc).
 * Dijalankan TERPISAH dan SERIAL (worker 1) setelah suite utama, karena:
 * - test-test ini membuat pengajuan/laporan lalu membersihkannya sendiri;
 * - suite utama punya assertion "antrean kosong" yang gagal bila ada sisa state;
 * - eksekusi paralel antar file menyebabkan race pada baris delegasi & gaji yang sama.
 *
 * Usage:
 *   npx playwright test --config=playwright.flows.config.ts
 */
export default defineConfig({
  testDir: "./tests",
  testMatch: ["cuti-flow.spec.ts", "delegasi.spec.ts", "gaji-flow.spec.ts", "cron.spec.ts", "laporan-acc.spec.ts", "slip-rincian.spec.ts", "laporan-kebun.spec.ts", "notifikasi.spec.ts", "hr-crud.spec.ts", "cuti-validasi.spec.ts"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: "http://localhost:3000",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
