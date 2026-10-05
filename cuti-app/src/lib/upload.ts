/**
 * Validasi upload berbasis magic bytes (server-side content sniffing).
 *
 * Alasan: `File.type` datang dari client dan bisa dipalsukan — file
 * berbahaya yang diklaim sebagai "application/pdf" akan lolos validasi
 * tipe. File di-host di Vercel Blob dengan `access: "public"`, sehingga
 * file berbahaya bisa disajikan dari origin yang sama.
 *
 * Solusi: baca signature (magic bytes) file di server dan tentukan
 * ekstensi dari konten AKTUAL, bukan dari klaim client.
 */

/** Signature file yang diizinkan. */
const SIGNATURE = {
  pdf: { ext: "pdf", mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // %PDF-
  jpg: { ext: "jpg", mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] }, // FF D8 FF
  png: { ext: "png", mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
} as const;

export type FileValid = { buffer: Buffer; ext: string; mime: string };

/**
 * True bila proses berjalan di Vercel. FS Vercel **read-only**, jadi di sana
 * upload lokal tidak mungkin — wajib lewat Vercel Blob (`BLOB_READ_WRITE_TOKEN`).
 *
 * Sengaja TIDAK memakai `NODE_ENV === "production"`: build produksi yang
 * dijalankan lokal (mis. E2E `next start` di CI) masih bisa menulis ke
 * `public/uploads/`, sedangkan di Vercel tidak. Dipakai di 3 tempat agar
 * kondisinya satu sumber (cutiActions + shared unggahFoto/unggahBanyakFoto).
 */
export const DI_VERCEL = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);

/**
 * Baca buffer file dan verifikasi signature-nya terhadap daftar yang diizinkan.
 * Mengembalikan Buffer + ekstensi/mime berdasarkan konten, bukan klaim client.
 *
 * Throws Error dengan pesan Bahasa Indonesia bila tidak valid.
 */
export async function sniffFile(f: File): Promise<FileValid> {
  const buffer = Buffer.from(await f.arrayBuffer());
  // Signature PDF/JPG/PNG pendek (< 12 byte); baca sisanya bila perlu.
  const head = buffer.subarray(0, 12);

  for (const [key, sig] of Object.entries(SIGNATURE)) {
    if (sig.bytes.every((b, i) => head[i] === b)) {
      return { buffer, ext: sig.ext, mime: sig.mime };
    }
  }

  // Fallback untuk PDF yang tidak persis di byte 0 (beberapa PDF valid dimulai
  // dengan byteIBS/whitespace sebelum %PDF-). PDF spec mengizinkan header di offset <= 1024.
  if (buffer.subarray(0, 1024).includes(Buffer.from("%PDF-"))) {
    return { buffer, ext: "pdf", mime: "application/pdf" };
  }

  throw new Error("Lampiran hanya PDF/JPG/PNG (verifikasi isi file gagal)");
}
