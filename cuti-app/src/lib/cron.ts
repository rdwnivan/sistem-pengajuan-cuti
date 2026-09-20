import { prisma } from "@/lib/prisma";
import { fmtTgl } from "@/lib/cuti";
import { kirimWA, notifApp } from "@/lib/notif";

const HARI_MS = 86400000;

export interface HasilCron { reminder: number; eskalasi: number; detail: string[] }

export async function jalankanReminderEskalasi(): Promise<HasilCron> {
  const detail: string[] = [];
  let reminder = 0;
  let eskalasi = 0;
  const now = new Date();

  const antrean = await prisma.pengajuan.findMany({
    where: { status: { in: ["MENUNGGU_ATASAN", "MENUNGGU_HR"] } },
    include: { pemohon: true, jenis: true },
  });

  for (const p of antrean) {
    const umurHari = Math.floor((now.getTime() - p.updatedAt.getTime()) / HARI_MS);
    let targetId: string | null = p.approverId;
    if (!targetId && p.status === "MENUNGGU_ATASAN") {
      targetId = await approverEfektif(p.pemohonId);
    }
    if (!targetId) targetId = await cariHRPertama();
    if (!targetId) continue;

    if (umurHari >= 3 && !p.dieskalasi && p.status === "MENUNGGU_ATASAN") {
      const atasEfektif = await approverEfektif(p.pemohonId);
      const atasId = atasEfektif ?? p.approverId ?? "";
      const atas = await prisma.user.findUnique({ where: { id: atasId }, include: { atasan: true } });
      const naikId = atas?.atasanId ?? (await cariHRPertama());
      if (naikId && naikId !== atasId) {
        const naik = await prisma.user.findUnique({ where: { id: naikId } });
        await prisma.pengajuan.update({ where: { id: p.id }, data: { approverId: naikId, dieskalasi: true, eskalasiKeId: naikId } });
        await prisma.auditLog.create({ data: { pengajuanId: p.id, aksi: "ESKALASI_OTOMATIS", dariStatus: p.status, keStatus: p.status, catatan: `Dieskalasi ke ${naik?.nama} setelah ${umurHari} hari tanpa respons` } });
        await notifApp(naikId, "Eskalasi persetujuan cuti", `${p.pemohon.nama} menunggu ${umurHari} hari (${p.jenis.nama} ${p.jumlahHariKerja} hari). Mohon segera diproses.`, p.id, "ESKALASI");
        if (naik?.noHp) await kirimWA(naik.noHp, `*Cuti Anime - ESKALASI* - ${p.pemohon.nama} menunggu ${umurHari} hari. Mohon proses.`);
        eskalasi++;
        detail.push(`eskalasi ${p.id.slice(0, 6)} -> ${naik?.nama}`);
        continue;
      }
    }

    if (umurHari >= 1) {
      const last = p.lastReminderAt ? Math.floor((now.getTime() - p.lastReminderAt.getTime()) / HARI_MS) : 99;
      if (last >= 1) {
        if (p.status === "MENUNGGU_HR") {
          const hrs = await prisma.user.findMany({ where: { role: "HR_ADMIN", statusAktif: true } });
          for (const h of hrs) {
            await notifApp(h.id, "Pengingat verifikasi HR", `${p.pemohon.nama} menunggu ${umurHari} hari (${p.jenis.nama} ${fmtTgl(p.tglMulai)}).`, p.id, "REMINDER");
            if (h.noHp) await kirimWA(h.noHp, `*Cuti Anime - Reminder HR* - ${p.pemohon.nama} menunggu ${umurHari} hari.`);
          }
          await prisma.pengajuan.update({ where: { id: p.id }, data: { reminderCount: p.reminderCount + 1, lastReminderAt: now } });
          await prisma.auditLog.create({ data: { pengajuanId: p.id, aksi: "REMINDER_OTOMATIS", dariStatus: p.status, keStatus: p.status, catatan: `Reminder ke-${p.reminderCount + 1} ke semua HR` } });
          reminder++;
          detail.push(`reminder ${p.id.slice(0, 6)} -> semua HR`);
        } else {
          const target = await prisma.user.findUnique({ where: { id: targetId } });
          await prisma.pengajuan.update({ where: { id: p.id }, data: { reminderCount: p.reminderCount + 1, lastReminderAt: now } });
          await prisma.auditLog.create({ data: { pengajuanId: p.id, aksi: "REMINDER_OTOMATIS", dariStatus: p.status, keStatus: p.status, catatan: `Reminder ke-${p.reminderCount + 1} ke ${target?.nama}` } });
          await notifApp(targetId, "Pengingat persetujuan cuti", `${p.pemohon.nama} menunggu ${umurHari} hari (${p.jenis.nama} ${fmtTgl(p.tglMulai)}).`, p.id, "REMINDER");
          if (target?.noHp) await kirimWA(target.noHp, `*Cuti Anime - Reminder* - ${p.pemohon.nama} menunggu ${umurHari} hari.`);
          reminder++;
          detail.push(`reminder ${p.id.slice(0, 6)} -> ${target?.nama}`);
        }
      }
    }
  }
  return { reminder, eskalasi, detail };
}

async function cariHRPertama(): Promise<string | null> {
  const h = await prisma.user.findFirst({ where: { role: "HR_ADMIN", statusAktif: true } });
  return h?.id ?? null;
}

export async function delegasiAktifUntuk(atasanId: string, ref = new Date()): Promise<string | null> {
  const d = await prisma.delegasi.findFirst({
    where: { dariId: atasanId, aktif: true, tglMulai: { lte: ref }, tglSelesai: { gte: ref } },
    orderBy: { createdAt: "desc" },
  });
  return d?.keId ?? null;
}

export async function approverEfektif(pemohonId: string): Promise<string | null> {
  const pemohon = await prisma.user.findUnique({ where: { id: pemohonId } });
  if (!pemohon?.atasanId) {
    if (pemohon?.role === "HR_ADMIN") {
      const pimp = await prisma.user.findFirst({ where: { atasanId: null, id: { not: pemohonId }, statusAktif: true } });
      return pimp?.id ?? null;
    }
    return null;
  }
  const del = await delegasiAktifUntuk(pemohon.atasanId);
  return del ?? pemohon.atasanId;
}
