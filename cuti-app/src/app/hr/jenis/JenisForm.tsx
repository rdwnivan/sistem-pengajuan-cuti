"use client";
import { useFormState } from "react-dom";
import { aksiSimpanJenis } from "@/app/actions";
import { ErrorMsg, Field, inputCls } from "@/components/ui";

type J = { id: string; nama: string; kuota: number; memotongKuotaTahunan: boolean; lampiranWajib: boolean; lampiranWajibJikaLebihDari: number | null; minHariSebelum: number; butuhMasaKerjaBulan: number; aktif: boolean };

export function JenisForm({ initial }: { initial?: J }) {
  const [state, action] = useFormState(aksiSimpanJenis, { error: "" } as { error?: string });
  return (
    <form action={action} className="mt-2 grid grid-cols-2 gap-2 border-t pt-2">
      <input type="hidden" name="id" value={initial?.id ?? ""} />
      <Field label="Nama"><input name="nama" required defaultValue={initial?.nama} className={inputCls} /></Field>
      <Field label="Kuota (hari)"><input name="kuota" type="number" min={0} max={365} required defaultValue={initial?.kuota ?? 12} className={inputCls} /></Field>
      <Field label="Min H- (hari)"><input name="minHariSebelum" type="number" min={0} max={90} required defaultValue={initial?.minHariSebelum ?? 3} className={inputCls} /></Field>
      <Field label="Masa kerja (bulan)"><input name="butuhMasaKerjaBulan" type="number" min={0} max={120} required defaultValue={initial?.butuhMasaKerjaBulan ?? 0} className={inputCls} /></Field>
      <Field label="Lampiran wajib jika > (hari, kosongkan bila tidak)"><input name="lampiranWajibJikaLebihDari" type="number" min={0} defaultValue={initial?.lampiranWajibJikaLebihDari ?? ""} className={inputCls} /></Field>
      <div className="col-span-2 flex flex-wrap gap-3 text-sm font-semibold">
        <label className="flex items-center gap-1"><input type="checkbox" name="memotongKuotaTahunan" defaultChecked={initial?.memotongKuotaTahunan ?? true} /> Potong kuota</label>
        <label className="flex items-center gap-1"><input type="checkbox" name="lampiranWajib" defaultChecked={initial?.lampiranWajib ?? false} /> Lampiran wajib</label>
        <label className="flex items-center gap-1"><input type="checkbox" name="aktif" defaultChecked={initial?.aktif ?? true} /> Aktif</label>
      </div>
      <div className="col-span-2">
        <ErrorMsg msg={state?.error} />
        <button className="w-full rounded-lg bg-emerald-700 px-3 py-2 font-bold text-white">{initial ? "Update" : "Tambah"}</button>
      </div>
    </form>
  );
}
