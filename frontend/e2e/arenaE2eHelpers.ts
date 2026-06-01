// SPDX-License-Identifier: AGPL-3.0-only
import { expect, type Page } from "@playwright/test";
import { connectMockWalletIfPlaceholderVisible } from "./pwMockWallet";

/** Anvil E2E: fail fast when RPC/env is wrong (full suite was ~8m with 120s expects). */
export const ARENA_E2E_TIMEOUT_MS = 45_000;

export async function gotoArena(page: Page): Promise<void> {
  await page.goto("/arena");
  await expect(page.getByText("Loading YieldOmega route...")).toBeHidden({
    timeout: ARENA_E2E_TIMEOUT_MS,
  });
  await expect(page.locator(".arena-simple-page")).toBeVisible({
    timeout: ARENA_E2E_TIMEOUT_MS,
  });
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
  return page.locator(".arena-simple__buy-panel");
}

/** Waits until DeployDev `startArena()` reads resolve to the live buy surface. */
export async function waitArenaSaleLive(page: Page): Promise<void> {
  await expect(page.getByTestId("arena-simple-rate-board")).toBeVisible({
    timeout: ARENA_E2E_TIMEOUT_MS,
  });
}

export async function openBuyAdvanced(page: Page): Promise<void> {
  const buyPanel = arenaBuyPanel(page);
  await buyPanel.locator('[data-testid="arena-simple-buy-advanced"] summary').click();
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
  const range = buyPanel.locator("input.arena-buy-spend-range");
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
