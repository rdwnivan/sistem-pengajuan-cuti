import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { wajibHR } from "@/lib/auth";
import { Shell } from "@/components/shell";
import { aksiToggleBlok } from "@/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { BlokForm } from "./BlokForm";

export default async function BlokPage() {
  const admin = await wajibHR();
  const list = await prisma.blok.findMany({ orderBy: { nama: "asc" } });
  return (
    <Shell nama={admin.nama} role={admin.role} isAtasan={true}>
      <h1 className="text-lg font-bold">Master Blok / Afdeling</h1>
      <BlokForm />
      <div className="mt-4 space-y-2">
        {list.length === 0 && <p className="rounded-xl border bg-white p-4 text-sm text-zinc-500">Belum ada blok.</p>}
        {list.map((b) => (
          <form key={b.id} action={aksiToggleBlok} className="flex items-center justify-between rounded-xl border bg-white px-3 py-2">
            <input type="hidden" name="id" value={b.id} />
            <div className="text-sm">
              <div className="font-semibold">{b.nama} {!b.aktif && "(nonaktif)"}</div>
              {b.keterangan && <div className="text-xs text-zinc-500">{b.keterangan}</div>}
            </div>
            <SubmitButton className="font-semibold text-emerald-700">{b.aktif ? "Nonaktifkan" : "Aktifkan"}</SubmitButton>
          </form>
        ))}
      </div>
      <Link href="/hr" className="mt-3 block text-sm font-semibold text-emerald-700">← Panel HR</Link>
    </Shell>
  );
}
