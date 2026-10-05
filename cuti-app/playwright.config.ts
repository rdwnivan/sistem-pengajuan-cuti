import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testIgnore: ["rate-limit.spec.ts", "cuti-flow.spec.ts", "delegasi.spec.ts", "gaji-flow.spec.ts", "cron.spec.ts", "laporan-acc.spec.ts", "slip-rincian.spec.ts", "laporan-kebun.spec.ts", "notifikasi.spec.ts", "hr-crud.spec.ts", "cuti-validasi.spec.ts", "profil.spec.ts", "slip-batal.spec.ts", "lampiran.spec.ts"], /* rate-limit & flows punya config sendiri (serial, worker 1) */
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    // Di CI pakai server produksi (`next start`) yang sudah di-build job `Build`,
    // supaya E2E tidak ikut terkena nondeterminisme dev server: React StrictMode
    // me-render 2×, kompilasi on-demand, dan HMR. Lokally tetap `npm run dev`.
    command: process.env.CI ? "npm run start" : "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  expect: {
    toHaveScreenshot: { maxDiffPixels: 100 },
  },
});