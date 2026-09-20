import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isAtasan, wajibLogin } from "@/lib/auth";
import { Shell } from "@/components/shell";
import { fmtTgl } from "@/lib/cuti";
import { aksiBacaNotif, aksiBacaSemuaNotif } from "@/app/actions";

export default async function NotifikasiPage() {
  const user = await wajibLogin();
  const list = await prisma.notifikasi.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 });
  const belum = list.filter((n) => !n.dibaca).length;
  return (
    <Shell nama={user.nama} role={user.role} isAtasan={await isAtasan(user.id)}>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Notifikasi ({belum} belum dibaca)</h1>
        {belum > 0 && (
          <form action={aksiBacaSemuaNotif}><button className="rounded-lg border px-3 py-1.5 text-sm font-semibold">Tandai semua dibaca</button></form>
        )}
      </div>
      <div className="space-y-2">
        {list.length === 0 && <p className="text-sm text-zinc-500">Belum ada notifikasi.</p>}
        {list.map((n) => (
          <div key={n.id} className={`rounded-xl border bg-white px-3 py-2 text-sm ${n.dibaca ? "opacity-70" : "border-emerald-400"}`}>
            <div className="font-semibold">{n.judul} <span className="ml-1 rounded bg-zinc-100 px-1.5 text-xs">{n.kanal}</span></div>
            <div className="text-zinc-700">{n.pesan}</div>
            <div className="mt-1 flex items-center justify-between text-xs text-zinc-500">
              <span>{fmtTgl(n.createdAt)} {String(n.createdAt.getHours()).padStart(2, "0")}:{String(n.createdAt.getMinutes()).padStart(2, "0")}</span>
              <span className="flex gap-2">
                {n.pengajuanId && <Link href={`/cuti/${n.pengajuanId}`} className="font-semibold text-emerald-700">Lihat</Link>}
                {!n.dibaca && (
                  <form action={aksiBacaNotif}><input type="hidden" name="id" value={n.id} /><button className="font-semibold text-blue-700">Tandai dibaca</button></form>
                )}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}
