// SPDX-License-Identifier: AGPL-3.0-only
import type { Page } from "@playwright/test";

/**
 * Connect wagmi mock connector when the UI shows a wallet placeholder (Anvil E2E builds with
 * `VITE_E2E_MOCK_WALLET=1`). Some surfaces auto-connect via `defaultConnected: true`; this is a
 * no-op when the placeholder is absent.
 */
export async function connectMockWalletIfPlaceholderVisible(
  page: Page,
  placeholder: string,
): Promise<void> {
  const barrier = page.getByText(placeholder, { exact: true });
  if (!(await barrier.isVisible().catch(() => false))) {
    return;
  }
  await page.getByRole("button", { name: /connect/i }).first().click();
  await page.getByRole("button", { name: /Mock Connector/i }).click();
}
