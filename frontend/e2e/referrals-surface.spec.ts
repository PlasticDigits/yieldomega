// SPDX-License-Identifier: AGPL-3.0-only
/**
 * `/referrals` UI smoke and `?ref=` capture (GitLab #64 checklist rows R1, R3, R7 for CI builds).
 * Rows R4–R6 (wallet writes + clipboard) run under Anvil — see `anvil-referrals.spec.ts` via `scripts/e2e-anvil.sh`.
 */
import { expect, test } from "@playwright/test";
import { detectLaunchState } from "./launchState";

test("referrals page shell renders when not behind launch countdown", async ({ page }) => {
  const state = await detectLaunchState(page);
  test.skip(state === "countdown", "Build is locked behind LaunchCountdownPage.");

  await page.goto("/referrals");
  await expect(page.getByTestId("referrals-surface")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Referrals", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Links that count", level: 2 })).toBeVisible();

  const gated =
    page.getByText("Connect a wallet", { exact: false }).or(page.getByText(/No registry address/i));
  await expect(gated.first()).toBeVisible({ timeout: 30_000 });
});

test("query ?ref= captures pending referral on first paint (R7)", async ({ page }) => {
  const state = await detectLaunchState(page);
  test.skip(state === "countdown", "Build is locked behind LaunchCountdownPage.");

  await page.goto("/?ref=ab12cd");
  const pending = await page.evaluate(() => window.localStorage.getItem("yieldomega.ref.v1"));
  expect(pending).toBeTruthy();
  const p = JSON.parse(pending!) as { code?: string };
  expect(p.code).toBe("ab12cd");
});
