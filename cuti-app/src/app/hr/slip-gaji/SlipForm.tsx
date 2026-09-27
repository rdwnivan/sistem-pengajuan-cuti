"use client";
import { useState } from "react";
import { useFormState } from "react-dom";
import { aksiBuatSlip } from "@/app/actions";
import { ErrorMsg, Field, btnCls, inputCls } from "@/components/ui";

type K = { id: string; nama: string; jabatan: string | null; gajiPokok: number | null; tunjanganTetap: number | null };

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export function SlipForm({ karyawan }: { karyawan: K[] }) {
  const [state, action] = useFormState(aksiBuatSlip, { error: "" } as { error?: string });
  const [userId, setUserId] = useState("");
  const [tunjangan, setTunjangan] = useState(0);
  const [potongan, setPotongan] = useState(0);
  const pilih = karyawan.find((k) => k.id === userId);
  const pokok = pilih?.gajiPokok ?? 0;
  const tetap = pilih?.tunjanganTetap ?? 0;
  const bersih = pokok + tetap + Number(tunjangan) - Number(potongan);

  return (
    <form action={action} className="space-y-3 rounded-xl border bg-white p-4">
      <Field label="Karyawan">
        <select name="userId" required value={userId} onChange={(e) => { setUserId(e.target.value); setTunjangan(0); setPotongan(0); }} className={inputCls}>
          <option value="">-- pilih karyawan --</option>
          {karyawan.map((k) => <option key={k.id} value={k.id}>{k.nama}{k.jabatan ? ` (${k.jabatan})` : ""}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Tahun">
          <input name="tahun" type="number" min="2020" max="2099" required defaultValue={new Date().getFullYear()} className={inputCls} />
        </Field>
        <Field label="Bulan">
          <select name="bulan" required defaultValue={String(new Date().getMonth() + 1)} className={inputCls}>
            {BULAN.map((b, i) => <option key={b} value={i + 1}>{b}</option>)}
          </select>
        </Field>
      </div>
      <Field label={`Gaji pokok (dari data karyawan) — ${pilih ? `Rp ${pilih.gajiPokok?.toLocaleString("id-ID") ?? 0}` : "pilih karyawan dulu"}`}>
        <input name="gajiPokok" type="number" min="0" required value={pilih ? pokok : ""} readOnly placeholder="Otomatis dari data karyawan" className={`${inputCls} bg-zinc-100`} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label={`Tunjangan tetap (dari data karyawan) — Rp ${tetap.toLocaleString("id-ID")}`}>
          <input name="tunjanganTetapTerbaca" value={tetap} readOnly className={`${inputCls} bg-zinc-100`} />
        </Field>
        <Field label="Tunjangan variabel (Rp)">
          <input name="tunjangan" type="number" min="0" value={tunjangan} onChange={(e) => setTunjangan(Number(e.target.value))} className={inputCls} placeholder="Bonus/lembur" />
        </Field>
      </div>
      <input type="hidden" name="tunjanganTetap" value={tetap} />
      <Field label="Potongan (BPJS, pajak, kasbon) — Rp">
        <input name="potongan" type="number" min="0" value={potongan} onChange={(e) => setPotongan(Number(e.target.value))} className={inputCls} />
      </Field>
      <div className="rounded-lg border-2 border-emerald-600 bg-emerald-50 p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-emerald-900">Gaji bersih</span>
          <span className="text-lg font-bold text-emerald-800">{bersih < 0 ? "NEGATIF" : `Rp ${bersih.toLocaleString("id-ID")}`}</span>
        </div>
        {bersih < 0 && <p className="mt-1 text-xs font-semibold text-red-700">Potongan melebihi total gaji.</p>}
      </div>
      <Field label="Catatan (opsional)"><textarea name="catatan" rows={2} className={inputCls} placeholder="Misal: bonus proyectos lapangan" /></Field>
      <ErrorMsg msg={state?.error} />
      <button className={btnCls}>Terbitkan Slip</button>
    </form>
  );
}
