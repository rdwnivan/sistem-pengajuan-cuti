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


export async function aksiBacaNotif(fd: FormData): Promise<void> {
  const user = await aktor();
  const id = (fd.get("id") as string) || "";
  await prisma.notifikasi.updateMany({ where: { id, userId: user.id }, data: { dibaca: true } });
  redirect("/notifikasi");
}


export async function aksiBacaSemuaNotif(): Promise<void> {
  const user = await aktor();
  await prisma.notifikasi.updateMany({ where: { userId: user.id, dibaca: false }, data: { dibaca: true } });
  redirect("/notifikasi");
}