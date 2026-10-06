"use server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAtasan } from "@/lib/auth";
import { parseTglInput } from "@/lib/cuti";
import { notifApp } from "@/lib/notif";
import { aktor } from "./shared";

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
  await prisma.delegasi.create({
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
