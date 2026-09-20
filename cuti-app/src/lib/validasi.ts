import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
});

export const ajukanSchema = z.object({
  jenisId: z.string().min(1, "Jenis cuti wajib dipilih"),
  tglMulai: z.string().min(1, "Tanggal mulai wajib diisi"),
  tglSelesai: z.string().min(1, "Tanggal selesai wajib diisi"),
  alasan: z.string().min(10, "Alasan minimal 10 karakter").max(1000),
  picPengganti: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().max(100).optional()),
  kontakSelamaCuti: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().max(30).optional()),
});

export const putusanSchema = z.object({
  pengajuanId: z.string().min(1),
  aksi: z.enum(["setuju", "tolak", "kembalikan"]),
  catatan: z.preprocess((v) => (v == null ? undefined : v), z.string().max(1000).optional()),
});

export const userSchema = z.object({
  nama: z.string().min(3, "Nama minimal 3 karakter"),
  email: z.string().email("Email tidak valid"),
  password: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().min(6).optional()),
  jabatan: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().optional()),
  noHp: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().optional()),
  tglMasuk: z.string().min(1),
  role: z.enum(["KARYAWAN", "HR_ADMIN"]),
  atasanId: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().optional()),
});

export const jenisSchema = z.object({
  nama: z.string().min(3),
  kuota: z.coerce.number().int().min(0).max(365),
  memotongKuotaTahunan: z.preprocess((v) => v === "on", z.boolean()),
  lampiranWajib: z.preprocess((v) => v === "on", z.boolean()),
  lampiranWajibJikaLebihDari: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().int().min(0).optional()),
  minHariSebelum: z.coerce.number().int().min(0).max(90),
  butuhMasaKerjaBulan: z.coerce.number().int().min(0).max(120),
  aktif: z.preprocess((v) => v === "on", z.boolean()),
});
