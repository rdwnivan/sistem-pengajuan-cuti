import { prisma } from "@/lib/prisma";
import { userDariSesi } from "@/lib/auth";

export async function GET() {
  const user = await userDariSesi();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const list = await prisma.blok.findMany({
    where: { aktif: true },
    select: { id: true, nama: true, keterangan: true },
    orderBy: { nama: "asc" },
  });
  return Response.json(list);
}
