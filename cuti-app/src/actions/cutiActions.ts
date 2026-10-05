"use server";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { buatSesi, keluar as keluarSesi, userDariSesi, hashPassword, isAtasan } from "@/lib/auth";
import { ajukanSchema, loginSchema, putusanSchema, userSchema, jenisSchema, slipSchema, laporanSchema, putusanLaporanSchema, putusanGajiSchema, gajiPerubahanSchema } from "@/lib/validasi";
import { bulanMasaKerja, fmtTgl, hariKerja, parseTglInput } from "@/lib/cuti";
import { notifyHRMenungguHR, notifyKeputusan, notifyPengajuanBaru, notifApp } from "@/lib/notif";
import { kirimWebPush } from "@/lib/web-push";
import { approverEfektif, delegasiAktifUntuk } from "@/lib/cron";
import { sniffFile, DI_VERCEL, type FileValid } from "@/lib/upload";

import { STATUS_AKTIF, aktor, BULAN_NAMA, unggahFoto, ajukanPerubahanGaji } from "./shared";
import { cekRateLimit, catatGagal, reset as resetRateLimit } from "@/lib/rate-limit";


export async function aksiLogin(_: unknown, fd: FormData) {
  // Key = email saja. x-forwarded-for tidak stabil di dev (Playwright/loopback
  // berganti ::1/127.0.0.1/null antar request) sehingga key per IP+email membuat
  // counter terpecah dan limit tidak pernah tercapai. Rate limit per akun juga
  // sudah tepat sasaran: brute force menarget satu akun, IP attacker bisa berganti.
  const key = `login:${String(fd.get("email") ?? "").toLowerCase().trim()}`;
  const rate = cekRateLimit(key);
  if (!rate.ok) return { error: `Terlalu banyak percobaan. Coba lagi dalam ${rate.cobaLagiDalam} detik.` };
  const v = loginSchema.safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!v.success) return { error: v.error.issues[0].message };
  const { default: bcrypt } = await import("bcryptjs");
  const user = await prisma.user.findUnique({ where: { email: v.data.email.toLowerCase().trim() } });
  if (!user || !user.statusAktif) {
    catatGagal(key);
    return { error: "Email atau password salah" };
  }
  const ok = await bcrypt.compare(v.data.password, user.passwordHash);
  if (!ok) {
    catatGagal(key);
    return { error: "Email atau password salah" };
  }
  resetRateLimit(key);
  await buatSesi(user.id);
  redirect("/");
}


export async function aksiAjukan(_: unknown, fd: FormData) {
  const user = await aktor();
  const v = ajukanSchema.safeParse({
    jenisId: fd.get("jenisId"), tglMulai: fd.get("tglMulai"), tglSelesai: fd.get("tglSelesai"),
    alasan: fd.get("alasan"), picPengganti: fd.get("picPengganti"), kontakSelamaCuti: fd.get("kontakSelamaCuti"),
  });
  if (!v.success) return { error: v.error.issues[0].message };
  const jenis = await prisma.jenisCuti.findUnique({ where: { id: v.data.jenisId } });
  if (!jenis || !jenis.aktif) return { error: "Jenis cuti tidak valid" };
  const mulai = parseTglInput(v.data.tglMulai);
  const selesai = parseTglInput(v.data.tglSelesai);
  if (isNaN(mulai.getTime()) || isNaN(selesai.getTime())) return { error: "Tanggal tidak valid" };
  if (fmtTgl(selesai) < fmtTgl(mulai)) return { error: "Tanggal selesai sebelum tanggal mulai" };

  const now = new Date(); now.setHours(0, 0, 0, 0);
  const selisihHari = Math.round((new Date(fmtTgl(mulai) + "T00:00:00").getTime() - now.getTime()) / 86400000);
  if (selisihHari < jenis.minHariSebelum)
    return { error: `Minimal pengajuan H-${jenis.minHariSebelum} (kurang ${jenis.minHariSebelum - selisihHari} hari)` };
  if (bulanMasaKerja(user.tglMasuk, now) < jenis.butuhMasaKerjaBulan)
    return { error: `Jenis cuti ini butuh masa kerja ${jenis.butuhMasaKerjaBulan} bulan` };

  const libur = await prisma.hariLibur.findMany();
  const liburSet = new Set(libur.map((l) => fmtTgl(l.tanggal)));
  const jumlah = hariKerja(mulai, selesai, liburSet);
  if (jumlah <= 0) return { error: "Rentang tanggal tidak memuat hari kerja" };

  if (jenis.lampiranWajib || (jenis.lampiranWajibJikaLebihDari != null && jumlah > jenis.lampiranWajibJikaLebihDari)) {
    const f = fd.get("lampiran") as File | null;
    if (!f || f.size === 0) return { error: "Lampiran wajib untuk jenis cuti ini" };
  }

  const bentrok = await prisma.pengajuan.findFirst({
    where: {
      pemohonId: user.id, status: { in: STATUS_AKTIF },
      tglMulai: { lte: selesai }, tglSelesai: { gte: mulai },
    },
  });
  if (bentrok) return { error: "Bentrok dengan pengajuan lain milik Anda" };

  const tahun = mulai.getFullYear();
  if (jenis.kuota > 0) {
    let k = await prisma.kuota.findUnique({ where: { userId_jenisId_tahun: { userId: user.id, jenisId: jenis.id, tahun } } });
    if (!k) {
      k = await prisma.kuota.create({ data: { userId: user.id, jenisId: jenis.id, tahun, jatah: jenis.kuota } });
    }
    if (k.jatah - k.terpakai < jumlah) return { error: `Sisa kuota tidak cukup (sisa ${k.jatah - k.terpakai}, butuh ${jumlah})` };
  }

  let lampiranPath: string | undefined;
  const f = fd.get("lampiran") as File | null;
  if (f && f.size > 0) {
    if (f.size > 2 * 1024 * 1024) return { error: "Lampiran maksimal 2MB" };
    let snapped: FileValid;
    try {
      snapped = await sniffFile(f);
    } catch {
      return { error: "Lampiran hanya PDF/JPG/PNG (file tidak sesuai jenis yang diklaim)" };
    }
    const { buffer, ext } = snapped;
    const name = `lampiran/${user.id}-${Date.now()}.${ext}`;
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { put } = await import("@vercel/blob");
      const blob = await put(name, buffer as unknown as File, { access: "public" });
      lampiranPath = blob.url;
    } else if (DI_VERCEL) {
      return { error: "Upload lampiran belum dikonfigurasi (BLOB_READ_WRITE_TOKEN kosong)" };
    } else {
      const { writeFile, mkdir } = await import("fs/promises");
      const { default: path } = await import("path");
      const dir = path.join(process.cwd(), "public", "uploads");
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, name.split("/").pop()!), buffer);
      lampiranPath = `/uploads/${name.split("/").pop()}`;
    }
  }

  const pemohonDb = await prisma.user.findUnique({ where: { id: user.id } });
  let atasanId = pemohonDb?.atasanId ?? null;
  if (atasanId) {
    const del = await delegasiAktifUntuk(atasanId);
    if (del) atasanId = del;
  }
  if (!atasanId && pemohonDb?.role === "HR_ADMIN") {
    const pimpinan = await prisma.user.findFirst({ where: { atasanId: null, id: { not: user.id }, statusAktif: true } });
    atasanId = pimpinan?.id ?? null;
  }
  const tanpaAtasan = !atasanId;
  const status = tanpaAtasan ? "MENUNGGU_HR" : "MENUNGGU_ATASAN";
  const p = await prisma.pengajuan.create({
    data: {
      pemohonId: user.id, jenisId: jenis.id, tglMulai: mulai, tglSelesai: selesai,
      jumlahHariKerja: jumlah, alasan: v.data.alasan,
      picPengganti: v.data.picPengganti || null, kontakSelamaCuti: v.data.kontakSelamaCuti || null,
      lampiranPath, status, approverId: atasanId,
    },
  });
  await prisma.auditLog.create({
    data: { pengajuanId: p.id, aktorId: user.id, aksi: "DIAJUKAN", keStatus: status },
  });
  await notifyPengajuanBaru(p.id);
  redirect(`/cuti/${p.id}`);
}


export async function aksiPutusan(_: unknown, fd: FormData) {
  const user = await aktor();
  const v = putusanSchema.safeParse({ pengajuanId: fd.get("pengajuanId"), aksi: fd.get("aksi"), catatan: fd.get("catatan") });
  if (!v.success) return { error: v.error.issues[0].message };
  const p = await prisma.pengajuan.findUnique({ where: { id: v.data.pengajuanId }, include: { pemohon: true, jenis: true } });
  if (!p) return { error: "Pengajuan tidak ditemukan" };
  if (p.pemohonId === user.id) return { error: "Tidak boleh memproses pengajuan sendiri" };
  const catatan = (v.data.catatan || "").trim();
  if ((v.data.aksi === "tolak" || v.data.aksi === "kembalikan") && !catatan)
    return { error: "Alasan/catatan wajib diisi untuk menolak atau mengembalikan" };

  const isHR = user.role === "HR_ADMIN";
  const isAtasanLangsung = p.pemohon.atasanId === user.id;
  const delKe = p.pemohon.atasanId ? await delegasiAktifUntuk(p.pemohon.atasanId) : null;
  const isDelegasi = delKe === user.id;
  const eskalasiKe = (p as { eskalasiKeId?: string | null }).eskalasiKeId ?? null;
  const isEskalasi = eskalasiKe === user.id;

  if (p.status === "MENUNGGU_ATASAN") {
    if (!isAtasanLangsung && !isHR && !isDelegasi && !isEskalasi) return { error: "Anda bukan atasan langsung pemohon" };
    const override = isHR && !isAtasanLangsung && !isDelegasi && !isEskalasi;
    const viaDelegasi = isDelegasi && !isAtasanLangsung;
    if (v.data.aksi === "setuju") {
      if (p.pemohon.role === "HR_ADMIN") {
        const tahunHR = p.tglMulai.getFullYear();
        if (p.jenis.kuota > 0) {
          let kh = await prisma.kuota.findUnique({ where: { userId_jenisId_tahun: { userId: p.pemohonId, jenisId: p.jenisId, tahun: tahunHR } } });
          if (!kh) kh = await prisma.kuota.create({ data: { userId: p.pemohonId, jenisId: p.jenisId, tahun: tahunHR, jatah: p.jenis.kuota } });
          if (kh.jatah - kh.terpakai < p.jumlahHariKerja) return { error: "Sisa kuota tidak cukup" };
          await prisma.kuota.update({ where: { id: kh.id }, data: { terpakai: kh.terpakai + p.jumlahHariKerja } });
        }
        await prisma.pengajuan.update({ where: { id: p.id }, data: { status: "DISETUJUI", catatanApprover: catatan || null, approverId: null } });
        await prisma.auditLog.create({ data: { pengajuanId: p.id, aktorId: user.id, aksi: "PIMPINAN_SETUJU_FINAL", dariStatus: p.status, keStatus: "DISETUJUI", catatan: catatan || null } });
      } else {
        await prisma.pengajuan.update({ where: { id: p.id }, data: { status: "MENUNGGU_HR", catatanApprover: catatan || null, approverId: null } });
        await prisma.auditLog.create({ data: { pengajuanId: p.id, aktorId: user.id, aksi: viaDelegasi ? "DELEGASI_SETUJU" : isEskalasi ? "ESKALASI_SETUJU" : override ? "OVERRIDE_ATASAN_SETUJU" : "ATASAN_SETUJU", dariStatus: p.status, keStatus: "MENUNGGU_HR", catatan: catatan || (override ? "Override HR" : viaDelegasi ? "Via delegasi" : isEskalasi ? "Via eskalasi" : null) } });
        await notifApp(p.pemohonId, "Atasan menyetujui", "Pengajuan diteruskan ke HR untuk verifikasi akhir.", p.id, "APP");
        await notifyHRMenungguHR(p.id);
      }
    } else if (v.data.aksi === "tolak") {
      await prisma.pengajuan.update({ where: { id: p.id }, data: { status: "DITOLAK", catatanApprover: catatan } });
      await prisma.auditLog.create({ data: { pengajuanId: p.id, aktorId: user.id, aksi: override ? "OVERRIDE_ATASAN_TOLAK" : "ATASAN_TOLAK", dariStatus: p.status, keStatus: "DITOLAK", catatan } });
    } else {
      await prisma.pengajuan.update({ where: { id: p.id }, data: { status: "DIKEMBALIKAN", catatanApprover: catatan } });
      await prisma.auditLog.create({ data: { pengajuanId: p.id, aktorId: user.id, aksi: "DIKEMBALIKAN", dariStatus: p.status, keStatus: "DIKEMBALIKAN", catatan } });
    }
  } else if (p.status === "MENUNGGU_HR") {
    if (!isHR) return { error: "Hanya HR yang dapat verifikasi akhir" };
    if (v.data.aksi === "setuju") {
      const tahun = p.tglMulai.getFullYear();
      if (p.jenis.kuota > 0) {
        let k = await prisma.kuota.findUnique({ where: { userId_jenisId_tahun: { userId: p.pemohonId, jenisId: p.jenisId, tahun } } });
        if (!k) k = await prisma.kuota.create({ data: { userId: p.pemohonId, jenisId: p.jenisId, tahun, jatah: p.jenis.kuota } });
        if (k.jatah - k.terpakai < p.jumlahHariKerja) return { error: "Sisa kuota tidak cukup" };
        await prisma.kuota.update({ where: { id: k.id }, data: { terpakai: k.terpakai + p.jumlahHariKerja } });
      }
      await prisma.pengajuan.update({ where: { id: p.id }, data: { status: "DISETUJUI", catatanApprover: catatan || null } });
      await prisma.auditLog.create({ data: { pengajuanId: p.id, aktorId: user.id, aksi: "HR_SETUJU", dariStatus: p.status, keStatus: "DISETUJUI", catatan: catatan || null } });
    } else if (v.data.aksi === "tolak") {
      await prisma.pengajuan.update({ where: { id: p.id }, data: { status: "DITOLAK", catatanApprover: catatan } });
      await prisma.auditLog.create({ data: { pengajuanId: p.id, aktorId: user.id, aksi: "HR_TOLAK", dariStatus: p.status, keStatus: "DITOLAK", catatan } });
    } else {
      await prisma.pengajuan.update({ where: { id: p.id }, data: { status: "DIKEMBALIKAN", catatanApprover: catatan } });
      await prisma.auditLog.create({ data: { pengajuanId: p.id, aktorId: user.id, aksi: "DIKEMBALIKAN", dariStatus: p.status, keStatus: "DIKEMBALIKAN", catatan } });
    }
  } else {
    return { error: "Pengajuan sudah final / tidak dapat diproses" };
  }
  const fresh = await prisma.pengajuan.findUnique({ where: { id: p.id } });
  if (fresh && ["DISETUJUI", "DITOLAK", "DIKEMBALIKAN"].includes(fresh.status)) {
    await notifyKeputusan(p.id, fresh.status, catatan);
  }
  redirect(`/cuti/${p.id}`);
}


export async function aksiBatal(fd: FormData): Promise<void> {
  const user = await aktor();
  const id = (fd.get("id") as string) || "";
  const p = await prisma.pengajuan.findUnique({ where: { id } });
  if (!p || p.pemohonId !== user.id) redirect("/");
  const now = new Date(); now.setHours(0, 0, 0, 0);
  if (fmtTgl(p.tglMulai) <= fmtTgl(now)) redirect(`/cuti/${id}`);
  if (!["MENUNGGU_ATASAN", "MENUNGGU_HR", "DIKEMBALIKAN"].includes(p.status)) redirect(`/cuti/${id}`);
  await prisma.pengajuan.update({ where: { id }, data: { status: "DIBATALKAN" } });
  await prisma.auditLog.create({ data: { pengajuanId: id, aktorId: user.id, aksi: "DIBATALKAN", dariStatus: p.status, keStatus: "DIBATALKAN" } });
  redirect("/");
}
