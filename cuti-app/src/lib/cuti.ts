export function fmtTgl(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function parseTglInput(s: string) {
  return new Date(s + "T12:00:00");
}

export function keTanggalDB(d: Date) {
  return fmtTgl(d);
}

export function hariKerja(mulai: Date, selesai: Date, liburSet: Set<string>) {
  let n = 0;
  const cur = new Date(mulai.getFullYear(), mulai.getMonth(), mulai.getDate());
  const end = new Date(selesai.getFullYear(), selesai.getMonth(), selesai.getDate());
  while (cur <= end) {
    const dow = cur.getDay();
    const key = fmtTgl(cur);
    if (dow !== 0 && dow !== 6 && !liburSet.has(key)) n++;
    cur.setDate(cur.getDate() + 1);
  }
  return n;
}

export function bulanMasaKerja(tglMasuk: Date, ref = new Date()) {
  return (ref.getFullYear() - tglMasuk.getFullYear()) * 12 + (ref.getMonth() - tglMasuk.getMonth());
}

export const LABEL_STATUS: Record<string, { label: string; cls: string }> = {
  MENUNGGU_ATASAN: { label: "Menunggu Atasan", cls: "bg-amber-100 text-amber-800 border-amber-300" },
  MENUNGGU_HR: { label: "Menunggu HR", cls: "bg-blue-100 text-blue-800 border-blue-300" },
  DISETUJUI: { label: "Disetujui", cls: "bg-green-100 text-green-800 border-green-400" },
  DITOLAK: { label: "Ditolak", cls: "bg-red-100 text-red-800 border-red-300" },
  DIKEMBALIKAN: { label: "Dikembalikan", cls: "bg-orange-100 text-orange-800 border-orange-300" },
  DIBATALKAN: { label: "Dibatalkan", cls: "bg-zinc-200 text-zinc-700 border-zinc-300" },
};
