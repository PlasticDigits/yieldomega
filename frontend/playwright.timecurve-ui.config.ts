// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Playwright config for TimeCurve UI tests that need `VITE_INDEXER_URL` at dev-server
 * compile time (see e2e/timecurve-live-buys-modals.spec.ts).
 */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "timecurve-live-buys-modals.spec.ts",
  fullyParallel: true,
  workers: 5,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4174",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command:
      "VITE_LAUNCH_TIMESTAMP= VITE_INDEXER_URL=http://127.0.0.1:54321 npm run dev -- --host 127.0.0.1 --port 4174 --strictPort",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
