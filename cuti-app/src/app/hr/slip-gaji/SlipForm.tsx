"use client";
import { useState, useActionState } from "react";
import { aksiBuatSlip } from "@/actions";
import { ErrorMsg, Field, btnCls, inputCls } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

type K = { id: string; nama: string; jabatan: string | null; gajiPokok: number | null; tunjanganTetap: number | null };

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const TETAP = [
  { name: "tunjanganJabatan", label: "Tunjangan jabatan (Rp)" },
  { name: "tunjanganTransport", label: "Tunjangan transport (Rp)" },
  { name: "tunjanganMakan", label: "Tunjangan makan (Rp)" },
] as const;

const VARIABEL = [
  { name: "lembur", label: "Lembur (Rp)" },
  { name: "bonus", label: "Bonus / insentif (Rp)" },
] as const;

const POTONGAN = [
  { name: "pph21", label: "PPh 21 (Rp)" },
  { name: "bpjsKesehatan", label: "BPJS Kesehatan (Rp)" },
  { name: "bpjsKetenagakerjaan", label: "BPJS Ketenagakerjaan (Rp)" },
  { name: "potonganLain", label: "Potongan lain — kasbon/koperasi (Rp)" },
] as const;

export function SlipForm({ karyawan }: { karyawan: K[] }) {
  const [state, action] = useActionState(aksiBuatSlip, { error: "" } as { error?: string });
  const [userId, setUserId] = useState("");
  const [nilai, setNilai] = useState<Record<string, number>>({});
  const pilih = karyawan.find((k) => k.id === userId);
  const pokok = pilih?.gajiPokok ?? 0;
  const tetap = pilih?.tunjanganTetap ?? 0;
  const num = (n: string) => nilai[n] ?? 0;
  const bersih = pokok
    + num("tunjanganJabatan") + num("tunjanganTransport") + num("tunjanganMakan")
    + num("lembur") + num("bonus")
    - num("pph21") - num("bpjsKesehatan") - num("bpjsKetenagakerjaan") - num("potonganLain");
  const set = (n: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setNilai((s) => ({ ...s, [n]: Number(e.target.value) || 0 }));

  const resetNilai = () => setNilai({});

  return (
    <form action={action} className="space-y-3 rounded-xl border bg-white p-4">
      <Field label="Karyawan">
        <select name="userId" required value={userId} onChange={(e) => { setUserId(e.target.value); resetNilai(); }} className={inputCls}>
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
      <Field label={`Gaji pokok (dari data karyawan) — ${pilih ? `Rp ${pokok.toLocaleString("id-ID")}` : "pilih karyawan dulu"}`}>
        <input name="gajiPokok" type="number" min="0" required value={pilih ? pokok : ""} readOnly placeholder="Otomatis dari data karyawan" className={`${inputCls} bg-zinc-100`} />
      </Field>
      <p className="text-xs text-zinc-500">Tunjangan tetap karyawan (Rp {tetap.toLocaleString("id-ID")}) sebagai referensi — isi manual per komponen di bawah.</p>

      <h3 className="text-sm font-bold text-zinc-700">Tunjangan tetap</h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {TETAP.map((f) => (
          <Field key={f.name} label={f.label}>
            <input name={f.name} type="number" min="0" value={num(f.name) || ""} onChange={set(f.name)} className={inputCls} placeholder="0" />
          </Field>
        ))}
      </div>

      <h3 className="text-sm font-bold text-zinc-700">Tunjangan variabel</h3>
      <div className="grid grid-cols-2 gap-2">
        {VARIABEL.map((f) => (
          <Field key={f.name} label={f.label}>
            <input name={f.name} type="number" min="0" value={num(f.name) || ""} onChange={set(f.name)} className={inputCls} placeholder="0" />
          </Field>
        ))}
      </div>

      <h3 className="text-sm font-bold text-zinc-700">Potongan</h3>
      <div className="grid grid-cols-2 gap-2">
        {POTONGAN.map((f) => (
          <Field key={f.name} label={f.label}>
            <input name={f.name} type="number" min="0" value={num(f.name) || ""} onChange={set(f.name)} className={inputCls} placeholder="0" />
          </Field>
        ))}
      </div>

      <div className="rounded-lg border-2 border-emerald-600 bg-emerald-50 p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-emerald-900">Gaji bersih</span>
          <span className="text-lg font-bold text-emerald-800">{bersih < 0 ? "NEGATIF" : `Rp ${bersih.toLocaleString("id-ID")}`}</span>
        </div>
        {bersih < 0 && <p className="mt-1 text-xs font-semibold text-red-700">Potongan melebihi total gaji.</p>}
      </div>
      <Field label="Catatan (opsional)"><textarea name="catatan" rows={2} className={inputCls} placeholder="Misal: bonus proyek lapangan" /></Field>
      <ErrorMsg msg={state?.error} />
      <SubmitButton className={btnCls}>Terbitkan Slip</SubmitButton>
    </form>
  );
}
