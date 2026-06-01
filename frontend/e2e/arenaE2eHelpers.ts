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

/** Sets minimum valid spend so `charmWadSelected` resolves and the buy CTA enables. */
export async function setCharmSliderMin(page: Page): Promise<void> {
  const buyPanel = arenaBuyPanel(page);
  await expect(buyPanel.getByText("Loading buy limits…")).toHaveCount(0, {
    timeout: ARENA_E2E_TIMEOUT_MS,
  });
  const cl8ySpendInput = buyPanel.getByLabel(/Exact CL8Y spend/i);
  if ((await cl8ySpendInput.count()) > 0) {
    await expect(cl8ySpendInput).toBeVisible({ timeout: ARENA_E2E_TIMEOUT_MS });
    // Dev deploy uses 1000 DOUB/CHARM; headroom pushes min spend above 1000 DOUB.
    await cl8ySpendInput.fill("2000");
    await cl8ySpendInput.blur();
    await expect(buyPanel.getByTestId("arena-simple-buy-preview")).toBeVisible({
      timeout: ARENA_E2E_TIMEOUT_MS,
    });
    return;
  }

  const kumbayaSpend = buyPanel.getByLabel(/Exact (ETH|USDM) spend/i);
  if ((await kumbayaSpend.count()) === 0) {
    return;
  }

  await expect(kumbayaSpend).toBeVisible({ timeout: ARENA_E2E_TIMEOUT_MS });
  // Blur-driven sizing resolves DOUB out from Kumbaya quotes (see useArenaSaleSession).
  await kumbayaSpend.fill("1");
  await kumbayaSpend.blur();
  await expect(buyPanel.getByTestId("arena-simple-buy-charm")).toBeEnabled({
    timeout: ARENA_KUMBAYA_QUOTE_TIMEOUT_MS,
  });
}
