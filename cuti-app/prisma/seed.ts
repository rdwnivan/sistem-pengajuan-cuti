import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.kuota.deleteMany();
  await prisma.pengajuan.deleteMany();
  await prisma.delegasi.deleteMany();
  await prisma.sesi.deleteMany();
  await prisma.hariLibur.deleteMany();
  await prisma.jenisCuti.deleteMany();
  await prisma.user.deleteMany();

  const hash = await bcrypt.hash("anime123", 10);
  const tglMasukLama = new Date("2022-01-10");
  const tglMasukBaru = new Date("2025-06-01");

  const pimpinan = await prisma.user.create({
    data: { nama: "Kepala Regional", email: "pimpinan@anime.id", passwordHash: hash, jabatan: "Kepala Regional", tglMasuk: tglMasukLama },
  });
  const hr = await prisma.user.create({
    data: { nama: "HR Anime", email: "hr@anime.id", passwordHash: hash, role: "HR_ADMIN", jabatan: "HR Admin", tglMasuk: tglMasukLama, atasanId: pimpinan.id },
  });
  const atasan1 = await prisma.user.create({
    data: { nama: "Atasan Satu", email: "atasan1@anime.id", passwordHash: hash, jabatan: "Manajer Operasional", atasanId: pimpinan.id, tglMasuk: tglMasukLama },
  });
  const atasan2 = await prisma.user.create({
    data: { nama: "Atasan Dua", email: "atasan2@anime.id", passwordHash: hash, jabatan: "Manajer Keuangan", atasanId: pimpinan.id, tglMasuk: tglMasukLama },
  });
  const kws: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const atasanId = i <= 3 ? atasan1.id : atasan2.id;
    const u = await prisma.user.create({
      data: {
        nama: `Karyawan ${i}`, email: `karyawan${i}@anime.id`, passwordHash: hash,
        jabatan: "Staff", atasanId, tglMasuk: i === 5 ? tglMasukBaru : tglMasukLama,
      },
    });
    kws.push(u.id);
  }

  const jenis = [
    { nama: "Tahunan", kuota: 12, memotongKuotaTahunan: true, lampiranWajib: false, minHariSebelum: 3, butuhMasaKerjaBulan: 12 },
    { nama: "Sakit", kuota: 0, memotongKuotaTahunan: false, lampiranWajib: false, lampiranWajibJikaLebihDari: 1, minHariSebelum: 0, butuhMasaKerjaBulan: 0 },
    { nama: "Melahirkan", kuota: 90, memotongKuotaTahunan: false, lampiranWajib: true, minHariSebelum: 7, butuhMasaKerjaBulan: 0 },
    { nama: "Menikah", kuota: 3, memotongKuotaTahunan: false, lampiranWajib: false, minHariSebelum: 3, butuhMasaKerjaBulan: 0 },
    { nama: "Duka", kuota: 2, memotongKuotaTahunan: false, lampiranWajib: false, minHariSebelum: 0, butuhMasaKerjaBulan: 0 },
    { nama: "Ibadah", kuota: 5, memotongKuotaTahunan: false, lampiranWajib: false, minHariSebelum: 7, butuhMasaKerjaBulan: 0 },
    { nama: "Besar", kuota: 30, memotongKuotaTahunan: false, lampiranWajib: false, minHariSebelum: 14, butuhMasaKerjaBulan: 60 },
    { nama: "Luar Tanggungan", kuota: 0, memotongKuotaTahunan: false, lampiranWajib: false, minHariSebelum: 3, butuhMasaKerjaBulan: 0 },
  ];
  for (const j of jenis) await prisma.jenisCuti.create({ data: j });

  await prisma.hariLibur.createMany({
    data: [
      { tanggal: new Date("2026-01-01"), keterangan: "Tahun Baru" },
      { tanggal: new Date("2026-05-01"), keterangan: "Hari Buruh" },
      { tanggal: new Date("2026-08-17"), keterangan: "Hari Kemerdekaan" },
      { tanggal: new Date("2026-12-25"), keterangan: "Natal" },
    ],
  });

  console.log("Seed OK. Login: hr@anime.id / pimpinan@anime.id / atasan1@anime.id / karyawan1@anime.id, password: anime123");
}

main().finally(() => prisma.$disconnect());
