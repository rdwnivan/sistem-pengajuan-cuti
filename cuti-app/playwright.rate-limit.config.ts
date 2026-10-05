import { defineConfig, devices } from "@playwright/test";

/**
 * Config khusus untuk test rate-limit saja.
 * Dijalankan terpisah dari suite utama karena 6× bcrypt cost 10
 * membuat Next dev single-process macet saat suite penuh berjalan paralel.
 *
 * Usage:
 *   npx playwright test --config=playwright.rate-limit.config.ts
 */
export default defineConfig({
  testDir: "./tests",
  testMatch: "rate-limit.spec.ts",
  fullyParallel: false,
  workers: 1,
  // Aman di-retry: tiap percobaan memakai email acak baru, jadi state rate-limit
  // in-memory dari percobaan sebelumnya tidak mengganggu.
  retries: process.env.CI ? 2 : 0,
  reporter: "line",
  use: {
    baseURL: "http://localhost:3000",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    // Lihat catatan di playwright.config.ts — CI pakai server produksi.
    command: process.env.CI ? "npm run start" : "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
