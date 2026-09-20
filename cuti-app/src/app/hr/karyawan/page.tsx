import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { wajibHR } from "@/lib/auth";
import { Shell } from "@/components/shell";

export default async function KaryawanList() {
  const user = await wajibHR();
  const list = await prisma.user.findMany({ include: { atasan: true }, orderBy: { nama: "asc" } });
  return (
    <Shell nama={user.nama} role={user.role} isAtasan={true}>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Kelola Karyawan</h1>
        <Link href="/hr/karyawan/baru" className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-bold text-white">+ Baru</Link>
      </div>
      <div className="space-y-2">
        {list.map((u) => (
          <Link key={u.id} href={`/hr/karyawan/${u.id}`} className="block rounded-xl border bg-white px-3 py-2 text-sm">
            <div className="font-semibold">{u.nama} {!u.statusAktif && "(nonaktif)"}</div>
            <div className="text-xs text-zinc-500">{u.email} · {u.role === "HR_ADMIN" ? "HR" : "Karyawan"} · Atasan: {u.atasan?.nama ?? "-"}</div>
          </Link>
        ))}
      </div>
    </Shell>
  );
}
