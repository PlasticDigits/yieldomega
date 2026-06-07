// SPDX-License-Identifier: AGPL-3.0-only
/**
 * `/referrals` UI smoke and `?ref=` capture (GitLab #64 checklist rows R1, R3, R7 for CI builds).
 * Rows R4–R6 (wallet writes + clipboard) run under Anvil — see `anvil-referrals.spec.ts` via `scripts/e2e-anvil.sh`.
 *
 * R7 asserts **pending** referral storage only: key `yieldomega.ref.v1` (JSON `{ code, ts }` in localStorage).
 * Post-register “my code” uses a different key prefix — see `referralStorage.ts` / [GitLab #85](https://gitlab.com/PlasticDigits/yieldomega/-/issues/85).
 */
import { expect, test } from "@playwright/test";
import { detectLaunchState } from "./launchState";

test("referrals page shell renders when not behind launch countdown", async ({ page }) => {
  const state = await detectLaunchState(page);
  test.skip(state === "countdown", "Build is locked behind LaunchCountdownPage.");

  await page.route("**/referrer-leaderboard?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            rank: 1,
            referrer: "0x0000000000000000000000000000000000000001",
            total_referrer_cred_wad: "1000000000000000000",
            referred_buy_count: "1",
            codes_registered_count: "1",
          },
        ],
        limit: 20,
        offset: 0,
        next_offset: null,
        total: 1,
        total_codes_registered: "1",
        total_referred_buys: "1",
        total_referrer_cred_wad: "1000000000000000000",
      }),
    });
  });

  await page.goto("/referrals");
  await expect(page.getByTestId("referrals-surface")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Referrals", level: 1 })).toBeVisible();
  await expect(page.getByText("CRED Network")).toBeVisible();
  await expect(page.getByText("Register. Share. Track CRED.")).toBeVisible();
  await expect(page.getByText("Flat referral CRED on referred DOUB buys.")).toBeVisible();
  await expect(page.getByText("5 + 5 CRED")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Claim your guide code", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Guide leaderboard", level: 2 })).toBeVisible();
  await expect(page.getByText("Codes", { exact: true })).toBeVisible();
  await expect(page.getByText("Guide CRED", { exact: true })).toBeVisible();
  await expect(page.getByTestId("referrals-surface")).not.toContainText(
    /\bTimeCurve path\b|\bsale\b|sale-end|redeem|redemption|launchpad|\bPvE\b/i,
  );

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
