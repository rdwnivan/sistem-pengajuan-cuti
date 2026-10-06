import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sesiKedaluwarsa } from "../src/lib/auth";

const JAM = 3600000;
const ref = new Date("2026-10-07T12:00:00Z");
const s = (offsetMs: number) => ({ expiresAt: new Date(ref.getTime() + offsetMs) });

describe("sesiKedaluwarsa — satu sumber kebenaran masa berlaku sesi", () => {
  it("belum lewat -> masih valid", () => {
    assert.equal(sesiKedaluwarsa(s(JAM), ref), false);
  });

  it("sudah lewat -> kedaluwarsa", () => {
    assert.equal(sesiKedaluwarsa(s(-JAM), ref), true);
  });

  it("tepat di expiresAt -> MASIH valid (kedaluwarsa hanya bila expiresAt < now, sama seperti kode lama)", () => {
    assert.equal(sesiKedaluwarsa(s(0), ref), false);
  });

  it("1 ms sebelum expiresAt -> masih valid", () => {
    assert.equal(sesiKedaluwarsa(s(1), ref), false);
  });

  it("1 ms sesudah expiresAt -> kedaluwarsa", () => {
    assert.equal(sesiKedaluwarsa(s(-1), ref), true);
  });

  it("default sekarang: sesi 7 hari (masa berlaku app) masih valid", () => {
    const tujuhHari = new Date(Date.now() + 7 * 24 * JAM);
    assert.equal(sesiKedaluwarsa({ expiresAt: tujuhHari }), false);
  });

  it("default sekarang: sesi kemarin sudah kedaluwarsa", () => {
    const kemarin = new Date(Date.now() - 24 * JAM);
    assert.equal(sesiKedaluwarsa({ expiresAt: kemarin }), true);
  });
});
