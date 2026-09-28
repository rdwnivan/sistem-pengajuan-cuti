"use client";
import { useRouter } from "next/navigation";

type SlipOption = { id: string; bulan: number; tahun: number };

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export function MonthSelector({ slips, currentId }: { slips: SlipOption[]; currentId: string }) {
  const router = useRouter();
  if (slips.length <= 1) return null;
  return (
    <select
      value={currentId}
      onChange={(e) => router.push(`/slip-gaji/${e.target.value}`)}
      className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-700"
    >
      {slips.map((s) => (
        <option key={s.id} value={s.id}>
          {BULAN[s.bulan - 1]} {s.tahun}
        </option>
      ))}
    </select>
  );
}
