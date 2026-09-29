"use server";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { buatSesi, keluar as keluarSesi, userDariSesi, hashPassword, isAtasan } from "@/lib/auth";
import { ajukanSchema, loginSchema, putusanSchema, userSchema, jenisSchema, slipSchema, laporanSchema, putusanLaporanSchema, putusanGajiSchema, gajiPerubahanSchema } from "@/lib/validasi";
import { bulanMasaKerja, fmtTgl, hariKerja, parseTglInput } from "@/lib/cuti";
import { notifyHRMenungguHR, notifyKeputusan, notifyPengajuanBaru, notifApp } from "@/lib/notif";
import { kirimWebPush } from "@/lib/web-push";
import { approverEfektif, delegasiAktifUntuk } from "@/lib/cron";

import { STATUS_AKTIF, aktor, BULAN_NAMA, unggahFoto, ajukanPerubahanGaji } from "./shared";


export async function aksiSimpanGajiPokok(_: unknown, fd: FormData) {
  const admin = await aktor();
  if (admin.role !== "HR_ADMIN") return { error: "Hanya HR" };
  const id = (fd.get("id") as string) || "";
  const pokok = Number(fd.get("gajiPokok") || 0);
  const tetap = Number(fd.get("tunjanganTetap") || 0);
  if (!Number.isInteger(pokok) || pokok < 0) return { error: "Gaji pokok tidak valid" };
  if (!Number.isInteger(tetap) || tetap < 0) return { error: "Tunjangan tetap tidak valid" };
  const alasan = (fd.get("alasan") as string || "").trim();
  const res = await ajukanPerubahanGaji({
    userId: id, pengajuId: admin.id,
    gajiPokokBaru: pokok, tunjanganTetapBaru: tetap,
    alasan: alasan || "Perubahan gaji langsung oleh HR",
  });
  if (res.error) return res;
  redirect("/hr/karyawan");
}


export async function aksiPutusanPerubahanGaji(_: unknown, fd: FormData) {
  const user = await aktor();
  const v = putusanGajiSchema.safeParse({ gajiPerubahanId: fd.get("gajiPerubahanId"), aksi: fd.get("aksi"), catatan: fd.get("catatan") });
  if (!v.success) return { error: v.error.issues[0].message };
  const gp = await prisma.gajiPerubahan.findUnique({ where: { id: v.data.gajiPerubahanId }, include: { user: true, pengaju: true } });
  if (!gp) return { error: "Permintaan tidak ditemukan" };
  if (gp.approverId !== user.id) return { error: "Anda bukan approver permintaan ini" };
  if (gp.status !== "MENUNGGU") return { error: "Permintaan sudah diproses" };
  const catatan = (v.data.catatan || "").trim();
  if ((v.data.aksi === "tolak" || v.data.aksi === "kembalikan") && !catatan)
    return { error: "Alasan/catatan wajib diisi" };

  if (v.data.aksi === "setuju") {
    await prisma.user.update({ where: { id: gp.userId }, data: { gajiPokok: gp.gajiPokokBaru, tunjanganTetap: gp.tunjanganTetapBaru } });
    await prisma.gajiPerubahan.update({ where: { id: gp.id }, data: { status: "DISETUJUI", diputuskanOlehId: user.id, decidedAt: new Date(), catatan: catatan || null } });
    await prisma.auditLog.create({ data: { aktorId: user.id, aksi: "GAJI_PERUBAHAN_DISETUJUI", catatan: `${gp.userId}: pokok ${gp.gajiPokokLama}→${gp.gajiPokokBaru}, tetap ${gp.tunjanganTetapLama}→${gp.tunjanganTetapBaru}` } });
    const pesan = `Perubahan gaji ${gp.user.nama} disetujui.`;
    await notifApp(gp.pengajuId, "Perubahan gaji disetujui", pesan, undefined, "APP", "GAJI");
    await kirimWebPush(gp.pengajuId, "Perubahan gaji disetujui", pesan);
  } else if (v.data.aksi === "tolak") {
    await prisma.gajiPerubahan.update({ where: { id: gp.id }, data: { status: "DITOLAK", diputuskanOlehId: user.id, decidedAt: new Date(), catatan } });
    await prisma.auditLog.create({ data: { aktorId: user.id, aksi: "GAJI_PERUBAHAN_DITOLAK", catatan: `${gp.userId}: ditolak` } });
    const pesan = `Perubahan gaji ${gp.user.nama} ditolak.${catatan ? " Alasan: " + catatan : ""}`;
    await notifApp(gp.pengajuId, "Perubahan gaji ditolak", pesan, undefined, "APP", "GAJI");
    await kirimWebPush(gp.pengajuId, "Perubahan gaji ditolak", pesan);
  } else {
    await prisma.gajiPerubahan.update({ where: { id: gp.id }, data: { status: "DIKEMBALIKAN", diputuskanOlehId: user.id, decidedAt: new Date(), catatan } });
    await prisma.auditLog.create({ data: { aktorId: user.id, aksi: "GAJI_PERUBAHAN_DIKEMBALIKAN", catatan: `${gp.userId}: dikembalikan` } });
    const pesan = `Perubahan gaji ${gp.user.nama} dikembalikan.${catatan ? " Catatan: " + catatan : ""}`;
    await notifApp(gp.pengajuId, "Perubahan gaji dikembalikan", pesan, undefined, "APP", "GAJI");
    await kirimWebPush(gp.pengajuId, "Perubahan gaji dikembalikan", pesan);
  }
  redirect("/persetujuan");
}