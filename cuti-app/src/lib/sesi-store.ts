import { prisma, tabelPrisma } from "./prisma";
import { samaAman } from "./aman-sama";

/** Shares the User lock with password reset/change before issuing a session. */
export async function terbitkanSesi(userId: string, hashTerverifikasi: string, token: string, expiresAt: Date, tokenLama?: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const users = await tx.$queryRaw<{ passwordHash: string; statusAktif: boolean }[]>`
      SELECT "passwordHash", "statusAktif" FROM ${tabelPrisma("User")} WHERE id = ${userId} FOR UPDATE`;
    if (!users[0]?.statusAktif || !samaAman(users[0].passwordHash, hashTerverifikasi)) return false;
    await tx.sesi.create({ data: { token, userId, expiresAt } });
    if (tokenLama) await tx.sesi.deleteMany({ where: { token: tokenLama } });
    return true;
  });
}
