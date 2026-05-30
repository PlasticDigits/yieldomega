// SPDX-License-Identifier: AGPL-3.0-only
import { test, expect } from "@playwright/test";

test.describe("Anvil Arena mount", () => {
  test.skip(
    process.env.ANVIL_E2E !== "1",
    "Set ANVIL_E2E=1 and build with VITE_* from scripts/e2e-anvil.sh.",
  );

  test("arena page mounts charm cred card and timer chips", async ({ page }) => {
    await page.goto("/arena");
    await expect(page.getByText("Loading YieldOmega route...")).toBeHidden({ timeout: 120_000 });
    await expect(page.getByTestId("time-arena-page-mounted")).toBeAttached({ timeout: 120_000 });
    await expect(page.locator(".arena-simple-page")).toBeVisible({ timeout: 120_000 });
    await expect(page.getByTestId("arena-charm-cred-card")).toBeVisible({ timeout: 120_000 });
    await expect(page.getByTestId("arena-timer-chips")).toBeAttached({ timeout: 120_000 });
  });

  test("redirects /timecurve to /arena", async ({ page }) => {
    await page.goto("/arena");
    await expect(page).toHaveURL(/\/arena$/);
  });
});
