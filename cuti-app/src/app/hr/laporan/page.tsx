import { wajibHR } from "@/lib/auth";
import { Shell } from "@/components/shell";
import { inputCls, Field } from "@/components/ui";

export default async function LaporanPage() {
  const user = await wajibHR();
  return (
    <Shell nama={user.nama} role={user.role} isAtasan={true}>
      <h1 className="text-lg font-bold">Rekap & Ekspor Laporan</h1>
      <form method="get" action="/api/laporan" className="space-y-3 rounded-xl border bg-white p-4">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Dari"><input name="dari" type="date" className={inputCls} /></Field>
          <Field label="Sampai"><input name="sampai" type="date" className={inputCls} /></Field>
        </div>
        <Field label="Status">
          <select name="status" className={inputCls} defaultValue="">
            <option value="">Semua</option>
            <option value="MENUNGGU_ATASAN">Menunggu Atasan</option>
            <option value="MENUNGGU_HR">Menunggu HR</option>
            <option value="DISETUJUI">Disetujui</option>
            <option value="DITOLAK">Ditolak</option>
            <option value="DIKEMBALIKAN">Dikembalikan</option>
            <option value="DIBATALKAN">Dibatalkan</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <button name="format" value="excel" className="rounded-xl bg-emerald-700 px-4 py-3 font-bold text-white">Unduh Excel</button>
          <button name="format" value="pdf-rekap" className="rounded-xl border-2 border-emerald-700 px-4 py-3 font-bold text-emerald-700">Unduh PDF</button>
        </div>
      </form>
    </Shell>
  );
}
