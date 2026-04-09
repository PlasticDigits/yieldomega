// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test } from "@playwright/test";

/**
 * Anvil-only E2E: public TimeCurve contract reads via wagmi + JSON-RPC (no wallet).
 *
 * Divergences vs MegaETH (MegaEVM): gas estimation, intrinsic minima, storage gas,
 * block cadence, and realtime RPC semantics differ from vanilla Anvil. A green run
 * here does not guarantee identical behavior on MegaETH testnet or mainnet.
 * See docs/testing/e2e-anvil.md and docs/research/megaeth.md.
 *
 * Phase B (connect wallet + write txs): optional; not implemented here.
 */

test.describe("Anvil TimeCurve RPC reads", () => {
  test.skip(
    process.env.ANVIL_E2E !== "1",
    "Set ANVIL_E2E=1 and build with VITE_* from an Anvil deploy (bash scripts/e2e-anvil.sh).",
  );

  test("TimeCurve page shows onchain panel without read errors", async ({
    page,
  }) => {
    await page.goto("/timecurve");

    await expect(
      page.getByText("Set VITE_TIMECURVE_ADDRESS", { exact: false }),
    ).not.toBeVisible();

    await expect(page.getByText("Loading contract reads…")).toBeHidden({
      timeout: 120_000,
    });

    await expect(
      page.getByText("Could not read contract (check RPC / network)."),
    ).toHaveCount(0);

    const protocolDetail = page.locator("summary").filter({
      hasText: "Raw contract and operator context",
    });
    await expect(protocolDetail).toBeVisible();
    await protocolDetail.click();

    await expect(page.getByRole("heading", { name: "Onchain snapshot" })).toBeVisible();

    await expect(page.locator('dt:text-is("ended") + dd')).toHaveText(
      /^(true|false)$/,
    );
    await expect(
      page.locator('dt:text-is("time remaining") + dd'),
    ).not.toHaveText("—");
  });
});
