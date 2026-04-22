// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test } from "@playwright/test";
import { detectLaunchState } from "./launchState";

test("timecurve path can carry a referral segment (not arena/protocol)", async ({ page }) => {
  const state = await detectLaunchState(page);
  test.skip(state === "countdown", "Build is locked behind LaunchCountdownPage.");

  await page.goto("/timecurve/abc12");
  await expect(page).toHaveURL(/\/timecurve\/abc12/);
  const pending = await page.evaluate(() => {
    return window.localStorage.getItem("yieldomega.ref.v1");
  });
  expect(pending).toBeTruthy();
  const p = JSON.parse(pending!);
  expect(p.code).toBe("abc12");
});
