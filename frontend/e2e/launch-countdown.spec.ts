// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test } from "@playwright/test";
import { detectLaunchState } from "./launchState";

/**
 * The launch gate is decided at build time via `VITE_LAUNCH_TIMESTAMP` (Vite inlines `import.meta.env`).
 * To exercise both states without a second Playwright project, this spec inspects the live page once and
 * branches into the assertions that match the current build:
 *
 * - Build with no `VITE_LAUNCH_TIMESTAMP` (default `.env.example`): root renders `HomePage`; `/home` is the same hub (GitLab #199).
 * - Build with `VITE_LAUNCH_TIMESTAMP` in the future: every route locks behind the countdown screen.
 * - Build with `VITE_LAUNCH_TIMESTAMP` in the past: root renders Time Arena, `/home` renders HomePage.
 */

test("countdown gate locks every route when VITE_LAUNCH_TIMESTAMP is in the future", async ({ page }) => {
  const state = await detectLaunchState(page);
  test.skip(state !== "countdown", `Build state is "${state}"; this scenario requires a future launch timestamp.`);

  const countdown = page.getByTestId("launch-countdown");
  await expect(countdown).toBeVisible();
  await expect(countdown.getByText("Time Arena opens in")).toBeVisible();
  await expect(countdown.getByText("PvP console gate. Prepare to play.")).toBeVisible();
  await expect(countdown.getByText("PLAY")).toBeVisible();
  await expect(countdown.getByText("PVP")).toBeVisible();
  await expect(countdown).not.toContainText(/DOUB launches|goes live|TimeCurve|\bsale\b|launchpad|worldbuilding|\bPvE\b/i);
  await expect(page.locator(".app-header")).toHaveCount(0);
  await expect(page.locator(".app-footer")).toHaveCount(0);
  await expect(page.getByLabel("Primary")).toHaveCount(0);

  await page.goto("/arena");
  await expect(page.getByTestId("launch-countdown")).toBeVisible();
  await expect(page.locator(".app-header")).toHaveCount(0);

  await page.goto("/home");
  await expect(page.getByTestId("launch-countdown")).toBeVisible();
});

test("post-launch routing serves Time Arena at / and HomePage at /home", async ({ page }) => {
  const state = await detectLaunchState(page);
  test.skip(state !== "post-launch", `Build state is "${state}"; this scenario requires a past launch timestamp.`);

  await expect(page.getByLabel("Primary")).toBeVisible();
  await expect(page.getByTestId("launch-countdown")).toHaveCount(0);

  await page.goto("/home");
  await expect(
    page.getByRole("heading", { name: "Yield Omega", level: 1 }),
  ).toBeVisible();
});

test("no-env routing keeps HomePage at / and the primary nav visible", async ({ page }) => {
  const state = await detectLaunchState(page);
  test.skip(state !== "no-env", `Build state is "${state}"; this scenario requires no VITE_LAUNCH_TIMESTAMP.`);

  await expect(
    page.getByRole("heading", { name: "Yield Omega", level: 1 }),
  ).toBeVisible();
  await expect(page.getByLabel("Primary")).toBeVisible();
  await expect(page.getByTestId("launch-countdown")).toHaveCount(0);

  await page.goto("/home");
  await expect(
    page.getByRole("heading", { name: "Yield Omega", level: 1 }),
  ).toBeVisible();
});
