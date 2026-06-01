// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test } from "@playwright/test";
import {
  arenaBuyPanel,
  connectArenaWallet,
  gotoArena,
  selectPayWith,
  setCharmSliderMin,
  ARENA_E2E_TIMEOUT_MS,
  waitArenaSaleLive,
} from "./arenaE2eHelpers";

test.describe("Anvil Arena wallet writes", () => {
  test.skip(
    process.env.ANVIL_E2E !== "1",
    "Set ANVIL_E2E=1 and build with scripts/e2e-anvil.sh (VITE_E2E_MOCK_WALLET=1).",
  );

  test.describe.configure({ mode: "serial" });

  test("DOUB approve and buy on /arena", async ({ page }) => {
    await gotoArena(page);
    await expect(page.getByText("Loading contract reads…")).toBeHidden({
      timeout: ARENA_E2E_TIMEOUT_MS,
    });
    await connectArenaWallet(page);
    await waitArenaSaleLive(page);

    const buyPanel = arenaBuyPanel(page);
    const buyCharm = buyPanel.getByRole("button", { name: /^Buy .+ CHARM$/i });
    await expect(buyCharm).toBeVisible({ timeout: 60_000 });
    await setCharmSliderMin(page);
    await expect(buyCharm).toBeEnabled({ timeout: ARENA_E2E_TIMEOUT_MS });
    await buyCharm.click();
    await expect(buyPanel.locator(".error-text")).toHaveCount(0, {
      timeout: ARENA_E2E_TIMEOUT_MS,
    });
  });

  test("ETH pay via TimeArena buy router (single-tx buyViaKumbaya)", async ({ page }) => {
    test.skip(
      !process.env.VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER &&
        !process.env.VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER,
      "TimeArena buy router not deployed — set VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER after Kumbaya fixtures.",
    );
    await gotoArena(page);
    await connectArenaWallet(page);
    await waitArenaSaleLive(page);
    await selectPayWith(page, "eth");
    const buyPanel = arenaBuyPanel(page);
    const ethSpendInput = buyPanel.getByLabel(/Exact ETH spend/);
    await expect(ethSpendInput).toBeVisible({ timeout: 120_000 });
    await setCharmSliderMin(page);
    await expect(buyPanel.getByRole("button", { name: /^Buy .+ CHARM$/i })).toBeEnabled({
      timeout: ARENA_E2E_TIMEOUT_MS,
    });
    await buyPanel.getByRole("button", { name: /^Buy .+ CHARM$/i }).click();
    await expect(buyPanel.locator(".error-text")).toHaveCount(0, {
      timeout: 180_000,
    });
  });
});
