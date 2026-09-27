import { prisma } from "@/lib/prisma";
import { isAtasan, wajibLogin } from "@/lib/auth";
import { Shell } from "@/components/shell";
import { fmtTgl } from "@/lib/cuti";
import { DelegasiForm } from "./DelegasiForm";
import { aksiBatalDelegasi } from "@/app/actions";
import { redirect } from "next/navigation";

export default async function DelegasiPage() {
  const user = await wajibLogin();
  const atasan = await isAtasan(user.id);
  if (!atasan && user.role !== "HR_ADMIN") redirect("/");
  const semua = await prisma.user.findMany({ where: { statusAktif: true, id: { not: user.id } }, select: { id: true, nama: true, email: true, role: true }, orderBy: { nama: "asc" } });
  const barisAtasan = await prisma.user.findMany({ where: { statusAktif: true, atasanId: { not: null } }, select: { atasanId: true }, distinct: ["atasanId"] });
  const atasanIds = new Set(barisAtasan.map((r) => r.atasanId));
  const users = user.role === "HR_ADMIN"
    ? semua.filter((u) => u.role === "HR_ADMIN")
    : semua.filter((u) => u.role !== "HR_ADMIN" && atasanIds.has(u.id));
  const list = await prisma.delegasi.findMany({ where: { dariId: user.id }, include: { ke: true }, orderBy: { createdAt: "desc" } });
  return (
    <Shell nama={user.nama} role={user.role} isAtasan={true}>
      <h1 className="text-lg font-bold">Delegasi Persetujuan</h1>
      <DelegasiForm users={users} />
      <div className="space-y-2">
        {list.map((d) => (
          <form key={d.id} action={aksiBatalDelegasi} className="flex items-center justify-between rounded-xl border bg-white px-3 py-2 text-sm">
            <input type="hidden" name="id" value={d.id} />
            <div>
              <div className="font-semibold">→ {d.ke.nama} {!d.aktif && "(nonaktif)"}</div>
              <div className="text-xs text-zinc-500">{fmtTgl(d.tglMulai)} → {fmtTgl(d.tglSelesai)}</div>
            </div>
            {d.aktif && <button className="font-semibold text-red-600">Batalkan</button>}
          </form>
        ))}
        {list.length === 0 && <p className="text-sm text-zinc-500">Belum ada delegasi.</p>}
      </div>
    </Shell>
  );
}
