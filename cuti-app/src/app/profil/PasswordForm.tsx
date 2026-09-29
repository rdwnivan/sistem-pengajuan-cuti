"use client";
import { useFormState } from "react-dom";
import { aksiUbahPassword } from "@/actions";
import { ErrorMsg, Field, btnCls, inputCls } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export function PasswordForm() {
  const [state, action] = useFormState(aksiUbahPassword, { error: "" } as { error?: string });
  return (
    <form action={action} className="space-y-3 rounded-xl border bg-white p-4">
      <h2 className="font-bold">Ubah Password</h2>
      <Field label="Password lama"><input name="lama" type="password" required className={inputCls} /></Field>
      <Field label="Password baru (min 6)"><input name="baru" type="password" required minLength={6} className={inputCls} /></Field>
      <ErrorMsg msg={state?.error} />
      <SubmitButton className={btnCls}>Simpan Password</SubmitButton>
    </form>
  );
}
