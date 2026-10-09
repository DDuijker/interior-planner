import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  esbuild: { jsx: "automatic" },
  test: {
    include: [
      "core/**/*.test.ts",
      "ui/**/*.test.{ts,tsx}",
      "i18n/**/*.test.ts",
      "catalog/**/*.test.ts",
    ],
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      include: ["core/**/*.ts"],
      exclude: ["core/**/*.test.ts", "core/**/index.ts"],
      thresholds: { lines: 85, functions: 85, statements: 85, branches: 80 },
    },
  },
});
