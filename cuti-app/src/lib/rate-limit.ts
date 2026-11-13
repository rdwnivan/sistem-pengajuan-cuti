import { createHash } from "node:crypto";
import { prisma, tabelPrisma } from "./prisma";

export type HasilBatas = { ok: true } | { ok: false; cobaLagiDalam: number };
export function hasilBatas(sisaDetik: number): HasilBatas {
  return sisaDetik > 0 ? { ok: false, cobaLagiDalam: Math.ceil(sisaDetik) } : { ok: true };
}
export function kunciLogin(key: string): string {
  return createHash("sha256").update(key.toLowerCase().trim()).digest("hex");
}

// Database clock + atomic UPSERT share five failures/15 min across instances.
// Database failures propagate: login must never silently bypass this gate.
export async function cekRateLimit(key: string): Promise<HasilBatas> {
  const rows = await prisma.$queryRaw<{ seconds: number }[]>`
    SELECT EXTRACT(EPOCH FROM ("blokirSampai" - CURRENT_TIMESTAMP))::float8 AS seconds
    FROM ${tabelPrisma("LoginRateLimit")} WHERE key = ${kunciLogin(key)}`;
  return hasilBatas(rows.length ? rows[0].seconds : 0);
}
export async function catatGagal(key: string): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO ${tabelPrisma("LoginRateLimit")} AS batas (key, gagal, terakhir, "blokirSampai")
    VALUES (${kunciLogin(key)}, 1, CURRENT_TIMESTAMP, TIMESTAMP '1970-01-01')
    ON CONFLICT (key) DO UPDATE SET
      gagal = CASE WHEN batas.terakhir < CURRENT_TIMESTAMP - INTERVAL '15 minutes'
        THEN 1 ELSE batas.gagal + 1 END,
      "blokirSampai" = CASE
        WHEN batas.terakhir < CURRENT_TIMESTAMP - INTERVAL '15 minutes' THEN TIMESTAMP '1970-01-01'
        WHEN batas.gagal + 1 >= 5 THEN CURRENT_TIMESTAMP + INTERVAL '15 minutes'
        ELSE batas."blokirSampai" END,
      terakhir = CURRENT_TIMESTAMP`;
}
export async function reset(key: string): Promise<void> {
  await prisma.loginRateLimit.deleteMany({ where: { key: kunciLogin(key) } });
}
export async function sapuRateLimit(): Promise<void> {
  await prisma.$executeRaw`DELETE FROM ${tabelPrisma("LoginRateLimit")} WHERE terakhir < CURRENT_TIMESTAMP - INTERVAL '30 minutes' AND "blokirSampai" < CURRENT_TIMESTAMP`;
}
