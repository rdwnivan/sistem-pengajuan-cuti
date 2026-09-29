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
  nip: z.string().regex(/^[0-9]{6,20}$/, "NIP wajib 6-20 digit angka"),
  password: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().min(6).optional()),
  jabatan: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().optional()),
  noHp: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().optional()),
  tglMasuk: z.string().min(1),
  role: z.enum(["KARYAWAN", "HR_ADMIN"]),
  atasanId: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().optional()),
  gajiPokok: z.preprocess((v) => (v === "" || v == null ? 0 : v), z.coerce.number().int().min(0).max(999999999)),
  tunjanganTetap: z.preprocess((v) => (v === "" || v == null ? 0 : v), z.coerce.number().int().min(0).max(999999999)),
});

export const slipSchema = z.object({
  userId: z.string().min(1, "Karyawan wajib dipilih"),
  tahun: z.coerce.number().int().min(2020).max(2099),
  bulan: z.coerce.number().int().min(1).max(12),
  gajiPokok: z.coerce.number().int().min(0),
  tunjanganJabatan: z.coerce.number().int().min(0).default(0),
  tunjanganTransport: z.coerce.number().int().min(0).default(0),
  tunjanganMakan: z.coerce.number().int().min(0).default(0),
  lembur: z.coerce.number().int().min(0).default(0),
  bonus: z.coerce.number().int().min(0).default(0),
  pph21: z.coerce.number().int().min(0).default(0),
  bpjsKesehatan: z.coerce.number().int().min(0).default(0),
  bpjsKetenagakerjaan: z.coerce.number().int().min(0).default(0),
  potonganLain: z.coerce.number().int().min(0).default(0),
  catatan: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().max(500).optional()),
});

export const laporanSchema = z.object({
  tglLaporan: z.string().min(1, "Tanggal laporan wajib diisi"),
  lokasi: z.string().min(2, "Lokasi minimal 2 karakter").max(200),
  blok: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().max(100).optional()),
  kegiatan: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().max(200).optional()),
  jumlahTenagaKerja: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().int().min(0).max(10000).optional()),
  hasil: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().max(500).optional()),
  cuaca: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().max(100).optional()),
  lat: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().min(-90).max(90).optional()),
  lng: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().min(-180).max(180).optional()),
  shift: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().max(100).optional()),
  judul: z.string().min(3, "Judul minimal 3 karakter").max(200),
  isi: z.string().min(10, "Isi minimal 10 karakter").max(5000),
  approverId: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().optional()),
});

export const putusanLaporanSchema = z.object({
  laporanId: z.string().min(1),
  aksi: z.enum(["setuju", "tolak", "kembalikan"]),
  catatan: z.preprocess((v) => (v == null ? undefined : v), z.string().max(1000).optional()),
});

export const gajiPerubahanSchema = z.object({
  userId: z.string().min(1, "Karyawan wajib dipilih"),
  gajiPokokBaru: z.coerce.number().int().min(0).max(999999999),
  tunjanganTetapBaru: z.coerce.number().int().min(0).max(999999999),
  alasan: z.string().min(10, "Alasan perubahan minimal 10 karakter").max(500),
});

export const putusanGajiSchema = z.object({
  gajiPerubahanId: z.string().min(1),
  aksi: z.enum(["setuju", "tolak", "kembalikan"]),
  catatan: z.preprocess((v) => (v == null ? undefined : v), z.string().max(500).optional()),
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
