// SPDX-License-Identifier: AGPL-3.0-only
import { expect, type Page } from "@playwright/test";

/** Anvil E2E: fail fast when RPC/env is wrong (was 120s; keep low for local iteration). */
export const ARENA_E2E_TIMEOUT_MS = 15_000;
/** Kumbaya exact-output quotes can lag first RPC round-trip on cold Anvil. */
export const ARENA_KUMBAYA_QUOTE_TIMEOUT_MS = 45_000;

export async function gotoArena(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByText("Loading Yield Omega route...")).toBeHidden({
    timeout: ARENA_E2E_TIMEOUT_MS,
  });
  await expect(page.getByTestId("arena-command-console")).toBeVisible({
    timeout: ARENA_E2E_TIMEOUT_MS,
  });
}

export async function connectArenaWallet(
  page: Page,
  options?: { requireDoubSpendControls?: boolean },
): Promise<void> {
  const buyPanel = arenaBuyPanel(page);
  const connectButton = buyPanel.getByRole("button", { name: /connect/i });
  if (await connectButton.isVisible().catch(() => false)) {
    await connectButton.first().click();
    await page.getByRole("button", { name: /Mock Connector/i }).click();
  }
  await expect(buyPanel).toBeVisible({ timeout: ARENA_E2E_TIMEOUT_MS });
  await expect(buyPanel.getByTestId("arena-simple-buy-charm")).toBeVisible({
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
  await expect(page.getByTestId("arena-simple-buy-charm")).toBeVisible({
    timeout: ARENA_E2E_TIMEOUT_MS,
  });
}

export async function selectPayWith(
  page: Page,
  asset: "cl8y" | "eth" | "usdm" | "cred",
): Promise<void> {
  const buyPanel = arenaBuyPanel(page);
  const trigger = buyPanel.getByTestId("arena-simple-amount-pay-token");
  const option = buyPanel.locator(`[data-pay-token-value="${asset}"]`);
  const labelPattern = asset === "cl8y" ? /DOUB|CL8Y/i : new RegExp(asset, "i");
  const ariaLabel = await trigger.getAttribute("aria-label").catch(() => null);
  if (ariaLabel && labelPattern.test(ariaLabel)) {
    return;
  }
  if (await option.isVisible().catch(() => false)) {
    await option.click();
    await expect(trigger).toHaveAttribute("aria-label", labelPattern);
    return;
  }
  await expect(trigger).toBeVisible({ timeout: ARENA_E2E_TIMEOUT_MS });
  await trigger.click();
  await expect(option).toBeVisible({ timeout: ARENA_E2E_TIMEOUT_MS });
  await option.click();
  await expect(trigger).toHaveAttribute("aria-label", labelPattern);
}

/** Advance Anvil clock so wallet buy cooldown gates clear between serial E2E buys. */
export async function warpAnvilPastBuyCooldown(): Promise<void> {
  const rpc = process.env.VITE_RPC_URL ?? "http://127.0.0.1:8545";
  for (const [method, params] of [
    ["anvil_increaseTime", [120]],
    ["anvil_mine", ["0x2"]],
  ] as const) {
    await fetch(rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
  }
}

/** Sets minimum valid spend so `charmWadSelected` resolves and the buy CTA enables. */
export async function setCharmSliderMin(page: Page): Promise<void> {
  const buyPanel = arenaBuyPanel(page);
  await expect(buyPanel.getByText("Loading buy limits…")).toHaveCount(0, {
    timeout: ARENA_E2E_TIMEOUT_MS,
  });
  const doubSpendInput = buyPanel.getByLabel(/Exact (CL8Y|DOUB) spend/i);
  if ((await doubSpendInput.count()) > 0) {
    await expect(doubSpendInput).toBeVisible({ timeout: ARENA_E2E_TIMEOUT_MS });
    // Dev deploy uses 1000 DOUB/CHARM; headroom pushes min spend above 1000 DOUB.
    await doubSpendInput.fill("2000");
    await doubSpendInput.blur();
    await expect(buyPanel.getByTestId("arena-simple-buy-preview")).toBeVisible({
      timeout: ARENA_E2E_TIMEOUT_MS,
    });
    return;
  }

  const altSpend = buyPanel.getByLabel(/Exact (ETH|USDM|CRED) spend/i);
  if ((await altSpend.count()) === 0) {
    return;
  }

  await expect(altSpend).toBeVisible({ timeout: ARENA_E2E_TIMEOUT_MS });
  const isKumbaya = (await buyPanel.getByLabel(/Exact (ETH|USDM) spend/i).count()) > 0;
  if (isKumbaya) {
    await expect(buyPanel.getByText("Could not quote this route")).toHaveCount(0);
  }

  const slider = buyPanel.locator("input.arena-buy-spend-range");
  await expect(slider).toHaveCount(1, { timeout: ARENA_E2E_TIMEOUT_MS });
  await slider.fill("0");

  if (isKumbaya) {
    await expect(buyPanel.getByText("Loading CHARM preview…")).toHaveCount(0, {
      timeout: ARENA_KUMBAYA_QUOTE_TIMEOUT_MS,
    });
    await expect(buyPanel.getByTestId("arena-simple-buy-preview")).toBeVisible({
      timeout: ARENA_KUMBAYA_QUOTE_TIMEOUT_MS,
    });
    try {
      await expect(buyPanel.getByTestId("arena-simple-buy-charm")).toBeEnabled({
        timeout: ARENA_KUMBAYA_QUOTE_TIMEOUT_MS,
      });
    } catch {
      const panelText = await buyPanel.innerText();
      throw new Error(`Buy CTA stayed disabled after Kumbaya quote wait.\n${panelText}`);
    }
    return;
  }

  await expect(buyPanel.getByTestId("arena-simple-buy-preview")).toBeVisible({
    timeout: ARENA_E2E_TIMEOUT_MS,
  });
}
