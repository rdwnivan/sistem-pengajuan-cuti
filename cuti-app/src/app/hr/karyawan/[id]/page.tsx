import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { wajibHR } from "@/lib/auth";
import { Shell } from "@/components/shell";
import { fmtTgl } from "@/lib/cuti";
import { UserForm } from "../UserForm";
export default async function EditUser({ params }: { params: { id: string } }) {
  const admin = await wajibHR();
  const u = await prisma.user.findUnique({ where: { id: params.id } });
  if (!u) notFound();
  const atasans = await prisma.user.findMany({ where: { statusAktif: true }, select: { id: true, nama: true }, orderBy: { nama: "asc" } });
  return (<Shell nama={admin.nama} role={admin.role} isAtasan={true}><h1 className="text-lg font-bold">Edit Karyawan</h1><UserForm id={u.id} atasans={atasans} initial={{ nama: u.nama, email: u.email, jabatan: u.jabatan, noHp: u.noHp, tglMasuk: fmtTgl(u.tglMasuk), role: u.role, atasanId: u.atasanId, statusAktif: u.statusAktif }} /></Shell>);
}
