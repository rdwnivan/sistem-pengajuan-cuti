import crypto from "crypto";

/**
 * Perbandingan string constant-time untuk nilai rahasia (mis. `CRON_SECRET`).
 *
 * Kedua sisi di-hash SHA-256 lebih dulu, jadi digest selalu 32 byte:
 * - `crypto.timingSafeEqual` tidak pernah melempar `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH`
 *   (fungsi itu melempar bila panjang buffer berbeda).
 * - Panjang rahasia tidak bocor lewat waktu eksekusi.
 *
 * Hanya waktu eksekusi yang konstan; nilai yang dibandingkan tetap tidak pernah di-log.
 */
export function samaAman(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const da = crypto.createHash("sha256").update(a).digest();
  const db = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(da, db);
}
