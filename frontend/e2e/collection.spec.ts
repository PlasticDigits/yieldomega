// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test } from "@playwright/test";

test("collection page loads", async ({ page }) => {
  await page.goto("/collection");
  await expect(page.locator("main.app-main")).toBeVisible();
});
