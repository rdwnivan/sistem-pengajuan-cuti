const PETA: Record<string, string> = {
  "\u2018": "'", "\u2019": "'", "\u201C": '"', "\u201D": '"',
  "\u2013": "-", "\u2014": "-", "\u2026": "...", "\u00A0": " ",
};

export function teksAman(s: string) {
  let out = "";
  for (const c of s) {
    const p = PETA[c];
    if (p) { out += p; continue; }
    const code = c.codePointAt(0) ?? 63;
    out += code >= 32 && code <= 255 ? c : "?";
  }
  return out;
}

export function rupiah(n: number) {
  return "Rp " + Math.abs(n).toLocaleString("id-ID");
}

const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export function namaBulan(bulan: number) {
  return NAMA_BULAN[bulan - 1] ?? String(bulan);
}

/** Tanggal hari ini dalam WIB (server Vercel jalan di UTC). */
export function tglWib(ref = new Date()) {
  const wib = new Date(ref.getTime() + 7 * 3600 * 1000);
  return `${wib.getUTCDate()} ${NAMA_BULAN[wib.getUTCMonth()]} ${wib.getUTCFullYear()}`;
}

export const LABEL_STATUS_LAPORAN: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "Draf", cls: "bg-zinc-200 text-zinc-700 border-zinc-300" },
  MENUNGGU: { label: "Menunggu Acc", cls: "bg-amber-100 text-amber-800 border-amber-300" },
  DISETUJUI: { label: "Disetujui", cls: "bg-green-100 text-green-800 border-green-400" },
  DITOLAK: { label: "Ditolak", cls: "bg-red-100 text-red-800 border-red-300" },
  DIKEMBALIKAN: { label: "Dikembalikan", cls: "bg-orange-100 text-orange-800 border-orange-300" },
  DIBATALKAN: { label: "Dibatalkan", cls: "bg-zinc-200 text-zinc-700 border-zinc-300" },
};

export const LABEL_STATUS_SLIP: Record<string, { label: string; cls: string }> = {
  TERBIT: { label: "Terbit", cls: "bg-green-100 text-green-800 border-green-400" },
  DIBATALKAN: { label: "Dibatalkan", cls: "bg-zinc-200 text-zinc-700 border-zinc-300" },
};

export function keBulan(s: string | null | undefined) {
  const n = Number(s);
  if (!Number.isInteger(n)) return 0;
  return n;
}
