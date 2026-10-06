"use server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAtasan } from "@/lib/auth";
import { laporanSchema, putusanLaporanSchema } from "@/lib/validasi";
import { notifApp } from "@/lib/notif";
import { kirimWebPush } from "@/lib/web-push";
import { aktor, unggahFoto, unggahBanyakFoto } from "./shared";


export async function aksiBuatLaporan(_: unknown, fd: FormData) {
  const user = await aktor();
  if (user.role === "HR_ADMIN" || (await isAtasan(user.id))) return { error: "Hanya karyawan (bukan atasan/HR) yang bisa membuat laporan" };
  const v = laporanSchema.safeParse({
    tglLaporan: fd.get("tglLaporan"), lokasi: fd.get("lokasi"), blok: fd.get("blok"),
    kegiatan: fd.get("kegiatan"), jumlahTenagaKerja: fd.get("jumlahTenagaKerja"),
    hasil: fd.get("hasil"), cuaca: fd.get("cuaca"), lat: fd.get("lat"), lng: fd.get("lng"),
    shift: fd.get("shift"), judul: fd.get("judul"),
    isi: fd.get("isi"), approverId: fd.get("approverId"),
  });
  if (!v.success) return { error: v.error.issues[0].message };
  const approverId = v.data.approverId || null;
  if (approverId) {
    const a = await prisma.user.findUnique({ where: { id: approverId } });
    if (!a || !a.statusAktif) return { error: "Approver tidak valid" };
    if (a.role === "HR_ADMIN") return { error: "Laporan lapangan tidak dapat di-approve HR" };
    if (!(await isAtasan(approverId))) return { error: "Approver laporan wajib atasan" };
  }
  const lampiranResult = await unggahFoto(fd, "laporan");
  if (lampiranResult && lampiranResult.startsWith("__GAGAL__:")) return { error: lampiranResult.slice(10) };
  const fotosResult = await unggahBanyakFoto(fd, "laporan-foto");
  if (!Array.isArray(fotosResult)) return { error: fotosResult.gagal };
  const l = await prisma.laporanLapangan.create({
    data: {
      pembuatId: user.id, approverId, tglLaporan: new Date(v.data.tglLaporan + "T12:00:00"),
      lokasi: v.data.lokasi, blok: v.data.blok ?? null, kegiatan: v.data.kegiatan ?? null,
      jumlahTenagaKerja: v.data.jumlahTenagaKerja ?? null, hasil: v.data.hasil ?? null,
      cuaca: v.data.cuaca ?? null, lat: v.data.lat ?? null, lng: v.data.lng ?? null,
      shift: v.data.shift ?? null, judul: v.data.judul,
      isi: v.data.isi, lampiranPath: lampiranResult ?? null, status: "DRAFT",
      fotos: { create: fotosResult.map((f) => ({ path: f.path, keterangan: f.keterangan })) },
    },
  });
  redirect(`/laporan/${l.id}`);
}

export async function aksiKirimLaporan(fd: FormData): Promise<void> {
  const user = await aktor();
  const id = (fd.get("id") as string) || "";
  const l = await prisma.laporanLapangan.findUnique({ where: { id } });
  if (!l || l.pembuatId !== user.id) throw new Error("Laporan tidak ditemukan");
  if (l.status !== "DRAFT") throw new Error("Hanya draf yang bisa dikirim");
  if (!l.approverId) throw new Error("Approver wajib dipilih");
  await prisma.laporanLapangan.update({ where: { id }, data: { status: "MENUNGGU" } });
  await prisma.auditLog.create({ data: { laporanId: id, aktorId: user.id, aksi: "DIKIRIM", keStatus: "MENUNGGU" } });
  await notifApp(l.approverId!, "Laporan lapangan menunggu Anda", `${user.nama} mengirim laporan "${l.judul}" untuk di-acc.`, id, "APP", "LAPORAN");
  await kirimWebPush(l.approverId!, "Laporan lapangan menunggu Anda", `${user.nama} mengirim laporan "${l.judul}" untuk di-acc.`);
  redirect(`/laporan/${id}`);
}

export async function aksiPutusanLaporan(_: unknown, fd: FormData) {
  const user = await aktor();
  const v = putusanLaporanSchema.safeParse({ laporanId: fd.get("laporanId"), aksi: fd.get("aksi"), catatan: fd.get("catatan") });
  if (!v.success) return { error: v.error.issues[0].message };
  const l = await prisma.laporanLapangan.findUnique({ where: { id: v.data.laporanId }, include: { pembuat: true } });
  if (!l) return { error: "Laporan tidak ditemukan" };
  if (l.approverId !== user.id) return { error: "Anda bukan approver laporan ini" };
  if (l.status !== "MENUNGGU") return { error: "Laporan tidak dalam status menunggu" };
  const catatan = (v.data.catatan || "").trim();
  if ((v.data.aksi === "tolak" || v.data.aksi === "kembalikan") && !catatan) return { error: "Catatan wajib diisi" };
  let statusBaru = "";
  let aksiLog = "";
  if (v.data.aksi === "setuju") { statusBaru = "DISETUJUI"; aksiLog = "DISETUJUI"; }
  else if (v.data.aksi === "tolak") { statusBaru = "DITOLAK"; aksiLog = "DITOLAK"; }
  else { statusBaru = "DIKEMBALIKAN"; aksiLog = "DIKEMBALIKAN"; }
  await prisma.laporanLapangan.update({ where: { id: l.id }, data: { status: statusBaru, catatanApprover: catatan || null } });
  await prisma.auditLog.create({ data: { laporanId: l.id, aktorId: user.id, aksi: aksiLog, dariStatus: l.status, keStatus: statusBaru, catatan: catatan || null } });
  await notifApp(l.pembuatId, `Laporan Anda: ${statusBaru}`, `Laporan "${l.judul}" berstatus ${statusBaru}.${catatan ? " Catatan: " + catatan : ""}`, l.id, "APP", "LAPORAN");
  await kirimWebPush(l.pembuatId, `Laporan Anda: ${statusBaru}`, `Laporan "${l.judul}" berstatus ${statusBaru}.${catatan ? " Catatan: " + catatan : ""}`);
  redirect(`/laporan/${l.id}`);
}

export async function aksiRevisiLaporan(_: unknown, fd: FormData) {
  const user = await aktor();
  if (user.role === "HR_ADMIN" || (await isAtasan(user.id))) return { error: "Hanya karyawan (bukan atasan/HR) yang bisa merevisi laporan" };
  const id = (fd.get("id") as string) || "";
  const l = await prisma.laporanLapangan.findUnique({ where: { id } });
  if (!l || l.pembuatId !== user.id) return { error: "Laporan tidak ditemukan" };
  const dariDraf = l.status === "DRAFT";
  if (!dariDraf && !["DITOLAK", "DIKEMBALIKAN"].includes(l.status))
    return { error: "Hanya laporan draf/ditolak/dikembalikan yang bisa direvisi" };
  const v = laporanSchema.safeParse({
    tglLaporan: fd.get("tglLaporan"), lokasi: fd.get("lokasi"), blok: fd.get("blok"),
    kegiatan: fd.get("kegiatan"), jumlahTenagaKerja: fd.get("jumlahTenagaKerja"),
    hasil: fd.get("hasil"), cuaca: fd.get("cuaca"), lat: fd.get("lat"), lng: fd.get("lng"),
    shift: fd.get("shift"), judul: fd.get("judul"),
    isi: fd.get("isi"), approverId: fd.get("approverId"),
  });
  if (!v.success) return { error: v.error.issues[0].message };
  const approverId = v.data.approverId || null;
  if (!approverId) return { error: "Approver wajib dipilih" };
  const a = await prisma.user.findUnique({ where: { id: approverId } });
  if (!a || !a.statusAktif) return { error: "Approver tidak valid" };
  if (a.role === "HR_ADMIN") return { error: "Laporan lapangan tidak dapat di-approve HR" };
  if (!(await isAtasan(approverId))) return { error: "Approver laporan wajib atasan" };
  const lampiranResult = await unggahFoto(fd, "laporan");
  if (lampiranResult && lampiranResult.startsWith("__GAGAL__:")) return { error: lampiranResult.slice(10) };
  const fotosResult = await unggahBanyakFoto(fd, "laporan-foto");
  if (!Array.isArray(fotosResult)) return { error: fotosResult.gagal };
  // Edit draf tetap DRAFT (belum dikirim). Revisi setelah ditolak/dikembalikan langsung MENUNGGU.
  const statusBaru = dariDraf ? "DRAFT" : "MENUNGGU";
  await prisma.laporanLapangan.update({
    where: { id }, data: {
      tglLaporan: new Date(v.data.tglLaporan + "T12:00:00"), lokasi: v.data.lokasi,
      blok: v.data.blok ?? null, kegiatan: v.data.kegiatan ?? null,
      jumlahTenagaKerja: v.data.jumlahTenagaKerja ?? null, hasil: v.data.hasil ?? null,
      cuaca: v.data.cuaca ?? null, lat: v.data.lat ?? null, lng: v.data.lng ?? null,
      shift: v.data.shift ?? null,
      judul: v.data.judul, isi: v.data.isi, approverId, lampiranPath: lampiranResult ?? l.lampiranPath,
      status: statusBaru, catatanApprover: null,
    },
  });
  if (fotosResult.length > 0) {
    await prisma.laporanFoto.createMany({
      data: fotosResult.map((f) => ({ laporanId: id, path: f.path, keterangan: f.keterangan })),
    });
  }
  await prisma.auditLog.create({ data: { laporanId: id, aktorId: user.id, aksi: dariDraf ? "DIEDIT" : "DIREVISI", dariStatus: l.status, keStatus: statusBaru } });
  if (!dariDraf) {
    const pesan = `${user.nama} telah merevisi laporan "${v.data.judul}" dan mengirim ulang untuk di-acc.`;
    await notifApp(approverId, "Laporan lapangan direvisi", pesan, id, "APP", "LAPORAN");
    await kirimWebPush(approverId, "Laporan lapangan direvisi", pesan);
  }
  redirect(`/laporan/${id}`);
}

export async function aksiBatalLaporan(fd: FormData) {
  const user = await aktor();
  const id = (fd.get("id") as string) || "";
  const l = await prisma.laporanLapangan.findUnique({ where: { id } });
  if (!l || l.pembuatId !== user.id) redirect("/laporan");
  if (!["DRAFT", "DITOLAK", "DIKEMBALIKAN"].includes(l.status)) redirect(`/laporan/${id}`);
  await prisma.laporanLapangan.update({ where: { id }, data: { status: "DIBATALKAN" } });
  await prisma.auditLog.create({ data: { laporanId: id, aktorId: user.id, aksi: "DIBATALKAN", keStatus: "DIBATALKAN" } });
  redirect("/laporan");
}
