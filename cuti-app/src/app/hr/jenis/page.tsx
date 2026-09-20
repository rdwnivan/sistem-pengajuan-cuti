import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { wajibHR } from "@/lib/auth";
import { Shell } from "@/components/shell";
import { JenisForm } from "./JenisForm";
export default async function JenisList() {
  const admin = await wajibHR();
  const list = await prisma.jenisCuti.findMany({ orderBy: { nama: "asc" } });
  return (
    <Shell nama={admin.nama} role={admin.role} isAtasan={true}>
      <h1 className="text-lg font-bold">Jenis Cuti</h1>
      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-2 font-bold">Tambah / Edit</h2>
        <JenisForm />
      </div>
      <div className="space-y-2">
        {list.map((j) => (
          <div key={j.id} className="rounded-xl border bg-white px-3 py-2 text-sm">
            <div className="font-semibold">{j.nama} {!j.aktif && "(nonaktif)"} — kuota {j.kuota}, min H-{j.minHariSebelum}</div>
            <div className="text-xs text-zinc-500">Masa kerja {j.butuhMasaKerjaBulan} bln · {j.lampiranWajib ? "lampiran wajib" : j.lampiranWajibJikaLebihDari != null ? `lampiran jika >${j.lampiranWajibJikaLebihDari} hari` : "tanpa lampiran"}</div>
            <JenisForm initial={j} />
          </div>
        ))}
      </div>
      <Link href="/hr" className="text-sm font-semibold text-emerald-700">← Panel HR</Link>
    </Shell>
  );
}
