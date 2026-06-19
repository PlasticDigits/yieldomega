// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Anvil play-feel E2E for gap-analysis #331 visual children ([#340](https://gitlab.com/PlasticDigits/yieldomega/-/issues/340)).
 * Indexer-first scenarios require `YIELDOMEGA_E2E_INDEXER=1 bash scripts/e2e-anvil.sh`.
 */
import { expect, test } from "@playwright/test";
import { ARENA_LAST_CLOSED_AT_KEY } from "../src/lib/arenaSessionClose";
import {
  arenaBuyCharmButton,
  ARENA_E2E_TIMEOUT_MS,
  connectArenaWallet,
  gotoArena,
  gotoCarouselDot,
  setCharmSliderMin,
  waitArenaSaleLive,
  waitIndexerSessionSummaryActivity,
  warpAnvilPastBuyCooldown,
} from "./arenaE2eHelpers";

const INDEXER_E2E_TIMEOUT_MS = 60_000;

test.describe("Anvil Arena #331 play-feel visual UX", () => {
  test.skip(
    process.env.ANVIL_E2E !== "1",
    "Set ANVIL_E2E=1 and build with scripts/e2e-anvil.sh (VITE_E2E_MOCK_WALLET=1).",
  );

  test.describe.configure({ mode: "serial" });

  test("first visit omits while-you-were-away modal (#338 sad)", async ({ page }) => {
    await gotoArena(page);
    await expect(page.getByTestId("while-you-were-away-modal")).toHaveCount(0);
  });

  test("connected wallet shows prominent XP hero (#331)", async ({ page }) => {
    await gotoArena(page);
    await connectArenaWallet(page);
    await waitArenaSaleLive(page);
    await expect(page.getByTestId("arena-xp-hero")).toBeVisible({
      timeout: ARENA_E2E_TIMEOUT_MS,
    });
    await expect(page.getByTestId("arena-xp-hero-level")).toContainText(/Lv \d+/);
    await expect(page.getByTestId("arena-xp-hero-progress")).toBeVisible();
  });

  test("carousel navigation updates active dot (#334)", async ({ page }) => {
    await gotoArena(page);
    await connectArenaWallet(page);
    await waitArenaSaleLive(page);

    await expect(page.getByTestId("arena-timer-podium-carousel-dot-0")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.getByTestId("arena-timer-podium-carousel-next").click();
    await expect(page.getByTestId("arena-timer-podium-carousel-dot-1")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.getByTestId("arena-timer-podium-carousel-prev").click();
    await expect(page.getByTestId("arena-timer-podium-carousel-dot-0")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await gotoCarouselDot(page, 3);
    await expect(page.getByTestId("arena-timer-podium-carousel")).toBeVisible();
  });

  test("L1 wallet shows only the next-tier lock overlay on play (#334)", async ({ page }) => {
    await gotoArena(page);
    await connectArenaWallet(page);
    await waitArenaSaleLive(page);

    await gotoCarouselDot(page, 1);
    await expect(page.getByTestId("arena-timer-podium-lock-3")).toBeVisible({
      timeout: ARENA_E2E_TIMEOUT_MS,
    });
    await expect(page.getByTestId("arena-timer-chip-gate-1")).toBeVisible();
    await expect(page.locator('[data-locked-level="3"]')).toHaveCount(0);
    await expect(page.locator('[data-locked-level="4"]')).toHaveCount(0);
    await expect(page.locator('[data-locked-level="5"]')).toHaveCount(0);

    await gotoCarouselDot(page, 2);
    await expect(page.getByTestId("arena-timer-podium-lock-2")).toHaveCount(0);
    await expect(page.locator('[data-locked-level="3"]')).toHaveCount(0);

    await gotoCarouselDot(page, 3);
    await expect(page.locator('[data-locked-level="4"]')).toHaveCount(0);
  });

  test("L1 wallet omits WarBow lane until WarBow is the next unlock (#331 / #334 sad)", async ({
    page,
  }) => {
    await gotoArena(page);
    await connectArenaWallet(page);
    await waitArenaSaleLive(page);
    await expect(page.getByTestId("arena-command-console-warbow")).toHaveCount(0);
    await expect(page.getByTestId("warbow-hero-actions")).toHaveCount(0);
  });

  test("L1 wallet does not auto-open level-up celebration on mount (#335 sad)", async ({ page }) => {
    await gotoArena(page);
    await connectArenaWallet(page);
    await waitArenaSaleLive(page);
    await expect(page.getByTestId("level-up-celebration")).toHaveCount(0);
  });

  test.describe("indexer-first play-feel", () => {
    test.skip(
      process.env.ANVIL_E2E_INDEXER !== "1",
      "Set YIELDOMEGA_E2E_INDEXER=1 so e2e-anvil.sh starts the indexer and inlines VITE_INDEXER_URL.",
    );

    test("while-you-were-away modal and profile level history after buy (#338 / #336)", async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await gotoArena(page);
      await connectArenaWallet(page);
      await waitArenaSaleLive(page);

      const sinceMs = Date.now() - 3_600_000;
      await page.evaluate(
        ({ key, ts }) => {
          localStorage.setItem(key, String(ts));
        },
        { key: ARENA_LAST_CLOSED_AT_KEY, ts: sinceMs },
      );

      await warpAnvilPastBuyCooldown();
      await setCharmSliderMin(page);
      const buyCharm = arenaBuyCharmButton(page);
      await expect(buyCharm).toBeEnabled({ timeout: ARENA_E2E_TIMEOUT_MS });
      await buyCharm.click();
      await expect(page.getByTestId("arena-buy-effect-toast").first()).toBeVisible({
        timeout: ARENA_E2E_TIMEOUT_MS,
      });

      const profileButton = page
        .getByRole("button", { name: /Open wallet profile for 0x/i })
        .first();
      await expect(profileButton).toBeVisible({ timeout: INDEXER_E2E_TIMEOUT_MS });
      await profileButton.click();
      await expect(page.getByTestId("wallet-profile-modal")).toBeVisible({
        timeout: INDEXER_E2E_TIMEOUT_MS,
      });
      const levelHistory = page.getByTestId("wallet-profile-level-history");
      await expect(levelHistory).toBeVisible();
      await expect(levelHistory.getByRole("listitem")).toHaveCount(5);
      await page.getByRole("button", { name: /close dialog/i }).click();
      await expect(page.getByTestId("wallet-profile-modal")).toHaveCount(0);

      await waitIndexerSessionSummaryActivity(sinceMs, INDEXER_E2E_TIMEOUT_MS);

      // `pagehide` persistence overwrites lastClosedAt on reload — re-seed before navigation.
      await page.addInitScript(
        ({ key, ts }) => {
          localStorage.setItem(key, String(ts));
        },
        { key: ARENA_LAST_CLOSED_AT_KEY, ts: sinceMs },
      );
      await page.goto("/");
      await expect(page.getByTestId("arena-command-console")).toBeVisible({
        timeout: ARENA_E2E_TIMEOUT_MS,
      });
      await expect(page.getByTestId("while-you-were-away-modal")).toBeVisible({
        timeout: INDEXER_E2E_TIMEOUT_MS,
      });
      await expect(page.getByTestId("wywa-elapsed")).toBeVisible();
    });
  });
});
