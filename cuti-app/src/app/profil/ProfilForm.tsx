"use client";
import { useActionState } from "react";
import { aksiUbahProfil } from "@/actions";
import { ErrorMsg, Field, btnCls, inputCls } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export function ProfilForm({ initial }: { initial: { noHp?: string | null; notifWa: boolean } }) {
  const [state, action] = useActionState(aksiUbahProfil, { error: "" } as { error?: string });
  return (
    <form action={action} className="space-y-3 rounded-xl border bg-white p-4">
      <h2 className="font-bold">Notifikasi WhatsApp</h2>
      <Field label="No HP / WhatsApp">
        <input name="noHp" defaultValue={initial?.noHp ?? ""} placeholder="Contoh: 08123456789" className={inputCls} />
      </Field>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="notifWa" defaultChecked={initial?.notifWa ?? true} /> Terima notifikasi WhatsApp
      </label>
      <p className="text-xs text-zinc-500">Pengingat cuti, eskalasi, keputusan, dan slip gaji dikirim ke nomor ini bila aktif.</p>
      <ErrorMsg msg={state?.error} />
      <SubmitButton className={btnCls}>Simpan Profil</SubmitButton>
    </form>
  );
}
