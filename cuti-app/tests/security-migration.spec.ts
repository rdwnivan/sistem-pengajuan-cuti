import { test, expect } from "./helpers";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("migrasi memverifikasi copy, menjaga sumber bersama dan dapat dilanjutkan", async () => {
  test.setTimeout(90000);
  const db = new PrismaClient();
  const root = await mkdtemp(path.join(tmpdir(), "cuti-migration-"));
  const filename = `source-${randomUUID()}.png`;
  const source = `/uploads/${filename}`;
  const bytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jk9sAAAAASUVORK5CYII=", "base64");
  await mkdir(path.join(root, "public", "uploads"), { recursive: true });
  await writeFile(path.join(root, "public", "uploads", filename), bytes);
  const otherFile = path.join(root, "public", "uploads", "another-schema.png");
  await writeFile(otherFile, bytes);
  const user = await db.user.create({ data: { nama: "Fixture Migrasi", email: `migration-${randomUUID()}@anime.id`, passwordHash: "unused-no-login" } });
  const jenis = await db.jenisCuti.findUniqueOrThrow({ where: { nama: "Sakit" } });
  const cuti = await db.pengajuan.create({ data: { pemohonId: user.id, jenisId: jenis.id, tglMulai: new Date(), tglSelesai: new Date(), jumlahHariKerja: 1, alasan: "Fixture migrasi penyimpanan", lampiranPath: source } });
  const laporan = await db.laporanLapangan.create({ data: { pembuatId: user.id, tglLaporan: new Date(), lokasi: "Uji", judul: "Fixture Migrasi", isi: "Konten fixture migrasi", lampiranPath: source, fotos: { create: { path: source } } } });
  const req = createRequire(path.join(process.cwd(), "package.json"));
  function run(args: string[]) {
    return spawnSync(process.execPath, [req.resolve("tsx/cli"), path.join(process.cwd(), "scripts", "migrate-attachments.ts"), ...args], {
      cwd: root, env: { ...process.env, BLOB_READ_WRITE_TOKEN: "", BLOB_PRIVATE_READ_WRITE_TOKEN: "", VERCEL: "", VERCEL_ENV: "" }, encoding: "utf8", timeout: 30000,
    });
  }
  try {
    const dry = run([]);
    expect(dry.status, dry.stderr).toBe(0);
    expect(JSON.parse(dry.stdout.trim())).toMatchObject({ pending: 1, unreferencedInventory: 1 });
    expect((await db.pengajuan.findUniqueOrThrow({ where: { id: cuti.id } })).lampiranPath).toBe(source);
    const copied = run(["--apply"]);
    expect(copied.status, copied.stderr).toBe(0);
    const reference = (await db.pengajuan.findUniqueOrThrow({ where: { id: cuti.id } })).lampiranPath!;
    expect(reference).toMatch(/^private:/);
    expect((await db.laporanLapangan.findUniqueOrThrow({ where: { id: laporan.id } })).lampiranPath).toBe(reference);
    expect((await db.laporanFoto.findFirstOrThrow({ where: { laporanId: laporan.id } })).path).toBe(reference);
    const destination = path.join(root, ".private", "uploads", reference.slice("private:".length));
    expect(await readFile(destination)).toEqual(bytes);
    expect((await stat(path.join(root, "public", "uploads", filename))).isFile()).toBe(true);
    expect(run(["--apply", "--revoke-old"]).status).not.toBe(0);
    // A damaged destination must never cause deletion of the old source.
    await writeFile(destination, "damaged");
    expect(run(["--apply", "--revoke-old", "--exclusive-storage"]).status).not.toBe(0);
    expect(await readFile(path.join(root, "public", "uploads", filename))).toEqual(bytes);
    await writeFile(destination, bytes);
    const resumed = run(["--apply", "--revoke-old", "--exclusive-storage"]);
    expect(resumed.status, resumed.stderr).toBe(0);
    await expect(stat(path.join(root, "public", "uploads", filename))).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(otherFile)).toEqual(bytes);
    expect(run(["--apply", "--revoke-old", "--exclusive-storage"]).status).toBe(0);
    const journal = JSON.parse(await readFile(path.join(root, ".private", "lampiran-migration.json"), "utf8"));
    expect(journal.entries).toHaveLength(1);
    expect(journal.entries[0]).toMatchObject({ migrated: true, done: true });
  } finally {
    await db.laporanLapangan.delete({ where: { id: laporan.id } });
    await db.pengajuan.delete({ where: { id: cuti.id } });
    await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
    // Sandbox retained for reproducibility; never recursively delete a shared temp dir.
  }
});
