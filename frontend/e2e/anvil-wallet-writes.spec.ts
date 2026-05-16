// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test } from "@playwright/test";

/**
 * Anvil Phase B: write txs via wagmi `mock` connector (`VITE_E2E_MOCK_WALLET=1`).
 * The mock forwards JSON-RPC to Anvil; behavior differs from injected wallets,
 * WalletConnect, and MegaETH (gas, signing, RPC). See docs/testing/e2e-anvil.md.
 */

import { connectMockWalletIfPlaceholderVisible } from "./pwMockWallet";

test.describe("Anvil wallet writes", () => {
  test.skip(
    process.env.ANVIL_E2E !== "1",
    "Set ANVIL_E2E=1 and build with scripts/e2e-anvil.sh (includes VITE_E2E_MOCK_WALLET=1).",
  );

  // Same Anvil chain + account; avoid parallel buys racing nonces / sale state.
  test.describe.configure({ mode: "serial" });

  test("TimeCurve approve and buy (CL8Y)", async ({ page }) => {
    await page.goto("/timecurve");
    await expect(page.getByText("Loading contract reads…")).toBeHidden({
      timeout: 120_000,
    });
    await connectMockWalletIfPlaceholderVisible(page, "Connect a wallet to preview and buy charms.");
    await expect(page.getByText("Connect a wallet to preview and buy charms.")).not.toBeVisible({
      timeout: 60_000,
    });

    const buyPanel = page.locator(".timecurve-simple__buy-panel");
    await expect(buyPanel.getByRole("button", { name: /buy/i })).toBeVisible({
      timeout: 60_000,
    });
    await buyPanel.locator('input[type="range"]').evaluate((input) => {
      const el = input as HTMLInputElement;
      el.value = "1";
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await buyPanel.getByRole("button", { name: /buy/i }).click();
    await expect(buyPanel.locator(".error-text")).toHaveCount(0, {
      timeout: 120_000,
    });
  });

  test("TimeCurve ETH route: quote, swap, and buy", async ({ page }) => {
    await page.goto("/timecurve");
    await expect(page.getByText("Loading contract reads…")).toBeHidden({
      timeout: 120_000,
    });
    await connectMockWalletIfPlaceholderVisible(page, "Connect a wallet to preview and buy charms.");
    await expect(page.getByText("Connect a wallet to preview and buy charms.")).not.toBeVisible({
      timeout: 60_000,
    });

    const buyPanel = page.locator(".timecurve-simple__buy-panel");
    // Pay-with toggles live under ADVANCED (collapsed by default).
    await buyPanel.locator('[data-testid="timecurve-simple-buy-advanced"] summary').click();
    // Toggle buttons (not legacy radio inputs) — `data-testid` + issue #87
    await buyPanel.getByTestId("timecurve-simple-paywith-eth").click();
    await expect(buyPanel.getByTestId("timecurve-simple-paywith-eth")).toHaveAttribute("aria-pressed", "true");
    await expect(
      buyPanel.getByLabel(/Quoted ETH spend for the selected CL8Y target/),
    ).toBeVisible({ timeout: 120_000 });
    // Resolves from "…" once the Kumbaya quoter read settles (issue #56)
    await expect(buyPanel.locator(".timecurve-simple__amount-field--quoted")).not.toHaveText("…", {
      timeout: 120_000,
    });
    await buyPanel.locator('input[type="range"]').evaluate((input) => {
      const el = input as HTMLInputElement;
      el.value = "1";
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
    // After slider moves, Kumbaya quote refetches; CTA shows "Refreshing quote…"
    // until the new quoter read settles (issue #56).
    await expect(buyPanel.getByRole("button", { name: /^Buy .+ CHARM$/i })).toBeEnabled({
      timeout: 120_000,
    });
    await buyPanel.getByRole("button", { name: /^Buy .+ CHARM$/i }).click();
    await expect(buyPanel.locator(".error-text")).toHaveCount(0, {
      timeout: 180_000,
    });
  });
});
