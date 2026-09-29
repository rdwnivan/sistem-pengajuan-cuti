import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { catatGagal, cekRateLimit, reset } from "../src/lib/rate-limit";

describe("rate-limit login", () => {
  it("akun baru langsung OK (belum diblokir)", () => {
    const k = `fresh-${Date.now()}@t.id`;
    assert.deepEqual(cekRateLimit(k), { ok: true });
    reset(k);
  });

  it("4 gagal masih OK, gagal ke-5 memicu blokir", () => {
    const k = `brute-${Date.now()}@t.id`;
    for (let i = 0; i < 4; i++) {
      catatGagal(k);
      assert.equal(cekRateLimit(k).ok, true, `gagal ke-${i + 1}`);
    }
    catatGagal(k);
    const r = cekRateLimit(k);
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.cobaLagiDalam > 0 && r.cobaLagiDalam <= 900);
    reset(k);
  });

  it("reset membuka blokir (simulasi login sukses)", () => {
    const k = `reset-${Date.now()}@t.id`;
    for (let i = 0; i < 5; i++) catatGagal(k);
    assert.equal(cekRateLimit(k).ok, false);
    reset(k);
    assert.deepEqual(cekRateLimit(k), { ok: true });
  });

  it("kunci per akun: blokir satu akun tidak memblokir akun lain", () => {
    const a = `a-${Date.now()}@t.id`;
    const b = `b-${Date.now()}@t.id`;
    for (let i = 0; i < 5; i++) catatGagal(a);
    assert.equal(cekRateLimit(a).ok, false);
    assert.deepEqual(cekRateLimit(b), { ok: true });
    reset(a);
  });
});
