import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ajukanSchema,
  gajiPerubahanSchema,
  jenisSchema,
  laporanSchema,
  loginSchema,
  putusanGajiSchema,
  putusanLaporanSchema,
  putusanSchema,
  slipSchema,
  userSchema,
} from "../src/lib/validasi";

describe("loginSchema", () => {
  it("kredensial valid lolos", () => {
    assert.ok(loginSchema.safeParse({ email: "hr@anime.id", password: "anime123" }).success);
  });

  it("email tidak valid ditolak", () => {
    const r = loginSchema.safeParse({ email: "bukan-email", password: "anime123" });
    assert.ok(!r.success);
  });

  it("password < 6 karakter ditolak", () => {
    const r = loginSchema.safeParse({ email: "hr@anime.id", password: "12345" });
    assert.ok(!r.success);
  });
});

describe("ajukanSchema", () => {
  const valid = {
    jenisId: "abc",
    tglMulai: "2026-10-06",
    tglSelesai: "2026-10-07",
    alasan: "Acara keluarga di luar kota",
  };

  it("pengajuan valid lolos", () => {
    assert.ok(ajukanSchema.safeParse(valid).success);
  });

  it("alasan < 10 karakter ditolak", () => {
    assert.ok(!ajukanSchema.safeParse({ ...valid, alasan: "pendek" }).success);
  });

  it("jenisId kosong ditolak", () => {
    assert.ok(!ajukanSchema.safeParse({ ...valid, jenisId: "" }).success);
  });

  it("tanggal kosong ditolak", () => {
    assert.ok(!ajukanSchema.safeParse({ ...valid, tglMulai: "" }).success);
  });

  it("pic/kontak kosong dinormalkan ke undefined", () => {
    const r = ajukanSchema.safeParse({ ...valid, picPengganti: "", kontakSelamaCuti: "" });
    assert.ok(r.success);
    if (r.success) {
      assert.equal(r.data.picPengganti, undefined);
      assert.equal(r.data.kontakSelamaCuti, undefined);
    }
  });
});

describe("putusanSchema", () => {
  it("aksi valid lolos (catatan opsional di level schema)", () => {
    for (const aksi of ["setuju", "tolak", "kembalikan"]) {
      assert.ok(putusanSchema.safeParse({ pengajuanId: "x", aksi }).success, aksi);
    }
  });

  it("aksi di luar enum ditolak", () => {
    assert.ok(!putusanSchema.safeParse({ pengajuanId: "x", aksi: "batal" }).success);
  });

  it("pengajuanId kosong ditolak", () => {
    assert.ok(!putusanSchema.safeParse({ pengajuanId: "", aksi: "setuju" }).success);
  });
});

describe("userSchema", () => {
  const valid = {
    nama: "Karyawan Baru",
    email: "baru@anime.id",
    nip: "100010",
    password: "rahasia1",
    tglMasuk: "2026-01-10",
    role: "KARYAWAN",
  };

  it("user baru valid lolos", () => {
    assert.ok(userSchema.safeParse(valid).success);
  });

  it("NIP wajib digit 6-20", () => {
    assert.ok(!userSchema.safeParse({ ...valid, nip: "" }).success);
    assert.ok(!userSchema.safeParse({ ...valid, nip: "12345" }).success);
    assert.ok(!userSchema.safeParse({ ...valid, nip: "ABC123" }).success);
    assert.ok(userSchema.safeParse({ ...valid, nip: "123456" }).success);
  });

  it("nama < 3 karakter ditolak", () => {
    assert.ok(!userSchema.safeParse({ ...valid, nama: "Ab" }).success);
  });

  it("password kosong = edit tanpa ganti password (lolos)", () => {
    const r = userSchema.safeParse({ ...valid, password: "" });
    assert.ok(r.success);
    if (r.success) assert.equal(r.data.password, undefined);
  });

  it("password pendek ditolak", () => {
    assert.ok(!userSchema.safeParse({ ...valid, password: "123" }).success);
  });

  it("role di luar enum ditolak", () => {
    assert.ok(!userSchema.safeParse({ ...valid, role: "ATASAN" }).success);
  });
});

describe("slipSchema", () => {
  const valid = { userId: "u1", tahun: 2026, bulan: 9, gajiPokok: 5000000 };

  it("slip valid lolos dengan default rincian 0", () => {
    const r = slipSchema.safeParse(valid);
    assert.ok(r.success);
    if (r.success) {
      assert.equal(r.data.tunjanganJabatan, 0);
      assert.equal(r.data.tunjanganTransport, 0);
      assert.equal(r.data.tunjanganMakan, 0);
      assert.equal(r.data.lembur, 0);
      assert.equal(r.data.bonus, 0);
      assert.equal(r.data.pph21, 0);
      assert.equal(r.data.bpjsKesehatan, 0);
      assert.equal(r.data.bpjsKetenagakerjaan, 0);
      assert.equal(r.data.potonganLain, 0);
    }
  });

  it("rincian terisi lolos dan terbaca", () => {
    const r = slipSchema.safeParse({ ...valid, tunjanganJabatan: 500000, lembur: 200000, pph21: 100000 });
    assert.ok(r.success);
    if (r.success) {
      assert.equal(r.data.tunjanganJabatan, 500000);
      assert.equal(r.data.lembur, 200000);
      assert.equal(r.data.pph21, 100000);
    }
  });

  it("bulan di luar 1–12 ditolak", () => {
    assert.ok(!slipSchema.safeParse({ ...valid, bulan: 13 }).success);
    assert.ok(!slipSchema.safeParse({ ...valid, bulan: 0 }).success);
  });

  it("gaji negatif ditolak", () => {
    assert.ok(!slipSchema.safeParse({ ...valid, gajiPokok: -1 }).success);
  });

  it("userId kosong ditolak", () => {
    assert.ok(!slipSchema.safeParse({ ...valid, userId: "" }).success);
  });
});

describe("laporanSchema", () => {
  const valid = {
    tglLaporan: "2026-09-29",
    lokasi: "Proyek Kalimantan",
    judul: "Laporan Mingguan",
    isi: "Pekerjaan lapangan berjalan baik, tidak ada kendala berarti.",
  };

  it("laporan valid lolos", () => {
    assert.ok(laporanSchema.safeParse(valid).success);
  });

  it("isi < 10 karakter ditolak", () => {
    assert.ok(!laporanSchema.safeParse({ ...valid, isi: "pendek" }).success);
  });

  it("judul < 3 karakter ditolak", () => {
    assert.ok(!laporanSchema.safeParse({ ...valid, judul: "AB" }).success);
  });

  it("approverId kosong dinormalkan ke undefined", () => {
    const r = laporanSchema.safeParse({ ...valid, approverId: "" });
    assert.ok(r.success);
    if (r.success) assert.equal(r.data.approverId, undefined);
  });

  it("field kebun opsional terbaca (blok/kegiatan/TK/hasil/cuaca/GPS)", () => {
    const r = laporanSchema.safeParse({
      ...valid, blok: "Blok A1", kegiatan: "Panen", jumlahTenagaKerja: "12",
      hasil: "2,5 ton TBS", cuaca: "Cerah", lat: "-2.21", lng: "113.91",
    });
    assert.ok(r.success);
    if (r.success) {
      assert.equal(r.data.blok, "Blok A1");
      assert.equal(r.data.kegiatan, "Panen");
      assert.equal(r.data.jumlahTenagaKerja, 12);
      assert.equal(r.data.hasil, "2,5 ton TBS");
      assert.equal(r.data.cuaca, "Cerah");
      assert.equal(r.data.lat, -2.21);
      assert.equal(r.data.lng, 113.91);
    }
  });

  it("kosong = undefined untuk field kebun", () => {
    const r = laporanSchema.safeParse({ ...valid, blok: "", jumlahTenagaKerja: "", lat: "", lng: "" });
    assert.ok(r.success);
    if (r.success) {
      assert.equal(r.data.blok, undefined);
      assert.equal(r.data.jumlahTenagaKerja, undefined);
      assert.equal(r.data.lat, undefined);
    }
  });

  it("lat/lng di luar rentang ditolak", () => {
    assert.ok(!laporanSchema.safeParse({ ...valid, lat: "200" }).success);
    assert.ok(!laporanSchema.safeParse({ ...valid, lng: "-200" }).success);
  });
});

describe("putusanLaporanSchema / putusanGajiSchema", () => {
  it("aksi enum valid lolos", () => {
    assert.ok(putusanLaporanSchema.safeParse({ laporanId: "l1", aksi: "setuju" }).success);
    assert.ok(putusanGajiSchema.safeParse({ gajiPerubahanId: "g1", aksi: "tolak", catatan: "belum waktunya" }).success);
  });

  it("aksi invalid ditolak", () => {
    assert.ok(!putusanLaporanSchema.safeParse({ laporanId: "l1", aksi: "batal" }).success);
    assert.ok(!putusanGajiSchema.safeParse({ gajiPerubahanId: "g1", aksi: "batal" }).success);
  });
});

describe("gajiPerubahanSchema", () => {
  const valid = { userId: "u1", gajiPokokBaru: 6000000, tunjanganTetapBaru: 500000, alasan: "Penyesuaian UMK tahun berjalan" };

  it("usulan valid lolos", () => {
    assert.ok(gajiPerubahanSchema.safeParse(valid).success);
  });

  it("alasan < 10 karakter ditolak", () => {
    assert.ok(!gajiPerubahanSchema.safeParse({ ...valid, alasan: "naik gaji" }).success);
  });

  it("gaji negatif ditolak", () => {
    assert.ok(!gajiPerubahanSchema.safeParse({ ...valid, gajiPokokBaru: -100 }).success);
  });
});

describe("jenisSchema", () => {
  const base = { nama: "Tahunan", kuota: 12, minHariSebelum: 3, butuhMasaKerjaBulan: 12 };

  it('checkbox "on" jadi true', () => {
    const r = jenisSchema.safeParse({ ...base, memotongKuotaTahunan: "on", lampiranWajib: "on", aktif: "on" });
    assert.ok(r.success);
    if (r.success) {
      assert.equal(r.data.memotongKuotaTahunan, true);
      assert.equal(r.data.lampiranWajib, true);
      assert.equal(r.data.aktif, true);
    }
  });

  it("checkbox tidak dicentang jadi false", () => {
    const r = jenisSchema.safeParse({ ...base, memotongKuotaTahunan: undefined, lampiranWajib: undefined, aktif: undefined });
    assert.ok(r.success);
    if (r.success) {
      assert.equal(r.data.memotongKuotaTahunan, false);
      assert.equal(r.data.aktif, false);
    }
  });

  it("kuota negatif ditolak", () => {
    assert.ok(!jenisSchema.safeParse({ ...base, kuota: -1, memotongKuotaTahunan: "on", aktif: "on" }).success);
  });
});
