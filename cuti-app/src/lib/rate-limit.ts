/**
 * Rate limiter sederhana untuk login (brute-force protection).
 * State in-memory per proses server.
 *
 * CATATAN PENTING: di Vercel serverless, state ini hilang saat cold start
 * dan tidak dibagikan antar instance. Ini tetap memblokir brute force
 * dalam satu instance/warm window. Untuk perlindungan penuh di production,
 * pertimbangkan backend berbasis DB atau Upstash Redis.
 */

type Catatan = { gagal: number; terakhir: number; blokirSampai: number };

const windowMs = 15 * 60 * 1000; // 15 menit
const maksGagal = 5;             // maksimal 5 kali gagal
const blokirMs = 15 * 60 * 1000; // blokir 15 menit setelah melebihi
const TTL = windowMs + blokirMs;  // berapa lama entri disimpan

const store = new Map<string, Catatan>();

// Bersihkan entri kedaluwarsa sesekali agar Map tidak membesar
function bersihkan() {
  const sekarang = Date.now();
  store.forEach((v, k) => {
    if (sekarang - v.terakhir > TTL && sekarang > v.blokirSampai) store.delete(k);
  });
}

export function cekRateLimit(key: string): { ok: true } | { ok: false; cobaLagiDalam: number } {
  bersihkan();
  const sekarang = Date.now();
  const c = store.get(key);
  if (c && sekarang < c.blokirSampai) {
    return { ok: false, cobaLagiDalam: Math.ceil((c.blokirSampai - sekarang) / 1000) };
  }
  return { ok: true };
}

export function catatGagal(key: string) {
  const sekarang = Date.now();
  const c = store.get(key);
  if (!c || sekarang - c.terakhir > windowMs) {
    store.set(key, { gagal: 1, terakhir: sekarang, blokirSampai: 0 });
    return;
  }
  c.gagal += 1;
  c.terakhir = sekarang;
  if (c.gagal >= maksGagal) c.blokirSampai = sekarang + blokirMs;
  store.set(key, c);
}

export function reset(key: string) {
  store.delete(key);
}
