import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";

const env = loadEnv("", process.cwd(), "");

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["tests/setup-components.ts"],
    env,
    testTimeout: 20000,
    hookTimeout: 30000,
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts", "tests/helpers/**/*.ts"],
      reporter: ["text", "json-summary"],
    },
  },
});
