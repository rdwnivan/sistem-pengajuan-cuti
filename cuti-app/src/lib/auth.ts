import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "./prisma";

const COOKIE = "sesi-cuti";
const EXPIRE_DAYS = 7;

export async function buatSesi(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + EXPIRE_DAYS * 86400 * 1000);
  await prisma.sesi.create({ data: { token, userId, expiresAt } });
  cookies().set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", expires: expiresAt });
}

export async function userDariSesi() {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  const sesi = await prisma.sesi.findUnique({ where: { token }, include: { user: true } });
  if (!sesi || sesi.expiresAt < new Date() || !sesi.user.statusAktif) return null;
  return sesi.user;
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
  const token = cookies().get(COOKIE)?.value;
  if (token) await prisma.sesi.deleteMany({ where: { token } });
  cookies().delete(COOKIE);
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
