// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Anvil + DeployDev + indexer: indexer-first Arena display smoke (GitLab #301, #322).
 * Requires `YIELDOMEGA_E2E_INDEXER=1 bash scripts/e2e-anvil.sh` (sets `INDEXER_E2E=1`,
 * inlines `VITE_INDEXER_URL`, starts Postgres-backed indexer).
 */
import { expect, test } from "@playwright/test";
import { ARENA_E2E_TIMEOUT_MS } from "./arenaE2eHelpers";

test.describe("Anvil indexer-first display", () => {
  test.skip(
    process.env.ANVIL_E2E !== "1" || process.env.INDEXER_E2E !== "1",
    "Set YIELDOMEGA_E2E_INDEXER=1 and run scripts/e2e-anvil.sh for indexer-first E2E.",
  );

  test("protocol view shows live indexer status and podium grid", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/arena/protocol");
    await expect(page.getByText("Loading Yield Omega route...")).toBeHidden({
      timeout: ARENA_E2E_TIMEOUT_MS,
    });
    await expect(page.getByRole("heading", { name: "AUDIT", level: 1 })).toBeVisible({
      timeout: ARENA_E2E_TIMEOUT_MS,
    });
    const indexerStatus = page.locator(".indexer-status");
    await indexerStatus.scrollIntoViewIfNeeded();
    await expect(indexerStatus).toContainText(/INDEXER · v[\d.]+ · block \d+ · live/, {
      timeout: 60_000,
    });
    await expect(page.getByTestId("arena-simple-podiums")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByTestId("arena-live-buys-activity")).toBeVisible({
      timeout: 60_000,
    });
  });
});
