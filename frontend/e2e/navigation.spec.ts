// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test } from "@playwright/test";
import { detectLaunchState } from "./launchState";

test("deep link from home to each surface", async ({ page }) => {
  const state = await detectLaunchState(page);
  test.skip(state === "countdown", "Build is locked behind LaunchCountdownPage.");

  // Post-launch builds route HomePage to `/home`; no-env builds keep it at `/`.
  // Either way, the `Primary` nav (header) carries the deep-link surface entries.
  const navHomeRoute = state === "post-launch" ? "/home" : "/";
  const nav = page.getByLabel("Primary");

  await page.goto(navHomeRoute);
  await nav.getByRole("link", { name: "TimeCurve" }).click();
  await expect(page).toHaveURL(/\/timecurve$/);

  await page.goto(navHomeRoute);
  await nav.getByRole("link", { name: "Rabbit Treasury" }).click();
  await expect(page).toHaveURL(/\/rabbit-treasury$/);

  await page.goto(navHomeRoute);
  await nav.getByRole("link", { name: "Collection" }).click();
  await expect(page).toHaveURL(/\/collection$/);

  await page.goto(navHomeRoute);
  await nav.getByRole("link", { name: "Referrals" }).click();
  await expect(page).toHaveURL(/\/referrals$/);

  await page.goto(navHomeRoute);
  await nav.getByRole("link", { name: "Kumbaya" }).click();
  await expect(page).toHaveURL(/\/kumbaya$/);

  await page.goto(navHomeRoute);
  await nav.getByRole("link", { name: "Sir" }).click();
  await expect(page).toHaveURL(/\/sir$/);
});
