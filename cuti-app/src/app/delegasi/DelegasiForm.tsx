"use client";
import { useFormState } from "react-dom";
import { aksiSimpanDelegasi } from "@/app/actions";
import { ErrorMsg, Field, btnCls, inputCls } from "@/components/ui";

export function DelegasiForm({ users }: { users: { id: string; nama: string; email: string }[] }) {
  const [state, action] = useFormState(aksiSimpanDelegasi, { error: "" } as { error?: string });
  return (
    <form action={action} className="space-y-3 rounded-xl border bg-white p-4">
      <h2 className="font-bold">Tunjuk Pengganti Sementara</h2>
      <Field label="Didelegasikan ke">
        <select name="keId" required className={inputCls} defaultValue="">
          <option value="">-- pilih karyawan --</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.nama} ({u.email})</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Mulai"><input name="tglMulai" type="date" required className={inputCls} /></Field>
        <Field label="Selesai"><input name="tglSelesai" type="date" required className={inputCls} /></Field>
      </div>
      <p className="text-xs text-zinc-500">Selama rentang ini, penerima dapat menyetujui bawahan Anda. Delegasi lama otomatis nonaktif.</p>
      <ErrorMsg msg={state?.error} />
      <button className={btnCls}>Simpan Delegasi</button>
    </form>
  );
}
