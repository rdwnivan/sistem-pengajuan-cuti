"use client";
import { useFormState } from "react-dom";
import { aksiSimpanBlok } from "@/actions";
import { ErrorMsg, Field, inputCls } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export function BlokForm() {
  const [state, action] = useFormState(aksiSimpanBlok, { error: "" } as { error?: string });
  return (
    <form action={action} className="space-y-2 rounded-xl border bg-white p-4">
      <h2 className="font-bold">Tambah Blok / Afdeling</h2>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Nama blok"><input name="nama" required minLength={2} className={inputCls} placeholder="Misal: Blok A1" /></Field>
        <Field label="Keterangan"><input name="keterangan" className={inputCls} placeholder="Misal: Afdeling 1" /></Field>
      </div>
      <ErrorMsg msg={state?.error} />
      <SubmitButton className="rounded-lg bg-emerald-700 px-3 py-2 font-bold text-white">Tambah</SubmitButton>
    </form>
  );
}
