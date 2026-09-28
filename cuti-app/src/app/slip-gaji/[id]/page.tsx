import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { wajibLogin } from "@/lib/auth";
import { Badge } from "@/components/ui";
import { Shell } from "@/components/shell";
import { namaBulan } from "@/lib/pdf";
import { MonthSelector } from "./MonthSelector";

export default async function SlipDetail({ params }: { params: { id: string } }) {
  const user = await wajibLogin();
  const s = await prisma.slipGaji.findUnique({ where: { id: params.id }, include: { user: true } });
  if (!s) notFound();
  const allowed = s.userId === user.id || user.role === "HR_ADMIN";
  if (!allowed) notFound();

  const allSlips = await prisma.slipGaji.findMany({
    where: { userId: s.userId, status: "TERBIT" },
    orderBy: [{ tahun: "desc" }, { bulan: "desc" }],
    select: { id: true, bulan: true, tahun: true },
  });

  return (
    <div className="mx-auto max-w-md space-y-3 px-3 pb-10 pt-4">
      <Link href={user.role === "HR_ADMIN" ? "/hr/slip-gaji" : "/slip-gaji"} className="text-sm font-semibold text-emerald-700">← Kembali</Link>
      <div className="rounded-xl border bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">Slip Gaji</h1>
          <Badge status={s.status} />
        </div>
        <div className="text-center text-3xl font-bold text-emerald-800 mb-4">Rp {s.gajiBersih.toLocaleString("id-ID")}</div>
        <dl className="space-y-2 text-sm">
          <Row k="Karyawan" v={s.user.nama} />
          <Row k="Email" v={s.user.email} />
          <Row k="Jabatan" v={s.user.jabatan ?? "-"} />
          <Row k="Periode" v={`${namaBulan(s.bulan)} ${s.tahun}`} />
          <Row k="Gaji pokok" v={s.gajiPokok.toLocaleString("id-ID")} />
          <Row k="Tunjangan" v={s.tunjangan.toLocaleString("id-ID")} />
          <Row k="Potongan" v={s.potongan.toLocaleString("id-ID")} />
          <Row k="Gaji bersih" v={s.gajiBersih.toLocaleString("id-ID")} />
          {s.catatan && <Row k="Catatan" v={s.catatan} />}
          <Row k="Status" v={s.status} />
        </dl>
      </div>
      <div className="flex gap-2">
        <a href={`/api/slip/${s.id}`} className="flex-1 rounded-xl bg-emerald-700 py-3 text-center font-bold text-white">Download PDF</a>
      </div>
      <MonthSelector slips={allSlips} currentId={s.id} />
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex gap-2"><dt className="w-32 shrink-0 text-zinc-500">{k}</dt><dd className="font-medium">{v}</dd></div>;
}
