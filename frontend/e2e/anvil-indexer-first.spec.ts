// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Anvil + DeployDev + indexer: smoke indexer-first Arena display (GitLab #301, #322).
 * Requires `YIELDOMEGA_E2E_WITH_INDEXER=1 bash scripts/e2e-anvil.sh` (sets `ANVIL_E2E_INDEXER=1`
 * and builds with `VITE_INDEXER_URL`).
 */
import { expect, test } from "@playwright/test";
import { gotoArena } from "./arenaE2eHelpers";

const INDEXER_E2E_TIMEOUT_MS = 60_000;

test.describe("Anvil indexer-first display", () => {
  test.skip(
    process.env.ANVIL_E2E_INDEXER !== "1",
    "Set YIELDOMEGA_E2E_WITH_INDEXER=1 when running scripts/e2e-anvil.sh.",
  );

  test.describe.configure({ timeout: 120_000 });

  test("arena loads timer head from indexer and protocol podiums render", async ({ page }) => {
    await gotoArena(page);

    await expect(page.getByText("INDEXER · dev-only · set VITE_INDEXER_URL")).toHaveCount(0);

    await page.waitForResponse(
      (response) =>
        response.url().includes("/v1/arena/timers") && response.status() === 200,
      { timeout: INDEXER_E2E_TIMEOUT_MS },
    );

    await page.getByLabel("Primary").getByRole("link", { name: /AUDIT/ }).click();
    await expect(page).toHaveURL(/\/arena\/protocol$/);
    await expect(page.getByTestId("arena-simple-podiums")).toBeVisible({
      timeout: INDEXER_E2E_TIMEOUT_MS,
    });

    await page.locator("details.app-footer-agent summary").click();
    await expect(page.locator(".indexer-status")).toContainText("live", {
      timeout: INDEXER_E2E_TIMEOUT_MS,
    });
  });
});
