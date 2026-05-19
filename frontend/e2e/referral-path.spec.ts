// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Path-based referral capture: pending key `yieldomega.ref.v1` only (not `myrefcode` — GitLab #85).
 */
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

test("timecurve path locks referral without wallet (test1)", async ({ page }) => {
  const state = await detectLaunchState(page);
  test.skip(state === "countdown", "Build is locked behind LaunchCountdownPage.");

  await page.goto("/timecurve/test1");
  await expect(page).toHaveURL(/\/timecurve\/test1/);
  const pending = await page.evaluate(() => window.localStorage.getItem("yieldomega.ref.v1"));
  expect(JSON.parse(pending!).code).toBe("test1");
  const siteLock = page.getByTestId("pending-referral-site-lock");
  if (await siteLock.isVisible().catch(() => false)) {
    await expect(siteLock).toContainText("test1");
  }
});
