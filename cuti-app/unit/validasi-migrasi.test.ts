import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ajukanSchema, jenisSchema, laporanSchema, loginSchema, slipSchema } from "../src/lib/validasi";

// Kontrak input form sebelum migrasi Zod; harus tetap berlaku setelah upgrade.
describe("kontrak validasi form saat migrasi Zod", () => {
  it("login menerima email bertanda plus tanpa mengubahnya", () => {
    assert.equal(loginSchema.parse({ email: "nama+cuti@example.co.id", password: "rahasia" }).email,
      "nama+cuti@example.co.id");
  });

  it("email dengan titik berulang ditolak dengan pesan Indonesia", () => {
    const result = loginSchema.safeParse({ email: "nama..cuti@example.com", password: "rahasia" });
    assert.equal(result.success, false);
    assert.equal(result.error?.issues[0].message, "Email tidak valid");
  });

  it("password pendek mempertahankan pesan Indonesia", () => {
    const result = loginSchema.safeParse({ email: "nama@example.com", password: "12345" });
    assert.equal(result.success, false);
    assert.equal(result.error?.issues[0].message, "Password minimal 6 karakter");
  });

  it("panjang password tetap menghitung unit UTF-16 seperti kontrak lama", () => {
    assert.equal(loginSchema.parse({ email: "nama@example.com", password: "😀😀😀" }).password, "😀😀😀");
  });

  it("alasan cuti lima emoji memenuhi batas minimum sepuluh unit UTF-16", () => {
    assert.equal(ajukanSchema.parse({ jenisId: "j1", tglMulai: "2026-11-23", tglSelesai: "2026-11-24",
      alasan: "😀😀😀😀😀" }).alasan, "😀😀😀😀😀");
  });

  it("alasan cuti emoji yang melebihi seribu unit UTF-16 tetap ditolak", () => {
    const result = ajukanSchema.safeParse({ jenisId: "j1", tglMulai: "2026-11-23", tglSelesai: "2026-11-24",
      alasan: "😀".repeat(501) });
    assert.equal(result.success, false);
    assert.equal(result.error?.issues[0].message, "String must contain at most 1000 character(s)");
  });

  it("slip mengonversi nominal form dan memberi nol pada rincian yang absen", () => {
    assert.deepEqual(slipSchema.parse({ userId: "u1", tahun: "2026", bulan: "11", gajiPokok: "1250000" }), {
      userId: "u1", tahun: 2026, bulan: 11, gajiPokok: 1250000,
      tunjanganJabatan: 0, tunjanganTransport: 0, tunjanganMakan: 0,
      lembur: 0, bonus: 0, pph21: 0, bpjsKesehatan: 0, bpjsKetenagakerjaan: 0, potonganLain: 0,
    });
  });

  it("slip tetap menolak nominal pecahan", () => {
    assert.equal(slipSchema.safeParse({ userId: "u1", tahun: "2026", bulan: "11", gajiPokok: "1.5" }).success, false);
  });

  it("slip menolak nominal di luar integer aman JavaScript", () => {
    assert.equal(slipSchema.safeParse({ userId: "u1", tahun: "2026", bulan: "11", gajiPokok: "9007199254740992" }).success, false);
  });

  it("jenis cuti tanpa checkbox menjadi false", () => {
    const result = jenisSchema.parse({ nama: "Tahunan", kuota: "12", minHariSebelum: "3", butuhMasaKerjaBulan: "12" });
    assert.equal(result.memotongKuotaTahunan, false);
    assert.equal(result.lampiranWajib, false);
    assert.equal(result.aktif, false);
  });

  it("laporan menormalkan field opsional null dan kosong ke undefined", () => {
    const result = laporanSchema.parse({
      tglLaporan: "2026-11-12", lokasi: "Kebun A", judul: "Laporan harian", isi: "Kegiatan panen hari ini",
      jumlahTenagaKerja: "", lat: null, lng: "", approverId: null,
    });
    assert.equal(result.jumlahTenagaKerja, undefined);
    assert.equal(result.lat, undefined);
    assert.equal(result.lng, undefined);
    assert.equal(result.approverId, undefined);
  });

  it("login menolak koleksi saat form mengharapkan scalar", () => {
    assert.equal(loginSchema.safeParse({ email: ["nama@example.com"], password: "rahasia" }).success, false);
  });
});
