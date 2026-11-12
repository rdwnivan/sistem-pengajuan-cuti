import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const parserRequire = createRequire(require.resolve("@typescript-eslint/parser"));
const estreeRequire = createRequire(parserRequire.resolve("@typescript-eslint/typescript-estree"));
const { minimatch } = estreeRequire("minimatch");
const tailwindRequire = createRequire(require.resolve("tailwindcss"));
const selectorParser = tailwindRequire("postcss-selector-parser");

test("typescript-estree's CommonJS glob matcher preserves dotfile and extension matching", () => {
  assert.equal(minimatch("src/.cache/example.ts", "**/*.ts", { dot: true }), true);
  assert.equal(minimatch("src/example.tsx", "**/*.ts", { dot: true }), false);
});

test("TypeScript parser project service accepts an allowDefaultProject glob", () => {
  const parser = require("@typescript-eslint/parser");
  const result = parser.parseForESLint("const value: number = 1;", {
    filePath: "tooling-compat-fixture.ts",
    tsconfigRootDir: process.cwd(),
    projectService: { allowDefaultProject: ["*.ts"] },
  });
  assert.equal(result.ast.body[0].type, "VariableDeclaration");
  assert.equal(result.ast.body[0].declarations[0].id.typeAnnotation.typeAnnotation.type, "TSNumberKeyword");
  assert.ok(result.services.program);
  parser.clearCaches();
});

test("Tailwind selector parser preserves escaped utilities and pseudo selectors", () => {
  const selector = ".sm\\:hover\\:bg-green-700:hover > [data-state=active]:not(.hidden)";
  const root = selectorParser().astSync(selector);
  assert.equal(root.toString(), selector);
  assert.equal(root.nodes[0].nodes[0].value, "sm:hover:bg-green-700");
});
