"use client";
import { useEffect, useState, useActionState } from "react";
import Link from "next/link";
import { aksiAjukan } from "@/actions";
import { ErrorMsg, Field, btnCls, inputCls } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import type { NilaiAjukan } from "@/lib/validasi";

type State = { error?: string; nilai?: NilaiAjukan };

export function Form({ jenisAwal }: { jenisAwal?: string }) {
  const [state, action] = useActionState(aksiAjukan, { error: "" } as State);
  return (
    <div className="mx-auto max-w-3xl px-3 pb-10 pt-4">
      <Link href="/" className="mb-3 inline-block text-sm font-semibold text-emerald-700 hover:underline">← Kembali</Link>
      <h1 className="mb-3 text-lg font-bold">Form Ajukan Cuti</h1>
      <JenisLoader jenisAwal={jenisAwal} state={state} action={action} />
    </div>
  );
}

type J = { id: string; nama: string; kuota: number; minHariSebelum: number };

function JenisLoader({ jenisAwal, state, action }: { jenisAwal?: string; state: State; action: (fd: FormData) => void }) {
  const [list, setList] = useState<J[]>([]);
  useEffect(() => { fetch("/api/jenis").then((r) => r.json()).then(setList).catch(() => setList([])); }, []);
  // React 19 mereset form uncontrolled setiap action di-submit, jadi nilai yang
  // dikembalikan action dipasang ulang sebagai defaultValue supaya isian user
  // tidak hilang saat pengajuan ditolak server (lihat NilaiAjukan di lib/validasi).
  const n = state?.nilai;
  return (
    <form action={action} className="space-y-3 rounded-xl border bg-white p-4">
      <Field label="Jenis cuti">
        {/* `key` wajib untuk <select> + defaultValue + opsi yang dimuat async:
            React hanya menerapkan defaultValue select saat mount, jadi (a) pilihan
            dari `?jenis=` tidak terpasang kalau opsi belum ada, dan (b) pilihan user
            hilang setelah form direset React 19. Remount saat nilai target / jumlah
            opsi berubah menyelesaikan keduanya; input teks tidak butuh ini. */}
        <select
          name="jenisId"
          key={`${n?.jenisId ?? jenisAwal ?? ""}#${list.length}`}
          defaultValue={n?.jenisId ?? jenisAwal ?? ""}
          required
          className={inputCls}
        >
          <option value="">-- pilih --</option>
          {list.map((j) => <option key={j.id} value={j.id}>{j.nama} (min H-{j.minHariSebelum})</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Tanggal mulai"><input name="tglMulai" type="date" defaultValue={n?.tglMulai ?? ""} required className={inputCls} /></Field>
        <Field label="Tanggal selesai"><input name="tglSelesai" type="date" defaultValue={n?.tglSelesai ?? ""} required className={inputCls} /></Field>
      </div>
      <Field label="Alasan"><textarea name="alasan" defaultValue={n?.alasan ?? ""} required minLength={10} rows={3} className={inputCls} placeholder="Minimal 10 karakter" /></Field>
      <Field label="PIC pengganti"><input name="picPengganti" defaultValue={n?.picPengganti ?? ""} className={inputCls} placeholder="Nama pengganti" /></Field>
      <Field label="Kontak selama cuti"><input name="kontakSelamanyaCuti" className={inputCls} style={{ display: "none" }} tabIndex={-1} autoComplete="off" /><input name="kontakSelamaCuti" defaultValue={n?.kontakSelamaCuti ?? ""} className={inputCls} placeholder="No HP aktif" /></Field>
      <Field label="Lampiran (PDF/JPG/PNG, maks 2MB — wajib untuk jenis tertentu)"><input name="lampiran" type="file" accept=".pdf,.jpg,.jpeg,.png" className={inputCls} /></Field>
      <ErrorMsg msg={state?.error} />
      <SubmitButton className={btnCls}>Kirim Pengajuan</SubmitButton>
    </form>
  );
}
