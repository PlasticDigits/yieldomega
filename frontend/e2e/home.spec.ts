// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test } from "@playwright/test";
import { detectLaunchState } from "./launchState";

test("home shows title and nav links", async ({ page }) => {
  const state = await detectLaunchState(page);
  test.skip(state === "countdown", "Build is locked behind LaunchCountdownPage.");

  if (state === "post-launch") {
    await page.goto("/home");
  }
  await expect(page.getByRole("heading", { name: "Yield Omega", level: 1 })).toBeVisible();
  await expect(
    page.getByLabel("Primary").getByRole("link", { name: "Time Arena" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "PLAY TIME ARENA" })).toBeVisible();
  await expect(page.getByRole("link", { name: "AUDIT", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Arena AUDIT/i })).toBeVisible();
  await expect(page.getByText("Buy CHARM. Move timers. Take the podium.")).toBeVisible();
  await expect(page.getByText("WARBOW")).toBeVisible();

  const visibleCopy = await page.locator("body").innerText();
  expect(visibleCopy).not.toMatch(/\bTimeCurve\b|sale-end|redeem|redemption|launchpad|worldbuilding|\bPvE\b/i);
});
