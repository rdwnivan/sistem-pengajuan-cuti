import { NextResponse } from "next/server";

/**
 * Identitas build yang SEDANG melayani request ini.
 *
 * Dipakai oleh smoke pasca-deploy (`post-deploy-smoke.yml`) untuk menjawab
 * "deploy commit X sudah mendarat di alias production?" dengan perbandingan
 * SHA — bukan perbandingan hash isi chunk, yang terbukti TIDAK sah antar
 * lingkungan (build commit yang sama bisa menghasilkan isi chunk runtime yang
 * berbeda, terukur 3482 vs 3864 byte untuk nama chunk yang sama).
 *
 * Di Vercel, `VERCEL_GIT_COMMIT_SHA` tersedia saat runtime dan berisi commit
 * dari deployment yang melayani request. Jadi endpoint ini secara definisi
 * melaporkan deployment mana yang menjawab — termasuk saat alias nyangkut di
 * deployment lama (akan melaporkan SHA lama).
 *
 * Read-only, tanpa data sensitif. Cache dimatikan supaya smoke tidak membaca
 * nilai basi dari CDN.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? null;
  return NextResponse.json(
    {
      sha: sha && /^[0-9a-f]{40}$/i.test(sha) ? sha.toLowerCase() : null,
      env: process.env.VERCEL_ENV ?? null,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
