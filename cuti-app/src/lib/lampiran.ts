import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";
import { DI_VERCEL, type FileValid } from "./upload";

export function urlLampiran(jenis: "cuti" | "laporan" | "foto", id: string): string {
  return `/api/lampiran/${jenis}/${encodeURIComponent(id)}`;
}

export async function simpanLampiranPrivat(file: FileValid): Promise<string> {
  const filename = `${randomUUID()}.${file.ext}`;
  const token = process.env.BLOB_PRIVATE_READ_WRITE_TOKEN;
  if (token) {
    const blob = await put(`lampiran/${filename}`, file.buffer, {
      access: "private", token, contentType: file.mime, addRandomSuffix: false,
    });
    return blob.url;
  }
  if (DI_VERCEL) throw new Error("Upload lampiran belum dikonfigurasi (BLOB_PRIVATE_READ_WRITE_TOKEN kosong)");
  const dir = path.join(process.cwd(), ".private", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), file.buffer, { flag: "wx" });
  return `private:${filename}`;
}

export function blobLampiranValid(value: string, access: "public" | "private"): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.port && !url.username && !url.password && !url.search && !url.hash &&
      new RegExp(`^[a-z0-9]+\\.${access}\\.blob\\.vercel-storage\\.com$`).test(url.hostname);
  } catch { return false; }
}

/** Called only after authorization against the owning domain record. */
export async function bacaLampiranPrivat(reference: string): Promise<Uint8Array | null> {
  const local = /^(private:|\/uploads\/)([a-zA-Z0-9-]+\.(?:pdf|jpg|png))$/.exec(reference);
  if (local) {
    if (DI_VERCEL) return null;
    const dir = local[1] === "private:" ? [".private", "uploads"] : ["public", "uploads"];
    try { return await readFile(path.join(process.cwd(), ...dir, local[2])); }
    catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
      throw error;
    }
  }
  if (blobLampiranValid(reference, "private")) {
    const token = process.env.BLOB_PRIVATE_READ_WRITE_TOKEN;
    if (!token) throw new Error("Private Blob belum dikonfigurasi");
    const result = await get(reference, { access: "private", token, useCache: false, abortSignal: AbortSignal.timeout(10000) });
    if (!result || result.statusCode !== 200) return null;
    return new Uint8Array(await new Response(result.stream).arrayBuffer());
  }
  // Legacy files remain readable to authorized owners during the migration.
  if (blobLampiranValid(reference, "public")) {
    const response = await fetch(reference, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("Pembacaan lampiran lama gagal");
    return new Uint8Array(await response.arrayBuffer());
  }
  throw new Error("Referensi lampiran tidak valid");
}
