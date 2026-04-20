// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test } from "@playwright/test";

/**
 * The launch gate is decided at build time via `VITE_LAUNCH_TIMESTAMP` (Vite inlines `import.meta.env`).
 * To exercise both states without a second Playwright project, this spec inspects the live page once and
 * branches into the assertions that match the current build:
 *
 * - Build with no `VITE_LAUNCH_TIMESTAMP` (default `.env.example`): root renders `HomePage`, no `/home` route.
 * - Build with `VITE_LAUNCH_TIMESTAMP` in the future: every route locks behind the countdown screen.
 * - Build with `VITE_LAUNCH_TIMESTAMP` in the past: root renders TimeCurve, `/home` renders HomePage.
 */

async function detectLaunchState(page: import("@playwright/test").Page) {
  await page.goto("/");
  const countdown = page.getByTestId("launch-countdown");
  if (await countdown.isVisible().catch(() => false)) return "countdown" as const;

  const heading = await page
    .getByRole("heading", { level: 1 })
    .first()
    .textContent()
    .catch(() => null);
  if (heading && /timecurve/i.test(heading)) return "post-launch" as const;
  return "no-env" as const;
}

test("countdown gate locks every route when VITE_LAUNCH_TIMESTAMP is in the future", async ({ page }) => {
  const state = await detectLaunchState(page);
  test.skip(state !== "countdown", `Build state is "${state}"; this scenario requires a future launch timestamp.`);

  const countdown = page.getByTestId("launch-countdown");
  await expect(countdown).toBeVisible();
  await expect(page.locator(".app-header")).toHaveCount(0);
  await expect(page.locator(".app-footer")).toHaveCount(0);
  await expect(page.getByLabel("Primary")).toHaveCount(0);

  await page.goto("/timecurve");
  await expect(page.getByTestId("launch-countdown")).toBeVisible();
  await expect(page.locator(".app-header")).toHaveCount(0);

  await page.goto("/home");
  await expect(page.getByTestId("launch-countdown")).toBeVisible();
});

test("post-launch routing serves TimeCurve at / and HomePage at /home", async ({ page }) => {
  const state = await detectLaunchState(page);
  test.skip(state !== "post-launch", `Build state is "${state}"; this scenario requires a past launch timestamp.`);

  await expect(page.getByLabel("Primary")).toBeVisible();
  await expect(page.getByTestId("launch-countdown")).toHaveCount(0);

  await page.goto("/home");
  await expect(
    page.getByRole("heading", { name: "YieldOmega", level: 1 }),
  ).toBeVisible();
});

test("no-env routing keeps HomePage at / and the primary nav visible", async ({ page }) => {
  const state = await detectLaunchState(page);
  test.skip(state !== "no-env", `Build state is "${state}"; this scenario requires no VITE_LAUNCH_TIMESTAMP.`);

  await expect(
    page.getByRole("heading", { name: "YieldOmega", level: 1 }),
  ).toBeVisible();
  await expect(page.getByLabel("Primary")).toBeVisible();
  await expect(page.getByTestId("launch-countdown")).toHaveCount(0);
});
