// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Path-based referral capture: pending key `yieldomega.ref.v1` only (not `myrefcode` — GitLab #85).
 */
import { expect, test } from "@playwright/test";
import { detectLaunchState } from "./launchState";

test("timecurve path can carry a referral segment (not arena/protocol)", async ({ page }) => {
  const state = await detectLaunchState(page);
  test.skip(state === "countdown", "Build is locked behind LaunchCountdownPage.");

  await page.goto("/arena/abc12");
  await expect(page).toHaveURL(/\/timecurve\/abc12/);
  const pending = await page.evaluate(() => {
    return window.localStorage.getItem("yieldomega.ref.v1");
  });
  expect(pending).toBeTruthy();
  const p = JSON.parse(pending!);
  expect(p.code).toBe("abc12");
});

test("?ref= capture works on unknown path inside RootLayout", async ({ page }) => {
  const state = await detectLaunchState(page);
  test.skip(state === "countdown", "Build is locked behind LaunchCountdownPage.");

  await page.goto("/definitely-not-a-route?ref=test1");
  await expect(page.getByTestId("not-found-page")).toBeVisible();
  const pending = await page.evaluate(() => window.localStorage.getItem("yieldomega.ref.v1"));
  expect(JSON.parse(pending!).code).toBe("test1");
});

test("timecurve path locks referral without wallet (test1)", async ({ page }) => {
  const state = await detectLaunchState(page);
  test.skip(state === "countdown", "Build is locked behind LaunchCountdownPage.");

  await page.goto("/arena/test1");
  await expect(page).toHaveURL(/\/timecurve\/test1/);
  const pending = await page.evaluate(() => window.localStorage.getItem("yieldomega.ref.v1"));
  expect(JSON.parse(pending!).code).toBe("test1");
});
