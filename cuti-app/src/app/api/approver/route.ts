import { prisma } from "@/lib/prisma";
import { userDariSesi } from "@/lib/auth";

export async function GET() {
  const user = await userDariSesi();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const list = await prisma.user.findMany({
    where: { statusAktif: true, id: { not: user.id }, role: { not: "HR_ADMIN" }, bawahan: { some: {} } },
    select: { id: true, nama: true, jabatan: true },
    orderBy: { nama: "asc" },
  });
  return Response.json(list);
}