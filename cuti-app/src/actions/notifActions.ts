"use server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { aktor } from "./shared";

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