// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Anvil Phase B: write txs via wagmi `mock` connector (`VITE_E2E_MOCK_WALLET=1`).
 * The mock forwards JSON-RPC to Anvil; behavior differs from injected wallets,
 * WalletConnect, and MegaETH (gas, signing, RPC). See docs/testing/e2e-anvil.md.
 */

async function connectMockIfPlaceholderVisible(
  page: Page,
  placeholder: string,
) {
  const barrier = page.getByText(placeholder, { exact: true });
  if (!(await barrier.isVisible().catch(() => false))) {
    return;
  }
  await page.getByRole("button", { name: /connect/i }).first().click();
  await page.getByRole("button", { name: /Mock Connector/i }).click();
}

test.describe("Anvil wallet writes", () => {
  test.skip(
    process.env.ANVIL_E2E !== "1",
    "Set ANVIL_E2E=1 and build with scripts/e2e-anvil.sh (includes VITE_E2E_MOCK_WALLET=1).",
  );

  test("TimeCurve approve and buy", async ({ page }) => {
    await page.goto("/timecurve");
    await expect(page.getByText("Loading contract reads…")).toBeHidden({
      timeout: 120_000,
    });
    await connectMockIfPlaceholderVisible(page, "Connect a wallet to buy.");
    await expect(page.getByText("Connect a wallet to buy.")).not.toBeVisible({
      timeout: 60_000,
    });

    const buyPanel = page.locator(".data-panel").filter({ hasText: "Buy (wallet)" });
    await expect(buyPanel.getByRole("button", { name: /buy/i })).toBeVisible({
      timeout: 60_000,
    });
    await buyPanel.getByRole("textbox").fill("1");
    await buyPanel.getByRole("button", { name: /buy/i }).click();
    await expect(buyPanel.locator(".error-text")).toHaveCount(0, {
      timeout: 120_000,
    });
  });

  test("Rabbit Treasury approve and deposit", async ({ page }) => {
    await page.goto("/rabbit-treasury");
    await expect(page.getByRole("heading", { name: "Rabbit Treasury" })).toBeVisible();
    await expect(page.locator('dt:text-is("currentEpochId") + dd')).not.toHaveText(
      "—",
      { timeout: 120_000 },
    );

    await connectMockIfPlaceholderVisible(page, "Connect a wallet to deposit.");
    await expect(page.getByText("Connect a wallet to deposit.")).not.toBeVisible({
      timeout: 60_000,
    });

    const depPanel = page.locator(".data-panel").filter({ hasText: "Deposit (wallet)" });
    await expect(
      depPanel.getByRole("button", { name: /deposit/i }),
    ).toBeVisible({ timeout: 60_000 });
    await depPanel.getByRole("textbox").fill("1");
    await depPanel.getByRole("button", { name: /deposit/i }).click();
    await expect(depPanel.locator(".error-text")).toHaveCount(0, {
      timeout: 120_000,
    });
  });
});
