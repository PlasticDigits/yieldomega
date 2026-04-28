// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Anvil + DeployDev: `/referrals` register flow, share links, and clipboard (GitLab #64 rows R2, R4–R6).
 * Requires `bash scripts/e2e-anvil.sh` (sets `ANVIL_E2E=1`, `VITE_TIMECURVE_ADDRESS`, mock wallet).
 * R3 (disconnected) and R1 post-launch shell variants are covered in `referrals-surface.spec.ts` + manual QA.
 *
 * R4–R6: asserts share-link UI after `registerCode`; does **not** assert `localStorage` key
 * `yieldomega.myrefcode.v1.*` directly (that cache backs the panel — see `referralStorage.ts`, GitLab #85).
 */
import { expect, test } from "@playwright/test";

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
    await page.goto("/referrals");
    await expect(page.getByTestId("referrals-surface")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("heading", { name: "Referrals", level: 1 })).toBeVisible();

    await expect(page.getByRole("heading", { name: "Register a code", level: 2 })).toBeVisible({
      timeout: 120_000,
    });

    const already = page.getByText("This wallet has a code.", { exact: false });
    if (await already.isVisible().catch(() => false)) {
      test.skip(true, "Anvil default account already registered a code; use a fresh chain for this spec.");
    }

    await expect(page.getByText("Connect a wallet.", { exact: false })).not.toBeVisible();
    await expect(page.getByText(/Burn per registration/i)).toBeVisible({ timeout: 60_000 });

    const code = `r${Date.now().toString(36).slice(-10)}`.toLowerCase();
    await page.getByLabel(/New code/i).fill(code);
    await page.getByRole("button", { name: /Register & burn CL8Y/i }).click();

    await expect(page.getByText(/Could not register/i)).toHaveCount(0, { timeout: 180_000 });
    await expect(page.getByRole("heading", { name: "Your share links", level: 4 })).toBeVisible({
      timeout: 60_000,
    });

    const sharePanel = page.locator(".data-panel--stack").filter({ hasText: "Your share links" });
    await expect(sharePanel.getByRole("button", { name: /^Copy$/ })).toHaveCount(2);
    await sharePanel.getByRole("button", { name: /^Copy$/ }).nth(0).click();
    const copiedPath = await page.evaluate(() => navigator.clipboard.readText());
    expect(copiedPath).toContain(`/timecurve/${code}`);
    await expect(sharePanel.getByRole("button", { name: /^Copied$/ })).toHaveCount(1);

    await sharePanel.getByRole("button", { name: /^Copy$/ }).click();
    const copiedQuery = await page.evaluate(() => navigator.clipboard.readText());
    expect(copiedQuery).toContain(`?ref=${code}`);
  });
});
