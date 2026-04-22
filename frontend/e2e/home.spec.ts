// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test } from "@playwright/test";
import { detectLaunchState } from "./launchState";

test("home shows title and nav links", async ({ page }) => {
  const state = await detectLaunchState(page);
  test.skip(state === "countdown", "Build is locked behind LaunchCountdownPage.");

  if (state === "post-launch") {
    await page.goto("/home");
  }
  await expect(page.getByRole("heading", { name: "YieldOmega", level: 1 })).toBeVisible();
  await expect(
    page.getByLabel("Primary").getByRole("link", { name: "TimeCurve" }),
  ).toBeVisible();
});
