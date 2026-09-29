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


export async function aksiSimpanDelegasi(_: unknown, fd: FormData) {
  const user = await aktor();
  const keId = ((fd.get("keId") as string) || "").trim();
  const tglMulai = (fd.get("tglMulai") as string) || "";
  const tglSelesai = (fd.get("tglSelesai") as string) || "";
  if (!keId || !tglMulai || !tglSelesai) return { error: "Penerima dan rentang tanggal wajib" };
  const userAtasan = await isAtasan(user.id);
  if (user.role !== "HR_ADMIN" && !userAtasan) return { error: "Hanya atasan atau HR yang bisa membuat delegasi" };
  if (keId === user.id) return { error: "Tidak bisa delegasi ke diri sendiri" };
  const target = await prisma.user.findUnique({ where: { id: keId } });
  if (!target || !target.statusAktif) return { error: "Penerima tidak valid" };
  if (user.role === "HR_ADMIN") {
    if (target.role !== "HR_ADMIN") return { error: "HR hanya bisa mendelegasikan ke HR lain" };
  } else {
    if (target.role === "HR_ADMIN" || !(await isAtasan(target.id)))
      return { error: "Atasan hanya bisa mendelegasikan ke atasan lain" };
  }
  if (tglSelesai < tglMulai) return { error: "Tanggal selesai sebelum mulai" };
  await prisma.delegasi.updateMany({ where: { dariId: user.id, aktif: true }, data: { aktif: false } });
  const d = await prisma.delegasi.create({
    data: { dariId: user.id, keId, tglMulai: parseTglInput(tglMulai), tglSelesai: parseTglInput(tglSelesai) },
  });
  await prisma.auditLog.create({ data: { aktorId: user.id, aksi: "DELEGASI_BUAT", catatan: `Delegasi ke ${target.nama} ${tglMulai}→${tglSelesai}` } });
  await notifApp(keId, "Anda ditunjuk sebagai delegasi", `${user.nama} menunjuk Anda menyetujui cuti ${tglMulai}→${tglSelesai}.`, undefined, "DELEGASI");
  redirect("/delegasi");
}


export async function aksiBatalDelegasi(fd: FormData): Promise<void> {
  const user = await aktor();
  const id = (fd.get("id") as string) || "";
  await prisma.delegasi.updateMany({ where: { id, dariId: user.id }, data: { aktif: false } });
  await prisma.auditLog.create({ data: { aktorId: user.id, aksi: "DELEGASI_BATAL", catatan: id } });
  redirect("/delegasi");
}
