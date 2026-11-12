import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

// Exercise the versions resolved by consumers, including nested installations.
const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve("next/package.json"));
const postcss = nextRequire("postcss");
const excelRequire = createRequire(require.resolve("exceljs"));
const uuid = excelRequire("uuid");
const ExcelJS = require("exceljs");

test("Next PostCSS escapes style-closing sequences in CSS output", () => {
  const output = postcss.parse('a { content: "</style><script>alert(1)</script>" }').toResult().css;
  assert.doesNotMatch(output, /<\/style/i);
});

test("Next PostCSS ignores external map annotations without a CSS source path", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cuti-postcss-"));
  try {
    const mapPath = join(directory, "outside.map");
    await writeFile(mapPath, JSON.stringify({ version: 3, sources: ["private.css"], names: [], mappings: "AAAA" }));
    const root = postcss.parse(`a { color: red } /*# sourceMappingURL=${mapPath.replaceAll("\\", "/")} */`);
    assert.equal(root.source.input.map?.text, undefined);
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("ExcelJS UUID dependency rejects undersized v5 output buffers", () => {
  assert.throws(() => uuid.v5("cuti", uuid.v5.DNS, new Uint8Array(8)), RangeError);
});

test("ExcelJS exports and reads employee rows with extended conditional formatting", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Rekap Cuti");
  sheet.addRow(["Pemohon", "Hari"]);
  sheet.addRow(["Karyawan Uji", 2]);
  // The extension serializer invokes UUID v4 using ExcelJS's own import.
  sheet.addConditionalFormatting({
    ref: "B2:B2",
    rules: [{ type: "dataBar", minLength: 0, maxLength: 100, cfvo: [{ type: "min" }, { type: "max" }], color: { argb: "FF638EC6" } }],
  });
  const bytes = await workbook.xlsx.writeBuffer();
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(bytes);
  assert.equal(restored.getWorksheet("Rekap Cuti").getCell("A2").value, "Karyawan Uji");
  assert.equal(restored.getWorksheet("Rekap Cuti").getCell("B2").value, 2);
  assert.equal(restored.getWorksheet("Rekap Cuti").conditionalFormattings[0].rules[0].type, "dataBar");
  assert.match(sheet.conditionalFormattings[0].rules[0].x14Id, /^\{[0-9a-f-]{36}\}$/i);
});
