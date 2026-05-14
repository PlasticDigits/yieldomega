// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test, type Page } from "@playwright/test";
import { detectLaunchState } from "./launchState";

/**
 * Issue #40: `/timecurve` is the simple, first-run path. Arena (PvP) and
 * Protocol (raw onchain reads) live behind the sub-nav.
 *
 * Like `launch-countdown.spec.ts`, the launch gate is decided at build time
 * via `VITE_LAUNCH_TIMESTAMP`. Skip these scenarios when the build is locked
 * behind the countdown — the post-launch view is what we are asserting.
 */
async function ensurePostLaunch(page: Page) {
  const state = await detectLaunchState(page);
  test.skip(
    state === "countdown",
    "Build is locked behind LaunchCountdownPage; rebuild with a past or unset VITE_LAUNCH_TIMESTAMP to exercise the simple view.",
  );
  await page.goto("/timecurve");
}

async function expectNoHorizontalViewportOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return Math.ceil(root.scrollWidth - window.innerWidth);
  });
  expect(overflow).toBeLessThanOrEqual(1);
}

test("timecurve simple view shows the first-run path (timer + buy CHARM)", async ({ page }) => {
  await ensurePostLaunch(page);
  await expect(page.locator("main.app-main")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "TimeCurve views" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Time left|TimeCurve Opens In/, level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /(Buy CHARM|Redeem CHARM|Coming soon)/, level: 2 }),
  ).toBeVisible();
  // Cross-page navigation to Arena / Protocol lives in the `TimeCurveSubnav`
  // at the top of the route — the redundant in-page "Want more?" tiles were
  // removed (UX feedback: the subnav is sufficient).
  await expect(page.getByRole("navigation", { name: "TimeCurve views" })).toBeVisible();
});

test("timecurve simple view shows compact podiums without dense Arena sections", async ({ page }) => {
  await ensurePostLaunch(page);
  const simplePodiums = page.getByTestId("timecurve-simple-podiums");
  const liveTicker = page.getByTestId("timecurve-simple-live-ticker");
  await expect(simplePodiums).toBeVisible();
  await expect(simplePodiums.getByRole("heading", { name: "Live reserve podiums", level: 2 })).toBeVisible();
  await expect(simplePodiums.getByRole("heading", { name: "Last Buy", level: 3 })).toBeVisible();
  await expect(simplePodiums.getByRole("heading", { name: "WarBow", level: 3 })).toBeVisible();
  await expect(simplePodiums.getByRole("heading", { name: "Defended Streak", level: 3 })).toBeVisible();
  await expect(simplePodiums.getByRole("heading", { name: "Time Booster", level: 3 })).toBeVisible();
  await expect(liveTicker).toBeVisible();
  const podiumBox = await simplePodiums.boundingBox();
  const tickerBox = await liveTicker.boundingBox();
  expect(podiumBox?.y ?? 0).toBeLessThan(tickerBox?.y ?? Number.POSITIVE_INFINITY);
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
  const sale = page.getByRole("heading", { name: /Sale state/, level: 2 });
  const noTc = page.getByRole("heading", { name: "Configuration missing", level: 2 });
  await expect(sale.or(noTc).first()).toBeVisible();
});

test("timecurve simple view stays usable on a 390×844 mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ensurePostLaunch(page);
  await expect(
    page.getByRole("heading", { name: /Time left|TimeCurve Opens In/, level: 2 }),
  ).toBeVisible();
  await expect(page.getByRole("navigation", { name: "TimeCurve views" })).toBeVisible();
  await expectNoHorizontalViewportOverflow(page);
});

test("home product cards reflow without iPad Mini horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/home");
  await expect(page.locator(".home-cta-grid")).toBeVisible();
  await expectNoHorizontalViewportOverflow(page);
});

test("timecurve Arena buy hub starts below the fixed mobile audio dock", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await ensurePostLaunch(page);
  await page.getByRole("navigation", { name: "TimeCurve views" }).getByRole("link", { name: /Arena/ }).click();
  await expect(page).toHaveURL(/\/timecurve\/arena$/);

  const buyPanel = page.locator(".timecurve-arena-buy-panel").first();
  const missingConfig = page.getByRole("heading", { name: "Configuration missing", level: 2 });
  await expect(buyPanel.or(missingConfig).first()).toBeVisible();
  test.skip(
    (await buyPanel.count()) === 0,
    "Arena buy hub requires a configured TimeCurve address; full-stack Anvil covers the rendered surface.",
  );
  await expect(buyPanel).toBeVisible();
  await expect(page.locator(".album-player-dock")).toBeVisible();

  const overlapsDock = await page.evaluate(() => {
    const dock = document.querySelector(".album-player-dock")?.getBoundingClientRect();
    const panel = document.querySelector(".timecurve-arena-buy-panel")?.getBoundingClientRect();
    if (!dock || !panel) return false;
    return dock.left < panel.right && dock.right > panel.left && dock.top < panel.bottom && dock.bottom > panel.top;
  });
  expect(overlapsDock).toBe(false);
  await expectNoHorizontalViewportOverflow(page);
});

test("timecurve Arena WarBow cards stay contained on an iPad Mini viewport", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await ensurePostLaunch(page);
  await page.getByRole("navigation", { name: "TimeCurve views" }).getByRole("link", { name: /Arena/ }).click();
  await expect(page).toHaveURL(/\/timecurve\/arena$/);

  const warbowHero = page.getByTestId("warbow-hero-actions");
  const missingConfig = page.getByRole("heading", { name: "Configuration missing", level: 2 });
  await expect(warbowHero.or(missingConfig).first()).toBeVisible();
  test.skip(
    (await warbowHero.count()) === 0,
    "WarBow hero actions require a configured TimeCurve address; full-stack Anvil covers the rendered surface.",
  );
  await expect(warbowHero).toBeVisible();
  await expect(warbowHero.getByRole("heading", { name: "Revenge", level: 3 })).toBeVisible();
  await expectNoHorizontalViewportOverflow(page);
});
