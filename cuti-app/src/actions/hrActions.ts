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


export async function aksiSimpanUser(_: unknown, fd: FormData) {
  const admin = await aktor();
  if (admin.role !== "HR_ADMIN") return { error: "Hanya HR" };
  const id = (fd.get("id") as string) || "";
  const v = userSchema.safeParse({
    nama: fd.get("nama"), email: fd.get("email"), password: fd.get("password"),
    jabatan: fd.get("jabatan"), noHp: fd.get("noHp"), tglMasuk: fd.get("tglMasuk"),
    role: fd.get("role"), atasanId: fd.get("atasanId"), statusAktif: fd.get("statusAktif"),
    gajiPokok: fd.get("gajiPokok"), tunjanganTetap: fd.get("tunjanganTetap"),
  });
  if (!v.success) return { error: v.error.issues[0].message };
  const email = v.data.email.toLowerCase().trim();
  const atasanId = v.data.atasanId ?? null;
  if (id && atasanId === id) return { error: "Atasan tidak boleh diri sendiri" };
  const data: Record<string, unknown> = {
    nama: v.data.nama.trim(), email, jabatan: v.data.jabatan ?? null, noHp: v.data.noHp ?? null,
    tglMasuk: parseTglInput(v.data.tglMasuk), role: v.data.role, atasanId,
    statusAktif: fd.get("statusAktif") === "on",
  };
  if (v.data.password) data.passwordHash = await hashPassword(v.data.password);
  try {
    if (id) {
      const existing = await prisma.user.findUnique({ where: { id } });
      if (!existing) return { error: "Karyawan tidak valid" };
      const gajiChanged = (existing.gajiPokok ?? 0) !== v.data.gajiPokok || (existing.tunjanganTetap ?? 0) !== v.data.tunjanganTetap;
      if (gajiChanged) {
        const res = await ajukanPerubahanGaji({
          userId: id, pengajuId: admin.id,
          gajiPokokBaru: v.data.gajiPokok, tunjanganTetapBaru: v.data.tunjanganTetap,
          alasan: "Perubahan gaji oleh HR",
        });
        if (res.error) return res;
      }
      await prisma.user.update({ where: { id }, data });
    } else {
      if (!v.data.password) return { error: "Password wajib untuk akun baru" };
      await prisma.user.create({ data: { ...data, gajiPokok: v.data.gajiPokok, tunjanganTetap: v.data.tunjanganTetap, passwordHash: data.passwordHash as string } as Parameters<typeof prisma.user.create>[0]["data"] });
    }
  } catch {
    return { error: "Email sudah dipakai" };
  }
  redirect("/hr/karyawan");
}


export async function aksiSimpanJenis(_: unknown, fd: FormData) {
  const admin = await aktor();
  if (admin.role !== "HR_ADMIN") return { error: "Hanya HR" };
  const id = (fd.get("id") as string) || "";
  const v = jenisSchema.safeParse({
    nama: fd.get("nama"), kuota: fd.get("kuota"), memotongKuotaTahunan: fd.get("memotongKuotaTahunan"),
    lampiranWajib: fd.get("lampiranWajib"), lampiranWajibJikaLebihDari: fd.get("lampiranWajibJikaLebihDari"),
    minHariSebelum: fd.get("minHariSebelum"), butuhMasaKerjaBulan: fd.get("butuhMasaKerjaBulan"), aktif: fd.get("aktif"),
  });
  if (!v.success) return { error: v.error.issues[0].message };
  const data = {
    nama: v.data.nama.trim(), kuota: v.data.kuota,
    memotongKuotaTahunan: v.data.memotongKuotaTahunan,
    lampiranWajib: v.data.lampiranWajib,
    lampiranWajibJikaLebihDari: v.data.lampiranWajibJikaLebihDari ?? null,
    minHariSebelum: v.data.minHariSebelum, butuhMasaKerjaBulan: v.data.butuhMasaKerjaBulan,
    aktif: v.data.aktif,
  };
  try {
    if (id) await prisma.jenisCuti.update({ where: { id }, data });
    else await prisma.jenisCuti.create({ data });
  } catch {
    return { error: "Nama jenis cuti sudah ada" };
  }
  redirect("/hr/jenis");
}


export async function aksiTambahLibur(fd: FormData): Promise<void> {
  const admin = await aktor();
  if (admin.role !== "HR_ADMIN") redirect("/hr");
  const tgl = (fd.get("tanggal") as string) || "";
  const ket = ((fd.get("keterangan") as string) || "").trim();
  if (!tgl || !ket) redirect("/hr/libur");
  try {
    await prisma.hariLibur.create({ data: { tanggal: parseTglInput(tgl), keterangan: ket } });
  } catch {
    redirect("/hr/libur");
  }
  redirect("/hr/libur");
}


export async function aksiHapusLibur(fd: FormData) {
  const admin = await aktor();
  if (admin.role !== "HR_ADMIN") return;
  const id = (fd.get("id") as string) || "";
  await prisma.hariLibur.delete({ where: { id } });
  redirect("/hr/libur");
}
