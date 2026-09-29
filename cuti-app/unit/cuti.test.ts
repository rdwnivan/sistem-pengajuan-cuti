import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { bulanMasaKerja, fmtTgl, hariKerja, parseTglInput } from "../src/lib/cuti";

const D = (y: number, m: number, d: number) => new Date(y, m - 1, d);

describe("fmtTgl", () => {
  it("format YYYY-MM-DD dengan padding nol", () => {
    assert.equal(fmtTgl(D(2026, 1, 5)), "2026-01-05");
    assert.equal(fmtTgl(D(2026, 12, 25)), "2026-12-25");
  });
});

describe("parseTglInput", () => {
  it("parse string YYYY-MM-DD ke tanggal lokal yang benar", () => {
    const d = parseTglInput("2026-10-05");
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 9);
    assert.equal(d.getDate(), 5);
  });
});

describe("hariKerja", () => {
  it("Senin–Jumat tanpa libur = 5", () => {
    assert.equal(hariKerja(D(2026, 10, 5), D(2026, 10, 9), new Set()), 5);
  });

  it("Sabtu saja = 0, Minggu saja = 0", () => {
    assert.equal(hariKerja(D(2026, 10, 10), D(2026, 10, 10), new Set()), 0);
    assert.equal(hariKerja(D(2026, 10, 11), D(2026, 10, 11), new Set()), 0);
  });

  it("rentang sepekan Senin–Minggu = 5 (akhir pekan diskip)", () => {
    assert.equal(hariKerja(D(2026, 10, 5), D(2026, 10, 11), new Set()), 5);
  });

  it("hari libur nasional mengurangi hitungan", () => {
    assert.equal(hariKerja(D(2026, 10, 5), D(2026, 10, 9), new Set(["2026-10-07"])), 4);
  });

  it("libur yang jatuh di akhir pekan tidak berpengaruh ganda", () => {
    assert.equal(hariKerja(D(2026, 10, 5), D(2026, 10, 11), new Set(["2026-10-10"])), 5);
  });

  it("satu hari kerja = 1", () => {
    assert.equal(hariKerja(D(2026, 10, 5), D(2026, 10, 5), new Set()), 1);
  });

  it("mulai setelah selesai = 0", () => {
    assert.equal(hariKerja(D(2026, 10, 9), D(2026, 10, 5), new Set()), 0);
  });

  it("tanggal merah seed (25 Des 2026, Jumat) dikecualikan", () => {
    // 24 Des = Kamis, 25 Des = Jumat (libur), 26 Des = Sabtu → 1 hari kerja
    assert.equal(hariKerja(D(2026, 12, 24), D(2026, 12, 26), new Set(["2026-12-25"])), 1);
    // tanpa libur pun Sabtu tidak dihitung → tetap 1; yang penting Jumat libur tidak dihitung
    assert.equal(hariKerja(D(2026, 12, 24), D(2026, 12, 25), new Set(["2026-12-25"])), 1);
  });
});

describe("bulanMasaKerja", () => {
  it("bulan yang sama = 0", () => {
    assert.equal(bulanMasaKerja(D(2026, 9, 1), D(2026, 9, 29)), 0);
  });

  it("hitungan selisih bulan kalender", () => {
    assert.equal(bulanMasaKerja(D(2022, 1, 10), D(2026, 9, 29)), 56);
    assert.equal(bulanMasaKerja(D(2025, 6, 1), D(2026, 9, 29)), 15);
  });

  it("syarat 12 bulan: karyawan lama lolos, karyawan baru tidak", () => {
    assert.ok(bulanMasaKerja(D(2022, 1, 10), D(2026, 9, 29)) >= 12);
    assert.ok(bulanMasaKerja(D(2026, 6, 1), D(2026, 9, 29)) < 12);
  });
});
