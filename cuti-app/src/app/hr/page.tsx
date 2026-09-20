import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { wajibHR } from "@/lib/auth";
import { Badge } from "@/components/ui";
import { Shell } from "@/components/shell";
import { fmtTgl } from "@/lib/cuti";

export default async function HRHome() {
  const user = await wajibHR();
  const now = new Date();
  const todayStr = fmtTgl(now);
  const menunggu = await prisma.pengajuan.findMany({
    where: { status: { in: ["MENUNGGU_ATASAN", "MENUNGGU_HR"] } },
    include: { pemohon: true, jenis: true },
    orderBy: { updatedAt: "asc" },
  });
  const sedangCuti = await prisma.pengajuan.findMany({
    where: { status: "DISETUJUI", tglMulai: { lte: now }, tglSelesai: { gte: now } },
    include: { pemohon: true, jenis: true },
    orderBy: { tglSelesai: "asc" },
  });
  const mendesak = menunggu.filter((p) => {
    const sisa = Math.floor((p.tglMulai.getTime() - now.getTime()) / 86400000);
    return sisa >= 0 && sisa <= 3;
  });
  const totalUser = await prisma.user.count();
  const cards = [
    { href: "/hr/pengajuan", label: `Semua Pengajuan (${menunggu.length} tertunda)` },
    { href: "/hr/laporan", label: "Rekap & Ekspor" },
    { href: "/hr/karyawan", label: `Karyawan (${totalUser})` },
    { href: "/hr/jenis", label: "Jenis Cuti" },
    { href: "/hr/libur", label: "Hari Libur" },
    { href: "/kalender", label: "Kalender Cuti" },
  ];
  return (
    <Shell nama={user.nama} role={user.role} isAtasan={true}>
      <h1 className="text-lg font-bold">Panel HR</h1>
      <section className="rounded-xl border-2 border-red-400 bg-red-50 p-3">
        <h2 className="font-bold text-red-800">Mendesak: mulai ≤3 hari tapi belum disetujui ({mendesak.length})</h2>
        <div className="mt-2 space-y-1">
          {mendesak.length === 0 && <p className="text-sm">Tidak ada.</p>}
          {mendesak.map((p) => (
            <Link key={p.id} href={`/cuti/${p.id}`} className="flex items-center justify-between rounded-lg border bg-white px-2 py-1 text-sm">
              <span>{p.pemohon.nama} · {p.jenis.nama} · mulai {fmtTgl(p.tglMulai)}</span>
              <Badge status={p.status} />
            </Link>
          ))}
        </div>
      </section>
      <section className="rounded-xl border bg-white p-3">
        <h2 className="font-bold">Tertunda ({menunggu.length}) — beserta lama menunggu</h2>
        <div className="mt-2 space-y-1">
          {menunggu.slice(0, 10).map((p) => {
            const hari = Math.floor((now.getTime() - p.updatedAt.getTime()) / 86400000);
            return (
              <Link key={p.id} href={`/cuti/${p.id}`} className="flex items-center justify-between rounded-lg border px-2 py-1 text-sm">
                <span>{p.pemohon.nama} · {p.jenis.nama}</span>
                <span className="text-xs font-bold text-amber-700">{hari} hari</span>
              </Link>
            );
          })}
          {menunggu.length === 0 && <p className="text-sm text-zinc-500">Tidak ada.</p>}
        </div>
      </section>
      <section className="rounded-xl border bg-white p-3">
        <h2 className="font-bold">Sedang cuti hari ini ({todayStr}): {sedangCuti.length} orang</h2>
        <div className="mt-2 space-y-1 text-sm">
          {sedangCuti.map((p) => (
            <div key={p.id} className="rounded-lg border px-2 py-1">{p.pemohon.nama} · {p.jenis.nama} s/d {fmtTgl(p.tglSelesai)}</div>
          ))}
          {sedangCuti.length === 0 && <p className="text-sm text-zinc-500">Tidak ada.</p>}
        </div>
      </section>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="rounded-xl border bg-white p-4 font-bold text-emerald-800">{c.label}</Link>
        ))}
      </div>
    </Shell>
  );
}
