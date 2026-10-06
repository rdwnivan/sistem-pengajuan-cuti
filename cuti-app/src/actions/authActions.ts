"use server";
import { redirect } from "next/navigation";
import { keluar as keluarSesi, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aktor } from "./shared";

export async function aksiKeluar() {
  await keluarSesi();
}


export async function aksiUbahPassword(_: unknown, fd: FormData) {
  const user = await aktor();
  const lama = ((fd.get("lama") as string) || "");
  const baru = ((fd.get("baru") as string) || "");
  if (baru.length < 6) return { error: "Password baru minimal 6 karakter" };
  const { default: bcrypt } = await import("bcryptjs");
  const db = await prisma.user.findUnique({ where: { id: user.id } });
  if (!db) return { error: "Akun tidak ditemukan" };
  const ok = await bcrypt.compare(lama, db.passwordHash);
  if (!ok) return { error: "Password lama salah" };
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(baru) } });
  redirect("/profil?ok=1");
}

export async function aksiUbahProfil(_: unknown, fd: FormData) {
  const user = await aktor();
  const raw = ((fd.get("noHp") as string) || "").trim();
  const notifWa = fd.get("notifWa") === "on";
  let noHp: string | null = null;
  if (raw) {
    let norm = raw.replace(/[^0-9]/g, "");
    if (!norm) return { error: "No HP tidak valid" };
    if (norm.startsWith("0")) norm = "62" + norm.slice(1);
    if (norm.length < 10 || norm.length > 15) return { error: "No HP tidak valid (10-15 digit)" };
    noHp = norm;
  }
  await prisma.user.update({ where: { id: user.id }, data: { noHp, notifWa } });
  redirect("/profil?ok=2");
}
