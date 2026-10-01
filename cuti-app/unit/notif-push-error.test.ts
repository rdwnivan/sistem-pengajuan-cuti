import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pesanGalatPush } from "../src/components/NotificationPermission";

describe("pesanGalatPush — pesan error subscribe yang ramah", () => {
  it("push service error -> panduan cek koneksi/FCM/browser lain", () => {
    const msg = pesanGalatPush(new Error("Registration failed - push service error"));
    assert.match(msg, /layanan push/);
    assert.match(msg, /gcm-internals|Firefox/);
  });

  it("AbortError (VAPID tidak cocok) -> suruh hubungi admin", () => {
    const e = new DOMException("Failed to subscribe", "AbortError");
    assert.match(pesanGalatPush(e), /VAPID|admin/);
  });

  it("NotAllowedError -> panduan buka blokir browser", () => {
    const e = new DOMException("Permission denied", "NotAllowedError");
    assert.match(pesanGalatPush(e), /diblokir browser/);
  });

  it("error tak dikenal -> pesan asli, tidak kosong", () => {
    const msg = pesanGalatPush(new Error("sesuatu yang aneh"));
    assert.equal(msg, "sesuatu yang aneh");
  });

  it("bukan Error -> string apa adanya", () => {
    assert.equal(pesanGalatPush("teks mentah"), "teks mentah");
  });
});
