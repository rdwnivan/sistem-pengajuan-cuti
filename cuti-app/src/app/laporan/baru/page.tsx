import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { wajibLogin, isAtasan } from "@/lib/auth";
import { LaporanForm } from "./LaporanForm";

export default async function LaporanBaruPage({ searchParams }: { searchParams: { edit?: string } }) {
  const user = await wajibLogin();
  if (user.role === "HR_ADMIN" || (await isAtasan(user.id))) redirect("/");
  let initial: { tglLaporan?: string; lokasi?: string; shift?: string | null; judul?: string; isi?: string; approverId?: string } | undefined;

  if (searchParams.edit) {
    const l = await prisma.laporanLapangan.findUnique({ where: { id: searchParams.edit }, select: { pembuatId: true, tglLaporan: true, lokasi: true, shift: true, judul: true, isi: true, approverId: true } });
    if (!l || l.pembuatId !== user.id) notFound();
    initial = { tglLaporan: l.tglLaporan.toISOString().slice(0, 10), lokasi: l.lokasi, shift: l.shift ?? "", judul: l.judul, isi: l.isi, approverId: l.approverId ?? "" };
  }

  return (
    <div className="mx-auto max-w-2xl px-3 pb-10 pt-4">
      <Link href="/laporan" className="mb-3 inline-block text-sm font-semibold text-emerald-700 hover:underline">← Kembali</Link>
      <h1 className="mb-4 text-lg font-bold">{searchParams.edit ? "Revisi Laporan" : "Laporan Baru"}</h1>
      <LaporanForm editId={searchParams.edit} initial={initial} />
    </div>
  );
}
