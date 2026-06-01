// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test } from "@playwright/test";
import {
  ARENA_E2E_TIMEOUT_MS,
  connectArenaWallet,
  gotoArena,
  waitArenaSaleLive,
} from "./arenaE2eHelpers";

test.describe("Anvil Arena onchain reads", () => {
  test.skip(
    process.env.ANVIL_E2E !== "1",
    "Set ANVIL_E2E=1 and build with scripts/e2e-anvil.sh.",
  );

  test("CRED card and timer chips load without contract read errors", async ({ page }) => {
    await gotoArena(page);
    await connectArenaWallet(page);
    await waitArenaSaleLive(page);

    await expect(page.getByText("Loading contract reads…")).toBeHidden({
      timeout: ARENA_E2E_TIMEOUT_MS,
    });
    await expect(
      page.getByText("Could not read contract (check RPC / network)."),
    ).toHaveCount(0);

    await expect(page.getByTestId("arena-charm-cred-card")).toBeVisible();
    await expect(page.getByTestId("arena-timer-chips")).toBeVisible();
    await expect(page.getByText("Last Buy epoch:", { exact: false })).toBeVisible();
  });
});
