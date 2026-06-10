// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test, type Page } from "@playwright/test";
import { detectLaunchState } from "./launchState";

/**
 * Issue #40 / #256: `/` is the simple, first-run play surface. AUDIT (protocol)
 * lives in the primary header nav.
 */
async function ensurePostLaunch(page: Page) {
  const state = await detectLaunchState(page);
  test.skip(
    state === "countdown",
    "Build is locked behind LaunchCountdownPage; rebuild with a past or unset VITE_LAUNCH_TIMESTAMP to exercise the simple view.",
  );
  await page.goto("/");
}

async function expectNoHorizontalViewportOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return Math.ceil(root.scrollWidth - window.innerWidth);
  });
  expect(overflow).toBeLessThanOrEqual(1);
}

test("arena command console shows the first-run path (Last Buy + buy CHARM)", async ({ page }) => {
  await ensurePostLaunch(page);
  await expect(page.locator("main.app-main")).toBeVisible();
  await expect(page.getByTestId("arena-command-console")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /You might win .* DOUB in:|Arena Opens In/, level: 2 }),
  ).toBeVisible();
  await expect(page.getByText(/Connect wallet to buy CHARM|Buy CHARM/i).first()).toBeVisible();
  await expect(page.locator(".arena-final-concept")).toHaveCount(0);
  await expect(page.getByText("Yield Omega", { exact: true })).toBeVisible();
});

test("arena simple view shows compact podiums without dense Audit feed sections", async ({ page }) => {
  await ensurePostLaunch(page);
  const simplePodiums = page.getByTestId("arena-simple-podiums");
  await expect(simplePodiums).toBeVisible();
  await expect(page.getByTestId("arena-live-buys-activity")).toHaveCount(0);

  await page.getByLabel("Primary").getByRole("link", { name: /AUDIT/ }).click();
  await expect(page).toHaveURL(/\/arena\/protocol$/);
  await expect(page.getByRole("heading", { name: "AUDIT", level: 1 })).toBeVisible();
  if (await page.getByText(/VITE_TIME_ARENA_ADDRESS is not configured/).isVisible()) {
    await expect(page.getByTestId("arena-live-buys-activity")).toHaveCount(0);
    await expect(page.getByTestId("arena-protocol-donate-pools")).toHaveCount(0);
    return;
  }
  await expect(page.getByTestId("arena-live-buys-activity")).toBeVisible();
  await expect(page.getByTestId("arena-protocol-donate-pools")).toBeVisible();
});

test("primary nav routes to /arena/protocol (raw reads)", async ({ page }) => {
  await ensurePostLaunch(page);
  await page.getByLabel("Primary").getByRole("link", { name: /AUDIT/ }).click();
  await expect(page).toHaveURL(/\/arena\/protocol$/);
  await expect(page.getByRole("heading", { name: "AUDIT", level: 1 })).toBeVisible();
});

test("arena simple view stays usable on a 390×844 mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ensurePostLaunch(page);
  await expect(
    page.getByRole("heading", { name: /You might win .* DOUB in:|Arena Opens In/, level: 2 }),
  ).toBeVisible();
  await expectNoHorizontalViewportOverflow(page);
});

test("legacy /timecurve redirects to /", async ({ page }) => {
  await ensurePostLaunch(page);
  await page.goto("/timecurve");
  await expect(page).toHaveURL(/\/$/);
});

test("legacy /timecurve/arena redirects to / (#266)", async ({ page }) => {
  await ensurePostLaunch(page);
  await page.goto("/timecurve/arena");
  await expect(page).toHaveURL(/\/$/);
});

test("legacy /timecurve/protocol redirects to /arena/protocol (#266)", async ({ page }) => {
  await ensurePostLaunch(page);
  await page.goto("/timecurve/protocol");
  await expect(page).toHaveURL(/\/arena\/protocol$/);
});

test("home product cards reflow without iPad Mini horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/home");
  await expect(page.locator(".home-cta-grid")).toBeVisible();
  await expectNoHorizontalViewportOverflow(page);
});
