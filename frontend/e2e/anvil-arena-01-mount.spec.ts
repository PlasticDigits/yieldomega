// SPDX-License-Identifier: AGPL-3.0-only
import { test, expect } from "@playwright/test";
import { ARENA_E2E_TIMEOUT_MS } from "./arenaE2eHelpers";

test.describe("Anvil Arena mount", () => {
  test.skip(
    process.env.ANVIL_E2E !== "1",
    "Set ANVIL_E2E=1 and build with VITE_* from scripts/e2e-anvil.sh.",
  );

  test("arena page mounts one command-console surface", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Loading Yield Omega route...")).toBeHidden({
      timeout: ARENA_E2E_TIMEOUT_MS,
    });
    await expect(page.getByTestId("time-arena-page-mounted")).toBeAttached({
      timeout: ARENA_E2E_TIMEOUT_MS,
    });
    await expect(page.getByTestId("arena-command-console")).toBeVisible({
      timeout: ARENA_E2E_TIMEOUT_MS,
    });
    await expect(page.getByTestId("arena-command-console-primary")).toBeVisible({
      timeout: ARENA_E2E_TIMEOUT_MS,
    });
    await expect(page.locator(".arena-final-concept")).toHaveCount(0);
    await expect(page.getByTestId("arena-charm-cred-card")).toBeVisible({
      timeout: ARENA_E2E_TIMEOUT_MS,
    });
    await expect(page.getByTestId("arena-last-buy-chip")).toBeAttached({
      timeout: ARENA_E2E_TIMEOUT_MS,
    });
    await expect(page.getByTestId("arena-timer-chip-gate-1")).toBeAttached({
      timeout: ARENA_E2E_TIMEOUT_MS,
    });
    await expect(page.getByTestId("warbow-hero-actions")).toBeAttached({
      timeout: ARENA_E2E_TIMEOUT_MS,
    });
    await expect(page.getByTestId("arena-simple-podiums")).toHaveCount(0);

    await page.getByLabel("Primary").getByRole("link", { name: /AUDIT/ }).click();
    await expect(page).toHaveURL(/\/arena\/protocol$/);
    await expect(page.getByTestId("arena-simple-podiums")).toBeAttached({
      timeout: ARENA_E2E_TIMEOUT_MS,
    });
  });

  test("redirects /timecurve to /", async ({ page }) => {
    await page.goto("/timecurve");
    await expect(page).toHaveURL(/\/$/);
  });
});
