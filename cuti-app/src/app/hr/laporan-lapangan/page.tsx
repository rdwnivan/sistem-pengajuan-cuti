import { prisma } from "@/lib/prisma";
import { wajibHR } from "@/lib/auth";
import { Shell } from "@/components/shell";
import { fmtTgl } from "@/lib/cuti";
import { Badge } from "@/components/ui";
import { inputCls, Field } from "@/components/ui";

export default async function RekapLaporanLapangan({ searchParams }: { searchParams: { dari?: string; sampai?: string; blok?: string; kegiatan?: string; status?: string } }) {
  const user = await wajibHR();
  const { dari, sampai, blok, kegiatan, status } = searchParams;

  const where: Record<string, unknown> = {};
  if (dari || sampai) {
    where.tglLaporan = {
      ...(dari ? { gte: new Date(dari + "T00:00:00") } : {}),
      ...(sampai ? { lte: new Date(sampai + "T23:59:59") } : {}),
    };
  }
  if (blok) where.blok = blok;
  if (kegiatan) where.kegiatan = { contains: kegiatan, mode: "insensitive" };
  if (status) where.status = status;

  const list = await prisma.laporanLapangan.findMany({
    where, include: { pembuat: true, approver: true }, orderBy: { tglLaporan: "desc" }, take: 200,
  });
  const blokList = await prisma.blok.findMany({ where: { aktif: true }, orderBy: { nama: "asc" } });

  const qs = new URLSearchParams({
    ...(dari ? { dari } : {}), ...(sampai ? { sampai } : {}),
    ...(blok ? { blok } : {}), ...(kegiatan ? { kegiatan } : {}), ...(status ? { status } : {}),
  }).toString();

  return (
    <Shell nama={user.nama} role={user.role} isAtasan={true}>
      <h1 className="text-lg font-bold">Rekap Laporan Lapangan ({list.length})</h1>
      <form method="get" className="space-y-3 rounded-xl border bg-white p-4">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Dari"><input name="dari" type="date" defaultValue={dari ?? ""} className={inputCls} /></Field>
          <Field label="Sampai"><input name="sampai" type="date" defaultValue={sampai ?? ""} className={inputCls} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Blok">
            <select name="blok" defaultValue={blok ?? ""} className={inputCls}>
              <option value="">Semua</option>
              {blokList.map((b) => <option key={b.id} value={b.nama}>{b.nama}</option>)}
            </select>
          </Field>
          <Field label="Kegiatan"><input name="kegiatan" defaultValue={kegiatan ?? ""} className={inputCls} placeholder="Cari kegiatan..." /></Field>
        </div>
        <Field label="Status">
          <select name="status" defaultValue={status ?? ""} className={inputCls}>
            <option value="">Semua</option>
            <option value="DRAFT">Draf</option>
            <option value="MENUNGGU">Menunggu Acc</option>
            <option value="DISETUJUI">Disetujui</option>
            <option value="DITOLAK">Ditolak</option>
            <option value="DIKEMBALIKAN">Dikembalikan</option>
            <option value="DIBATALKAN">Dibatalkan</option>
          </select>
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <button className="rounded-xl bg-zinc-800 px-4 py-3 font-bold text-white">Filter</button>
          <a href={`/api/laporan-rekap?format=excel&${qs}`} className="rounded-xl bg-emerald-700 px-4 py-3 text-center font-bold text-white">Unduh Excel</a>
          <a href={`/api/laporan-rekap?format=pdf-rekap&${qs}`} className="rounded-xl border-2 border-emerald-700 px-4 py-3 text-center font-bold text-emerald-700">Unduh PDF</a>
        </div>
      </form>
      <div className="space-y-2">
        {list.length === 0 && <p className="rounded-xl border bg-white p-4 text-sm text-zinc-500">Belum ada laporan untuk filter ini.</p>}
        {list.map((l) => (
          <div key={l.id} className="rounded-xl border bg-white p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold">{l.judul}</div>
                <div className="text-xs text-zinc-500">{fmtTgl(l.tglLaporan)} · {l.pembuat.nama} · {l.blok ?? "-"} · {l.kegiatan ?? "-"}{l.jumlahTenagaKerja != null ? ` · ${l.jumlahTenagaKerja} TK` : ""}</div>
              </div>
              <Badge status={l.status} />
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}
