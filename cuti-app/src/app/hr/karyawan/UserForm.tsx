"use client";
import { useFormState } from "react-dom";
import { aksiSimpanUser } from "@/app/actions";
import { ErrorMsg, Field, btnCls, inputCls } from "@/components/ui";

export function UserForm({ initial, atasans, id }: {
  id?: string;
  initial?: { nama: string; email: string; jabatan?: string | null; noHp?: string | null; tglMasuk: string; role: string; atasanId?: string | null; statusAktif: boolean };
  atasans: { id: string; nama: string }[];
}) {
  const [state, action] = useFormState(aksiSimpanUser, { error: "" } as { error?: string });
  return (
    <form action={action} className="space-y-3 rounded-xl border bg-white p-4">
      <input type="hidden" name="id" value={id ?? ""} />
      <Field label="Nama"><input name="nama" required defaultValue={initial?.nama} className={inputCls} /></Field>
      <Field label="Email"><input name="email" type="email" required defaultValue={initial?.email} className={inputCls} /></Field>
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
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="statusAktif" defaultChecked={initial?.statusAktif ?? true} /> Akun aktif
      </label>
      <ErrorMsg msg={state?.error} />
      <button className={btnCls}>Simpan</button>
    </form>
  );
}
