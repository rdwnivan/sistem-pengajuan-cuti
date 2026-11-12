import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { put } from "@vercel/blob";

// Uji integrasi khusus override: resolusi mengikuti SDK yang terpasang,
// bukan menambahkan CLI-config/OIDC sebagai dependency aplikasi.
const require = createRequire(import.meta.url);
const blobRequire = createRequire(require.resolve("@vercel/blob"));
const oidcPath = blobRequire.resolve("@vercel/oidc");
const oidcRequire = createRequire(oidcPath);
const cliConfig = oidcRequire("@vercel/cli-config");

test("CLI-config mempertahankan token dan field tambahan tanpa membaca kredensial disk", () => {
  assert.deepEqual(cliConfig.parseAuthConfig({ token: "test-only-token", expiresAt: 123, extra: true }),
    { token: "test-only-token", expiresAt: 123, extra: true });
});

test("CLI-config menolak tipe token yang salah", () => {
  assert.throws(() => cliConfig.parseAuthConfig({ token: 123 }));
});

test("CLI-config mempertahankan konfigurasi telemetry dan team", () => {
  assert.deepEqual(cliConfig.parseGlobalConfig({ currentTeam: "team-test", telemetry: { enabled: false } }),
    { currentTeam: "team-test", telemetry: { enabled: false } });
});

test("CLI-config menolak mode penyimpanan kredensial yang tidak dikenal", () => {
  assert.throws(() => cliConfig.parseGlobalConfig({ credStorage: "invalid" }), /Invalid value for `credStorage`/);
});

test("OIDC memilih token environment dummy tanpa disk, refresh, atau jaringan", () => {
  const result = spawnSync(process.execPath, ["-e", `
    const assert = require('node:assert/strict');
    const { getVercelOidcTokenSync } = require(process.argv[1]);
    assert.equal(getVercelOidcTokenSync(), 'test-only-oidc-token');
  `, oidcPath], { env: { VERCEL_OIDC_TOKEN: "test-only-oidc-token" }, encoding: "utf8", timeout: 10000 });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
});

async function mockBlob(t, options) {
  const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  let received;
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    received = { method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(chunks) };
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ url: "https://example.invalid/test.png", downloadUrl: "https://example.invalid/test.png?download=1",
      pathname: "test.png", contentType: "image/png", contentDisposition: 'inline; filename="test.png"' }));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const previousUrl = process.env.VERCEL_BLOB_API_URL;
  process.env.VERCEL_BLOB_API_URL = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    if (previousUrl === undefined) delete process.env.VERCEL_BLOB_API_URL;
    else process.env.VERCEL_BLOB_API_URL = previousUrl;
    await new Promise(resolve => server.close(resolve));
  });
  const result = await put("test.png", bytes, { access: "public", contentType: "image/png", ...options });
  assert.equal(result.url, "https://example.invalid/test.png");
  assert.equal(result.contentType, "image/png");
  assert.equal(received.method, "PUT");
  assert.match(received.url, /pathname=test.png/);
  assert.deepEqual(received.body, bytes);
  return received.headers;
}

test("Blob put mengirim PNG dan bearer read-write dummy ke endpoint lokal", async t => {
  const headers = await mockBlob(t, { token: "vercel_blob_rw_teststore_testonly" });
  assert.equal(headers.authorization, "Bearer vercel_blob_rw_teststore_testonly");
  assert.equal(headers["x-vercel-blob-store-id"], "teststore");
});

test("Blob put mengirim OIDC dan store ID dummy ke endpoint lokal", async t => {
  const headers = await mockBlob(t, { oidcToken: "test-only-oidc-token", storeId: "store_teststore" });
  assert.equal(headers.authorization, "Bearer test-only-oidc-token");
  assert.equal(headers["x-vercel-blob-store-id"], "teststore");
});
