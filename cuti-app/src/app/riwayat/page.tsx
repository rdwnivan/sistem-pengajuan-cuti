import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isAtasan, wajibLogin } from "@/lib/auth";
import { Badge } from "@/components/ui";
import { Shell } from "@/components/shell";
import { fmtTgl } from "@/lib/cuti";

export default async function Riwayat() {
  const user = await wajibLogin();
  const list = await prisma.pengajuan.findMany({
    where: { pemohonId: user.id }, include: { jenis: true }, orderBy: { createdAt: "desc" },
  });
  return (
    <Shell nama={user.nama} role={user.role} isAtasan={await isAtasan(user.id)}>
      <h1 className="text-lg font-bold">Riwayat Pengajuan Saya</h1>
      <div className="space-y-2">
        {list.length === 0 && <p className="text-sm text-zinc-500">Belum ada.</p>}
        {list.map((p) => (
          <Link key={p.id} href={`/cuti/${p.id}`} className="flex items-center justify-between rounded-xl border bg-white px-3 py-2">
            <div className="text-sm">
              <div className="font-semibold">{p.jenis.nama} · {p.jumlahHariKerja} hari</div>
              <div className="text-xs text-zinc-500">{fmtTgl(p.tglMulai)} → {fmtTgl(p.tglSelesai)}</div>
            </div>
            <Badge status={p.status} />
          </Link>
        ))}
      </div>
    </Shell>
  );
}
