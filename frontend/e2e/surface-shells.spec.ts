// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test } from "@playwright/test";
import { detectLaunchState } from "./launchState";

test("placeholder and third-party routes use the shared branded shell", async ({ page }) => {
  const state = await detectLaunchState(page);
  test.skip(state === "countdown", "Build is locked behind LaunchCountdownPage.");

  await page.goto("/kumbaya");
  await expect(page.getByRole("heading", { name: "Kumbaya", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Venue Snapshot", level: 2 })).toBeVisible();
  await expect(page.getByText("Third-party venue. Verify off-site.")).toBeVisible();
  await expect(page.getByText(/Set VITE_KUMBAYA_DEX_URL at build time to add the outbound venue link./i)).toHaveCount(1);
  await expect(page.getByText(/canonical DOUB arena surface/i)).toBeVisible();
  const venue = page.getByTestId("third-party-dex-kumbaya");
  await expect(venue.getByRole("link", { name: "Time Arena" }).first()).toBeVisible();
  await expect(page.getByLabel("Primary").getByRole("link", { name: "AUDIT" })).toBeVisible();
});
