import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isAtasan, wajibLogin } from "@/lib/auth";
import { Badge } from "@/components/ui";
import { Shell } from "@/components/shell";
import { fmtTgl } from "@/lib/cuti";

export default async function Persetujuan() {
  const user = await wajibLogin();
  const atasan = await isAtasan(user.id);
  const isHR = user.role === "HR_ADMIN";
  const now = new Date();

  const laporanList = atasan
    ? await prisma.laporanLapangan.findMany({
        where: { status: "MENUNGGU", OR: [{ approverId: user.id }, { pembuat: { atasanId: user.id } }] },
        include: { pembuat: true, approver: true },
        orderBy: { createdAt: "asc" },
      })
    : [];

  type Row = { id: string; jumlahHariKerja: number; tglMulai: Date; tglSelesai: Date; status: string; updatedAt: Date; jenis: { nama: string }; pemohon: { nama: string } };
  let list: Row[] = [];
  let viaDelegasiIds: string[] = [];
  if (isHR) {
    list = await prisma.pengajuan.findMany({
      where: { OR: [{ status: "MENUNGGU_HR" }, { status: "MENUNGGU_ATASAN" }] },
      include: { jenis: true, pemohon: true }, orderBy: { createdAt: "asc" },
    });
  } else if (atasan) {
    const langsung = await prisma.pengajuan.findMany({
      where: { status: "MENUNGGU_ATASAN", OR: [{ pemohon: { atasanId: user.id } }, { approverId: user.id }, { eskalasiKeId: user.id }] },
      include: { jenis: true, pemohon: true }, orderBy: { createdAt: "asc" },
    });
    list = langsung;
    const delegasiDari = await prisma.delegasi.findMany({
      where: { keId: user.id, aktif: true, tglMulai: { lte: now }, tglSelesai: { gte: now } },
      select: { dariId: true },
    });
    for (const a of delegasiDari) {
      const l = await prisma.pengajuan.findMany({
        where: { status: "MENUNGGU_ATASAN", pemohon: { atasanId: a.dariId } },
        include: { jenis: true, pemohon: true }, orderBy: { createdAt: "asc" },
      });
      viaDelegasiIds.push(...l.map((x) => x.id));
      list.push(...l);
    }
    const seen = new Set<string>();
    list = list.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
  }

  const total = list.length + laporanList.length;

  return (
    <Shell nama={user.nama} role={user.role} isAtasan={atasan}>
      <h1 className="text-lg font-bold">
        Persetujuan <span className="text-sm font-semibold text-zinc-500">({total} menunggu)</span>
      </h1>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-zinc-600">
          Cuti <span className="font-semibold text-zinc-400">({list.length})</span>
        </h2>
        {list.length === 0 && (
          <p className="rounded-xl border bg-white p-4 text-sm text-zinc-500">Tidak ada antrean cuti.</p>
        )}
        {list.map((p) => {
          const hari = Math.floor((now.getTime() - p.updatedAt.getTime()) / 86400000);
          return (
            <Link key={p.id} href={`/cuti/${p.id}`} className="flex items-center justify-between rounded-xl border bg-white px-3 py-2">
              <div className="text-sm">
                <div className="font-semibold">{p.pemohon.nama} · {p.jenis.nama} {p.jumlahHariKerja} hari {viaDelegasiIds.includes(p.id) && <span className="ml-1 rounded bg-blue-100 px-1.5 text-xs text-blue-700">delegasi</span>}</div>
                <div className="text-xs text-zinc-500">{fmtTgl(p.tglMulai)} → {fmtTgl(p.tglSelesai)} · menunggu {hari} hari</div>
              </div>
              <Badge status={p.status} />
            </Link>
          );
        })}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-zinc-600">
          Laporan Lapangan <span className="font-semibold text-zinc-400">({laporanList.length})</span>
        </h2>
        {laporanList.length === 0 && (
          <p className="rounded-xl border bg-white p-4 text-sm text-zinc-500">Tidak ada laporan menunggu.</p>
        )}
        {laporanList.map((l) => {
          const hari = Math.floor((now.getTime() - l.updatedAt.getTime()) / 86400000);
          return (
            <Link key={l.id} href={`/laporan/${l.id}`} className="block rounded-xl border bg-white px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold">{l.pembuat.nama} · {l.judul}</div>
                  <div className="text-xs text-zinc-500">{l.lokasi}{l.shift ? ` (${l.shift})` : ""} · {fmtTgl(l.tglLaporan)} · menunggu {hari} hari</div>
                  {l.approver && <div className="text-xs text-zinc-400">Ditunjuk: {l.approver.nama}</div>}
                </div>
                <Badge status={l.status} />
              </div>
            </Link>
          );
        })}
      </section>
    </Shell>
  );
}
