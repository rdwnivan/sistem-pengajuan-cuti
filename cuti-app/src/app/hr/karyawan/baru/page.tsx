import { prisma } from "@/lib/prisma";
import { wajibHR } from "@/lib/auth";
import { Shell } from "@/components/shell";
import { UserForm } from "../UserForm";
export default async function BaruUser() {
  const admin = await wajibHR();
  const atasans = await prisma.user.findMany({ where: { statusAktif: true }, select: { id: true, nama: true }, orderBy: { nama: "asc" } });
  return (<Shell nama={admin.nama} role={admin.role} isAtasan={true}><h1 className="text-lg font-bold">Karyawan Baru</h1><UserForm atasans={atasans} /></Shell>);
}
