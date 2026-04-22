// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test } from "@playwright/test";
import { detectLaunchState } from "./launchState";

test("collection page loads", async ({ page }) => {
  const state = await detectLaunchState(page);
  test.skip(state === "countdown", "Build is locked behind LaunchCountdownPage.");

  await page.goto("/collection");
  await expect(page.locator("main.app-main")).toBeVisible();
});
