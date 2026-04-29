// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Anvil + DeployDev: hidden `/vesting` route reads DoubPresaleVesting + claim CTA (GitLab #92).
 * Requires `bash scripts/e2e-anvil.sh` (sets `VITE_DOUB_PRESALE_VESTING_ADDRESS`, mock wallet).
 */
import { expect, test } from "@playwright/test";

test.describe("Anvil presale vesting surface", () => {
  test.skip(
    process.env.ANVIL_E2E !== "1",
    "Set ANVIL_E2E=1 and build with scripts/e2e-anvil.sh (includes VITE_DOUB_PRESALE_VESTING_ADDRESS).",
  );

  test("vesting page shows schedule + claim for mock beneficiary wallet", async ({ page }) => {
    await page.goto("/vesting");
    await expect(page.getByTestId("presale-vesting-surface")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("heading", { name: "Presale vesting", level: 1 })).toBeVisible();
    await expect(page.getByTestId("presale-vesting-wallet-panel")).toBeVisible({ timeout: 120_000 });
    const panel = page.getByTestId("presale-vesting-wallet-panel");
    await expect(panel.getByText("Your allocation", { exact: true })).toBeVisible();
    await expect(panel.getByText("Claimable now", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Claim DOUB/i })).toBeEnabled();
  });
});
