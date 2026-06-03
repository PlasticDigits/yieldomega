// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Path-based referral capture: pending key `yieldomega.ref.v1` only (not `myrefcode` — GitLab #85).
 * Legacy `/timecurve/:code` redirects to `/arena/:code` ([#266](https://gitlab.com/PlasticDigits/yieldomega/-/issues/266)).
 */
import { expect, test } from "@playwright/test";
import { detectLaunchState } from "./launchState";

test("arena path can carry a referral segment (not arena/protocol)", async ({ page }) => {
  const state = await detectLaunchState(page);
  test.skip(state === "countdown", "Build is locked behind LaunchCountdownPage.");

  await page.goto("/arena/abc12");
  await expect(page).toHaveURL(/\/arena\/abc12/);
  const pending = await page.evaluate(() => {
    return window.localStorage.getItem("yieldomega.ref.v1");
  });
  expect(pending).toBeTruthy();
  const p = JSON.parse(pending!);
  expect(p.code).toBe("abc12");
});

test("legacy /timecurve/:code redirects to /arena/:code and captures referral", async ({
  page,
}) => {
  const state = await detectLaunchState(page);
  test.skip(state === "countdown", "Build is locked behind LaunchCountdownPage.");

  await page.goto("/timecurve/abc12");
  await expect(page).toHaveURL(/\/arena\/abc12/);
  const pending = await page.evaluate(() => window.localStorage.getItem("yieldomega.ref.v1"));
  expect(pending).toBeTruthy();
  expect(JSON.parse(pending!).code).toBe("abc12");
});

test("?ref= capture works on unknown path inside RootLayout", async ({ page }) => {
  const state = await detectLaunchState(page);
  test.skip(state === "countdown", "Build is locked behind LaunchCountdownPage.");

  await page.goto("/definitely-not-a-route?ref=test1");
  await expect(page.getByTestId("not-found-page")).toBeVisible();
  const pending = await page.evaluate(() => window.localStorage.getItem("yieldomega.ref.v1"));
  expect(JSON.parse(pending!).code).toBe("test1");
});

test("legacy /timecurve/:code locks referral without wallet (test1)", async ({ page }) => {
  const state = await detectLaunchState(page);
  test.skip(state === "countdown", "Build is locked behind LaunchCountdownPage.");

  await page.goto("/timecurve/test1");
  await expect(page).toHaveURL(/\/arena\/test1/);
  const pending = await page.evaluate(() => window.localStorage.getItem("yieldomega.ref.v1"));
  expect(JSON.parse(pending!).code).toBe("test1");
});
