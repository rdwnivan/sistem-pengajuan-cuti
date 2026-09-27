import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { wajibHR } from "@/lib/auth";
import { Badge } from "@/components/ui";
import { Shell } from "@/components/shell";
import { aksiBatalSlip } from "@/app/actions";
import { SlipForm } from "./SlipForm";

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export default async function HRSlipGaji({ searchParams }: { searchParams: { tahun?: string; bulan?: string; buat?: string } }) {
  const user = await wajibHR();
  const tahun = Number(searchParams.tahun) || new Date().getFullYear();
  const bulan = searchParams.bulan ? Number(searchParams.bulan) : null;
  const list = await prisma.slipGaji.findMany({
    where: { tahun, ...(bulan ? { bulan } : {}) },
    include: { user: true },
    orderBy: [{ bulan: "desc" }, { user: { nama: "asc" } }],
  });
  const karyawan = await prisma.user.findMany({
    where: { statusAktif: true }, select: { id: true, nama: true, jabatan: true, gajiPokok: true, tunjanganTetap: true }, orderBy: { nama: "asc" },
  });
  const total = list.filter((s) => s.status === "TERBIT").reduce((a, s) => a + s.gajiBersih, 0);

  return (
    <Shell nama={user.nama} role={user.role} isAtasan={true}>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Slip Gaji</h1>
        <Link href="/slip-gaji" className="text-sm font-semibold text-emerald-700">Slip saya</Link>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2 rounded-xl border bg-white p-3">
        <label className="text-sm font-semibold">Tahun
          <input name="tahun" type="number" min="2020" max="2099" defaultValue={tahun} className="ml-1 w-24 rounded-lg border px-2 py-1.5" />
        </label>
        <label className="text-sm font-semibold">Bulan
          <select name="bulan" defaultValue={bulan ?? ""} className="ml-1 rounded-lg border px-2 py-1.5">
            <option value="">Semua</option>
            {BULAN.map((b, i) => <option key={b} value={i + 1}>{b}</option>)}
          </select>
        </label>
        <button className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-bold text-white">Filter</button>
        <Link href="/hr/slip-gaji?buat=1" className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-bold text-white">+ Terbitkan</Link>
        <span className="ml-auto text-sm font-bold text-emerald-800">Total: Rp {total.toLocaleString("id-ID")}</span>
      </form>

      {searchParams.buat && <SlipForm karyawan={karyawan} />}

      <div className="space-y-2">
        {list.length === 0 && <p className="rounded-xl border bg-white p-4 text-sm text-zinc-500">Belum ada slip untuk periode ini.</p>}
        {list.map((s) => (
          <div key={s.id} className="rounded-xl border bg-white p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold">{s.user.nama}</div>
                <div className="text-xs text-zinc-500">{BULAN[s.bulan - 1]} {s.tahun} · {s.user.jabatan ?? "-"}</div>
              </div>
              <Badge status={s.status} />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1 text-xs text-zinc-600">
              <span>Pokok: {s.gajiPokok.toLocaleString("id-ID")}</span>
              <span>Tunj: {s.tunjangan.toLocaleString("id-ID")}</span>
              <span>Potong: {s.potongan.toLocaleString("id-ID")}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-bold text-emerald-800">Rp {s.gajiBersih.toLocaleString("id-ID")}</span>
              <div className="flex gap-2 text-xs font-bold">
                <Link href={`/slip-gaji/${s.id}`} className="rounded-lg border border-emerald-700 px-2 py-1 text-emerald-700">Detail</Link>
                {s.status === "TERBIT" && <a href={`/api/slip/${s.id}`} className="rounded-lg border border-blue-700 px-2 py-1 text-blue-700">PDF</a>}
                {s.status === "TERBIT" && (
                  <form action={aksiBatalSlip}>
                    <input type="hidden" name="id" value={s.id} />
                    <button className="rounded-lg border border-red-500 px-2 py-1 text-red-600">Batalkan</button>
                  </form>
                )}
              </div>
            </div>
            {s.catatan && <div className="mt-1 text-xs text-zinc-500">Catatan: {s.catatan}</div>}
          </div>
        ))}
      </div>
    </Shell>
  );
}
