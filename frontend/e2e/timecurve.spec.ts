// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test } from "@playwright/test";

test("timecurve page loads", async ({ page }) => {
  await page.goto("/timecurve");
  await expect(page.locator("main.app-main")).toBeVisible();
});
