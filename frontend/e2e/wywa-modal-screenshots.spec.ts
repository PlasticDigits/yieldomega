// SPDX-License-Identifier: AGPL-3.0-only

import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "../../docs/testing/screenshots/issue-338");

const MOCK_WALLET = "0xf39Fd6e51aad88F6F4ce6bB8827279cffFb92263";

const summary = {
  since_ms: String(Date.now() - 3_600_000),
  elapsed_ms: "3600000",
  total_buys: "12",
  unique_players: "4",
  podium_updates: "1",
  podium_epochs_ended: [
    {
      podium: "last_buy",
      category: 0,
      epoch: "3",
      pool_paid_doub_wad: "700000000000000000000",
      winners: [
        {
          rank: 1,
          address: MOCK_WALLET,
          prize_doub_wad: "400000000000000000000",
        },
        {
          rank: 2,
          address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          prize_doub_wad: "200000000000000000000",
        },
        {
          rank: 3,
          address: "0xcccccccccccccccccccccccccccccccccccccccc",
          prize_doub_wad: "100000000000000000000",
        },
      ],
    },
  ],
  wallet_summary: {
    address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    buy_count: "2",
    wins: "1",
    rank_at_since: "5",
    rank_now: "3",
    rank_delta: "2",
  },
};

async function mockArenaReads(page: import("@playwright/test").Page) {
  await page.route("**/v1/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.route("**/v1/arena/timers", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "x-schema-version": "2.18.0" },
      body: JSON.stringify({
        read_block_number: "100",
        block_timestamp_sec: String(Math.floor(Date.now() / 1000)),
        last_buy_deadline_sec: String(Math.floor(Date.now() / 1000) + 3600),
        arena_start_sec: String(Math.floor(Date.now() / 1000) - 3600),
        paused: false,
        total_doub_raised: "0",
        charm_price_wad: "1000000000000000000000",
        doub: "0x0000000000000000000000000000000000000001",
        referral_registry: "0xdddddddddddddddddddddddddddddddddddddddd",
        timer_extension_sec: "120",
        timer_cap_sec: "86400",
        buy_charge_interval_sec: "60",
        max_buy_charges: "1",
        burst_buy_cooldown_sec: "60",
        buy_cooldown_sec: "60",
        time_arena_buy_router: "0x0000000000000000000000000000000000000002",
        referral_cred_flat_wad: "5000000000000000000",
        podium_deadlines_sec: ["0", "0", "0", "0"],
        podium_epochs: ["1", "1", "1", "1"],
        podium_timer_armed: [true, true, true, true],
        last_buy_epoch: "1",
      }),
    });
  });
  await page.route("**/v1/arena/podiums", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "x-schema-version": "2.18.0" },
      body: JSON.stringify({ items: [] }),
    });
  });
  await page.route("**/v1/arena/buys**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [], limit: 20, offset: 0, next_offset: null }),
    });
  });
  await page.route("**/v1/arena/warbow/latest-bp**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [] }),
    });
  });
  await page.route("**/v1/arena/wallet/**/stats", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        address: MOCK_WALLET,
        buy_count: 0,
        level: "1",
        xp: "0",
        prizes_won: [],
        total_won_doub: "0",
        highest_scores: [],
        warbow_steals: 0,
        warbow_guards: 0,
        cred_claimed: "0",
        referral_cred_earned: "0",
        longest_defended_streak: "0",
        podium_win_rate: "0",
        rank_distribution: { "1": "0", "2": "0", "3": "0" },
      }),
    });
  });
}

async function mockSessionSummary(page: import("@playwright/test").Page) {
  await mockArenaReads(page);
  await page.route("**/v1/arena/session-summary**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "x-schema-version": "2.18.0" },
      body: JSON.stringify(summary),
    });
  });
  await page.addInitScript(() => {
    localStorage.setItem(
      "yieldomega.arena.lastClosedAt.v1",
      String(Date.now() - 3_600_000),
    );
  });
}

test.describe("While You Were Away modal screenshots (#338)", () => {
  test.beforeAll(() => {
    mkdirSync(outDir, { recursive: true });
  });

  test("desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockSessionSummary(page);
    await page.goto("/");
    await expect(page.getByTestId("while-you-were-away-modal")).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: resolve(outDir, "desktop.png"), fullPage: false });
  });

  test("tablet", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await mockSessionSummary(page);
    await page.goto("/");
    await expect(page.getByTestId("while-you-were-away-modal")).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: resolve(outDir, "tablet.png"), fullPage: false });
  });

  test("mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockSessionSummary(page);
    await page.goto("/");
    await expect(page.getByTestId("while-you-were-away-modal")).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: resolve(outDir, "mobile.png"), fullPage: false });
  });
});
