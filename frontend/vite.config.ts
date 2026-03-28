/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// SPDX-License-Identifier: AGPL-3.0-only
export default defineConfig({
  plugins: [react()],
  build: {
    // Rainbow/wagmi/WalletConnect pull large minified chunks; splitting further is a separate optimization.
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      onwarn(warning, defaultHandler) {
        // Upstream `ox` (via Coinbase, Reown, etc.) places `/*#__PURE__*/` where Rollup ignores it; behavior is safe.
        if (
          warning.code === "INVALID_ANNOTATION" &&
          typeof warning.id === "string" &&
          warning.id.includes("node_modules")
        ) {
          return;
        }
        defaultHandler(warning);
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
