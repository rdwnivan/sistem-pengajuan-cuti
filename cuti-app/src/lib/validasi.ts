import { z } from "zod";

// Zod >=4.6 menghitung code point; pertahankan kontrak UTF-16 Zod 3 dan
// atribut minLength/maxLength HTML, termasuk password yang sudah digunakan.
function teks(min = 0, max?: number, pesanMin?: string) {
  return z.string().superRefine((value, ctx) => {
    if (value.length < min) {
      ctx.addIssue({ code: "too_small", origin: "string", minimum: min, inclusive: true,
        message: pesanMin ?? `String must contain at least ${min} character(s)` });
    }
    if (max !== undefined && value.length > max) {
      ctx.addIssue({ code: "too_big", origin: "string", maximum: max, inclusive: true,
        message: `String must contain at most ${max} character(s)` });
    }
  });
}

export const loginSchema = z.object({
  email: z.string().email("Email tidak valid"),
  password: teks(6, undefined, "Password minimal 6 karakter"),
});

export const ajukanSchema = z.object({
  jenisId: teks(1, undefined, "Jenis cuti wajib dipilih"),
  tglMulai: teks(1, undefined, "Tanggal mulai wajib diisi"),
  tglSelesai: teks(1, undefined, "Tanggal selesai wajib diisi"),
  alasan: teks(10, 1000, "Alasan minimal 10 karakter"),
  picPengganti: z.preprocess((v) => (v === "" || v == null ? undefined : v), teks(0, 100).optional()),
  kontakSelamaCuti: z.preprocess((v) => (v === "" || v == null ? undefined : v), teks(0, 30).optional()),
});

/**
 * Nilai mentah form pengajuan cuti. Dikembalikan bersama `error` oleh `aksiAjukan`
 * supaya Form bisa memasangnya kembali sebagai `defaultValue` — React 19 mereset
 * form uncontrolled pada SETIAP submit action, termasuk saat action mengembalikan
 * error, sehingga tanpa ini isian user hilang dan submit terasa "gagal".
 */
export type NilaiAjukan = {
  jenisId: string;
  tglMulai: string;
  tglSelesai: string;
  alasan: string;
  picPengganti: string;
  kontakSelamaCuti: string;
};

export const putusanSchema = z.object({
  pengajuanId: teks(1),
  aksi: z.enum(["setuju", "tolak", "kembalikan"]),
  catatan: z.preprocess((v) => (v == null ? undefined : v), teks(0, 1000).optional()),
});

export const userSchema = z.object({
  nama: teks(3, undefined, "Nama minimal 3 karakter"),
  email: z.string().email("Email tidak valid"),
  nip: z.string().regex(/^[0-9]{6,20}$/, "NIP wajib 6-20 digit angka"),
  password: z.preprocess((v) => (v === "" || v == null ? undefined : v), teks(6).optional()),
  jabatan: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().optional()),
  noHp: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().optional()),
  tglMasuk: teks(1),
  role: z.enum(["KARYAWAN", "HR_ADMIN"]),
  atasanId: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().optional()),
  gajiPokok: z.preprocess((v) => (v === "" || v == null ? 0 : v), z.coerce.number().int().min(0).max(999999999)),
  tunjanganTetap: z.preprocess((v) => (v === "" || v == null ? 0 : v), z.coerce.number().int().min(0).max(999999999)),
});

export const slipSchema = z.object({
  userId: teks(1, undefined, "Karyawan wajib dipilih"),
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
  catatan: z.preprocess((v) => (v === "" || v == null ? undefined : v), teks(0, 500).optional()),
});

export const laporanSchema = z.object({
  tglLaporan: teks(1, undefined, "Tanggal laporan wajib diisi"),
  lokasi: teks(2, 200, "Lokasi minimal 2 karakter"),
  blok: z.preprocess((v) => (v === "" || v == null ? undefined : v), teks(0, 100).optional()),
  kegiatan: z.preprocess((v) => (v === "" || v == null ? undefined : v), teks(0, 200).optional()),
  jumlahTenagaKerja: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().int().min(0).max(10000).optional()),
  hasil: z.preprocess((v) => (v === "" || v == null ? undefined : v), teks(0, 500).optional()),
  cuaca: z.preprocess((v) => (v === "" || v == null ? undefined : v), teks(0, 100).optional()),
  lat: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().min(-90).max(90).optional()),
  lng: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().min(-180).max(180).optional()),
  shift: z.preprocess((v) => (v === "" || v == null ? undefined : v), teks(0, 100).optional()),
  judul: teks(3, 200, "Judul minimal 3 karakter"),
  isi: teks(10, 5000, "Isi minimal 10 karakter"),
  approverId: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().optional()),
});

export const putusanLaporanSchema = z.object({
  laporanId: teks(1),
  aksi: z.enum(["setuju", "tolak", "kembalikan"]),
  catatan: z.preprocess((v) => (v == null ? undefined : v), teks(0, 1000).optional()),
});

export const gajiPerubahanSchema = z.object({
  userId: teks(1, undefined, "Karyawan wajib dipilih"),
  gajiPokokBaru: z.coerce.number().int().min(0).max(999999999),
  tunjanganTetapBaru: z.coerce.number().int().min(0).max(999999999),
  alasan: teks(10, 500, "Alasan perubahan minimal 10 karakter"),
});

export const putusanGajiSchema = z.object({
  gajiPerubahanId: teks(1),
  aksi: z.enum(["setuju", "tolak", "kembalikan"]),
  catatan: z.preprocess((v) => (v == null ? undefined : v), teks(0, 500).optional()),
});

export const jenisSchema = z.object({
  nama: teks(3),
  kuota: z.coerce.number().int().min(0).max(365),
  memotongKuotaTahunan: z.preprocess((v) => v === "on", z.boolean()),
  lampiranWajib: z.preprocess((v) => v === "on", z.boolean()),
  lampiranWajibJikaLebihDari: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().int().min(0).optional()),
  minHariSebelum: z.coerce.number().int().min(0).max(90),
  butuhMasaKerjaBulan: z.coerce.number().int().min(0).max(120),
  aktif: z.preprocess((v) => v === "on", z.boolean()),
});
