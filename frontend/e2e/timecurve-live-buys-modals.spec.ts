// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Exercises TimeCurve live buys + modals. Requires `playwright.timecurve-ui.config.ts`
 * (Vite dev with VITE_INDEXER_URL so the app polls the indexer; requests are mocked).
 */
import { expect, test } from "@playwright/test";

const mockBuy = {
  block_number: "42",
  block_hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  contract_address: "0xcccccccccccccccccccccccccccccccccccccccc",
  tx_hash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  log_index: 0,
  block_timestamp: "1700000000",
  buyer: "0xdddddddddddddddddddddddddddddddddddddddd",
  amount: "1000000000000000000",
  charm_wad: "1000000000000000000",
  price_per_charm_wad: "1000000000000000000",
  new_deadline: "2000000000",
  total_raised_after: "5000000000000000000",
  buy_index: "1",
  actual_seconds_added: "120",
  timer_hard_reset: false,
  battle_points_after: "100",
  bp_base_buy: "0",
  bp_timer_reset_bonus: "0",
  bp_clutch_bonus: "0",
  bp_streak_break_bonus: "0",
  bp_ambush_bonus: "0",
  bp_flag_penalty: "0",
  flag_planted: false,
  buyer_total_effective_timer_sec: "3600",
  buyer_active_defended_streak: "0",
  buyer_best_defended_streak: "0",
};

test.beforeEach(async ({ page }) => {
  await page.route("**/v1/timecurve/buys**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [mockBuy],
        limit: 25,
        offset: 0,
        next_offset: null,
      }),
    });
  });
});

test("live buys strip, More list modal, and buy detail modal stack", async ({ page }) => {
  await page.goto("/timecurve");

  await expect(page.getByLabel("Latest buys from indexer")).toBeVisible();
  await expect(page.getByRole("button", { name: "More" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "More" }).click();
  const listDialog = page.getByRole("dialog", { name: "All indexed buys" });
  await expect(listDialog).toBeVisible();

  await listDialog.locator(".live-buy-row__hit").first().click();
  const detail = page.getByRole("dialog", { name: "Buy details" });
  await expect(detail).toBeVisible();
  await expect(detail.getByText("Buy event", { exact: true })).toBeVisible();
  await expect(detail.getByText("Indexer fields", { exact: true })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Buy details" })).toBeHidden();
  await expect(listDialog).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(listDialog).toBeHidden();
});

test("side strip opens buy detail without opening list first", async ({ page }) => {
  await page.goto("/timecurve");
  await expect(page.getByRole("button", { name: /View details for buy by/ })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: /View details for buy by/ }).first().click();
  await expect(page.getByRole("dialog", { name: "Buy details" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "All indexed buys" })).toHaveCount(0);
});
