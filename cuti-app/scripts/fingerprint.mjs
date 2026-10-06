/**
 * Menuliskan identitas build ke dua file kecil, dipakai sebagai artifact
 * `build-identity` di CI:
 *
 *   - `chunk-name.txt`  : nama chunk runtime webpack (informasi/diagnostik)
 *   - `commit-sha.txt`  : SHA commit yang dibangun (yang diverifikasi smoke)
 *
 * PENTING (pelajaran yang mahal): perbandingan **hash isi chunk** antar
 * lingkungan TIDAK sah. Commit yang sama di-build bisa menghasilkan isi chunk
 * runtime yang berbeda (terukur: 3482 byte vs 3864 byte untuk nama chunk yang
 * sama persis), sehingga smoke berbasis hash melaporkan MISMATCH padahal alias
 * menyajikan build yang benar. Karena itu smoke memverifikasi **SHA commit**
 * lewat `GET /api/version`, bukan hash.
 *
 * `chunk-sha256.txt` tetap ditulis untuk diagnostik lokal saja.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const sha = (buf) => createHash("sha256").update(buf).digest("hex");

const chunk = readdirSync(".next/static/chunks").find((f) => /^webpack-.*\.js$/.test(f));
if (!chunk) {
  console.error("[fingerprint] chunk runtime webpack tidak ditemukan di .next/static/chunks");
  process.exit(1);
}
const chunkSha = sha(readFileSync(`.next/static/chunks/${chunk}`));

// SHA commit: Vercel mengekspor VERCEL_GIT_COMMIT_SHA; GitHub Actions GITHUB_SHA.
// Di PR (preview) VERCEL_GIT_COMMIT_SHA tidak ada, jadi GITHUB_SHA dipakai.
// Nilai non-SHA (mis. nama branch) ditolak supaya file tidak berisi sampah.
function commitSha() {
  for (const v of [process.env.VERCEL_GIT_COMMIT_SHA, process.env.GITHUB_SHA]) {
    if (v && /^[0-9a-f]{40}$/i.test(v)) return v.toLowerCase();
  }
  return "unknown";
}

writeFileSync("chunk-name.txt", chunk + "\n");
writeFileSync("chunk-sha256.txt", chunkSha + "\n");
writeFileSync("commit-sha.txt", commitSha() + "\n");
console.log(`[fingerprint] chunk=${chunk} sha256=${chunkSha} commit=${commitSha()}`);
