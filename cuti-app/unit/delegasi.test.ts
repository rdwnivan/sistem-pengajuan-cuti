import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { delegasiBerlaku } from "../src/lib/cron";

const HARI = 86400000;
const ref = new Date("2026-09-15T12:00:00Z");
const d = (offsetMs: number) => new Date(ref.getTime() + offsetMs);

function buat(mulai: Date, selesai: Date, aktif = true) {
  return { aktif, tglMulai: mulai, tglSelesai: selesai };
}

describe("delegasiBerlaku — logika date-range delegasi", () => {
  it("dalam rentang -> berlaku", () => {
    assert.equal(delegasiBerlaku(buat(d(-HARI), d(HARI)), ref), true);
  });

  it("tepat di tglMulai -> berlaku (batas inklusif, lte)", () => {
    assert.equal(delegasiBerlaku(buat(ref, d(HARI)), ref), true);
  });

  it("tepat di tglSelesai -> berlaku (batas inklusif, gte)", () => {
    assert.equal(delegasiBerlaku(buat(d(-HARI), ref), ref), true);
  });

  it("sehari sebelum tglMulai -> tidak berlaku", () => {
    assert.equal(delegasiBerlaku(buat(d(HARI), d(2 * HARI)), ref), false);
  });

  it("sehari setelah tglSelesai -> tidak berlaku", () => {
    assert.equal(delegasiBerlaku(buat(d(-2 * HARI), d(-HARI)), ref), false);
  });

  it("aktif=false dalam rentang -> tidak berlaku", () => {
    assert.equal(delegasiBerlaku(buat(d(-HARI), d(HARI), false), ref), false);
  });

  it("ref default = sekarang", () => {
    const sekarang = new Date();
    const mulai = new Date(sekarang.getTime() - 30 * HARI);
    const selesai = new Date(sekarang.getTime() + 30 * HARI);
    assert.equal(delegasiBerlaku(buat(mulai, selesai)), true);
  });

  it("rentang satu hari (mulai == selesai == ref) -> berlaku", () => {
    assert.equal(delegasiBerlaku(buat(ref, ref), ref), true);
  });
});
