import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hasilBatas, kunciLogin } from "../src/lib/rate-limit";

describe("hasil rate limit dari waktu database", () => {
  it("batas yang sudah lewat mengizinkan login", () => assert.deepEqual(hasilBatas(-1), { ok: true }));
  it("tepat pada batas mengizinkan login", () => assert.deepEqual(hasilBatas(0), { ok: true }));
  it("sisa waktu dibulatkan ke atas", () => assert.deepEqual(hasilBatas(1.1), { ok: false, cobaLagiDalam: 2 }));
  it("lima belas menit mempertahankan 900 detik", () => assert.deepEqual(hasilBatas(900), { ok: false, cobaLagiDalam: 900 }));
  it("kunci menormalkan akun dan tidak menyimpan email", () => {
    assert.equal(kunciLogin(" USER@example.id "), kunciLogin("user@example.id"));
    assert.match(kunciLogin("user@example.id"), /^[a-f0-9]{64}$/);
  });
});
