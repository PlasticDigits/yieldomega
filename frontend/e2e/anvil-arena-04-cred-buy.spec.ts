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

test.describe("Anvil Arena CRED buy", () => {
  test.skip(
    process.env.ANVIL_E2E !== "1",
    "Set ANVIL_E2E=1 and build with scripts/e2e-anvil.sh (VITE_E2E_MOCK_WALLET=1).",
  );

  test("buyWithCred on /arena when CRED pay is selected", async ({ page }) => {
    await gotoArena(page);
    await expect(page.getByText("Loading contract reads…")).toBeHidden({
      timeout: ARENA_E2E_TIMEOUT_MS,
    });
    await connectArenaWallet(page);
    await waitArenaSaleLive(page);
    const buyPanel = arenaBuyPanel(page);
    await selectPayWith(page, "cred");
    await setCharmSliderMin(page);
    await expect(buyPanel.getByTestId("arena-simple-buy-preview-cred")).toBeVisible({
      timeout: ARENA_E2E_TIMEOUT_MS,
    });
    await buyPanel.getByRole("button", { name: /buy/i }).click();
    await expect(buyPanel.locator(".error-text")).toHaveCount(0, {
      timeout: ARENA_E2E_TIMEOUT_MS,
    });
  });
});
