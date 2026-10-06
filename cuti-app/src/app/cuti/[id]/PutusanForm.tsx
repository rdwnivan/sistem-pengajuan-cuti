"use client";
import { useState, useActionState } from "react";
import { aksiPutusan } from "@/actions";
import { ErrorMsg, inputCls, Field } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export function PutusanForm({ id }: { id: string }) {
  const [state, action] = useActionState(aksiPutusan, { error: "" } as { error?: string });
  const [pending, setPending] = useState<string | null>(null);
  return (
    <form action={action} className="space-y-2 rounded-xl border-2 border-amber-400 bg-amber-50 p-4">
      <input type="hidden" name="pengajuanId" value={id} />
      <Field label="Catatan (wajib untuk Tolak/Kembalikan)">
        <textarea name="catatan" rows={2} className={inputCls} placeholder="Alasan keputusan..." />
      </Field>
      <ErrorMsg msg={state?.error} />
      <div className="grid grid-cols-3 gap-2">
        <SubmitButton name="aksi" value="setuju" onClick={() => setPending("setuju")} active={pending === "setuju"} className="rounded-xl bg-emerald-700 px-3 py-3 font-bold text-white">Setujui</SubmitButton>
        <SubmitButton name="aksi" value="tolak" onClick={() => setPending("tolak")} active={pending === "tolak"} className="rounded-xl bg-red-600 px-3 py-3 font-bold text-white">Tolak</SubmitButton>
        <SubmitButton name="aksi" value="kembalikan" onClick={() => setPending("kembalikan")} active={pending === "kembalikan"} className="rounded-xl border-2 border-orange-500 px-3 py-3 font-bold text-orange-600">Kembalikan</SubmitButton>
      </div>
    </form>
  );
}
