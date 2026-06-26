// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Anvil transition E2E: podium epoch roll, leaderboard refresh, claim state ([#350](https://gitlab.com/PlasticDigits/yieldomega/-/issues/350)).
 * Requires `YIELDOMEGA_E2E_INDEXER=1 bash scripts/e2e-anvil.sh`.
 */
import { expect, test } from "@playwright/test";
import {
  ARENA_E2E_TIMEOUT_MS,
  buyCharmViaCast,
  connectArenaWallet,
  dismissLevelUpCelebrationIfPresent,
  ensureArenaLevelTwoViaCast,
  gotoArena,
  gotoCarouselDot,
  rollPodiumEpochOnchain,
  waitArenaSaleLive,
  waitIndexerCaughtUp,
  waitIndexerPodiumUxEpoch,
  warpAnvilIntoLastBuyHardResetBand,
  warpAnvilPastPodiumDeadline,
} from "./arenaE2eHelpers";

const INDEXER_E2E_TIMEOUT_MS = 90_000;
/** Time Booster onchain category index (carousel slide 1). */
const TIME_BOOSTER_CONTRACT_INDEX = 1;
/** Time Booster UX row on GET /v1/arena/podiums (Last Buy · WarBow · Defended · Booster). */
const TIME_BOOSTER_UX_ROW = 3;

test.describe("Anvil Arena #342 transition E2E", () => {
  test.skip(
    process.env.ANVIL_E2E !== "1",
    "Set ANVIL_E2E=1 and build with scripts/e2e-anvil.sh.",
  );
  test.skip(
    process.env.ANVIL_E2E_INDEXER !== "1",
    "Set YIELDOMEGA_E2E_INDEXER=1 so e2e-anvil.sh starts the indexer and inlines VITE_INDEXER_URL.",
  );

  test.describe.configure({ mode: "serial" });

  test("podium roll, leaderboard refresh, and claim-ready after Last Buy epoch end", async ({
    page,
  }) => {
    test.setTimeout(240_000);

    await ensureArenaLevelTwoViaCast();
    await gotoArena(page);
    await connectArenaWallet(page);
    await waitArenaSaleLive(page);
    await dismissLevelUpCelebrationIfPresent(page);

    const claimButton = page.getByTestId("arena-charm-cred-claim");
    await expect(page.getByTestId("arena-charm-cred-card")).toBeVisible({
      timeout: INDEXER_E2E_TIMEOUT_MS,
    });
    await expect(claimButton).toBeDisabled({ timeout: ARENA_E2E_TIMEOUT_MS });
    await expect(claimButton).toHaveAttribute(
      "title",
      "Claim opens after the first Last Buy epoch ends.",
    );

    await gotoCarouselDot(page, 1);
    const epochCorner = page.getByTestId("arena-timer-panel-epoch-corner");
    await expect(epochCorner).toContainText(/Time Booster/i, {
      timeout: INDEXER_E2E_TIMEOUT_MS,
    });
    const epochBefore = await epochCorner.innerText();
    expect(epochBefore).toMatch(/EPOCH 0/);

    const leaderboard = page.getByTestId("arena-last-buy-podium-leaderboard");
    await buyCharmViaCast();
    await waitIndexerCaughtUp(INDEXER_E2E_TIMEOUT_MS);
    await expect(leaderboard.getByTestId("arena-last-buy-podium-1")).toBeVisible({
      timeout: INDEXER_E2E_TIMEOUT_MS,
    });

    await warpAnvilPastPodiumDeadline(TIME_BOOSTER_CONTRACT_INDEX);
    await waitIndexerCaughtUp(INDEXER_E2E_TIMEOUT_MS);
    await page.reload();
    await expect(page.getByTestId("arena-command-console")).toBeVisible({
      timeout: ARENA_E2E_TIMEOUT_MS,
    });
    await connectArenaWallet(page);
    await dismissLevelUpCelebrationIfPresent(page);
    await gotoCarouselDot(page, 1);
    const expiredOrSettling = page.locator(
      '[data-testid="arena-timer-expired-pending-roll"], [data-testid="arena-timer-settling"]',
    );
    await expect(expiredOrSettling.first()).toBeVisible({
      timeout: INDEXER_E2E_TIMEOUT_MS,
    });
    await expect(page.getByTestId("arena-timer-transition-foot")).toContainText(
      /Waiting for settlement/i,
    );
    await expect(page.getByTestId("arena-podium-roll-cta")).toBeVisible({
      timeout: INDEXER_E2E_TIMEOUT_MS,
    });

    rollPodiumEpochOnchain(TIME_BOOSTER_CONTRACT_INDEX);
    await waitIndexerCaughtUp(INDEXER_E2E_TIMEOUT_MS);
    await waitIndexerPodiumUxEpoch(TIME_BOOSTER_UX_ROW, 1, INDEXER_E2E_TIMEOUT_MS);
    await page.reload();
    await expect(page.getByTestId("arena-command-console")).toBeVisible({
      timeout: ARENA_E2E_TIMEOUT_MS,
    });
    await connectArenaWallet(page);
    await dismissLevelUpCelebrationIfPresent(page);
    await gotoCarouselDot(page, 1);

    await expect(epochCorner).toContainText(/EPOCH 1/, { timeout: INDEXER_E2E_TIMEOUT_MS });
    await expect(epochCorner).not.toContainText(/EPOCH 0/);

    await expect
      .poll(
        async () => {
          const res = await fetch(
            `${process.env.VITE_INDEXER_URL ?? "http://127.0.0.1:3100"}/v1/arena/podiums`,
          );
          if (!res.ok) return "";
          const body = (await res.json()) as { rows?: Array<{ winners?: string[] }> };
          return body.rows?.[TIME_BOOSTER_UX_ROW]?.winners?.[0] ?? "";
        },
        { timeout: INDEXER_E2E_TIMEOUT_MS },
      )
      .toBe("0x0000000000000000000000000000000000000000");

    await gotoCarouselDot(page, 0);

    await warpAnvilIntoLastBuyHardResetBand();
    await buyCharmViaCast();
    await waitIndexerCaughtUp(INDEXER_E2E_TIMEOUT_MS);
    await page.reload();
    await expect(page.getByTestId("arena-command-console")).toBeVisible({
      timeout: ARENA_E2E_TIMEOUT_MS,
    });
    await connectArenaWallet(page);
    await dismissLevelUpCelebrationIfPresent(page);
    await gotoCarouselDot(page, 0);

    const lastBuyEpochCorner = page.getByTestId("arena-timer-panel-epoch-corner");
    await expect(lastBuyEpochCorner).toContainText(/Last Buy/i, {
      timeout: INDEXER_E2E_TIMEOUT_MS,
    });
    await expect(lastBuyEpochCorner).toContainText(/EPOCH 1/, {
      timeout: INDEXER_E2E_TIMEOUT_MS,
    });

    await expect
      .poll(
        async () => {
          const res = await fetch(
            `${process.env.VITE_INDEXER_URL ?? "http://127.0.0.1:3100"}/v1/arena/wallet/${"0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266".toLowerCase()}/stats`,
          );
          if (!res.ok) return "0";
          const body = (await res.json()) as { claimable_cred?: string };
          return body.claimable_cred ?? "0";
        },
        { timeout: INDEXER_E2E_TIMEOUT_MS },
      )
      .not.toBe("0");

    await expect(claimButton).toBeEnabled({ timeout: INDEXER_E2E_TIMEOUT_MS });
  });
});
