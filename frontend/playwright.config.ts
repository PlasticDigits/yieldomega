// SPDX-License-Identifier: AGPL-3.0-only
import { defineConfig, devices } from "@playwright/test";

const isAnvilE2E = process.env.ANVIL_E2E === "1";

export default defineConfig({
  testDir: "./e2e",
  testIgnore: /timecurve-live-buys-modals\.spec\.ts/,
  // Anvil: one chain + shared mock account — cross-file Playwright workers race
  // nonces / sale / referral state (gitlab #87). CI UI smoke: parallel OK.
  fullyParallel: !isAnvilE2E,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: isAnvilE2E ? 1 : process.env.CI ? 5 : undefined,
  timeout: 180_000,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
