import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { wajibLogin, isAtasan } from "@/lib/auth";
import { LaporanForm } from "./LaporanForm";

export default async function LaporanBaruPage({ searchParams }: { searchParams: { edit?: string } }) {
  const user = await wajibLogin();
  if (user.role === "HR_ADMIN" || (await isAtasan(user.id))) redirect("/");
  let initial: { tglLaporan?: string; lokasi?: string; blok?: string | null; kegiatan?: string | null; jumlahTenagaKerja?: number | null; hasil?: string | null; cuaca?: string | null; lat?: number | null; lng?: number | null; shift?: string | null; judul?: string; isi?: string; approverId?: string } | undefined;
  let dariDraf = false;

  if (searchParams.edit) {
    const l = await prisma.laporanLapangan.findUnique({ where: { id: searchParams.edit }, select: { id: true, pembuatId: true, status: true, tglLaporan: true, lokasi: true, blok: true, kegiatan: true, jumlahTenagaKerja: true, hasil: true, cuaca: true, lat: true, lng: true, shift: true, judul: true, isi: true, approverId: true } });
    if (!l || l.pembuatId !== user.id) notFound();
    if (!["DRAFT", "DITOLAK", "DIKEMBALIKAN"].includes(l.status)) redirect(`/laporan/${l.id}`);
    dariDraf = l.status === "DRAFT";
    initial = { tglLaporan: l.tglLaporan.toISOString().slice(0, 10), lokasi: l.lokasi, blok: l.blok, kegiatan: l.kegiatan, jumlahTenagaKerja: l.jumlahTenagaKerja, hasil: l.hasil, cuaca: l.cuaca, lat: l.lat, lng: l.lng, shift: l.shift ?? "", judul: l.judul, isi: l.isi, approverId: l.approverId ?? "" };
  }

  const judul = searchParams.edit ? (dariDraf ? "Edit Laporan" : "Revisi Laporan") : "Laporan Baru";

  return (
    <div className="mx-auto max-w-2xl px-3 pb-10 pt-4">
      <Link href="/laporan" className="mb-3 inline-block text-sm font-semibold text-emerald-700 hover:underline">← Kembali</Link>
      <h1 className="mb-4 text-lg font-bold">{judul}</h1>
      <LaporanForm editId={searchParams.edit} initial={initial} dariDraf={dariDraf} />
    </div>
  );
}
