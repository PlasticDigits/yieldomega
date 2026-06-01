// SPDX-License-Identifier: AGPL-3.0-only
import { expect, type Page } from "@playwright/test";
import { connectMockWalletIfPlaceholderVisible } from "./pwMockWallet";

/** Anvil E2E: fail fast when RPC/env is wrong (was 120s; keep low for local iteration). */
export const ARENA_E2E_TIMEOUT_MS = 15_000;
/** Kumbaya exact-output quotes can lag first RPC round-trip on cold Anvil. */
export const ARENA_KUMBAYA_QUOTE_TIMEOUT_MS = 45_000;

export async function gotoArena(page: Page): Promise<void> {
  await page.goto("/arena");
  await expect(page.getByText("Loading YieldOmega route...")).toBeHidden({
    timeout: ARENA_E2E_TIMEOUT_MS,
  });
  await expect(page.locator(".arena-simple-page")).toBeVisible({
    timeout: ARENA_E2E_TIMEOUT_MS,
  });
}

export async function connectArenaWallet(
  page: Page,
  options?: { requireDoubSpendControls?: boolean },
): Promise<void> {
  const connectPitch = "Connect your Wallet to earn CHARM, reserve your DOUB, and win prizes!";
  await connectMockWalletIfPlaceholderVisible(page, connectPitch);
  await expect(page.getByText(connectPitch)).not.toBeVisible({
    timeout: ARENA_E2E_TIMEOUT_MS,
  });
  const buyPanel = arenaBuyPanel(page);
  await expect(buyPanel).toBeVisible({ timeout: ARENA_E2E_TIMEOUT_MS });
  await expect(buyPanel.getByTestId("arena-simple-rate-board")).toBeVisible({
    timeout: ARENA_E2E_TIMEOUT_MS,
  });
  if (options?.requireDoubSpendControls) {
    await expect(arenaBuyPanel(page).locator("input.arena-buy-spend-range")).toHaveCount(1, {
      timeout: ARENA_E2E_TIMEOUT_MS,
    });
  }
}

export function arenaBuyPanel(page: Page) {
  return page.locator(".arena-simple__buy-panel");
}

export function arenaBuyCharmButton(page: Page) {
  return arenaBuyPanel(page).getByTestId("arena-simple-buy-charm");
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

/** Sets minimum valid CL8Y-band spend so `charmWadSelected` resolves (CL8Y / CRED paths). */
export async function setCharmSliderMin(page: Page): Promise<void> {
  const buyPanel = arenaBuyPanel(page);
  await expect(buyPanel.getByText("Loading buy limits…")).toHaveCount(0, {
    timeout: ARENA_E2E_TIMEOUT_MS,
  });
  const spendInput = buyPanel.getByLabel(/Exact CL8Y spend/i);
  if ((await spendInput.count()) > 0) {
    await expect(spendInput).toBeVisible({ timeout: ARENA_E2E_TIMEOUT_MS });
    // Dev deploy uses 1000 DOUB/CHARM; headroom pushes min spend above 1000 DOUB.
    await spendInput.fill("2000");
    await spendInput.blur();
  } else {
    // CRED pay: slider targets CL8Y band; input shows CRED burn after charm resolves.
    const slider = buyPanel.locator("input.arena-buy-spend-range");
    if ((await slider.count()) > 0) {
      await slider.evaluate((el: HTMLInputElement) => {
        el.value = "500";
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });
    }
  }
  await expect(buyPanel.getByText("Loading CHARM preview…")).toHaveCount(0, {
    timeout: ARENA_E2E_TIMEOUT_MS,
  });
}

/** ETH/USDM Kumbaya pay: set pay-in budget, wait for swap quote + enabled buy CTA. */
export async function setKumbayaPaySpendMin(page: Page): Promise<void> {
  const buyPanel = arenaBuyPanel(page);
  await expect(buyPanel.getByText("Loading buy limits…")).toHaveCount(0, {
    timeout: ARENA_E2E_TIMEOUT_MS,
  });
  const spendInput = buyPanel.getByLabel(/Exact (ETH|USDM) spend/i);
  await expect(spendInput).toBeVisible({ timeout: ARENA_E2E_TIMEOUT_MS });
  const label = (await spendInput.getAttribute("aria-label")) ?? "";
  await spendInput.fill(/USDM/i.test(label) ? "100" : "0.05");
  await spendInput.blur();
  await expect(buyPanel.getByText("Loading CHARM preview…")).toHaveCount(0, {
    timeout: ARENA_E2E_TIMEOUT_MS,
  });
  await expect(buyPanel.getByTestId("arena-simple-buy-preview")).toBeVisible({
    timeout: ARENA_KUMBAYA_QUOTE_TIMEOUT_MS,
  });
  await expect(arenaBuyCharmButton(page)).toBeEnabled({
    timeout: ARENA_KUMBAYA_QUOTE_TIMEOUT_MS,
  });
}
