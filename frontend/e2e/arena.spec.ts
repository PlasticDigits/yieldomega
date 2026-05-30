// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test, type Page } from "@playwright/test";
import { detectLaunchState } from "./launchState";

/**
 * Issue #40 / #256: `/arena` is the simple, first-run path. AUDIT (protocol)
 * lives behind the sub-nav.
 */
async function ensurePostLaunch(page: Page) {
  const state = await detectLaunchState(page);
  test.skip(
    state === "countdown",
    "Build is locked behind LaunchCountdownPage; rebuild with a past or unset VITE_LAUNCH_TIMESTAMP to exercise the simple view.",
  );
  await page.goto("/arena");
}

async function expectNoHorizontalViewportOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return Math.ceil(root.scrollWidth - window.innerWidth);
  });
  expect(overflow).toBeLessThanOrEqual(1);
}

test("arena simple view shows the first-run path (timer + buy CHARM)", async ({ page }) => {
  await ensurePostLaunch(page);
  await expect(page.locator("main.app-main")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Time Arena views" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Time left|Arena Opens In/, level: 2 }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("heading", { name: /(Buy CHARM|Redeem CHARM|Coming soon)/, level: 2 })
      .or(page.getByRole("group", { name: "Show live price in" })),
  ).toBeVisible();
});

test("arena simple view shows compact podiums without dense Audit feed sections", async ({ page }) => {
  await ensurePostLaunch(page);
  const simplePodiums = page.getByTestId("arena-simple-podiums");
  await expect(simplePodiums).toBeVisible();
  await expect(simplePodiums.getByText(/Prize podiums/i)).toBeVisible();
  await expect(page.getByTestId("arena-live-buys-activity")).toHaveCount(0);

  await page.getByRole("navigation", { name: "Time Arena views" }).getByRole("link", { name: /AUDIT/ }).click();
  await expect(page).toHaveURL(/\/arena\/protocol$/);
  await expect(page.getByTestId("arena-live-buys-activity")).toBeVisible();
  await expect(page.getByTestId("arena-protocol-donate-pools")).toBeVisible();
});

test("arena sub-nav routes to /arena/protocol (raw reads)", async ({ page }) => {
  await ensurePostLaunch(page);
  const subnav = page.getByRole("navigation", { name: "Time Arena views" });
  await subnav.getByRole("link", { name: /AUDIT/ }).click();
  await expect(page).toHaveURL(/\/arena\/protocol$/);
  await expect(page.getByRole("heading", { name: "Protocol view", level: 1 })).toBeVisible();
});

test("arena simple view stays usable on a 390×844 mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ensurePostLaunch(page);
  await expect(
    page.getByRole("heading", { name: /Time left|Arena Opens In/, level: 2 }),
  ).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Time Arena views" })).toBeVisible();
  await expectNoHorizontalViewportOverflow(page);
});

test("legacy /timecurve redirects to /arena", async ({ page }) => {
  await ensurePostLaunch(page);
  await page.goto("/timecurve");
  await expect(page).toHaveURL(/\/arena$/);
});

test("home product cards reflow without iPad Mini horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/home");
  await expect(page.locator(".home-cta-grid")).toBeVisible();
  await expectNoHorizontalViewportOverflow(page);
});
