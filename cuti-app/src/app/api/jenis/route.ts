import { prisma } from "@/lib/prisma";
import { wajibLogin } from "@/lib/auth";

export async function GET() {
  await wajibLogin();
  const j = await prisma.jenisCuti.findMany({ where: { aktif: true }, orderBy: { nama: "asc" } });
  return Response.json(j);
}
