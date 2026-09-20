import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isAtasan, wajibLogin } from "@/lib/auth";
import { Shell } from "@/components/shell";
import { fmtTgl } from "@/lib/cuti";
import { redirect } from "next/navigation";

export default async function Kalender({ searchParams }: { searchParams: { bln?: string } }) {
  const user = await wajibLogin();
  const atasan = await isAtasan(user.id);
  const isHR = user.role === "HR_ADMIN";
  if (!atasan && !isHR) redirect("/");
  const now = new Date();
  const [y, m] = (searchParams.bln ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`).split("-").map(Number);
  const awal = new Date(y, m - 1, 1);
  const akhir = new Date(y, m, 0);
  const awalStr = fmtTgl(awal);
  const akhirStr = fmtTgl(akhir);

  const bawahanIds = isHR ? null : (await prisma.user.findMany({ where: { atasanId: user.id }, select: { id: true } })).map((u) => u.id);
  const cuti = await prisma.pengajuan.findMany({
    where: {
      status: "DISETUJUI",
      tglMulai: { lte: akhir },
      tglSelesai: { gte: awal },
      ...(bawahanIds ? { pemohonId: { in: bawahanIds } } : {}),
    },
    include: { pemohon: true, jenis: true },
    orderBy: { tglMulai: "asc" },
  });

  const perHari = new Map<string, typeof cuti>();
  for (const c of cuti) {
    const cur = new Date(c.tglMulai.getFullYear(), c.tglMulai.getMonth(), c.tglMulai.getDate());
    const end = new Date(c.tglSelesai.getFullYear(), c.tglSelesai.getMonth(), c.tglSelesai.getDate());
    while (cur <= end) {
      const k = fmtTgl(cur);
      if (k >= awalStr && k <= akhirStr) {
        if (!perHari.has(k)) perHari.set(k, []);
        perHari.get(k)!.push(c);
      }
      cur.setDate(cur.getDate() + 1);
    }
  }

  const prev = fmtTgl(new Date(y, m - 2, 1)).slice(0, 7);
  const next = fmtTgl(new Date(y, m, 1)).slice(0, 7);
  const cells: (string | null)[] = [];
  const offset = (awal.getDay() + 6) % 7;
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= akhir.getDate(); d++) cells.push(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);

  return (
    <Shell nama={user.nama} role={user.role} isAtasan={true}>
      <div className="flex items-center justify-between">
        <Link href={`/kalender?bln=${prev}`} className="rounded-lg border px-3 py-1.5 text-sm font-bold">←</Link>
        <h1 className="text-lg font-bold">Kalender Cuti {y}-{String(m).padStart(2, "0")}</h1>
        <Link href={`/kalender?bln=${next}`} className="rounded-lg border px-3 py-1.5 text-sm font-bold">→</Link>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-zinc-500">
        {["Sn", "Sl", "Rb", "Km", "Jm", "Sb", "Mg"].map((h) => <div key={h}>{h}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((k, i) =>
          k === null ? <div key={i} /> : (
            <div key={k} className={`min-h-14 rounded-lg border p-1 text-xs ${perHari.get(k)?.length ? "border-emerald-400 bg-emerald-50" : "bg-white"}`}>
              <div className="font-bold">{k.slice(8)}</div>
              {(perHari.get(k) ?? []).slice(0, 3).map((c) => (
                <div key={c.id} className="truncate">{c.pemohon.nama}</div>
              ))}
              {(perHari.get(k)?.length ?? 0) > 1 && (
                <div className="font-bold text-orange-600">⚠ {(perHari.get(k)?.length ?? 0)} orang</div>
              )}
            </div>
          )
        )}
      </div>
      <p className="text-xs text-zinc-500">⚠ = lebih dari 1 anggota tim cuti di tanggal yang sama.</p>
    </Shell>
  );
}
