import { test as base, expect, type Page } from "@playwright/test";

export const AKUN = {
  pimpinan: { email: "pimpinan@anime.id", password: "anime123" },
  hr: { email: "hr@anime.id", password: "anime123" },
  atasan: { email: "atasan1@anime.id", password: "anime123" },
  karyawan: { email: "karyawan1@anime.id", password: "anime123" },
  karyawan2: { email: "karyawan4@anime.id", password: "anime123" },
} as const;

export type Peran = keyof typeof AKUN;

export async function login(page: Page, peran: Peran) {
  const akun = AKUN[peran];
  await page.goto("/login");
  await page.getByLabel("Email").fill(akun.email);
  await page.locator("#password").fill(akun.password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
}

export const test = base.extend<{ loggedIn: Peran }>({
  loggedIn: async ({ page }, use) => {
    await use("karyawan" as Peran);
  },
});

export { expect };
