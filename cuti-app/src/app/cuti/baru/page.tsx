"use client";
import { useFormState } from "react-dom";
import { aksiAjukan } from "@/app/actions";
import { ErrorMsg, Field, btnCls, inputCls } from "@/components/ui";

export default function BaruPage({ searchParams }: { searchParams: { jenis?: string } }) {
  return <Form jenisAwal={searchParams.jenis} />;
}

function Form({ jenisAwal }: { jenisAwal?: string }) {
  const [state, action] = useFormState(aksiAjukan, { error: "" } as { error?: string });
  return (
    <div className="mx-auto max-w-3xl px-3 pb-10 pt-4">
      <h1 className="mb-3 text-lg font-bold">Form Ajukan Cuti</h1>
      <JenisLoader jenisAwal={jenisAwal} state={state} action={action} />
    </div>
  );
}

import { useEffect, useState } from "react";
type J = { id: string; nama: string; kuota: number; minHariSebelum: number };

function JenisLoader({ jenisAwal, state, action }: { jenisAwal?: string; state: { error?: string }; action: (fd: FormData) => void }) {
  const [list, setList] = useState<J[]>([]);
  useEffect(() => { fetch("/api/jenis").then((r) => r.json()).then(setList).catch(() => setList([])); }, []);
  return (
    <form action={action} className="space-y-3 rounded-xl border bg-white p-4">
      <Field label="Jenis cuti">
        <select name="jenisId" defaultValue={jenisAwal ?? ""} required className={inputCls}>
          <option value="">-- pilih --</option>
          {list.map((j) => <option key={j.id} value={j.id}>{j.nama} (min H-{j.minHariSebelum})</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Tanggal mulai"><input name="tglMulai" type="date" required className={inputCls} /></Field>
        <Field label="Tanggal selesai"><input name="tglSelesai" type="date" required className={inputCls} /></Field>
      </div>
      <Field label="Alasan"><textarea name="alasan" required minLength={10} rows={3} className={inputCls} placeholder="Minimal 10 karakter" /></Field>
      <Field label="PIC pengganti"><input name="picPengganti" className={inputCls} placeholder="Nama pengganti" /></Field>
      <Field label="Kontak selama cuti"><input name="kontakSelamanyaCuti" className={inputCls} style={{ display: "none" }} tabIndex={-1} autoComplete="off" /><input name="kontakSelamaCuti" className={inputCls} placeholder="No HP aktif" /></Field>
      <Field label="Lampiran (PDF/JPG/PNG, maks 2MB — wajib untuk jenis tertentu)"><input name="lampiran" type="file" accept=".pdf,.jpg,.jpeg,.png" className={inputCls} /></Field>
      <ErrorMsg msg={state?.error} />
      <button className={btnCls}>Kirim Pengajuan</button>
    </form>
  );
}
