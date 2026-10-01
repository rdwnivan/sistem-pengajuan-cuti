import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { isAtasan, wajibLogin } from "@/lib/auth";
import { Badge, Banner } from "@/components/ui";
import { Shell } from "@/components/shell";
import { SkeletonCard, SkeletonGrid, SkeletonBar } from "@/components/skeleton";
import { fmtTgl } from "@/lib/cuti";

export default async function Dashboard() {
  const user = await wajibLogin();
  const atasan = user.role === "HR_ADMIN" ? true : await isAtasan(user.id);
  const tahun = new Date().getFullYear();
  return (
    <Shell nama={user.nama} role={user.role} isAtasan={atasan}>
      <Banner />
      <Suspense fallback={<SkeletonBar w="w-full" h="h-12" />}>
        <AntreanBanner userId={user.id} role={user.role} atasan={atasan} />
      </Suspense>
      <Suspense fallback={<SkeletonGrid />}>
        <KuotaSection userId={user.id} tahun={tahun} />
      </Suspense>
      <Suspense fallback={<SkeletonCard />}>
        <RiwayatSection userId={user.id} />
      </Suspense>
      <Suspense fallback={null}>
        <MenuGrid role={user.role} atasan={atasan} />
      </Suspense>
    </Shell>
  );
}

async function AntreanBanner({ userId, role, atasan }: { userId: string; role: string; atasan: boolean }) {
  const [antreanAtasan, antreanHR] = await Promise.all([
    atasan && role !== "HR_ADMIN"
      ? prisma.pengajuan.count({ where: { status: "MENUNGGU_ATASAN", pemohon: { atasanId: userId } } })
      : 0,
    role === "HR_ADMIN"
      ? prisma.pengajuan.count({ where: { status: "MENUNGGU_HR" } })
      : 0,
  ]);
  const menungguSaya = role === "HR_ADMIN" ? antreanHR : antreanAtasan;
  if (menungguSaya === 0) return null;
  return (
    <Link href="/persetujuan" className="block rounded-xl border-2 border-amber-500 bg-amber-50 p-3 text-center text-sm font-bold text-amber-800">
      {menungguSaya} pengajuan menunggu persetujuan Anda — ketuk untuk proses
    </Link>
  );
}

async function KuotaSection({ userId, tahun }: { userId: string; tahun: number }) {
  const [jenis, kuota] = await Promise.all([
    prisma.jenisCuti.findMany({ where: { aktif: true }, orderBy: { nama: "asc" } }),
    prisma.kuota.findMany({ where: { userId, tahun }, include: { jenis: true } }),
  ]);
  const petaKuota = new Map(kuota.map((k) => [k.jenisId, k]));
  return (
    <section className="rounded-xl border bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-bold">Sisa Kuota {tahun}</h2>
        <Link href="/cuti/baru" className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-bold text-white">+ Ajukan</Link>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {jenis.filter((j) => j.kuota > 0).map((j) => {
          const k = petaKuota.get(j.id);
          const sisa = (k?.jatah ?? j.kuota) - (k?.terpakai ?? 0);
          return (
            <div key={j.id} className="rounded-lg border p-2 text-center">
              <div className="text-xs text-zinc-500">{j.nama}</div>
              <div className="text-xl font-bold text-emerald-700">{sisa}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

async function RiwayatSection({ userId }: { userId: string }) {
  const riwayat = await prisma.pengajuan.findMany({
    where: { pemohonId: userId }, include: { jenis: true }, orderBy: { createdAt: "desc" }, take: 5,
  });
  return (
    <section className="rounded-xl border bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-bold">Pengajuan Terakhir</h2>
        <Link href="/riwayat" className="text-sm font-semibold text-emerald-700">Lihat semua</Link>
      </div>
      <div className="space-y-2">
        {riwayat.length === 0 && <p className="text-sm text-zinc-500">Belum ada pengajuan.</p>}
        {riwayat.map((p) => (
          <Link key={p.id} href={`/cuti/${p.id}`} className="flex items-center justify-between rounded-lg border px-3 py-2">
            <div className="text-sm">
              <div className="font-semibold">{p.jenis.nama} · {p.jumlahHariKerja} hari</div>
              <div className="text-xs text-zinc-500">{fmtTgl(p.tglMulai)} → {fmtTgl(p.tglSelesai)}</div>
            </div>
            <Badge status={p.status} />
          </Link>
        ))}
      </div>
    </section>
  );
}

async function MenuGrid({ role, atasan }: { role: string; atasan: boolean }) {
  const antreanHR = role === "HR_ADMIN"
    ? await prisma.pengajuan.count({ where: { status: "MENUNGGU_HR" } })
    : 0;
  return (
    <section className="grid grid-cols-2 gap-2">
      <Link href="/cuti/baru" className="rounded-xl border bg-white p-3 text-center text-sm font-bold text-emerald-700">+ Ajukan Cuti</Link>
      <Link href="/slip-gaji" className="rounded-xl border bg-white p-3 text-center text-sm font-bold text-blue-700">Slip Gaji</Link>
      {!atasan && <Link href="/laporan" className="rounded-xl border bg-white p-3 text-center text-sm font-bold text-amber-700">Laporan Lapangan</Link>}
      {role === "HR_ADMIN" && <Link href="/persetujuan" className="rounded-xl border bg-white p-3 text-center text-sm font-bold text-blue-700">Verifikasi HR ({antreanHR})</Link>}
      {role === "HR_ADMIN" && <Link href="/hr/slip-gaji" className="rounded-xl border bg-white p-3 text-center text-sm font-bold text-purple-700">Kelola Slip Gaji</Link>}
      {role === "HR_ADMIN" && <Link href="/hr" className="rounded-xl border bg-white p-3 text-center text-sm font-bold text-emerald-700">Kelola HR</Link>}
    </section>
  );
}
