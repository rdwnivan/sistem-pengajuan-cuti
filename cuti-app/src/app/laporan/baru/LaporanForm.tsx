"use client";
import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { aksiBuatLaporan, aksiRevisiLaporan } from "@/actions";
import { ErrorMsg, Field, btnCls, inputCls } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

type A = { id: string; nama: string; jabatan: string | null };

export function LaporanForm({ editId, initial, dariDraf }: { editId?: string; initial?: { tglLaporan?: string; lokasi?: string; shift?: string | null; judul?: string; isi?: string; approverId?: string }; dariDraf?: boolean }) {
  const [state, action] = useFormState(editId ? aksiRevisiLaporan : aksiBuatLaporan, { error: "" } as { error?: string });
  const [approverId, setApproverId] = useState(initial?.approverId ?? "");
  const [list, setList] = useState<A[]>([]);

  useEffect(() => {
    fetch("/api/approver")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setList(Array.isArray(d) ? d : []))
      .catch(() => setList([]));
  }, []);

  return (
    <form action={action} className="space-y-3 rounded-xl border bg-white p-4">
      {editId && <input type="hidden" name="id" value={editId} />}
      <Field label="Tanggal laporan">
        <input name="tglLaporan" type="date" required defaultValue={initial?.tglLaporan ?? new Date().toISOString().slice(0, 10)} className={inputCls} />
      </Field>
      <Field label="Lokasi">
        <input name="lokasi" required defaultValue={initial?.lokasi ?? ""} className={inputCls} placeholder="Misal: Kantor Pusat" />
      </Field>
      <Field label="Shift">
        <input name="shift" defaultValue={initial?.shift ?? ""} className={inputCls} placeholder="Contoh: Pagi / Siang / Malam" />
      </Field>
      <Field label="Judul laporan">
        <input name="judul" required minLength={3} defaultValue={initial?.judul ?? ""} className={inputCls} placeholder="Misal: Laporan kegiatan lapangan" />
      </Field>
      <Field label="Isi laporan">
        <textarea name="isi" required minLength={10} rows={5} defaultValue={initial?.isi ?? ""} className={inputCls} placeholder="Tulis laporan lengkap di sini (minimal 10 karakter)..." />
      </Field>
      <Field label="Foto / lampiran (opsional, PDF/JPG/PNG maks 2MB)">
        <input name="lampiran" type="file" accept=".pdf,.jpg,.jpeg,.png" className={inputCls} />
      </Field>
      <Field label="Kirim ke atasan">
        <select name="approverId" required value={approverId} onChange={(e) => setApproverId(e.target.value)} className={inputCls}>
          <option value="">-- pilih approver --</option>
          {list.map((a) => <option key={a.id} value={a.id}>{a.nama}{a.jabatan ? ` (${a.jabatan})` : ""}</option>)}
        </select>
      </Field>
      <ErrorMsg msg={state?.error} />
      <SubmitButton className={btnCls}>
        {!editId ? "Simpan Laporan" : dariDraf ? "Simpan Perubahan" : "Simpan & Kirim Ulang"}
      </SubmitButton>
    </form>
  );
}
