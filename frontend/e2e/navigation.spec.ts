// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test } from "@playwright/test";
import { detectLaunchState } from "./launchState";

test("deep link from home to each surface", async ({ page }) => {
  const state = await detectLaunchState(page);
  test.skip(state === "countdown", "Build is locked behind LaunchCountdownPage.");

  const navHomeRoute = "/home";
  const nav = page.getByLabel("Primary");

  await page.goto(navHomeRoute);
  await page.getByRole("link", { name: "PLAY TIME ARENA" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto(navHomeRoute);
  await nav.getByRole("link", { name: "Referrals" }).click();
  await expect(page).toHaveURL(/\/referrals$/);

  await page.goto(navHomeRoute);
  await nav.getByRole("link", { name: "AUDIT" }).click();
  await expect(page).toHaveURL(/\/arena\/protocol$/);

  for (const path of ["/kumbaya", "/sir"] as const) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByText("Third-party venue. Verify off-site.")).toBeVisible();
    await expect(page.getByLabel("Primary").getByRole("link", { name: "AUDIT" })).toBeVisible();
  }
});

test("unknown routes show branded 404 inside RootLayout", async ({ page }) => {
  const state = await detectLaunchState(page);
  test.skip(state === "countdown", "Build is locked behind LaunchCountdownPage.");

  await page.goto("/definitely-not-a-route");
  await expect(page.getByTestId("not-found-page")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "404", level: 1 })).toBeVisible();
  await expect(page.getByText("No surface at this route.")).toBeVisible();
  await expect(page.getByLabel("Primary").getByRole("link", { name: "AUDIT" })).toBeVisible();
  await expect(page.getByLabel("Primary")).toBeVisible();
});

test("valid arena referral path does not show 404", async ({ page }) => {
  const state = await detectLaunchState(page);
  test.skip(state === "countdown", "Build is locked behind LaunchCountdownPage.");

  await page.goto("/arena/abc12");
  await expect(page).toHaveURL(/\/arena\/abc12/);
  await expect(page.getByTestId("not-found-page")).toHaveCount(0);
});

test("legacy /timecurve referral path redirects to /arena/:code", async ({ page }) => {
  const state = await detectLaunchState(page);
  test.skip(state === "countdown", "Build is locked behind LaunchCountdownPage.");

  await page.goto("/timecurve/abc12");
  await expect(page).toHaveURL(/\/arena\/abc12/);
});

test("legacy /arena root redirects to /", async ({ page }) => {
  const state = await detectLaunchState(page);
  test.skip(state === "countdown", "Build is locked behind LaunchCountdownPage.");

  await page.goto("/arena");
  await expect(page).toHaveURL(/\/$/);
});
