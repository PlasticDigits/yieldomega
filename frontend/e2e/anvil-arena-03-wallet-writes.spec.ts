// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test } from "@playwright/test";
import {
  arenaBuyCharmButton,
  arenaBuyPanel,
  connectArenaWallet,
  gotoArena,
  selectPayWith,
  setCharmSliderMin,
  warpAnvilPastBuyCooldown,
  ARENA_E2E_TIMEOUT_MS,
  waitArenaSaleLive,
} from "./arenaE2eHelpers";

test.describe("Anvil Arena wallet writes", () => {
  test.skip(
    process.env.ANVIL_E2E !== "1",
    "Set ANVIL_E2E=1 and build with scripts/e2e-anvil.sh (VITE_E2E_MOCK_WALLET=1).",
  );

  test.describe.configure({ mode: "serial" });

  test("DOUB spend sizes CHARM preview on /arena", async ({ page }) => {
    await gotoArena(page);
    await expect(page.getByText("Loading contract reads…")).toBeHidden({
      timeout: ARENA_E2E_TIMEOUT_MS,
    });
    await connectArenaWallet(page);
    await waitArenaSaleLive(page);

    const buyPanel = arenaBuyPanel(page);
    await expect(arenaBuyCharmButton(page)).toBeVisible({ timeout: ARENA_E2E_TIMEOUT_MS });
    await setCharmSliderMin(page);
  });

  test("ETH pay via TimeArena buy router (single-tx buyViaKumbaya)", async ({ page }) => {
    test.skip(
      !process.env.VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER &&
        !process.env.VITE_KUMBAYA_TIMECURVE_BUY_ROUTER,
      "TimeArena buy router not deployed — set VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER after Kumbaya fixtures.",
    );
    test.setTimeout(60_000);
    await gotoArena(page);
    await connectArenaWallet(page);
    await waitArenaSaleLive(page);
    await selectPayWith(page, "eth");
    const buyPanel = arenaBuyPanel(page);
    const ethSpendInput = buyPanel.getByLabel(/Exact ETH spend/);
    await expect(ethSpendInput).toBeVisible({ timeout: ARENA_E2E_TIMEOUT_MS });
    await expect(buyPanel.getByText("Could not quote this route")).toHaveCount(0);
    await setCharmSliderMin(page);
    const buyCharm = arenaBuyCharmButton(page);
    await buyCharm.click();
    await expect(buyPanel.locator(".error-text")).toHaveCount(0, {
      timeout: ARENA_E2E_TIMEOUT_MS,
    });
  });

  test("DOUB buy shows post-buy result share popover on /", async ({ page }) => {
    await gotoArena(page);
    await expect(page.getByText("Loading contract reads…")).toBeHidden({
      timeout: ARENA_E2E_TIMEOUT_MS,
    });
    await connectArenaWallet(page);
    await waitArenaSaleLive(page);

    const buyPanel = arenaBuyPanel(page);
    await expect(arenaBuyCharmButton(page)).toBeVisible({ timeout: ARENA_E2E_TIMEOUT_MS });
    await warpAnvilPastBuyCooldown();
    await setCharmSliderMin(page);
    const buyCharm = arenaBuyCharmButton(page);
    await expect(buyCharm).toBeEnabled({ timeout: ARENA_E2E_TIMEOUT_MS });
    await buyCharm.click();
    await expect(buyPanel.locator(".error-text")).toHaveCount(0, {
      timeout: ARENA_E2E_TIMEOUT_MS,
    });
    await expect(page.getByTestId("arena-buy-result-share-popover")).toBeVisible({
      timeout: ARENA_E2E_TIMEOUT_MS,
    });
    await page.getByTestId("arena-buy-result-share-close").click();
    await expect(page.getByTestId("arena-buy-result-share-popover")).toHaveCount(0);
  });
});
