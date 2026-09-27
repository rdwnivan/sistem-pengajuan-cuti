import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { wajibLogin, isAtasan } from "@/lib/auth";
import { Badge } from "@/components/ui";
import { Shell } from "@/components/shell";
import { namaBulan } from "@/lib/pdf";

export default async function SlipGajiSaya() {
  const user = await wajibLogin();
  const atasan = await isAtasan(user.id);
  const list = await prisma.slipGaji.findMany({
    where: { userId: user.id, status: "TERBIT" },
    orderBy: [{ tahun: "desc" }, { bulan: "desc" }],
  });
  const totalTahunIni = list.filter((s) => s.tahun === new Date().getFullYear()).reduce((a, s) => a + s.gajiBersih, 0);

  return (
    <Shell nama={user.nama} role={user.role} isAtasan={atasan}>
      <h1 className="text-lg font-bold">Slip Gaji Saya</h1>
      <div className="rounded-xl border-2 border-emerald-600 bg-emerald-50 p-3">
        <div className="text-xs font-semibold text-emerald-900">Total diterima tahun {new Date().getFullYear()}</div>
        <div className="text-2xl font-bold text-emerald-800">Rp {totalTahunIni.toLocaleString("id-ID")}</div>
      </div>
      <p className="text-xs text-zinc-500">Slip gaji bersifat rahasia. Jangan dibagikan ke siapa pun.</p>
      <div className="space-y-2">
        {list.length === 0 && (
          <p className="rounded-xl border bg-white p-4 text-sm text-zinc-500">Belum ada slip gaji. Slip terbit setelah HR menerbitkannya.</p>
        )}
        {list.map((s) => (
          <Link key={s.id} href={`/slip-gaji/${s.id}`} className="block rounded-xl border bg-white p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold">{namaBulan(s.bulan)} {s.tahun}</div>
                <div className="text-xs text-zinc-500">Gaji bersih</div>
                <div className="text-lg font-bold text-emerald-800">Rp {s.gajiBersih.toLocaleString("id-ID")}</div>
              </div>
              <Badge status={s.status} />
            </div>
          </Link>
        ))}
      </div>
    </Shell>
  );
}
