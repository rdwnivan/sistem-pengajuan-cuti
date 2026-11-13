import { Prisma, PrismaClient } from "@prisma/client";
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** Raw SQL must use the same schema as Prisma's generated ORM queries. */
export function tabelPrisma(name: "User" | "LoginRateLimit" | "Pengajuan") {
  const schema = new URL(process.env.DATABASE_URL ?? "").searchParams.get("schema") ?? "public";
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) throw new Error("Nama schema database tidak didukung");
  // Only these identifiers are interpolated; all data stays parameterized.
  return Prisma.raw(`"${schema}"."${name}"`);
}
