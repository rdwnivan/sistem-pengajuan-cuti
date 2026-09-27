"use client";
import { useState } from "react";
import { useFormState } from "react-dom";
import { aksiPutusanLaporan } from "@/app/actions";
import { ErrorMsg, Field, inputCls } from "@/components/ui";

export function PutusanLaporanForm({ laporanId }: { laporanId: string }) {
  const [state, action] = useFormState(aksiPutusanLaporan, { error: "" } as { error?: string });
  const [opsi, setOpsi] = useState<"setuju" | "tolak" | "kembalikan" | null>(null);
  const perluCatatan = opsi === "tolak" || opsi === "kembalikan";

  return (
    <form action={action} className="space-y-3 rounded-xl border-2 border-amber-400 bg-amber-50 p-4">
      <input type="hidden" name="laporanId" value={laporanId} />
      <h2 className="font-bold text-amber-900">Keputusan Anda</h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button name="aksi" value="setuju" onClick={() => setOpsi("setuju")} className={`rounded-xl px-4 py-3 font-bold ${opsi === "setuju" ? "bg-green-700 text-white ring-2 ring-green-900" : "border-2 border-green-700 bg-white text-green-700"}`}>
          Setujui
        </button>
        <button name="aksi" value="tolak" onClick={() => setOpsi("tolak")} className={`rounded-xl px-4 py-3 font-bold ${opsi === "tolak" ? "bg-red-600 text-white ring-2 ring-red-900" : "border-2 border-red-500 bg-white text-red-600"}`}>
          Tolak
        </button>
        <button name="aksi" value="kembalikan" onClick={() => setOpsi("kembalikan")} className={`rounded-xl px-4 py-3 font-bold ${opsi === "kembalikan" ? "bg-orange-600 text-white ring-2 ring-orange-900" : "border-2 border-orange-500 bg-white text-orange-600"}`}>
          Kembalikan
        </button>
      </div>
      {perluCatatan && (
        <Field label="Catatan (wajib untuk tolak/kembalikan)">
          <textarea name="catatan" rows={3} className={inputCls} placeholder="Jelaskan alasan agar laporan bisa direvisi" />
        </Field>
      )}
      <ErrorMsg msg={state?.error} />
    </form>
  );
}
