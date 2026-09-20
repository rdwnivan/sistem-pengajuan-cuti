import { prisma } from "./prisma";
import { fmtTgl } from "./cuti";

export interface WAAdapter {
  kirim(noHp: string, pesan: string): Promise<{ ok: boolean; info?: string }>;
}

class FonnteAdapter implements WAAdapter {
  async kirim(noHp: string, pesan: string) {
    const token = process.env.FONNTE_TOKEN;
    if (!token) return { ok: false, info: "FONNTE_TOKEN belum diisi (mode log)" };
    try {
      const res = await fetch("https://api.fonnte.com/send", {
        method: "POST",
        headers: { Authorization: token },
        body: new URLSearchParams({ target: noHp, message: pesan }),
      });
      const j = await res.json().catch(() => ({}));
      return { ok: res.ok, info: JSON.stringify(j).slice(0, 200) };
    } catch (e) {
      return { ok: false, info: String(e).slice(0, 200) };
    }
  }
}

class LogAdapter implements WAAdapter {
  async kirim(noHp: string, pesan: string) {
    console.log(`[WA-LOG] ke ${noHp}: ${pesan.slice(0, 160)}`);
    return { ok: true, info: "logged" };
  }
}

function adapter(): WAAdapter {
  if (process.env.FONNTE_TOKEN) return new FonnteAdapter();
  return new LogAdapter();
}

export async function kirimWA(noHp: string | null | undefined, pesan: string) {
  if (!noHp) return { ok: false, info: "no HP kosong" };
  let norm = noHp.replace(/[^0-9]/g, "");
  if (!norm) return { ok: false, info: "no HP invalid" };
  if (norm.startsWith("0")) norm = "62" + norm.slice(1);
  if (norm.length < 10 || norm.length > 15) return { ok: false, info: "no HP invalid" };
  return adapter().kirim(norm, pesan);
}

export async function notifApp(userId: string, judul: string, pesan: string, pengajuanId?: string, kanal = "APP") {
  await prisma.notifikasi.create({ data: { userId, judul, pesan, pengajuanId: pengajuanId ?? null, kanal } });
}

export async function notifyPengajuanBaru(pengajuanId: string) {
  const p = await prisma.pengajuan.findUnique({ where: { id: pengajuanId }, include: { pemohon: true, jenis: true, approver: true } });
  if (!p) return;
  const tgl = `${fmtTgl(p.tglMulai)}→${fmtTgl(p.tglSelesai)}`;
  if (p.approverId) {
    const appr = await prisma.user.findUnique({ where: { id: p.approverId } });
    const judul = "Pengajuan cuti baru menunggu Anda";
    const pesan = `${p.pemohon.nama} mengajukan ${p.jenis.nama} ${p.jumlahHariKerja} hari (${tgl}). Alasan: ${p.alasan.slice(0, 120)}`;
    await notifApp(p.approverId, judul, pesan, p.id, "APP");
    if (appr?.noHp) await kirimWA(appr.noHp, `*Cuti Anime* - ${judul}: ${pesan}`);
  } else if (p.status === "MENUNGGU_HR") {
    const hrs = await prisma.user.findMany({ where: { role: "HR_ADMIN", statusAktif: true } });
    for (const h of hrs) {
      await notifApp(h.id, "Pengajuan menunggu verifikasi HR", `${p.pemohon.nama} - ${p.jenis.nama} ${p.jumlahHariKerja} hari`, p.id, "APP");
      if (h.noHp) await kirimWA(h.noHp, `*Cuti Anime* - ${p.pemohon.nama} menunggu verifikasi HR (${p.jenis.nama} ${tgl})`);
    }
  }
}

export async function notifyHRMenungguHR(pengajuanId: string) {
  const p = await prisma.pengajuan.findUnique({ where: { id: pengajuanId }, include: { pemohon: true, jenis: true } });
  if (!p || p.status !== "MENUNGGU_HR") return;
  const tgl = `${fmtTgl(p.tglMulai)}→${fmtTgl(p.tglSelesai)}`;
  const hrs = await prisma.user.findMany({ where: { role: "HR_ADMIN", statusAktif: true } });
  for (const h of hrs) {
    await notifApp(h.id, "Pengajuan menunggu verifikasi HR", `${p.pemohon.nama} - ${p.jenis.nama} ${p.jumlahHariKerja} hari (${tgl})`, p.id, "APP");
    if (h.noHp) await kirimWA(h.noHp, `*Cuti Anime* - ${p.pemohon.nama} menunggu verifikasi HR (${p.jenis.nama} ${tgl})`);
  }
}

export async function notifyKeputusan(pengajuanId: string, keputusan: string, catatan?: string | null) {
  const p = await prisma.pengajuan.findUnique({ where: { id: pengajuanId }, include: { pemohon: true, jenis: true } });
  if (!p) return;
  const judul = `Pengajuan Anda: ${keputusan}`;
  const pesan = `${p.jenis.nama} ${p.jumlahHariKerja} hari berstatus ${keputusan}.${catatan ? " Catatan: " + catatan : ""} Cuti baru sah jika DISETUJUI.`;
  await notifApp(p.pemohonId, judul, pesan, p.id, "APP");
  if (p.pemohon.noHp) await kirimWA(p.pemohon.noHp, `*Cuti Anime* - ${pesan}`);
}
