import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { wajibLogin, isAtasan } from "@/lib/auth";
import { Badge } from "@/components/ui";
import { LABEL_STATUS_LAPORAN } from "@/lib/pdf";
import { Shell } from "@/components/shell";
import { aksiBatalLaporan } from "@/actions";

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agus", "Sep", "Okt", "Nov", "Des"];

function tglValid(s?: string): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T12:00:00");
  return !isNaN(d.getTime());
}

export default async function LaporanSaya({ searchParams }: { searchParams: Promise<{ stat?: string; dari?: string; sampai?: string }> }) {
  const sp = await searchParams;
  const user = await wajibLogin();
  if (user.role === "HR_ADMIN" || (await isAtasan(user.id))) redirect("/");
  const stat = sp.stat ?? "semua";
  const dari = tglValid(sp.dari) ? (sp.dari as string) : undefined;
  const sampai = tglValid(sp.sampai) ? (sp.sampai as string) : undefined;
  const where: { pembuatId: string; status?: string; tglLaporan?: { gte?: Date; lte?: Date } } =
    stat === "semua" ? { pembuatId: user.id } : { pembuatId: user.id, status: stat };
  if (dari || sampai) {
    where.tglLaporan = {
      ...(dari ? { gte: new Date(dari + "T00:00:00") } : {}),
      ...(sampai ? { lte: new Date(sampai + "T23:59:59") } : {}),
    };
  }
  const list = await prisma.laporanLapangan.findMany({
    where, include: { approver: true }, orderBy: { createdAt: "desc" },
  });
  const qsTanggal = `${dari ? `&dari=${dari}` : ""}${sampai ? `&sampai=${sampai}` : ""}`;

  return (
    <Shell nama={user.nama} role={user.role} isAtasan={false}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold">Laporan Lapangan</h1>
        <Link href="/laporan/baru" className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-bold text-white">+ Laporan Baru</Link>
      </div>
      <form method="get" action="/laporan" className="flex flex-wrap items-end gap-2 rounded-xl border bg-white p-3">
        <input type="hidden" name="stat" value={stat} />
        <label className="text-xs font-semibold">Dari
          <input name="dari" type="date" defaultValue={dari ?? ""} className="ml-1 rounded-lg border px-2 py-1.5" />
        </label>
        <label className="text-xs font-semibold">Sampai
          <input name="sampai" type="date" defaultValue={sampai ?? ""} className="ml-1 rounded-lg border px-2 py-1.5" />
        </label>
        <button className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-bold text-white">Filter</button>
        {(dari || sampai) && <Link href={`/laporan?stat=${stat}`} className="rounded-lg border px-3 py-1.5 text-xs font-bold text-zinc-700">Reset</Link>}
      </form>
      <div className="flex gap-1 text-xs font-semibold">
        {[
          { href: `/laporan?stat=semua${qsTanggal}`, label: "Semua" },
          { href: `/laporan?stat=DRAFT${qsTanggal}`, label: "Draf" },
          { href: `/laporan?stat=MENUNGGU${qsTanggal}`, label: "Menunggu Acc" },
          { href: `/laporan?stat=DISETUJUI${qsTanggal}`, label: "Disetujui" },
          { href: `/laporan?stat=DITOLAK${qsTanggal}`, label: "Ditolak" },
          { href: `/laporan?stat=DIKEMBALIKAN${qsTanggal}`, label: "Dikembalikan" },
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
