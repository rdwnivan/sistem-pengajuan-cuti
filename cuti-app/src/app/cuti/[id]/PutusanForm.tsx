"use client";
import { useFormState } from "react-dom";
import { aksiPutusan } from "@/app/actions";
import { ErrorMsg, btnCls, inputCls, Field } from "@/components/ui";

export function PutusanForm({ id }: { id: string }) {
  const [state, action] = useFormState(aksiPutusan, { error: "" } as { error?: string });
  return (
    <form action={action} className="space-y-2 rounded-xl border-2 border-amber-400 bg-amber-50 p-4">
      <input type="hidden" name="pengajuanId" value={id} />
      <Field label="Catatan (wajib untuk Tolak/Kembalikan)">
        <textarea name="catatan" rows={2} className={inputCls} placeholder="Alasan keputusan..." />
      </Field>
      <ErrorMsg msg={state?.error} />
      <div className="grid grid-cols-3 gap-2">
        <button name="aksi" value="setuju" className="rounded-xl bg-emerald-700 px-3 py-3 font-bold text-white">Setujui</button>
        <button name="aksi" value="tolak" className="rounded-xl bg-red-600 px-3 py-3 font-bold text-white">Tolak</button>
        <button name="aksi" value="kembalikan" className="rounded-xl border-2 border-orange-500 px-3 py-3 font-bold text-orange-600">Kembalikan</button>
      </div>
    </form>
  );
}
