// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test, type Page } from "@playwright/test";

/**
 * Issue #40: `/timecurve` is the simple, first-run path. Arena (PvP) and
 * Protocol (raw onchain reads) live behind the sub-nav.
 *
 * Like `launch-countdown.spec.ts`, the launch gate is decided at build time
 * via `VITE_LAUNCH_TIMESTAMP`. Skip these scenarios when the build is locked
 * behind the countdown — the post-launch view is what we are asserting.
 */
async function ensurePostLaunch(page: Page) {
  await page.goto("/timecurve");
  const countdownVisible = await page
    .getByTestId("launch-countdown")
    .isVisible()
    .catch(() => false);
  test.skip(
    countdownVisible,
    "Build is locked behind LaunchCountdownPage; rebuild with a past or unset VITE_LAUNCH_TIMESTAMP to exercise the simple view.",
  );
}

test("timecurve simple view shows the first-run path (timer + buy CHARM)", async ({ page }) => {
  await ensurePostLaunch(page);
  await expect(page.locator("main.app-main")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "TimeCurve views" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "TimeCurve sale", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Time left", level: 2 })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /(Buy CHARM|Redeem CHARM|Coming soon)/, level: 2 }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Want more?", level: 2 })).toBeVisible();
});

test("timecurve simple view does NOT show the dense PvP / podiums sections above the fold", async ({ page }) => {
  await ensurePostLaunch(page);
  await expect(page.getByRole("heading", { name: "WarBow moves and rivalry", level: 2 })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Podiums and prizes", level: 2 })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Live battle feed", level: 2 })).toHaveCount(0);
});

test("timecurve sub-nav routes to /timecurve/arena (PvP)", async ({ page }) => {
  await ensurePostLaunch(page);
  const subnav = page.getByRole("navigation", { name: "TimeCurve views" });
  await subnav.getByRole("link", { name: /Arena/ }).click();
  await expect(page).toHaveURL(/\/timecurve\/arena$/);
  await expect(page.getByRole("heading", { name: /TimeCurve · Arena/, level: 1 })).toBeVisible();
});

test("timecurve sub-nav routes to /timecurve/protocol (raw reads)", async ({ page }) => {
  await ensurePostLaunch(page);
  const subnav = page.getByRole("navigation", { name: "TimeCurve views" });
  await subnav.getByRole("link", { name: /Protocol/ }).click();
  await expect(page).toHaveURL(/\/timecurve\/protocol$/);
  await expect(page.getByRole("heading", { name: "Protocol view", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Sale state/, level: 2 })).toBeVisible();
});

test("timecurve simple view stays usable on a 390×844 mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ensurePostLaunch(page);
  await expect(page.getByRole("heading", { name: "TimeCurve sale", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Time left", level: 2 })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "TimeCurve views" })).toBeVisible();
});
