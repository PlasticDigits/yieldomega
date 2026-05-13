// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test } from "@playwright/test";
import { detectLaunchState } from "./launchState";

test("deep link from home to each surface", async ({ page }) => {
  const state = await detectLaunchState(page);
  test.skip(state === "countdown", "Build is locked behind LaunchCountdownPage.");

  // Post-launch builds route HomePage to `/home`; no-env builds keep it at `/`.
  // Primary nav currently exposes TimeCurve + Referrals; other surfaces stay routable by URL.
  const navHomeRoute = state === "post-launch" ? "/home" : "/";
  const nav = page.getByLabel("Primary");

  await page.goto(navHomeRoute);
  await nav.getByRole("link", { name: "TimeCurve" }).click();
  await expect(page).toHaveURL(/\/timecurve$/);

  await page.goto(navHomeRoute);
  await nav.getByRole("link", { name: "Referrals" }).click();
  await expect(page).toHaveURL(/\/referrals$/);

  for (const path of ["/rabbit-treasury", "/collection", "/kumbaya", "/sir"] as const) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  }
});
