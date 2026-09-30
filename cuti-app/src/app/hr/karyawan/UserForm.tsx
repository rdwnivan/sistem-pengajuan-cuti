"use client";
import { useState } from "react";
import { useFormState } from "react-dom";
import { aksiSimpanUser } from "@/actions";
import { ErrorMsg, Field, btnCls, inputCls } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export function UserForm({ initial, atasans, id, gajiPending }: {
  id?: string;
  initial?: { nama: string; email: string; nip?: string | null; jabatan?: string | null; noHp?: string | null; tglMasuk: string; role: string; atasanId?: string | null; statusAktif: boolean; gajiPokok?: number; tunjanganTetap?: number };
  atasans: { id: string; nama: string }[];
  gajiPending?: boolean;
}) {
  const [state, action] = useFormState(aksiSimpanUser, { error: "" } as { error?: string });
  const [statusAktif, setStatusAktif] = useState(initial?.statusAktif ?? true);
  // Konfirmasi hanya saat menonaktifkan akun yang tadinya aktif.
  const confirmNonaktif = id && (initial?.statusAktif ?? true) && !statusAktif
    ? `Nonaktifkan akun ${initial?.nama ?? "karyawan ini"}? Akun tidak bisa login sampai diaktifkan lagi.`
    : undefined;
  return (
    <form action={action} className="space-y-3 rounded-xl border bg-white p-4">
      {gajiPending && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
          Perubahan gaji menunggu persetujuan atasan. Cek di /persetujuan atau panel HR.
        </div>
      )}
      <input type="hidden" name="id" value={id ?? ""} />
      <Field label="Nama"><input name="nama" required defaultValue={initial?.nama} className={inputCls} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Email"><input name="email" type="email" required defaultValue={initial?.email} className={inputCls} /></Field>
        <Field label="NIP"><input name="nip" required pattern="[0-9]{6,20}" inputMode="numeric" defaultValue={initial?.nip ?? ""} className={inputCls} placeholder="6-20 digit angka" /></Field>
      </div>
      <Field label={id ? "Password baru (kosongkan jika tidak diubah)" : "Password"}>
        <input name="password" type="password" required={!id} minLength={6} className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Jabatan"><input name="jabatan" defaultValue={initial?.jabatan ?? ""} className={inputCls} /></Field>
        <Field label="No HP"><input name="noHp" defaultValue={initial?.noHp ?? ""} className={inputCls} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Tanggal masuk"><input name="tglMasuk" type="date" required defaultValue={initial?.tglMasuk} className={inputCls} /></Field>
        <Field label="Role">
          <select name="role" defaultValue={initial?.role ?? "KARYAWAN"} className={inputCls}>
            <option value="KARYAWAN">Karyawan</option>
            <option value="HR_ADMIN">HR Admin</option>
          </select>
        </Field>
      </div>
      <Field label="Atasan langsung">
        <select name="atasanId" defaultValue={initial?.atasanId ?? ""} className={inputCls}>
          <option value="">-- pucuk hierarki --</option>
          {atasans.filter((a) => a.id !== id).map((a) => <option key={a.id} value={a.id}>{a.nama}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Gaji pokok (Rp)"><input name="gajiPokok" type="number" min="0" defaultValue={initial?.gajiPokok ?? 0} className={inputCls} /></Field>
        <Field label="Tunjangan tetap (Rp)"><input name="tunjanganTetap" type="number" min="0" defaultValue={initial?.tunjanganTetap ?? 0} className={inputCls} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="statusAktif" defaultChecked={initial?.statusAktif ?? true} onChange={(e) => setStatusAktif(e.target.checked)} /> Akun aktif
      </label>
      <ErrorMsg msg={state?.error} />
      <SubmitButton confirm={confirmNonaktif} className={btnCls}>Simpan</SubmitButton>
    </form>
  );
}
