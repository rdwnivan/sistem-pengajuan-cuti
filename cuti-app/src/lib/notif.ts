import { prisma } from "./prisma";
import { fmtTgl } from "./cuti";
import { kirimWebPush } from "./web-push";

export interface WAAdapter {
  kirim(noHp: string, pesan: string): Promise<{ ok: boolean; info?: string }>;
}

class FonnteAdapter implements WAAdapter {
  async kirim(noHp: string, pesan: string) {
    const token = process.env.FONNTE_TOKEN;
    if (!token) return { ok: false, info: "FONNTE_TOKEN belum diisi (mode log)" };
    // Retry terbatas + backoff singkat. Jalur sukses tetap 1x percobaan
    // (tidak menambah beban normal); biaya tambahan hanya saat gagal.
    // Jeda bisa dioverride untuk test via WA_RETRY_DELAYS_MS="10,20".
    const rawJeda = process.env.WA_RETRY_DELAYS_MS;
    const jeda = rawJeda
      ? rawJeda.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n >= 0)
      : [];
    const jadwal = jeda.length > 0 ? jeda : [0, 1000, 3000];
    let terakhir = "";
    for (let i = 0; i < jadwal.length; i++) {
      if (jadwal[i] > 0) await new Promise((r) => setTimeout(r, jadwal[i]));
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 10000);
        try {
          const res = await fetch("https://api.fonnte.com/send", {
            method: "POST",
            headers: { Authorization: token },
            body: new URLSearchParams({ target: noHp, message: pesan }),
            signal: ctrl.signal,
          });
          const j = await res.json().catch(() => ({}));
          if (res.ok) return { ok: true, info: `percobaan-${i + 1}` };
          terakhir = JSON.stringify(j).slice(0, 200);
        } finally {
          clearTimeout(t);
        }
      } catch (e) {
        terakhir = String(e).slice(0, 200);
      }
    }
    console.error(`[WA-GAGAL] ke ${noHp} setelah ${jadwal.length}x: ${terakhir}`);
    return { ok: false, info: `gagal ${jadwal.length}x: ${terakhir}` };
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

/**
 * Keputusan murni: apakah WA boleh dikirim ke user ini.
 * Diekspor agar bisa di-unit-test tanpa DB (`unit/notif-wa.test.ts`).
 */
export function bolehKirimWA(
  u: { noHp: string | null; notifWa: boolean } | null | undefined,
): { boleh: boolean; alasan?: string } {
  if (!u) return { boleh: false, alasan: "user tidak ditemukan" };
  if (!u.notifWa) return { boleh: false, alasan: "dinonaktifkan user" };
  if (!u.noHp) return { boleh: false, alasan: "no HP kosong" };
  return { boleh: true };
}

/**
 * Kirim WA ke user dengan menghormati preferensi `notifWa` miliknya.
 * Gantikan pemanggilan `kirimWA(u.noHp, ...)` dengan ini bila id user tersedia.
 */
export async function kirimWAkeUser(userId: string, pesan: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { noHp: true, notifWa: true } });
  const putusan = bolehKirimWA(u);
  if (!putusan.boleh) return { ok: true, info: `dilewati: ${putusan.alasan}` };
  return kirimWA(u!.noHp, pesan);
}

export async function notifApp(userId: string, judul: string, pesan: string, refId?: string, kanal = "APP", tipe: "CUTI" | "LAPORAN" | "SLIP" | "GAJI" = "CUTI") {
  await prisma.notifikasi.create({
    data: {
      userId, judul, pesan, kanal, tipe,
      pengajuanId: tipe === "CUTI" ? refId ?? null : null,
      laporanId: tipe === "LAPORAN" ? refId ?? null : null,
    },
  });
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
    await kirimWebPush(p.approverId, judul, pesan);
    if (appr) await kirimWAkeUser(appr.id, `*Cuti Anime* - ${judul}: ${pesan}`);
  } else if (p.status === "MENUNGGU_HR") {
    const hrs = await prisma.user.findMany({ where: { role: "HR_ADMIN", statusAktif: true } });
    for (const h of hrs) {
      await notifApp(h.id, "Pengajuan menunggu verifikasi HR", `${p.pemohon.nama} - ${p.jenis.nama} ${p.jumlahHariKerja} hari`, p.id, "APP");
      await kirimWebPush(h.id, "Pengajuan menunggu verifikasi HR", `${p.pemohon.nama} - ${p.jenis.nama} ${p.jumlahHariKerja} hari`);
      await kirimWAkeUser(h.id, `*Cuti Anime* - ${p.pemohon.nama} menunggu verifikasi HR (${p.jenis.nama} ${tgl})`);
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
    await kirimWebPush(h.id, "Pengajuan menunggu verifikasi HR", `${p.pemohon.nama} - ${p.jenis.nama} ${p.jumlahHariKerja} hari (${tgl})`);
    await kirimWAkeUser(h.id, `*Cuti Anime* - ${p.pemohon.nama} menunggu verifikasi HR (${p.jenis.nama} ${tgl})`);
  }
}

export async function notifyKeputusan(pengajuanId: string, keputusan: string, catatan?: string | null) {
  const p = await prisma.pengajuan.findUnique({ where: { id: pengajuanId }, include: { pemohon: true, jenis: true } });
  if (!p) return;
  const judul = `Pengajuan Anda: ${keputusan}`;
  const pesan = `${p.jenis.nama} ${p.jumlahHariKerja} hari berstatus ${keputusan}.${catatan ? " Catatan: " + catatan : ""} Cuti baru sah jika DISETUJUI.`;
  await notifApp(p.pemohonId, judul, pesan, p.id, "APP");
  await kirimWebPush(p.pemohonId, judul, pesan);
  await kirimWAkeUser(p.pemohonId, `*Cuti Anime* - ${pesan}`);
}
