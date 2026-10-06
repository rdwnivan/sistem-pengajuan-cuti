import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { samaAman } from "../src/lib/aman-sama";

describe("samaAman (perbandingan constant-time)", () => {
  const rahasia = "s3cret".repeat(8); // 48 char, menyerupai CRON_SECRET

  it("string identik → true", () => {
    assert.equal(samaAman(rahasia, rahasia), true);
  });

  it("beda satu karakter di akhir → false", () => {
    assert.equal(samaAman(rahasia.slice(0, -1) + "X", rahasia), false);
  });

  it("beda satu karakter di awal → false", () => {
    assert.equal(samaAman("X" + rahasia.slice(1), rahasia), false);
  });

  it("prefix benar tapi lebih pendek → false", () => {
    assert.equal(samaAman(rahasia.slice(0, 10), rahasia), false);
  });

  it("panjang berbeda tidak melempar, hasilnya false", () => {
    let hasil = true;
    assert.doesNotThrow(() => {
      hasil = samaAman("pendek", rahasia);
    });
    assert.equal(hasil, false);
    assert.doesNotThrow(() => samaAman(rahasia, "pendek"));
  });

  it("null / undefined / string kosong → false", () => {
    assert.equal(samaAman(null, rahasia), false);
    assert.equal(samaAman(undefined, rahasia), false);
    assert.equal(samaAman("", rahasia), false);
    assert.equal(samaAman(rahasia, null), false);
    assert.equal(samaAman(null, null), false);
  });
});
