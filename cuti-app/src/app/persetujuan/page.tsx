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
  return (
    <Shell nama={user.nama} role={user.role} isAtasan={atasan}>
      <h1 className="text-lg font-bold">Antrean Persetujuan</h1>
      <div className="space-y-2">
        {list.length === 0 && <p className="text-sm text-zinc-500">Tidak ada antrean.</p>}
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
      </div>
    </Shell>
  );
}
