"use client";
import { useState, useActionState } from "react";
import { aksiPutusanLaporan } from "@/actions";
import { ErrorMsg, Field, inputCls } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export function PutusanLaporanForm({ laporanId }: { laporanId: string }) {
  const [state, action] = useActionState(aksiPutusanLaporan, { error: "" } as { error?: string });
  const [opsi, setOpsi] = useState<"setuju" | "tolak" | "kembalikan" | null>(null);

  return (
    <form action={action} className="space-y-3 rounded-xl border-2 border-amber-400 bg-amber-50 p-4">
      <input type="hidden" name="laporanId" value={laporanId} />
      <h2 className="font-bold text-amber-900">Keputusan Anda</h2>
      <Field label="Catatan (wajib untuk tolak/kembalikan)">
        <textarea name="catatan" rows={2} className={inputCls} placeholder="Alasan keputusan..." />
      </Field>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <SubmitButton name="aksi" value="setuju" onClick={() => setOpsi("setuju")} active={opsi === "setuju"} className={`rounded-xl px-4 py-3 font-bold ${opsi === "setuju" ? "bg-green-700 text-white ring-2 ring-green-900" : "border-2 border-green-700 bg-white text-green-700"}`}>
          Setujui
        </SubmitButton>
        <SubmitButton name="aksi" value="tolak" onClick={() => setOpsi("tolak")} active={opsi === "tolak"} className={`rounded-xl px-4 py-3 font-bold ${opsi === "tolak" ? "bg-red-600 text-white ring-2 ring-red-900" : "border-2 border-red-500 bg-white text-red-600"}`}>
          Tolak
        </SubmitButton>
        <SubmitButton name="aksi" value="kembalikan" onClick={() => setOpsi("kembalikan")} active={opsi === "kembalikan"} className={`rounded-xl px-4 py-3 font-bold ${opsi === "kembalikan" ? "bg-orange-600 text-white ring-2 ring-orange-900" : "border-2 border-orange-500 bg-white text-orange-600"}`}>
          Kembalikan
        </SubmitButton>
      </div>
      <ErrorMsg msg={state?.error} />
    </form>
  );
}
