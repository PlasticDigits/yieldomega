// SPDX-License-Identifier: AGPL-3.0-only
/**
 * GitLab #95 / issue path 7: full wrong-network gate via real Rabby (not wagmi mock).
 *
 * Prerequisites:
 *   - sudo bash scripts/install-browser-extensions.sh
 *   - xvfb-run … node scripts/setup-rabby-dev-wallets.mjs  (once per profile)
 *   - Anvil on VITE_RPC_URL (default http://127.0.0.1:8545)
 *   - Frontend built/served WITHOUT VITE_E2E_MOCK_WALLET (see scripts/verify-rabby-chain-mismatch.sh)
 *
 * Usage:
 *   node scripts/qa/verify-rabby-chain-mismatch.mjs
 *   YIELDOMEGA_RABBY_BASE_URL=http://127.0.0.1:5173 node scripts/qa/verify-rabby-chain-mismatch.mjs
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  connectRabbyToDapp,
  activeAppPage,
  launchRabbyContext,
  rabbyExtensionIdFromPath,
  RABBY_EXT,
  readWalletChainId,
  switchWalletChain,
  warmUpRabbyExtension,
} from "../lib/rabby_playwright.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TARGET_CHAIN = Number.parseInt(process.env.VITE_CHAIN_ID ?? "31337", 10);
const WRONG_CHAIN = Number.parseInt(process.env.YIELDOMEGA_RABBY_WRONG_CHAIN_ID ?? "1", 10);
const BASE_URL = (process.env.YIELDOMEGA_RABBY_BASE_URL ?? "http://127.0.0.1:5173").replace(/\/$/, "");
const PASSWORD = process.env.RABBY_DEV_PASSWORD ?? "YieldomegaDevOnly1!";
const HEADLESS = process.env.YIELDOMEGA_RABBY_HEADLESS === "1";
async function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function openArenaAdvanced(page) {
  await page.goto(`${BASE_URL}/arena`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.locator(".arena-simple-page").waitFor({ state: "visible", timeout: 30_000 });
  const summary = page.locator('[data-testid="arena-simple-buy-advanced"] summary');
  if (await summary.isVisible().catch(() => false)) {
    await summary.click();
  }
}

async function main() {
  console.log("verify-rabby-chain-mismatch: starting…");
  const extId = rabbyExtensionIdFromPath(RABBY_EXT);
  const context = await launchRabbyContext({ headless: HEADLESS });
  let page = context.pages()[0] ?? (await context.newPage());

  try {
    await warmUpRabbyExtension(context, extId, PASSWORD);
    page = activeAppPage(context) ?? page;

    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(2000);
    await switchWalletChain(page, context, TARGET_CHAIN, PASSWORD);
    await assert(
      (await readWalletChainId(page)) === TARGET_CHAIN,
      `Wallet not on target chain ${TARGET_CHAIN} before dapp load`,
    );

    await openArenaAdvanced(page);
    await connectRabbyToDapp(page, context);
    await openArenaAdvanced(page);

    const gate = page.getByTestId("arena-simple-chain-write-gate");
    await gate.waitFor({ state: "visible", timeout: 20_000 });
    await assert(
      (await page.locator(".chain-write-gate__overlay").count()) === 0,
      "Expected no wrong-network overlay on target chain",
    );
    console.log("PASS: correct chain — no chain-write-gate overlay");

    await switchWalletChain(page, context, WRONG_CHAIN, PASSWORD);
    await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
    await page.waitForTimeout(1500);
    await assert(
      (await readWalletChainId(page)) === WRONG_CHAIN,
      `Wallet did not switch to wrong chain ${WRONG_CHAIN}`,
    );
    await page.waitForTimeout(1500);

    const overlay = page.locator(".chain-write-gate__overlay");
    await overlay.waitFor({ state: "visible", timeout: 15_000 });
    await assert(
      (await page.getByText("Wrong network").count()) > 0,
      "Expected Wrong network copy in overlay",
    );
    const buyBtn = page.getByTestId("arena-simple-buy-charm");
    if (await buyBtn.isVisible().catch(() => false)) {
      await assert(!(await buyBtn.isEnabled()), "Buy CHARM should be disabled on wrong network");
    }
    console.log("PASS: wrong chain — overlay visible and buy surface blocked");

    await switchWalletChain(page, context, TARGET_CHAIN, PASSWORD);
    await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
    await page.waitForTimeout(1500);
    await assert(
      (await page.locator(".chain-write-gate__overlay").count()) === 0,
      "Overlay should clear after switching back to target chain",
    );
    console.log("PASS: switched back to target chain — overlay cleared");
    console.log("verify-rabby-chain-mismatch: all checks passed");
  } finally {
    await context.close();
  }
}

main().catch((err) => {
  console.error("verify-rabby-chain-mismatch FAILED:", err?.message ?? String(err));
  if (err?.stack) console.error(err.stack);
  process.exit(1);
});
