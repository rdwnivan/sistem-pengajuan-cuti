import { it } from "node:test";
import assert from "node:assert/strict";
import { blobLampiranValid, urlLampiran } from "../src/lib/lampiran";

it("URL lampiran memakai ID objek, bukan URL storage", () => {
  assert.equal(urlLampiran("foto", "foto-1"), "/api/lampiran/foto/foto-1");
});
for (const url of ["https://127.0.0.1/a", "https://evil.invalid/a", "https://store.private.blob.vercel-storage.com.evil.invalid/a", "https://user:pw@store.private.blob.vercel-storage.com/a", "https://store.private.blob.vercel-storage.com/a?token=x"]) {
  it(`menolak referensi storage asing ${url}`, () => assert.equal(blobLampiranValid(url, "private"), false));
}
it("membedakan Blob public lama dan private", () => {
  assert.equal(blobLampiranValid("https://store.private.blob.vercel-storage.com/a", "private"), true);
  assert.equal(blobLampiranValid("https://store.public.blob.vercel-storage.com/a", "private"), false);
});
