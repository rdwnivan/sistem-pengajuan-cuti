import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { agenPushAman, alamatPushPublik, endpointPushValid, subscriptionSchema } from "../src/lib/push-security";

describe("batas tujuan push", () => {
  for (const endpoint of ["https://127.0.0.1/x", "https://[::1]/x", "http://fcm.googleapis.com/x", "https://fcm.googleapis.com.evil.invalid/x", "https://user@fcm.googleapis.com/x", "https://fcm.googleapis.com:123/x", "https://web.push.apple.com/x#fragment", "https://example.org/x"]) {
    it(`menolak ${endpoint}`, () => assert.equal(endpointPushValid(endpoint), false));
  }
  for (const host of ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"]) {
    it(`mengizinkan penyedia ${host}`, () => assert.equal(endpointPushValid(`https://${host}/push/token`), true));
  }
  it("mengizinkan channel Microsoft WNS untuk Edge tanpa membuka domain lain", () => {
    assert.equal(endpointPushValid("https://db3.notify.windows.com/?token=channel"), true);
    assert.equal(endpointPushValid("https://db3.notify.windows.com.evil.invalid/?token=x"), false);
  });
  for (const address of ["127.0.0.1", "10.1.2.3", "169.254.169.254", "192.168.1.1", "100.64.1.1", "::1", "::ffff:127.0.0.1", "fc00::1", "fe80::1", "2001:db8::1"]) {
    it(`menolak IP ${address}`, () => assert.equal(alamatPushPublik(address), false));
  }
  it("mengizinkan IPv4 publik", () => assert.equal(alamatPushPublik("8.8.8.8"), true));
  it("mengizinkan IPv6 publik", () => assert.equal(alamatPushPublik("2606:4700:4700::1111"), true));
  it("menolak tipe body dan key palsu", () => assert.equal(subscriptionSchema.safeParse({ endpoint: {}, keys: { p256dh: "bad", auth: "bad" } }).success, false));
  it("menolak DNS penyedia yang mengarah ke private sebelum membuat koneksi", async () => {
    await assert.rejects(agenPushAman("https://fcm.googleapis.com/x", async () => [{ address: "127.0.0.1", family: 4 }]), /bukan jaringan publik/);
  });
  it("membatasi DNS yang tidak pernah selesai", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const pending = agenPushAman("https://fcm.googleapis.com/x", () => new Promise(() => {}));
    const rejected = assert.rejects(pending, /batas waktu/);
    t.mock.timers.tick(3000);
    await rejected;
  });
});
