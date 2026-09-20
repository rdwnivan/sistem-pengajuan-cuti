import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { userDariSesi } from "@/lib/auth";
import { Badge, Banner } from "@/components/ui";
import { fmtTgl } from "@/lib/cuti";
import { aksiBatal } from "@/app/actions";
import { delegasiAktifUntuk } from "@/lib/cron";
import { PutusanForm } from "./PutusanForm";

export default async function Detail({ params }: { params: { id: string } }) {
  const user = await userDariSesi();
  if (!user) redirect("/login");
  const p = await prisma.pengajuan.findUnique({
    where: { id: params.id },
    include: { jenis: true, pemohon: true, riwayat: { include: { aktor: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!p) notFound();
  const isOwner = p.pemohonId === user.id;
  const isHR = user.role === "HR_ADMIN";
  const isAtasanLangsung = p.pemohon.atasanId === user.id;
  const delAktif = p.pemohon.atasanId ? await delegasiAktifUntuk(p.pemohon.atasanId) : null;
  const isDelegasi = delAktif === user.id;
  const eskalasiKe = (p as { eskalasiKeId?: string | null }).eskalasiKeId ?? null;
  const isEskalasi = eskalasiKe === user.id;
  const bisaPutusAtasan = p.status === "MENUNGGU_ATASAN" && (isAtasanLangsung || isHR || isDelegasi || isEskalasi) && !isOwner;
  const bisaPutusHR = p.status === "MENUNGGU_HR" && isHR && !isOwner;
  const bisaPutus = bisaPutusAtasan || bisaPutusHR;
  const bolehLihat = isOwner || isHR || isAtasanLangsung || isDelegasi || isEskalasi;
  if (!bolehLihat) notFound();
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const bisaBatal = isOwner && fmtTgl(p.tglMulai) > fmtTgl(now) && ["MENUNGGU_ATASAN", "MENUNGGU_HR", "DIKEMBALIKAN"].includes(p.status);

  return (
    <div className="mx-auto max-w-3xl space-y-3 px-3 pb-10 pt-4">
      <Link href="/" className="text-sm font-semibold text-emerald-700">← Kembali</Link>
      <Banner />
      <div className="rounded-xl border bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <h1 className="font-bold">Detail Pengajuan</h1>
          <Badge status={p.status} />
        </div>
        <dl className="space-y-1 text-sm">
          <Row k="Pemohon" v={`${p.pemohon.nama} (${p.pemohon.email})`} />
          <Row k="Jenis" v={p.jenis.nama} />
          <Row k="Tanggal" v={`${fmtTgl(p.tglMulai)} → ${fmtTgl(p.tglSelesai)} (${p.jumlahHariKerja} hari kerja)`} />
          <Row k="Alasan" v={p.alasan} />
          {p.picPengganti && <Row k="PIC" v={p.picPengganti} />}
          {p.kontakSelamaCuti && <Row k="Kontak" v={p.kontakSelamaCuti} />}
          {p.lampiranPath && (
            <div className="flex gap-2"><dt className="w-32 shrink-0 text-zinc-500">Lampiran</dt><dd className="font-medium"><a className="text-emerald-700 underline" href={p.lampiranPath} target="_blank">Lihat lampiran</a></dd></div>
          )}
          {p.catatanApprover && <Row k="Catatan approver" v={p.catatanApprover} />}
        </dl>
      </div>
      {bisaPutus && <PutusanForm id={p.id} />}
      {p.status === "DISETUJUI" && (
        <a href={`/api/formulir/${p.id}`} className="block rounded-xl bg-emerald-700 px-4 py-3 text-center font-bold text-white">Cetak / Unduh Formulir PDF</a>
      )}
      {bisaBatal && (
        <form action={aksiBatal}>
          <input type="hidden" name="id" value={p.id} />
          <button className="w-full rounded-xl border-2 border-red-500 px-4 py-3 font-bold text-red-600">Batalkan Pengajuan</button>
        </form>
      )}
      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-2 font-bold">Timeline</h2>
        <ol className="space-y-2 text-sm">
          {p.riwayat.map((r) => (
            <li key={r.id} className="rounded-lg border px-3 py-2">
              <div className="font-semibold">{r.aksi} {r.dariStatus ? `(${r.dariStatus} → ${r.keStatus})` : r.keStatus ? `→ ${r.keStatus}` : ""}</div>
              <div className="text-xs text-zinc-500">{r.aktor?.nama ?? "Sistem"} · {fmtTgl(r.createdAt)} {String(r.createdAt.getHours()).padStart(2, "0")}:{String(r.createdAt.getMinutes()).padStart(2, "0")}</div>
              {r.catatan && <div className="mt-1 text-zinc-700">{r.catatan}</div>}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex gap-2"><dt className="w-32 shrink-0 text-zinc-500">{k}</dt><dd className="font-medium">{v}</dd></div>;
}
