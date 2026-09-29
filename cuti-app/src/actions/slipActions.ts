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


export async function aksiBuatSlip(_: unknown, fd: FormData) {
  const admin = await aktor();
  if (admin.role !== "HR_ADMIN") return { error: "Hanya HR" };
  const v = slipSchema.safeParse({
    userId: fd.get("userId"), tahun: fd.get("tahun"), bulan: fd.get("bulan"),
    gajiPokok: fd.get("gajiPokok"),
    tunjanganJabatan: fd.get("tunjanganJabatan"), tunjanganTransport: fd.get("tunjanganTransport"),
    tunjanganMakan: fd.get("tunjanganMakan"), lembur: fd.get("lembur"), bonus: fd.get("bonus"),
    pph21: fd.get("pph21"), bpjsKesehatan: fd.get("bpjsKesehatan"),
    bpjsKetenagakerjaan: fd.get("bpjsKetenagakerjaan"), potonganLain: fd.get("potonganLain"),
    catatan: fd.get("catatan"),
  });
  if (!v.success) return { error: v.error.issues[0].message };
  const karyawan = await prisma.user.findUnique({ where: { id: v.data.userId } });
  if (!karyawan || !karyawan.statusAktif) return { error: "Karyawan tidak valid" };
  const d = v.data;
  const gajiBersih = d.gajiPokok + d.tunjanganJabatan + d.tunjanganTransport + d.tunjanganMakan
    + d.lembur + d.bonus - d.pph21 - d.bpjsKesehatan - d.bpjsKetenagakerjaan - d.potonganLain;
  if (gajiBersih < 0) return { error: "Potongan melebihi gaji (gaji bersih negatif)" };
  try {
    await prisma.slipGaji.create({
      data: {
        userId: v.data.userId, tahun: v.data.tahun, bulan: v.data.bulan,
        gajiPokok: v.data.gajiPokok,
        tunjanganJabatan: d.tunjanganJabatan, tunjanganTransport: d.tunjanganTransport,
        tunjanganMakan: d.tunjanganMakan, lembur: d.lembur, bonus: d.bonus,
        pph21: d.pph21, bpjsKesehatan: d.bpjsKesehatan,
        bpjsKetenagakerjaan: d.bpjsKetenagakerjaan, potonganLain: d.potonganLain,
        gajiBersih, catatan: v.data.catatan ?? null,
      },
    });
  } catch {
    return { error: `Slip ${BULAN_NAMA[v.data.bulan - 1]} ${v.data.tahun} untuk ${karyawan.nama} sudah ada` };
  }
  const pesanSlip = `Slip ${BULAN_NAMA[v.data.bulan - 1]} ${v.data.tahun} diterbitkan. Gaji bersih: ${gajiBersih.toLocaleString("id-ID")}.`;
  await notifApp(v.data.userId, "Slip gaji terbit", pesanSlip, undefined, "APP", "SLIP");
  await kirimWebPush(v.data.userId, "Slip gaji terbit", pesanSlip);
  redirect("/hr/slip-gaji");
}


export async function aksiBatalSlip(fd: FormData) {
  const admin = await aktor();
  if (admin.role !== "HR_ADMIN") redirect("/hr/slip-gaji");
  const id = (fd.get("id") as string) || "";
  const s = await prisma.slipGaji.findUnique({ where: { id } });
  if (!s || s.status === "DIBATALKAN") redirect("/hr/slip-gaji");
  await prisma.slipGaji.update({ where: { id }, data: { status: "DIBATALKAN" } });
  await prisma.auditLog.create({ data: { aktorId: admin.id, aksi: "SLIP_DIBATALKAN", catatan: `${s.userId} ${s.bulan}/${s.tahun}` } });
  await notifApp(s.userId, "Slip gaji dibatalkan HR", `Slip ${BULAN_NAMA[s.bulan - 1]} ${s.tahun} dibatalkan. Hubungi HR bila ini tidak sesuai.`, undefined, "APP", "SLIP");
  await kirimWebPush(s.userId, "Slip gaji dibatalkan HR", `Slip ${BULAN_NAMA[s.bulan - 1]} ${s.tahun} dibatalkan. Hubungi HR bila ini tidak sesuai.`);
  redirect("/hr/slip-gaji");
}