import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "tests/unit/**/*.test.ts",
      "tests/integration/**/*.test.ts",
      "tests/staging/**/*.test.ts",
    ],
    globals: true,
    setupFiles: ["./tests/setup-paths.ts"],
    env: {
      NEXT_PUBLIC_SOLANA_NETWORK: "mainnet-beta",
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
