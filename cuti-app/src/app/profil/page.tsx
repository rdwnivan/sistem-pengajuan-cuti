import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isAtasan, wajibLogin } from "@/lib/auth";
import { Shell } from "@/components/shell";
import { fmtTgl } from "@/lib/cuti";
import { PasswordForm } from "./PasswordForm";

export default async function Profil({ searchParams }: { searchParams: { ok?: string } }) {
  const user = await wajibLogin();
  const db = await prisma.user.findUnique({ where: { id: user.id }, include: { atasan: true } });
  return (
    <Shell nama={user.nama} role={user.role} isAtasan={await isAtasan(user.id)}>
      <h1 className="text-lg font-bold">Profil Saya</h1>
      {searchParams.ok && <div className="rounded-lg border border-green-400 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">Password berhasil diubah.</div>}
      <div className="rounded-xl border bg-white p-4 text-sm">
        <div className="font-bold">{db?.nama}</div>
        <div className="text-zinc-600">{db?.email} · {db?.jabatan ?? "-"}</div>
        <div className="text-zinc-600">Masuk: {db ? fmtTgl(db.tglMasuk) : "-"} · Atasan: {db?.atasan?.nama ?? "-"}</div>
        <Link href={db?.role === "HR_ADMIN" ? "/hr/laporan" : "/riwayat"} className="mt-1 inline-block font-semibold text-emerald-700">Riwayat saya</Link>
      </div>
      <PasswordForm />
    </Shell>
  );
}
