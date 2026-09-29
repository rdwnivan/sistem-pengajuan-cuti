import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { wajibLogin } from "@/lib/auth";
import { Badge } from "@/components/ui";
import { Shell } from "@/components/shell";
import { fmtTgl } from "@/lib/cuti";
import { aksiKirimLaporan, aksiBatalLaporan } from "@/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { PutusanLaporanForm } from "./PutusanLaporanForm";

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export default async function LaporanDetail({ params }: { params: { id: string } }) {
  const user = await wajibLogin();
  const l = await prisma.laporanLapangan.findUnique({
    where: { id: params.id },
    include: { pembuat: true, approver: true, riwayat: { include: { aktor: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!l) notFound();

  const isOwner = l.pembuatId === user.id;
  const isApprover = l.approverId === user.id;
  if (!isOwner && !isApprover) notFound();

  const dapatPutus = isApprover && l.status === "MENUNGGU";
  const dapatRevisi = isOwner && ["DITOLAK", "DIKEMBALIKAN"].includes(l.status);
  const dapatEditDraft = isOwner && l.status === "DRAFT";
  const dapatKirim = isOwner && l.status === "DRAFT" && !!l.approverId;
  const dapatBatal = isOwner && ["DITOLAK", "DIKEMBALIKAN"].includes(l.status);
  const bisaDownload = l.status === "DISETUJUI";

  return (
    <Shell nama={user.nama} role={user.role} isAtasan={isApprover}>
      <Link href="/laporan" className="inline-block text-sm font-semibold text-emerald-700">&larr; Kembali</Link>

      <div className="rounded-xl border bg-white p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h1 className="font-bold">{l.judul}</h1>
          <Badge status={l.status} />
        </div>
        <dl className="space-y-1 text-sm">
          <Row k="Pelapor" v={`${l.pembuat.nama} (${l.pembuat.email})`} />
          <Row k="Tanggal" v={fmtTgl(l.tglLaporan)} />
          <Row k="Lokasi" v={l.lokasi} />
          {l.shift && <Row k="Shift" v={l.shift} />}
          <Row k="Approver" v={l.approver?.nama ?? "-"} />
          {l.catatanApprover && <Row k="Catatan approver" v={l.catatanApprover} />}
        </dl>
        <div className="mt-3 whitespace-pre-wrap rounded-lg border bg-zinc-50 p-3 text-sm">{l.isi}</div>
        {l.lampiranPath && (
          <a href={l.lampiranPath} target="_blank" className="mt-2 inline-block text-sm font-semibold text-emerald-700 underline">Lihat lampiran</a>
        )}
      </div>

      {dapatPutus && <PutusanLaporanForm laporanId={l.id} />}

<div className="space-y-2">
        {dapatKirim && (
          <form action={aksiKirimLaporan}>
            <input type="hidden" name="id" value={l.id} />
            <SubmitButton className="w-full rounded-xl bg-emerald-700 px-4 py-3 font-bold text-white">Kirim ke Atasan</SubmitButton>
          </form>
        )}
        {dapatRevisi && (
          <Link href={`/laporan/baru?edit=${l.id}`} className="block rounded-xl border-2 border-emerald-700 px-4 py-3 text-center font-bold text-emerald-700">Revisi Laporan</Link>
        )}
        {dapatEditDraft && (
          <Link href={`/laporan/baru?edit=${l.id}`} className="block rounded-xl border-2 border-emerald-700 px-4 py-3 text-center font-bold text-emerald-700">Edit Laporan</Link>
        )}
        {bisaDownload && (
          <a href={`/api/laporan-lapangan/${l.id}?format=pdf`} className="block rounded-xl bg-emerald-700 px-4 py-3 text-center font-bold text-white">Download PDF</a>
        )}
        {dapatBatal && (
          <form action={aksiBatalLaporan}>
            <input type="hidden" name="id" value={l.id} />
            <SubmitButton className="w-full rounded-xl border-2 border-red-500 px-4 py-3 font-bold text-red-600">Batalkan Laporan</SubmitButton>
          </form>
        )}
      </div>

      {l.riwayat.length > 0 && (
        <div className="rounded-xl border bg-white p-4">
          <h2 className="mb-2 font-bold">Timeline</h2>
          <ol className="space-y-2 text-sm">
            {l.riwayat.map((r) => (
              <li key={r.id} className="rounded-lg border px-3 py-2">
                <div className="font-semibold">{r.aksi} {r.keStatus ? `→ ${r.keStatus}` : ""}</div>
                <div className="text-xs text-zinc-500">{r.aktor?.nama ?? "Sistem"} · {fmtTgl(r.createdAt)}</div>
                {r.catatan && <div className="mt-1 text-zinc-700">{r.catatan}</div>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </Shell>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex gap-2"><dt className="w-32 shrink-0 text-zinc-500">{k}</dt><dd className="font-medium">{v}</dd></div>;
}
