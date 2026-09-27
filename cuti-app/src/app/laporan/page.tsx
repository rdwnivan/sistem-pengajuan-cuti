import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { wajibLogin, isAtasan } from "@/lib/auth";
import { Badge } from "@/components/ui";
import { LABEL_STATUS_LAPORAN } from "@/lib/pdf";
import { Shell } from "@/components/shell";
import { aksiBatalLaporan } from "@/app/actions";

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agus", "Sep", "Okt", "Nov", "Des"];

export default async function LaporanSaya({ searchParams }: { searchParams: { stat?: string } }) {
  const user = await wajibLogin();
  if (user.role === "HR_ADMIN" || (await isAtasan(user.id))) redirect("/");
  const stat = searchParams.stat ?? "semua";
  const where = stat === "semua" ? { pembuatId: user.id } : { pembuatId: user.id, status: stat };
  const list = await prisma.laporanLapangan.findMany({
    where, include: { approver: true }, orderBy: { createdAt: "desc" },
  });

  return (
    <Shell nama={user.nama} role={user.role} isAtasan={false}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold">Laporan Lapangan</h1>
        <Link href="/laporan/baru" className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-bold text-white">+ Laporan Baru</Link>
      </div>
      <div className="flex gap-1 text-xs font-semibold">
        {[
          { href: "/laporan?stat=semua", label: "Semua" },
          { href: "/laporan?stat=DRAFT", label: "Draf" },
          { href: "/laporan?stat=MENUNGGU", label: "Menunggu Acc" },
          { href: "/laporan?stat=DISETUJUI", label: "Disetujui" },
          { href: "/laporan?stat=DITOLAK", label: "Ditolak" },
          { href: "/laporan?stat=DIKEMBALIKAN", label: "Dikembalikan" },
        ].map((l) => (
          <Link key={l.href} href={l.href} className={`rounded-lg px-2 py-1 ${l.label === (stat === "semua" ? "Semua" : LABEL_STATUS_LAPORAN[stat]?.label ?? stat) ? "bg-emerald-700 text-white" : "border text-zinc-700"}`}>
            {l.label}
          </Link>
        ))}
      </div>
      <div className="space-y-2">
        {list.length === 0 && <p className="rounded-xl border bg-white p-4 text-sm text-zinc-500">Belum ada laporan untuk filter ini.</p>}
        {list.map((l) => (
          <Link key={l.id} href={`/laporan/${l.id}`} className="block rounded-xl border bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-bold">{l.judul}</div>
                <div className="text-xs text-zinc-500">{BULAN[new Date(l.tglLaporan).getMonth()]} {new Date(l.tglLaporan).getFullYear()} · {l.lokasi}{l.shift ? ` (${l.shift})` : ""}</div>
              </div>
              <Badge status={l.status} />
            </div>
            {l.approver && <div className="mt-1 text-xs text-zinc-500">Acc: {l.approver.nama}</div>}
            {l.catatanApprover && <div className="mt-1 text-xs text-zinc-500">Catatan: {l.catatanApprover}</div>}
          </Link>
        ))}
      </div>
    </Shell>
  );
}
