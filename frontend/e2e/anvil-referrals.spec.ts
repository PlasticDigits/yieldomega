// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Anvil + DeployDev: `/referrals` register flow, share links, and clipboard (GitLab #64 rows R2, R4–R6; #86 copy confirmation).
 * Requires `bash scripts/e2e-anvil.sh` (sets `ANVIL_E2E=1`, `VITE_TIME_ARENA_ADDRESS`, mock wallet).
 * R3 (disconnected) and R1 post-launch shell variants are covered in `referrals-surface.spec.ts` + manual QA.
 *
 * R4–R6: asserts share-link UI after `registerCode`; does **not** assert `localStorage` key
 * `yieldomega.myrefcode.v2.*` directly (that cache backs the panel — see `referralStorage.ts`, GitLab #85).
 */
import { expect, test } from "@playwright/test";
import { ARENA_E2E_TIMEOUT_MS } from "./arenaE2eHelpers";

async function connectMockWallet(page: import("@playwright/test").Page): Promise<void> {
  const connectButton = page.getByRole("button", { name: /connect/i });
  if (await connectButton.isVisible().catch(() => false)) {
    await connectButton.first().click();
    await page.getByRole("button", { name: /Mock Connector/i }).click();
  }
}

test.describe("Anvil referrals surface", () => {
  test.skip(
    process.env.ANVIL_E2E !== "1",
    "Set ANVIL_E2E=1 and build with scripts/e2e-anvil.sh (includes VITE_E2E_MOCK_WALLET=1).",
  );

  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: "http://127.0.0.1:4173",
    });
  });

  test("connected wallet: register code, share links, copy to clipboard", async ({ page }) => {
    test.setTimeout(240_000);
    await page.goto("/referrals");
    await expect(page.getByTestId("referrals-surface")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("heading", { name: "Referrals", level: 1 })).toBeVisible();
    await connectMockWallet(page);

    await expect(page.getByRole("heading", { name: /Claim your guide code/i, level: 2 })).toBeVisible({
      timeout: ARENA_E2E_TIMEOUT_MS,
    });

    const newCodeField = page.getByLabel(/New code/i);
    if (!(await newCodeField.isVisible().catch(() => false))) {
      test.skip(true, "Anvil default account already registered a code; use a fresh chain for this spec.");
    }

    await expect(page.getByText("Connect a wallet.", { exact: false })).not.toBeVisible();
    await expect(page.getByTestId("referrals-register-cost-amount")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/Claim cost/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Register code$/i })).toBeVisible({
      timeout: ARENA_E2E_TIMEOUT_MS,
    });
    await expect(page.getByText(/One-time burn/i)).toBeVisible({
      timeout: ARENA_E2E_TIMEOUT_MS,
    });

    const code = `r${Date.now().toString(36).slice(-10)}`.toLowerCase();
    await newCodeField.fill(code);
    await page.getByRole("button", { name: /^Register code$/i }).click();

    await expect(page.getByText(/Could not register/i)).toHaveCount(0, { timeout: 180_000 });
    await expect(page.getByRole("heading", { name: "Your share links", level: 4 })).toBeVisible({
      timeout: 60_000,
    });

    const sharePanel = page.locator(".data-panel--stack").filter({ hasText: "Your share links" });
    await expect(sharePanel.getByRole("button", { name: /^Copy$/ })).toHaveCount(2);
    await sharePanel.getByRole("button", { name: /^Copy$/ }).nth(0).click();
    await expect(page.getByTestId("referrals-copy-feedback")).toContainText(/Copied to clipboard/i);
    const copiedPath = await page.evaluate(() => navigator.clipboard.readText());
    expect(copiedPath).toContain(`/${code}`);
    await expect(sharePanel.getByRole("button", { name: /^Copied!$/ })).toHaveCount(1);
    await sharePanel.getByRole("button", { name: /^Copied!$/ }).click();
    await expect(page.getByTestId("referrals-copy-feedback")).toContainText(/Copied to clipboard/i);

    await sharePanel.getByRole("button", { name: /^Copy$/ }).click();
    const copiedQuery = await page.evaluate(() => navigator.clipboard.readText());
    expect(copiedQuery).toContain(`?ref=${code}`);
  });
});
