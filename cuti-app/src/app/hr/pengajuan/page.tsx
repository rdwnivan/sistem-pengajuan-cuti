import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { wajibHR } from "@/lib/auth";
import { Badge } from "@/components/ui";
import { Shell } from "@/components/shell";
import { fmtTgl } from "@/lib/cuti";

export default async function HRPengajuan() {
  const user = await wajibHR();
  const list = await prisma.pengajuan.findMany({
    include: { jenis: true, pemohon: true }, orderBy: { createdAt: "desc" }, take: 100,
  });
  return (
    <Shell nama={user.nama} role={user.role} isAtasan={true}>
      <h1 className="text-lg font-bold">Semua Pengajuan</h1>
      <div className="space-y-2">
        {list.map((p) => (
          <Link key={p.id} href={`/cuti/${p.id}`} className="flex items-center justify-between rounded-xl border bg-white px-3 py-2">
            <div className="text-sm">
              <div className="font-semibold">{p.pemohon.nama} · {p.jenis.nama} {p.jumlahHariKerja} hari</div>
              <div className="text-xs text-zinc-500">{fmtTgl(p.tglMulai)} → {fmtTgl(p.tglSelesai)}</div>
            </div>
            <Badge status={p.status} />
          </Link>
        ))}
      </div>
    </Shell>
  );
}
