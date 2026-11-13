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
      <div className="flex flex-wrap items-center justify-between gap-4 py-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Beranda</h1>
          <p className="mt-1 text-sm text-zinc-600">Kuota cuti dan pengajuan terbaru Anda.</p>
        </div>
        <Link href="/cuti/baru" prefetch className="ui-press inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white">+ Ajukan Cuti</Link>
      </div>
      <Banner />
      {(menungguSaya > 0) && (
        <Link href="/persetujuan" prefetch className="ui-press flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          <span>{menungguSaya} pengajuan menunggu persetujuan Anda</span>
          <span className="inline-flex items-center gap-2">Proses pengajuan <Panah /></span>
        </Link>
      )}
      <section aria-label={`Sisa Kuota ${tahun}`} className="rounded-xl border border-zinc-200 bg-white px-4 py-5 sm:px-5">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-bold">Sisa Kuota {tahun}</h2>
          <span className="text-xs text-zinc-600">Dalam hari kerja</span>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 sm:gap-x-6">
          {jenis.filter((j) => j.kuota > 0).map((j) => {
            const k = petaKuota.get(j.id);
            const sisa = (k?.jatah ?? j.kuota) - (k?.terpakai ?? 0);
            return (
              <div key={j.id} className="flex min-w-0 items-baseline justify-between gap-3 border-b border-zinc-100 py-3">
                <dt className="min-w-0 break-words text-sm text-zinc-700">{j.nama}</dt>
                <dd className="shrink-0 text-lg font-bold tabular-nums text-emerald-800">{sisa}</dd>
              </div>
            );
          })}
        </dl>
      </section>
      <section aria-label="Pengajuan Terakhir" className="rounded-xl border border-zinc-200 bg-white px-4 py-5 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold">Pengajuan Terakhir</h2>
          <Link href="/riwayat" prefetch className="dashboard-text-link inline-flex min-h-11 items-center gap-1.5 rounded text-sm font-semibold text-emerald-800">Lihat semua <Panah /></Link>
        </div>
        <div className="divide-y divide-zinc-100">
          {riwayat.length === 0 && (
            <div className="py-5">
              <p className="text-sm font-medium text-zinc-700">Belum ada pengajuan.</p>
              <p className="mt-1 text-sm text-zinc-600">Pengajuan cuti Anda akan tampil di sini.</p>
            </div>
          )}
          {riwayat.map((p) => (
            <Link key={p.id} href={`/cuti/${p.id}`} prefetch className="dashboard-row ui-press flex flex-wrap items-center justify-between gap-3 rounded-lg py-3">
              <div className="min-w-0 text-sm">
                <div className="break-words font-semibold">{p.jenis.nama} · {p.jumlahHariKerja} hari</div>
                <div className="mt-1 text-xs text-zinc-600">{fmtTgl(p.tglMulai)} → {fmtTgl(p.tglSelesai)}</div>
              </div>
              <Badge status={p.status} />
            </Link>
          ))}
        </div>
      </section>
      <section aria-label="Akses cepat" className="pt-2">
        <h2 className="mb-2 text-sm font-semibold text-zinc-600">Akses cepat</h2>
        <div className="grid gap-x-6 sm:grid-cols-2">
          <AksesCepat href="/slip-gaji">Slip Gaji</AksesCepat>
          {!atasan && <AksesCepat href="/laporan">Laporan Lapangan</AksesCepat>}
          {user.role === "HR_ADMIN" && <>
            <AksesCepat href="/persetujuan">Verifikasi HR ({antreanHR})</AksesCepat>
            <AksesCepat href="/hr/slip-gaji">Kelola Slip Gaji</AksesCepat>
            <AksesCepat href="/hr">Kelola HR</AksesCepat>
          </>}
        </div>
      </section>
    </Shell>
  );
}

function Panah() {
  return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;
}

function AksesCepat({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} prefetch className="dashboard-row ui-press flex min-h-12 items-center justify-between gap-3 rounded-lg border-b border-zinc-200 py-3 text-sm font-semibold text-emerald-800">
      {children}<Panah />
    </Link>
  );
}
