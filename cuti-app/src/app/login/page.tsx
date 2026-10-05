"use client";
import { useState, useActionState } from "react";
import { aksiLogin } from "@/actions";
import { ErrorMsg, inputCls, btnCls, Field } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

const init = { error: "" } as { error?: string };

function IkonMata() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IkonMataTertutup() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10.6 5.2A9.9 9.9 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6A17.6 17.6 0 0 0 2 12s3.5 7 10 7c1.5 0 2.8-.3 4-.8" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

export default function LoginPage() {
  const [state, action] = useActionState(aksiLogin, init);
  const [showPassword, setShowPassword] = useState(false);
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-emerald-800">Cuti Anime Japan</h1>
        <p className="mb-4 text-sm text-zinc-600">Masuk dengan akun dari HR</p>
        <form action={action} className="space-y-3">
          <Field label="Email">
            <input name="email" type="email" required className={inputCls} placeholder="nama@anime.id" />
          </Field>
          <div className="block">
            <label htmlFor="password" className="mb-1 block text-sm font-semibold">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                className={`${inputCls} pr-11`}
                placeholder="••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                aria-pressed={showPassword}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
              >
                {showPassword ? <IkonMataTertutup /> : <IkonMata />}
              </button>
            </div>
          </div>
          <ErrorMsg msg={state?.error} />
          <SubmitButton className={btnCls}>Masuk</SubmitButton>
        </form>
        <p className="mt-3 text-xs text-zinc-500">Demo (password: anime123): hr@anime.id · pimpinan@anime.id · atasan1@anime.id · karyawan1@anime.id</p>
      </div>
    </div>
  );
}
