import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { userDariSesi } from "@/lib/auth";
import { notifApp } from "@/lib/notif";
import { kirimWebPush } from "@/lib/web-push";
import { sniffFile } from "@/lib/upload";
import { simpanLampiranPrivat } from "@/lib/lampiran";

export const STATUS_AKTIF = ["MENUNGGU_ATASAN", "MENUNGGU_HR", "DISETUJUI"];

export const BULAN_NAMA = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export async function aktor() {
  const u = await userDariSesi();
  if (!u) redirect("/login");
  return u;
}

export async function unggahFoto(fd: FormData): Promise<string | null> {
  const f = fd.get("lampiran") as File | null;
  if (!f || f.size === 0) return null;
  if (f.size > 2 * 1024 * 1024) return "__GAGAL__:Lampiran maksimal 2MB";
  let snapped;
  try {
    snapped = await sniffFile(f);
  } catch {
    return "__GAGAL__:Lampiran hanya PDF/JPG/PNG (file tidak sesuai jenis yang diklaim)";
  }
  try { return await simpanLampiranPrivat(snapped); }
  catch {
    console.error("[LAMPIRAN-SIMPAN-GAGAL]");
    return "__GAGAL__:Upload lampiran gagal. Periksa konfigurasi penyimpanan privat.";
  }
}

export type FotoTerunggah = { path: string; keterangan: string | null };

export async function unggahBanyakFoto(fd: FormData): Promise<FotoTerunggah[] | { gagal: string }> {
  const files = (fd.getAll("fotos") as File[]).filter((f) => f && f.size > 0).slice(0, 5);
  const keterangans = fd.getAll("fotoKeterangan") as string[];
  if (files.length === 0) return [];
  const hasil: FotoTerunggah[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (f.size > 2 * 1024 * 1024) return { gagal: `Foto ke-${i + 1} melebihi 2MB` };
    let snapped;
    try {
      snapped = await sniffFile(f);
    } catch {
      return { gagal: `Foto ke-${i + 1} hanya boleh JPG/PNG (isi file tidak valid)` };
    }
    const { ext } = snapped;
    if (ext === "pdf") return { gagal: `Foto ke-${i + 1} harus gambar (JPG/PNG), bukan PDF` };
    try { hasil.push({ path: await simpanLampiranPrivat(snapped), keterangan: (keterangans[i] || "").trim() || null }); }
    catch {
      console.error("[FOTO-SIMPAN-GAGAL]", { index: i });
      return { gagal: "Upload foto gagal. Periksa konfigurasi penyimpanan privat." };
    }
  }
  return hasil;
}

export async function ajukanPerubahanGaji(params: {
  userId: string;
  pengajuId: string;
  gajiPokokBaru: number;
  tunjanganTetapBaru: number;
  alasan: string;
}): Promise<{ error?: string }> {
  const db = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!db) return { error: "Karyawan tidak valid" };
  const gajiPokokLama = db.gajiPokok ?? 0;
  const tunjanganTetapLama = db.tunjanganTetap ?? 0;
  if (gajiPokokLama === params.gajiPokokBaru && tunjanganTetapLama === params.tunjanganTetapBaru)
    return { error: "Nilai gaji baru sama dengan gaji saat ini" };
  const approverId = db.atasanId;
  if (!approverId) return { error: "Atasan karyawan belum diset, tidak bisa mengajukan perubahan gaji" };
  const pending = await prisma.gajiPerubahan.findFirst({ where: { userId: params.userId, status: "MENUNGGU" } });
  if (pending) return { error: "Sudah ada permintaan perubahan gaji yang menunggu persetujuan" };
  await prisma.gajiPerubahan.create({
    data: {
      userId: params.userId,
      gajiPokokLama,
      tunjanganTetapLama,
      gajiPokokBaru: params.gajiPokokBaru,
      tunjanganTetapBaru: params.tunjanganTetapBaru,
      alasan: params.alasan,
      pengajuId: params.pengajuId,
      approverId,
    },
  });
  await prisma.auditLog.create({
    data: { aktorId: params.pengajuId, aksi: "GAJI_PERUBAHAN_DIAJUKAN", catatan: `${params.userId}: gajiPokok ${gajiPokokLama}→${params.gajiPokokBaru}, tunjanganTetap ${tunjanganTetapLama}→${params.tunjanganTetapBaru}` },
  });
  const pesan = `Perubahan gaji ${db.nama}: pokok ${gajiPokokLama.toLocaleString("id-ID")}→${params.gajiPokokBaru.toLocaleString("id-ID")}, tetap ${tunjanganTetapLama.toLocaleString("id-ID")}→${params.tunjanganTetapBaru.toLocaleString("id-ID")}.`;
  await notifApp(approverId, "Permintaan perubahan gaji", pesan, undefined, "APP", "GAJI");
  await kirimWebPush(approverId, "Permintaan perubahan gaji", pesan);
  return {};
}
