// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test } from "@playwright/test";

/**
 * Collection is under construction during the TimeCurve launch milestone.
 * See launchplan-timecurve.md and docs/testing/e2e-anvil.md.
 */

test.describe("Anvil Collection (placeholder)", () => {
  test.skip(
    process.env.ANVIL_E2E !== "1",
    "Set ANVIL_E2E=1 and build with scripts/e2e-anvil.sh (includes VITE_E2E_MOCK_WALLET=1).",
  );

  test("collection page is under construction", async ({ page }) => {
    await page.goto("/collection");
    await expect(page.getByTestId("under-construction-collection")).toBeVisible();
  });
});
