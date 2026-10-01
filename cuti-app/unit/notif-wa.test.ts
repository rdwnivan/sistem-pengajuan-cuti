import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { kirimWA, bolehKirimWA } from "../src/lib/notif";

const fetchAsli = globalThis.fetch;

function mockFetch(perilaku: Array<"ok" | "gagal" | "throw">) {
  let panggil = 0;
  // @ts-expect-error mock parsial untuk test
  globalThis.fetch = async () => {
    const i = Math.min(panggil++, perilaku.length - 1);
    const mode = perilaku[i];
    if (mode === "throw") throw new Error("network down");
    const ok = mode === "ok";
    return { ok, json: async () => (ok ? { status: true } : { reason: "rate limited" }) };
  };
  return () => panggil;
}

describe("WA retry (Fonnte)", () => {
  beforeEach(() => {
    process.env.FONNTE_TOKEN = "dummy-token-test";
    process.env.WA_RETRY_DELAYS_MS = "1,2,3";
  });

  afterEach(() => {
    globalThis.fetch = fetchAsli;
    delete process.env.WA_RETRY_DELAYS_MS;
  });

  it("sukses di percobaan pertama tanpa retry", async () => {
    const hitung = mockFetch(["ok"]);
    const r = await kirimWA("08123456789", "halo");
    assert.equal(r.ok, true);
    assert.equal(hitung(), 1);
  });

  it("gagal 2x lalu sukses di percobaan ke-3", async () => {
    const hitung = mockFetch(["gagal", "throw", "ok"]);
    const r = await kirimWA("08123456789", "halo");
    assert.equal(r.ok, true);
    assert.equal(hitung(), 3);
  });

  it("gagal semua -> ok:false setelah 3x, ada info", async () => {
    const hitung = mockFetch(["gagal", "gagal", "gagal", "gagal"]);
    const r = await kirimWA("08123456789", "halo");
    assert.equal(r.ok, false);
    assert.equal(hitung(), 3);
    assert.match(r.info ?? "", /gagal 3x/);
  });

  it("tanpa token -> mode log (ok, tanpa fetch)", async () => {
    delete process.env.FONNTE_TOKEN;
    const hitung = mockFetch(["ok"]);
    const r = await kirimWA("08123456789", "halo");
    assert.equal(r.ok, true);
    assert.equal(r.info, "logged");
    assert.equal(hitung(), 0);
    process.env.FONNTE_TOKEN = "dummy-token-test";
  });

  it("no HP invalid ditolak sebelum fetch", async () => {
    const hitung = mockFetch(["ok"]);
    assert.equal((await kirimWA(null, "x")).ok, false);
    assert.equal((await kirimWA("abc", "x")).ok, false);
    assert.equal(hitung(), 0);
  });
});

describe("bolehKirimWA — preferensi notif WA user", () => {
  it("user null -> tidak boleh", () => {
    assert.deepEqual(bolehKirimWA(null), { boleh: false, alasan: "user tidak ditemukan" });
  });

  it("notifWa mati -> tidak boleh walau no HP ada", () => {
    assert.deepEqual(bolehKirimWA({ noHp: "08123456789", notifWa: false }), { boleh: false, alasan: "dinonaktifkan user" });
  });

  it("no HP kosong -> tidak boleh walau notifWa aktif", () => {
    assert.deepEqual(bolehKirimWA({ noHp: null, notifWa: true }), { boleh: false, alasan: "no HP kosong" });
  });

  it("notifWa aktif + no HP ada -> boleh", () => {
    assert.deepEqual(bolehKirimWA({ noHp: "08123456789", notifWa: true }), { boleh: true });
  });
});
