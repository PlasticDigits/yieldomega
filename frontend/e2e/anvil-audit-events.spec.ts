// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Anvil + indexer: AUDIT event directory navigates to permanent event pages (#364).
 * Requires `YIELDOMEGA_E2E_INDEXER=1 bash scripts/e2e-anvil.sh` (sets VITE_INDEXER_URL at build time).
 */
import { expect, test } from "@playwright/test";
import { ARENA_E2E_TIMEOUT_MS } from "./arenaE2eHelpers";

test.describe("Anvil audit event directory", () => {
  test.skip(
    process.env.ANVIL_E2E !== "1",
    "Set ANVIL_E2E=1 and build with scripts/e2e-anvil.sh.",
  );
  test.skip(
    process.env.ANVIL_E2E_INDEXER !== "1",
    "Set YIELDOMEGA_E2E_INDEXER=1 so e2e-anvil.sh starts the indexer and inlines VITE_INDEXER_URL.",
  );

  test("audit search navigates to event page with tx replay", async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto("/audit");
    await expect(page.getByText("Loading Yield Omega route...")).toBeHidden({
      timeout: ARENA_E2E_TIMEOUT_MS,
    });

    const directory = page.getByTestId("arena-event-directory");
    await expect(directory).toBeVisible({ timeout: ARENA_E2E_TIMEOUT_MS });
    await expect(directory.getByRole("button", { name: "Podium settlements" })).toBeVisible();

    const firstEventLink = directory.locator(".arena-event-directory__link").first();
    await expect(firstEventLink).toBeVisible({ timeout: ARENA_E2E_TIMEOUT_MS });

    const href = await firstEventLink.getAttribute("href");
    expect(href).toMatch(/^\/audit\/events\//);

    await firstEventLink.click();
    await expect(page).toHaveURL(/\/audit\/events\//, { timeout: ARENA_E2E_TIMEOUT_MS });
    await expect(page.getByTestId("arena-event-page")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("AUDIT");

    await expect(page.getByRole("heading", { name: "Transaction replay" })).toBeVisible();
    await expect(page.locator(".mono").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Play Time Arena" })).toBeVisible();
    await expect(page.getByRole("link", { name: /AUDIT/i })).toBeVisible();
  });
});
