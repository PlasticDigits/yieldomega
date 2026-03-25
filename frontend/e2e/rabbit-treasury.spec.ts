// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test } from "@playwright/test";

test("rabbit treasury page loads", async ({ page }) => {
  await page.goto("/rabbit-treasury");
  await expect(page.locator("main.app-main")).toBeVisible();
});
