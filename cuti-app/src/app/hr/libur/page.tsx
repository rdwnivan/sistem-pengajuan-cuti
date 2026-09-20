import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { wajibHR } from "@/lib/auth";
import { Shell } from "@/components/shell";
import { fmtTgl } from "@/lib/cuti";
import { aksiTambahLibur, aksiHapusLibur } from "@/app/actions";

export default async function LiburPage() {
  const admin = await wajibHR();
  const list = await prisma.hariLibur.findMany({ orderBy: { tanggal: "desc" } });
  return (
    <Shell nama={admin.nama} role={admin.role} isAtasan={true}>
      <h1 className="text-lg font-bold">Hari Libur Nasional / Cuti Bersama</h1>
      <form action={aksiTambahLibur} className="rounded-xl border bg-white p-4 space-y-2">
        <h2 className="font-bold">Tambah Hari Libur</h2>
        <div className="grid grid-cols-2 gap-2">
          <label className="block"><span className="text-sm font-semibold">Tanggal</span><input name="tanggal" type="date" required className="w-full rounded-lg border border-zinc-300 px-3 py-2" /></label>
          <label className="block"><span className="text-sm font-semibold">Keterangan</span><input name="keterangan" required className="w-full rounded-lg border border-zinc-300 px-3 py-2" /></label>
        </div>
        <button className="rounded-lg bg-emerald-700 px-3 py-2 font-bold text-white">Tambah</button>
      </form>
      <div className="mt-4 space-y-2">
        {list.map((l) => (
          <form key={l.id} action={aksiHapusLibur} className="flex items-center justify-between rounded-xl border bg-white px-3 py-2">
            <input type="hidden" name="id" value={l.id} />
            <div className="text-sm">
              <div className="font-semibold">{fmtTgl(l.tanggal)}</div>
              <div className="text-xs text-zinc-500">{l.keterangan}</div>
            </div>
            <button className="text-red-600 font-semibold">Hapus</button>
          </form>
        ))}
      </div>
      <Link href="/hr" className="mt-3 block text-sm font-semibold text-emerald-700">← Panel HR</Link>
    </Shell>
  );
}