import { test as base, expect, type Page } from "@playwright/test";

export const AKUN = {
  pimpinan: { email: "pimpinan@anime.id", password: "anime123" },
  hr: { email: "hr@anime.id", password: "anime123" },
  atasan: { email: "atasan1@anime.id", password: "anime123" },
  atasan2: { email: "atasan2@anime.id", password: "anime123" },
  karyawan: { email: "karyawan1@anime.id", password: "anime123" },
  karyawan2: { email: "karyawan4@anime.id", password: "anime123" },
  karyawan3: { email: "karyawan3@anime.id", password: "anime123" },
  karyawan5: { email: "karyawan5@anime.id", password: "anime123" },
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

/**
 * Format tanggal lokal YYYY-MM-DD.
 * Jangan pakai toISOString() — itu UTC dan mundur 1 hari di WIB (UTC+7),
 * sehingga "Senin" yang dihitung bisa terkirim sebagai "Minggu".
 */
export function isoLocal(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dd}`;
}

/** Senin–Selasa pada minggu ke-(plusMinggu) ke depan, format lokal. */
export function seninDepan(plusMinggu = 0): { mulai: string; selesai: string } {
  const d = new Date();
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7) + plusMinggu * 7);
  const mulai = isoLocal(d);
  d.setDate(d.getDate() + 1);
  return { mulai, selesai: isoLocal(d) };
}

/** Sabtu–Minggu terdekat, format lokal. */
export function sabtuDepan(): { mulai: string; selesai: string } {
  const d = new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  const mulai = isoLocal(d);
  d.setDate(d.getDate() + 1);
  return { mulai, selesai: isoLocal(d) };
}

/** Rentang delegasi: kemarin → +30 hari, format lokal. */
export function rentangDelegasi(): { mulai: string; selesai: string } {
  const m = new Date();
  m.setDate(m.getDate() - 1);
  const s = new Date();
  s.setDate(s.getDate() + 30);
  return { mulai: isoLocal(m), selesai: isoLocal(s) };
}
