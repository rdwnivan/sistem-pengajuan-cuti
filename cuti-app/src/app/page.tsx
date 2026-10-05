import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isAtasan, wajibLogin } from "@/lib/auth";
import { Badge, Banner } from "@/components/ui";
import { Shell } from "@/components/shell";
import { fmtTgl } from "@/lib/cuti";

export default async function Dashboard() {
  const user = await wajibLogin();
  const atasan = user.role === "HR_ADMIN" ? true : await isAtasan(user.id);
  const tahun = new Date().getFullYear();
  // Query independen jalan paralel (bukan sequential) untuk potong latency wall-clock.
  // Sengaja TIDAK di-cache: sisa kuota berubah setiap ada pengajuan disetujui,
  // sehingga cache butuh invalidasi per user per tahun yang lebih mahal daripada query-nya.
  const [jenis, kuota, riwayat, antreanAtasan, antreanHR] = await Promise.all([
    prisma.jenisCuti.findMany({ where: { aktif: true }, orderBy: { nama: "asc" } }),
    prisma.kuota.findMany({ where: { userId: user.id, tahun }, include: { jenis: true } }),
    prisma.pengajuan.findMany({
      where: { pemohonId: user.id }, include: { jenis: true }, orderBy: { createdAt: "desc" }, take: 5,
    }),
    atasan && user.role !== "HR_ADMIN"
      ? prisma.pengajuan.count({ where: { status: "MENUNGGU_ATASAN", pemohon: { atasanId: user.id } } })
      : 0,
    user.role === "HR_ADMIN"
      ? prisma.pengajuan.count({ where: { status: "MENUNGGU_HR" } })
      : 0,
  ]);
  const petaKuota = new Map(kuota.map((k) => [k.jenisId, k]));
  const menungguSaya = user.role === "HR_ADMIN" ? antreanHR : antreanAtasan;

  return (
    <Shell nama={user.nama} role={user.role} isAtasan={atasan}>
      <Banner />
      {(menungguSaya > 0) && (
        <Link href="/persetujuan" prefetch className="block rounded-xl border-2 border-amber-500 bg-amber-50 p-3 text-center text-sm font-bold text-amber-800 transition active:scale-[0.99]">
          {menungguSaya} pengajuan menunggu persetujuan Anda — ketuk untuk proses
        </Link>
      )}
      <section className="rounded-xl border bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-bold">Sisa Kuota {tahun}</h2>
          <Link href="/cuti/baru" prefetch className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-bold text-white transition active:scale-[0.97]">+ Ajukan</Link>
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
      <section className="rounded-xl border bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-bold">Pengajuan Terakhir</h2>
          <Link href="/riwayat" prefetch className="text-sm font-semibold text-emerald-700">Lihat semua</Link>
        </div>
        <div className="space-y-2">
          {riwayat.length === 0 && <p className="text-sm text-zinc-500">Belum ada pengajuan.</p>}
          {riwayat.map((p) => (
            <Link key={p.id} href={`/cuti/${p.id}`} prefetch className="flex items-center justify-between rounded-lg border px-3 py-2 transition active:scale-[0.99]">
              <div className="text-sm">
                <div className="font-semibold">{p.jenis.nama} · {p.jumlahHariKerja} hari</div>
                <div className="text-xs text-zinc-500">{fmtTgl(p.tglMulai)} → {fmtTgl(p.tglSelesai)}</div>
              </div>
              <Badge status={p.status} />
            </Link>
          ))}
        </div>
      </section>
      <section className="grid grid-cols-2 gap-2">
        <Link href="/cuti/baru" prefetch className="rounded-xl border bg-white p-3 text-center text-sm font-bold text-emerald-700 transition active:scale-[0.97]">+ Ajukan Cuti</Link>
        <Link href="/slip-gaji" prefetch className="rounded-xl border bg-white p-3 text-center text-sm font-bold text-blue-700 transition active:scale-[0.97]">Slip Gaji</Link>
        {!atasan && <Link href="/laporan" prefetch className="rounded-xl border bg-white p-3 text-center text-sm font-bold text-amber-700 transition active:scale-[0.97]">Laporan Lapangan</Link>}
        {user.role === "HR_ADMIN" && <Link href="/persetujuan" prefetch className="rounded-xl border bg-white p-3 text-center text-sm font-bold text-blue-700 transition active:scale-[0.97]">Verifikasi HR ({antreanHR})</Link>}
        {user.role === "HR_ADMIN" && <Link href="/hr/slip-gaji" prefetch className="rounded-xl border bg-white p-3 text-center text-sm font-bold text-purple-700 transition active:scale-[0.97]">Kelola Slip Gaji</Link>}
        {user.role === "HR_ADMIN" && <Link href="/hr" prefetch className="rounded-xl border bg-white p-3 text-center text-sm font-bold text-emerald-700 transition active:scale-[0.97]">Kelola HR</Link>}
      </section>
    </Shell>
  );
}
