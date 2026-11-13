import { PrismaClient } from "@prisma/client";
import { del, list } from "@vercel/blob";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { bacaLampiranPrivat, blobLampiranValid, simpanLampiranPrivat } from "../src/lib/lampiran";
import { sniffFile } from "../src/lib/upload";

type Entry = { source: string; destination?: string; sha256?: string; migrated?: boolean; done?: boolean };
type Journal = { database: string; entries: Entry[] };
const hash = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const legacy = (value: string) => value.startsWith("/uploads/") || blobLampiranValid(value, "public");

async function main() {
  if (process.argv.includes("--help")) {
    console.log("Dry-run: tsx scripts/migrate-attachments.ts; copy/update: --apply; revoke sources: --apply --revoke-old --exclusive-storage. Orphan archive: additionally --include-unreferenced. Use --journal-name=production.json per environment. Exclusive storage requires verifying every consuming database/environment first.");
    return;
  }
  const apply = process.argv.includes("--apply");
  const revoke = process.argv.includes("--revoke-old");
  const includeUnreferenced = process.argv.includes("--include-unreferenced");
  if ((revoke || includeUnreferenced) && !process.argv.includes("--exclusive-storage")) throw new Error("Periksa semua database pemakai storage sebelum mencabut/mengarsipkan sumber");
  const dbUrl = new URL(process.env.DATABASE_URL ?? "");
  dbUrl.username = ""; dbUrl.password = "";
  const database = hash(dbUrl.toString());
  const db = new PrismaClient();
  const dir = path.resolve(process.cwd(), ".private");
  const journalName = process.argv.find((v) => v.startsWith("--journal-name="))?.slice("--journal-name=".length) ?? "lampiran-migration.json";
  if (!/^[a-zA-Z0-9_-]+\.json$/.test(journalName)) throw new Error("Nama journal tidak diizinkan");
  const journalPath = path.join(dir, journalName);
  try {
    const [cuti, laporan, fotos] = await Promise.all([
      db.pengajuan.findMany({ where: { lampiranPath: { not: null } }, select: { lampiranPath: true } }),
      db.laporanLapangan.findMany({ where: { lampiranPath: { not: null } }, select: { lampiranPath: true } }),
      db.laporanFoto.findMany({ select: { path: true } }),
    ]);
    const sources = new Set([...cuti.map((r) => r.lampiranPath!), ...laporan.map((r) => r.lampiranPath!), ...fotos.map((r) => r.path)].filter(legacy));
    // Inventory is NOT authority to delete: other schemas may reference these files.
    const inventory = new Set<string>();
    try {
      for (const file of await readdir(path.join(process.cwd(), "public", "uploads"))) {
        if (/^[a-zA-Z0-9-]+\.(pdf|png|jpg)$/.test(file)) inventory.add(`/uploads/${file}`);
      }
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
    const oldToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (oldToken) {
      for (const prefix of ["lampiran/", "laporan/", "laporan-foto/"]) {
        let cursor: string | undefined;
        do {
          const page = await list({ token: oldToken, prefix, cursor, limit: 1000 });
          for (const blob of page.blobs) inventory.add(blob.url);
          cursor = page.hasMore ? page.cursor : undefined;
        } while (cursor);
      }
    }
    let journal: Journal = { database, entries: [] };
    try { journal = JSON.parse(await readFile(journalPath, "utf8")) as Journal; }
    catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
    if (journal.database !== database || !Array.isArray(journal.entries)) throw new Error("Journal bukan milik database/schema ini");
    const unreferenced = [...inventory].filter((source) => !sources.has(source) && !journal.entries.some((e) => e.source === source));
    if (includeUnreferenced) for (const source of unreferenced) sources.add(source);
    for (const source of sources) if (!journal.entries.some((e) => e.source === source)) journal.entries.push({ source });
    const pending = journal.entries.filter((e) => revoke ? !e.done : !e.migrated);
    console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", pending: pending.length, local: pending.filter((e) => e.source.startsWith("/uploads/")).length,
      remote: pending.filter((e) => blobLampiranValid(e.source, "public")).length, unreferencedInventory: unreferenced.length,
      revokeOldSources: revoke, legacyBlobInventoryChecked: !!oldToken, privateBlobConfigured: !!process.env.BLOB_PRIVATE_READ_WRITE_TOKEN }));
    if (!apply) return;
    if (pending.some((e) => blobLampiranValid(e.source, "public")) && (!oldToken || !process.env.BLOB_PRIVATE_READ_WRITE_TOKEN)) throw new Error("Migrasi Blob memerlukan token store public lama dan private baru");
    await mkdir(dir, { recursive: true });
    async function save() {
      await writeFile(journalPath + ".tmp", JSON.stringify(journal), { mode: 0o600 });
      await rename(journalPath + ".tmp", journalPath);
    }
    for (const entry of pending) {
      if (!legacy(entry.source)) throw new Error("Sumber journal tidak diizinkan");
      if (entry.source.startsWith("https:")) {
        const store = /^vercel_blob_rw_([a-zA-Z0-9]+)_/.exec(oldToken!)?.[1].toLowerCase();
        if (!store || new URL(entry.source).hostname !== `${store}.public.blob.vercel-storage.com`) throw new Error("Blob sumber bukan milik token store lama");
      }
      if (!entry.destination) {
        const bytes = await bacaLampiranPrivat(entry.source);
        if (!bytes || bytes.byteLength > 2 * 1024 * 1024) throw new Error("Sumber hilang/melebihi batas; migrasi dihentikan tanpa menghapusnya");
        const file = await sniffFile(new File([new Uint8Array(bytes)], "lampiran"));
        entry.destination = await simpanLampiranPrivat(file);
        entry.sha256 = hash(bytes);
        await save(); // Crash recovery knows which verified copy to resume.
      }
      const copied = await bacaLampiranPrivat(entry.destination);
      if (!copied || hash(copied) !== entry.sha256) throw new Error("Verifikasi copy gagal; sumber tidak dihapus");
      await db.$transaction([
        db.pengajuan.updateMany({ where: { lampiranPath: entry.source }, data: { lampiranPath: entry.destination } }),
        db.laporanLapangan.updateMany({ where: { lampiranPath: entry.source }, data: { lampiranPath: entry.destination } }),
        db.laporanFoto.updateMany({ where: { path: entry.source }, data: { path: entry.destination } }),
      ]);
      entry.migrated = true;
      await save();
      if (!revoke) continue;
      if (entry.source.startsWith("/uploads/")) {
        const match = /^\/uploads\/([a-zA-Z0-9-]+\.(?:pdf|jpg|png))$/.exec(entry.source);
        if (!match) throw new Error("Path sumber lokal tidak diizinkan");
        const root = path.resolve(process.cwd(), "public", "uploads");
        const target = path.resolve(root, match[1]);
        if (path.dirname(target) !== root) throw new Error("Path di luar direktori upload");
        try {
          if (hash(await readFile(target)) !== entry.sha256) throw new Error("Sumber berubah; tidak dihapus");
          await unlink(target);
        } catch (error) {
          if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
        }
      } else {
        await del(entry.source, { token: oldToken! });
        const response = await fetch(entry.source, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000) });
        if (![403, 404, 410].includes(response.status)) throw new Error("URL lama masih dapat diakses; ulangi migrasi untuk memverifikasi pencabutan");
      }
      entry.done = true;
      await save();
    }
    console.log(JSON.stringify({ migrated: journal.entries.filter((e) => e.migrated).length, pendingRevocation: journal.entries.filter((e) => !e.done).length }));
  } finally { await db.$disconnect(); }
}

main().catch(() => {
  // SDK errors may contain token/URLs; only a fixed message is safe to print.
  console.error("[MIGRASI-LAMPIRAN-GAGAL] Sumber dipertahankan sampai copy terverifikasi. Periksa token/config, file sumber dan journal privat; ulangi perintah untuk melanjutkan.");
  process.exitCode = 1;
});
