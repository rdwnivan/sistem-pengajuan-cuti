import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

// ESLint 9 flat config — pengganti `next lint` (dihapus di Next.js 16).
// `eslint-config-next@15` belum mengekspor flat config, jadi konfigurasi
// eslintrc lama dibungkus lewat FlatCompat. Isi `extends` sengaja
// dipertahankan sama dengan .eslintrc.json lama (`next/core-web-vitals`)
// supaya hasil lint identik — menambah `next/typescript` akan mengaktifkan
// aturan baru dan itu perubahan terpisah.
const __dirname = dirname(fileURLToPath(import.meta.url));

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals"),
  {
    // Fixture Playwright memakai callback bernama `use` (`async ({ page }, use) => ...`).
    // `react-hooks/rules-of-hooks` mengiranya React Hook — false positive, bukan React.
    files: ["tests/**/*.ts"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "playwright-report/**",
      "test-results/**",
      "public/uploads/**",
    ],
  },
];

export default eslintConfig;
