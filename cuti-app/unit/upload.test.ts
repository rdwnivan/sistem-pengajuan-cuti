import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sniffFile } from "../src/lib/upload";

const keFile = (bytes: number[], nama = "x.bin") =>
  new File([new Uint8Array(bytes)], nama) as unknown as File;

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]; // %PDF-1.4
const JPG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00];
const HTML = Array.from(Buffer.from("<html><script>alert(1)</script>"));
const SVG = Array.from(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">'));

describe("sniffFile (content sniffing upload)", () => {
  it("PDF asli diterima dengan ext/mime dari konten", async () => {
    const r = await sniffFile(keFile(PDF));
    assert.equal(r.ext, "pdf");
    assert.equal(r.mime, "application/pdf");
    assert.ok(r.buffer.length > 0);
  });

  it("JPG asli diterima", async () => {
    const r = await sniffFile(keFile(JPG));
    assert.equal(r.ext, "jpg");
    assert.equal(r.mime, "image/jpeg");
  });

  it("PNG asli diterima", async () => {
    const r = await sniffFile(keFile(PNG));
    assert.equal(r.ext, "png");
    assert.equal(r.mime, "image/png");
  });

  it("HTML yang diklaim PDF ditolak (spoof)", async () => {
    await assert.rejects(() => sniffFile(keFile(HTML, "evil.pdf")), /hanya PDF\/JPG\/PNG/);
  });

  it("SVG ditolak", async () => {
    await assert.rejects(() => sniffFile(keFile(SVG, "x.svg")), /hanya PDF\/JPG\/PNG/);
  });

  it("script JS plain ditolak", async () => {
    await assert.rejects(() => sniffFile(keFile(Array.from(Buffer.from("alert('xss')")), "x.js")), /hanya PDF\/JPG\/PNG/);
  });

  it("file kosong ditolak", async () => {
    await assert.rejects(() => sniffFile(keFile([])), /hanya PDF\/JPG\/PNG/);
  });
});
