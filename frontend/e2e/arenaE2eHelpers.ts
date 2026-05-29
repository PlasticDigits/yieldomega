// SPDX-License-Identifier: AGPL-3.0-only
import { expect, type Page } from "@playwright/test";
import { connectMockWalletIfPlaceholderVisible } from "./pwMockWallet";

export async function gotoArena(page: Page): Promise<void> {
  await page.goto("/arena");
  await expect(page.getByText("Loading YieldOmega route...")).toBeHidden({ timeout: 120_000 });
  await expect(page.locator(".timecurve-simple-page")).toBeVisible({ timeout: 120_000 });
}

export async function connectArenaWallet(page: Page): Promise<void> {
  await connectMockWalletIfPlaceholderVisible(
    page,
    "Connect a wallet to preview and buy charms.",
  );
  await expect(page.getByText("Connect a wallet to preview and buy charms.")).not.toBeVisible({
    timeout: 60_000,
  });
}

export function arenaBuyPanel(page: Page) {
  return page.locator(".timecurve-simple__buy-panel");
}

export async function openBuyAdvanced(page: Page): Promise<void> {
  const buyPanel = arenaBuyPanel(page);
  await buyPanel.locator('[data-testid="timecurve-simple-buy-advanced"] summary').click();
}

export async function selectPayWith(
  page: Page,
  asset: "cl8y" | "eth" | "usdm" | "cred",
): Promise<void> {
  const buyPanel = arenaBuyPanel(page);
  const btn = buyPanel.getByTestId(`arena-paywith-${asset}`);
  if (!(await btn.isVisible().catch(() => false))) {
    await openBuyAdvanced(page);
  }
  await btn.scrollIntoViewIfNeeded();
  await btn.click({ force: true });
  await expect(btn).toHaveAttribute("aria-pressed", "true");
}

export async function setCharmSliderMin(page: Page): Promise<void> {
  const buyPanel = arenaBuyPanel(page);
  await openBuyAdvanced(page);
  const range = buyPanel.locator("input.timecurve-buy-spend-range");
  if ((await range.count()) === 0) {
    // Arena DOUB checkout may omit the CL8Y spend slider when bounds are not wired yet.
    return;
  }
  await range.first().evaluate((input) => {
    const el = input as HTMLInputElement;
    el.value = "1";
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
