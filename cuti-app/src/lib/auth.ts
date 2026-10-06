import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "./prisma";

const COOKIE = "sesi-cuti";
const EXPIRE_DAYS = 7;

export async function buatSesi(userId: string) {
  const jar = await cookies();
  const tokenLama = jar.get(COOKIE)?.value;
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + EXPIRE_DAYS * 86400 * 1000);
  await prisma.sesi.create({ data: { token, userId, expiresAt } });
  // Rotasi token: login ulang (mis. di perangkat bersama) tidak boleh meninggalkan
  // row Sesi lama yang tetap valid 7 hari. Token baru dibuat lebih dulu supaya tidak
  // pernah ada jendela tanpa sesi valid bila pembuatan gagal.
  if (tokenLama) await prisma.sesi.deleteMany({ where: { token: tokenLama } });
  jar.set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", expires: expiresAt, secure: process.env.NODE_ENV === "production" });
}

export async function userDariSesi() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const sesi = await prisma.sesi.findUnique({ where: { token }, include: { user: true } });
  if (!sesi || sesiKedaluwarsa(sesi, new Date()) || !sesi.user.statusAktif) return null;
  return sesi.user;
}

/**
 * Satu-satunya sumber kebenaran "sesi sudah tidak berlaku karena waktu".
 * Dipakai `userDariSesi` (menolak sesi) DAN sapu `Sesi` kedaluwarsa di
 * `/api/cron` (menghapus row) — sengaja satu fungsi supaya penghapusan tidak
 * pernah menyimpang dari penolakan: kalau predikatnya beda, sapu bisa membuang
 * sesi yang masih valid, atau membiarkan row yang sudah mati.
 * Batas mengikuti penolakan lama (`expiresAt < now`): tepat di `expiresAt`
 * dianggap sudah kedaluwarsa.
 */
export function sesiKedaluwarsa(sesi: { expiresAt: Date }, sekarang = new Date()): boolean {
  return sesi.expiresAt < sekarang;
}

export async function wajibLogin() {
  const u = await userDariSesi();
  if (!u) redirect("/login");
  return u;
}

export async function wajibHR() {
  const u = await wajibLogin();
  if (u.role !== "HR_ADMIN") redirect("/");
  return u;
}

export async function verifikasiLogin(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !user.statusAktif) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  return ok ? user : null;
}

export async function keluar() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (token) await prisma.sesi.deleteMany({ where: { token } });
  (await cookies()).delete(COOKIE);
  redirect("/login");
}

export async function isAtasan(userId: string) {
  return (await prisma.user.count({ where: { atasanId: userId, statusAktif: true } })) > 0;
}

export async function approverUntuk(pemohonId: string): Promise<string | null> {
  const pemohon = await prisma.user.findUnique({ where: { id: pemohonId } });
  if (!pemohon?.atasanId) return null;
  return pemohon.atasanId;
}

export function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}
