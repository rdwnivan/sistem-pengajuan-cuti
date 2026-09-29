"use client";
import { useFormState } from "react-dom";
import { Badge, ErrorMsg, inputCls } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { aksiPutusanPerubahanGaji } from "@/actions";

type GajiPerubahanData = {
  id: string;
  gajiPokokLama: number;
  tunjanganTetapLama: number;
  gajiPokokBaru: number;
  tunjanganTetapBaru: number;
  alasan: string;
  status: string;
  user: { nama: string; jabatan: string | null };
  pengaju: { nama: string };
};

export function GajiPerubahanCard({ g }: { g: GajiPerubahanData }) {
  const [state, action] = useFormState(aksiPutusanPerubahanGaji, { error: "" } as { error?: string });
  return (
    <div className="space-y-2 rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-bold">
            {g.user.nama}
            {g.user.jabatan ? ` (${g.user.jabatan})` : ""}
          </div>
          <div className="text-xs text-zinc-600">Diajukan oleh {g.pengaju.nama}</div>
        </div>
        <Badge status={g.status} />
      </div>

      <div className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
        <div className="rounded-lg border border-amber-200 bg-white px-2 py-1.5">
          <div className="font-semibold text-zinc-600">Gaji pokok</div>
          <div className="text-zinc-500 line-through">Rp {g.gajiPokokLama.toLocaleString("id-ID")}</div>
          <div className="text-sm font-bold text-emerald-700">Rp {g.gajiPokokBaru.toLocaleString("id-ID")}</div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-white px-2 py-1.5">
          <div className="font-semibold text-zinc-600">Tunjangan tetap</div>
          <div className="text-zinc-500 line-through">Rp {g.tunjanganTetapLama.toLocaleString("id-ID")}</div>
          <div className="text-sm font-bold text-emerald-700">Rp {g.tunjanganTetapBaru.toLocaleString("id-ID")}</div>
        </div>
      </div>

      <p className="text-xs italic text-zinc-600">Alasan: {g.alasan}</p>

      <form action={action} className="space-y-2">
        <input type="hidden" name="gajiPerubahanId" value={g.id} />
        <textarea name="catatan" rows={2} placeholder="Catatan (wajib diisi bila menolak)" className={inputCls} />
        <ErrorMsg msg={state?.error} />
        <div className="flex gap-2 text-sm font-bold">
          <SubmitButton name="aksi" value="setuju" className="flex-1 rounded-lg bg-emerald-700 px-3 py-2 text-white">Setujui</SubmitButton>
          <SubmitButton name="aksi" value="kembalikan" className="flex-1 rounded-lg border border-orange-500 px-3 py-2 text-orange-700">Kembalikan</SubmitButton>
          <SubmitButton name="aksi" value="tolak" className="flex-1 rounded-lg border border-red-500 px-3 py-2 text-red-700">Tolak</SubmitButton>
        </div>
      </form>
    </div>
  );
}
