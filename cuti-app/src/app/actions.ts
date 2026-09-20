"use server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buatSesi, keluar as keluarSesi, userDariSesi, hashPassword } from "@/lib/auth";
import { ajukanSchema, loginSchema, putusanSchema, userSchema, jenisSchema } from "@/lib/validasi";
import { bulanMasaKerja, fmtTgl, hariKerja, parseTglInput } from "@/lib/cuti";
import { notifyHRMenungguHR, notifyKeputusan, notifyPengajuanBaru, notifApp } from "@/lib/notif";
import { approverEfektif, delegasiAktifUntuk } from "@/lib/cron";

async function aktor() {
  const u = await userDariSesi();
  if (!u) redirect("/login");
  return u;
}

export async function aksiLogin(_: unknown, fd: FormData) {
  const v = loginSchema.safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!v.success) return { error: v.error.issues[0].message };
  const { default: bcrypt } = await import("bcryptjs");
  const user = await prisma.user.findUnique({ where: { email: v.data.email.toLowerCase().trim() } });
  if (!user || !user.statusAktif) return { error: "Email atau password salah" };
  const ok = await bcrypt.compare(v.data.password, user.passwordHash);
  if (!ok) return { error: "Email atau password salah" };
  await buatSesi(user.id);
  redirect("/");
}

export async function aksiKeluar() {
  await keluarSesi();
}

const STATUS_AKTIF = ["MENUNGGU_ATASAN", "MENUNGGU_HR", "DISETUJUI"];

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
    const okType = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
    if (!okType.includes(f.type)) return { error: "Lampiran hanya PDF/JPG/PNG" };
    const ext = f.type === "application/pdf" ? "pdf" : f.type.includes("png") ? "png" : "jpg";
    const name = `lampiran/${user.id}-${Date.now()}.${ext}`;
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { put } = await import("@vercel/blob");
      const blob = await put(name, f, { access: "public" });
      lampiranPath = blob.url;
    } else if (process.env.NODE_ENV === "production") {
      return { error: "Upload lampiran belum dikonfigurasi (BLOB_READ_WRITE_TOKEN kosong)" };
    } else {
      const { writeFile, mkdir } = await import("fs/promises");
      const { default: path } = await import("path");
      const dir = path.join(process.cwd(), "public", "uploads");
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, name.split("/").pop()!), Buffer.from(await f.arrayBuffer()));
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

export async function aksiSimpanUser(_: unknown, fd: FormData) {
  const admin = await aktor();
  if (admin.role !== "HR_ADMIN") return { error: "Hanya HR" };
  const id = (fd.get("id") as string) || "";
  const v = userSchema.safeParse({
    nama: fd.get("nama"), email: fd.get("email"), password: fd.get("password"),
    jabatan: fd.get("jabatan"), noHp: fd.get("noHp"), tglMasuk: fd.get("tglMasuk"),
    role: fd.get("role"), atasanId: fd.get("atasanId"), statusAktif: fd.get("statusAktif"),
  });
  if (!v.success) return { error: v.error.issues[0].message };
  const email = v.data.email.toLowerCase().trim();
  const atasanId = v.data.atasanId ?? null;
  if (id && atasanId === id) return { error: "Atasan tidak boleh diri sendiri" };
  const data: Record<string, unknown> = {
    nama: v.data.nama.trim(), email, jabatan: v.data.jabatan ?? null, noHp: v.data.noHp ?? null,
    tglMasuk: parseTglInput(v.data.tglMasuk), role: v.data.role, atasanId,
    statusAktif: fd.get("statusAktif") === "on",
  };
  if (v.data.password) data.passwordHash = await hashPassword(v.data.password);
  try {
    if (id) await prisma.user.update({ where: { id }, data });
    else {
      if (!v.data.password) return { error: "Password wajib untuk akun baru" };
      await prisma.user.create({ data: { ...data, passwordHash: data.passwordHash as string } as Parameters<typeof prisma.user.create>[0]["data"] });
    }
  } catch {
    return { error: "Email sudah dipakai" };
  }
  redirect("/hr/karyawan");
}

export async function aksiSimpanJenis(_: unknown, fd: FormData) {
  const admin = await aktor();
  if (admin.role !== "HR_ADMIN") return { error: "Hanya HR" };
  const id = (fd.get("id") as string) || "";
  const v = jenisSchema.safeParse({
    nama: fd.get("nama"), kuota: fd.get("kuota"), memotongKuotaTahunan: fd.get("memotongKuotaTahunan"),
    lampiranWajib: fd.get("lampiranWajib"), lampiranWajibJikaLebihDari: fd.get("lampiranWajibJikaLebihDari"),
    minHariSebelum: fd.get("minHariSebelum"), butuhMasaKerjaBulan: fd.get("butuhMasaKerjaBulan"), aktif: fd.get("aktif"),
  });
  if (!v.success) return { error: v.error.issues[0].message };
  const data = {
    nama: v.data.nama.trim(), kuota: v.data.kuota,
    memotongKuotaTahunan: v.data.memotongKuotaTahunan,
    lampiranWajib: v.data.lampiranWajib,
    lampiranWajibJikaLebihDari: v.data.lampiranWajibJikaLebihDari ?? null,
    minHariSebelum: v.data.minHariSebelum, butuhMasaKerjaBulan: v.data.butuhMasaKerjaBulan,
    aktif: v.data.aktif,
  };
  try {
    if (id) await prisma.jenisCuti.update({ where: { id }, data });
    else await prisma.jenisCuti.create({ data });
  } catch {
    return { error: "Nama jenis cuti sudah ada" };
  }
  redirect("/hr/jenis");
}

export async function aksiTambahLibur(fd: FormData): Promise<void> {
  const admin = await aktor();
  if (admin.role !== "HR_ADMIN") redirect("/hr");
  const tgl = (fd.get("tanggal") as string) || "";
  const ket = ((fd.get("keterangan") as string) || "").trim();
  if (!tgl || !ket) redirect("/hr/libur");
  try {
    await prisma.hariLibur.create({ data: { tanggal: parseTglInput(tgl), keterangan: ket } });
  } catch {
    redirect("/hr/libur");
  }
  redirect("/hr/libur");
}

export async function aksiHapusLibur(fd: FormData) {
  const admin = await aktor();
  if (admin.role !== "HR_ADMIN") return;
  const id = (fd.get("id") as string) || "";
  await prisma.hariLibur.delete({ where: { id } });
  redirect("/hr/libur");
}

export async function aksiBacaNotif(fd: FormData): Promise<void> {
  const user = await aktor();
  const id = (fd.get("id") as string) || "";
  await prisma.notifikasi.updateMany({ where: { id, userId: user.id }, data: { dibaca: true } });
  redirect("/notifikasi");
}

export async function aksiBacaSemuaNotif(): Promise<void> {
  const user = await aktor();
  await prisma.notifikasi.updateMany({ where: { userId: user.id, dibaca: false }, data: { dibaca: true } });
  redirect("/notifikasi");
}

export async function aksiSimpanDelegasi(_: unknown, fd: FormData) {
  const user = await aktor();
  const keId = ((fd.get("keId") as string) || "").trim();
  const tglMulai = (fd.get("tglMulai") as string) || "";
  const tglSelesai = (fd.get("tglSelesai") as string) || "";
  if (!keId || !tglMulai || !tglSelesai) return { error: "Penerima dan rentang tanggal wajib" };
  if (keId === user.id) return { error: "Tidak bisa delegasi ke diri sendiri" };
  const target = await prisma.user.findUnique({ where: { id: keId } });
  if (!target || !target.statusAktif) return { error: "Penerima tidak valid" };
  if (tglSelesai < tglMulai) return { error: "Tanggal selesai sebelum mulai" };
  await prisma.delegasi.updateMany({ where: { dariId: user.id, aktif: true }, data: { aktif: false } });
  const d = await prisma.delegasi.create({
    data: { dariId: user.id, keId, tglMulai: parseTglInput(tglMulai), tglSelesai: parseTglInput(tglSelesai) },
  });
  await prisma.auditLog.create({ data: { aktorId: user.id, aksi: "DELEGASI_BUAT", catatan: `Delegasi ke ${target.nama} ${tglMulai}→${tglSelesai}` } });
  await notifApp(keId, "Anda ditunjuk sebagai delegasi", `${user.nama} menunjuk Anda menyetujui cuti ${tglMulai}→${tglSelesai}.`, undefined, "DELEGASI");
  redirect("/delegasi");
}

export async function aksiBatalDelegasi(fd: FormData): Promise<void> {
  const user = await aktor();
  const id = (fd.get("id") as string) || "";
  await prisma.delegasi.updateMany({ where: { id, dariId: user.id }, data: { aktif: false } });
  await prisma.auditLog.create({ data: { aktorId: user.id, aksi: "DELEGASI_BATAL", catatan: id } });
  redirect("/delegasi");
}

export async function aksiUbahPassword(_: unknown, fd: FormData) {
  const user = await aktor();
  const lama = ((fd.get("lama") as string) || "");
  const baru = ((fd.get("baru") as string) || "");
  if (baru.length < 6) return { error: "Password baru minimal 6 karakter" };
  const { default: bcrypt } = await import("bcryptjs");
  const db = await prisma.user.findUnique({ where: { id: user.id } });
  if (!db) return { error: "Akun tidak ditemukan" };
  const ok = await bcrypt.compare(lama, db.passwordHash);
  if (!ok) return { error: "Password lama salah" };
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(baru) } });
  redirect("/profil?ok=1");
}
