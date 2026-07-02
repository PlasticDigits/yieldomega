// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Anvil + DeployDev + indexer: Arena display from GET /v1/arena/* (#301, #322).
 * Requires `YIELDOMEGA_E2E_INDEXER=1 bash scripts/e2e-anvil.sh` (sets VITE_INDEXER_URL at build time).
 */
import { expect, test } from "@playwright/test";
import { ARENA_E2E_TIMEOUT_MS } from "./arenaE2eHelpers";

const INDEXER_E2E_TIMEOUT_MS = 60_000;

test.describe("Anvil indexer-first Arena display", () => {
  test.skip(
    process.env.ANVIL_E2E !== "1",
    "Set ANVIL_E2E=1 and build with scripts/e2e-anvil.sh.",
  );
  test.skip(
    process.env.ANVIL_E2E_INDEXER !== "1",
    "Set YIELDOMEGA_E2E_INDEXER=1 so e2e-anvil.sh starts the indexer and inlines VITE_INDEXER_URL.",
  );

  test("protocol podiums and play-surface timer epoch load from indexer", async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto("/audit");
    await expect(page.getByText("Loading Yield Omega route...")).toBeHidden({
      timeout: ARENA_E2E_TIMEOUT_MS,
    });
    await expect(page.getByRole("heading", { name: "AUDIT", level: 1 })).toBeVisible({
      timeout: ARENA_E2E_TIMEOUT_MS,
    });

    const indexerStatus = page.locator(".indexer-status");
    await indexerStatus.scrollIntoViewIfNeeded();
    await expect(indexerStatus).not.toContainText("dev-only");
    await expect(indexerStatus).toContainText(/INDEXER · v[\d.]+ · block [\d,]+ · live/, {
      timeout: INDEXER_E2E_TIMEOUT_MS,
    });

    const podiums = page.getByTestId("arena-simple-podiums");
    await expect(podiums).toBeVisible({ timeout: INDEXER_E2E_TIMEOUT_MS });
    await expect(podiums.locator(".arena-simple__podium-card")).toHaveCount(4);

    await page.goto("/");
    await expect(page.getByTestId("arena-command-console")).toBeVisible({
      timeout: ARENA_E2E_TIMEOUT_MS,
    });

    const epochCorner = page.getByTestId("arena-timer-panel-epoch-corner");
    await expect(epochCorner).toBeVisible({ timeout: INDEXER_E2E_TIMEOUT_MS });
    await expect(epochCorner).not.toContainText("EPOCH —", { timeout: INDEXER_E2E_TIMEOUT_MS });
    await expect(epochCorner).toContainText(/EPOCH \d+/);
  });
});
