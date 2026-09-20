"use client";
import { useFormState } from "react-dom";
import { aksiLogin } from "@/app/actions";
import { ErrorMsg, inputCls, btnCls, Field } from "@/components/ui";

const init = { error: "" } as { error?: string };

export default function LoginPage() {
  const [state, action] = useFormState(aksiLogin, init);
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-emerald-800">Cuti Anime Japan</h1>
        <p className="mb-4 text-sm text-zinc-600">Masuk dengan akun dari HR</p>
        <form action={action} className="space-y-3">
          <Field label="Email">
            <input name="email" type="email" required className={inputCls} placeholder="nama@anime.id" />
          </Field>
          <Field label="Password">
            <input name="password" type="password" required className={inputCls} placeholder="••••••" />
          </Field>
          <ErrorMsg msg={state?.error} />
          <button className={btnCls}>Masuk</button>
        </form>
        <p className="mt-3 text-xs text-zinc-500">Demo (password: anime123): hr@anime.id · pimpinan@anime.id · atasan1@anime.id · karyawan1@anime.id</p>
      </div>
    </div>
  );
}
