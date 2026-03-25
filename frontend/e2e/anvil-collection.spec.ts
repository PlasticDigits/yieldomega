// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Anvil: Leprechaun NFT Collection — `totalSupply` (public read) and `balanceOf` (wallet read).
 * Indexer-backed “Recent mints” is not asserted here; set `VITE_INDEXER_URL` separately to verify
 * that panel. MegaETH may differ for RPC limits and wallet UX — see docs/testing/e2e-anvil.md.
 */

async function connectMockIfPlaceholderVisible(
  page: Page,
  placeholder: string,
) {
  const barrier = page.getByText(placeholder, { exact: true });
  if (!(await barrier.isVisible().catch(() => false))) {
    return;
  }
  await page.getByRole("button", { name: /connect/i }).first().click();
  await page.getByRole("button", { name: /Mock Connector/i }).click();
}

test.describe("Anvil Collection NFT reads", () => {
  test.skip(
    process.env.ANVIL_E2E !== "1",
    "Set ANVIL_E2E=1 and build with scripts/e2e-anvil.sh (includes VITE_E2E_MOCK_WALLET=1).",
  );

  test("totalSupply and connected balanceOf", async ({ page }) => {
    await page.goto("/collection");
    await expect(page.getByText("Loading totalSupply…")).toBeHidden({
      timeout: 120_000,
    });
    await expect(page.getByText(/totalSupply:\s*\d+/)).toBeVisible();

    await connectMockIfPlaceholderVisible(
      page,
      "Connect a wallet to list owned token IDs.",
    );
    await expect(
      page.getByText("Connect a wallet to list owned token IDs."),
    ).not.toBeVisible({ timeout: 60_000 });

    await expect(page.getByText("Loading balance…")).toBeHidden({
      timeout: 120_000,
    });
    await expect(page.getByText(/^Your balance:\s*\d+$/)).toBeVisible();
  });
});
