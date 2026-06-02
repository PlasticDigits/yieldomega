// SPDX-License-Identifier: AGPL-3.0-only
/** Shared Playwright + unpacked Rabby helpers for Cloud agent QA. */

import { createHash } from "node:crypto";
import { existsSync, unlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");

export const RABBY_EXT =
  process.env.RABBY_EXTENSION_PATH ?? "/opt/cursor/browser-extensions/rabby";
export const RABBY_PROFILE =
  process.env.CHROME_RABBY_PROFILE ?? "/opt/cursor/chrome-profile-rabby";

/** Chromium unpacked-extension id from absolute path (stable per VM path). */
export function rabbyExtensionIdFromPath(extensionPath) {
  const hash = createHash("sha256").update(extensionPath).digest("hex");
  return [...hash.slice(0, 32)]
    .map((c) => String.fromCharCode("a".charCodeAt(0) + Number.parseInt(c, 16)))
    .join("");
}

export function resolvePlaywright() {
  const require = createRequire(join(ROOT, "frontend/package.json"));
  return require("playwright");
}

export function assertRabbyInstalled() {
  if (!existsSync(join(RABBY_EXT, "manifest.json"))) {
    throw new Error(
      `Rabby not installed at ${RABBY_EXT}. Run: sudo bash scripts/install-browser-extensions.sh`,
    );
  }
}

export function releaseRabbyProfileLock() {
  const lock = join(RABBY_PROFILE, "SingletonLock");
  if (existsSync(lock)) {
    try {
      unlinkSync(lock);
    } catch {
      // ignore — live Chrome may still hold the profile
    }
  }
}

export async function launchRabbyContext({ headless = false } = {}) {
  assertRabbyInstalled();
  releaseRabbyProfileLock();
  const { chromium } = resolvePlaywright();
  return chromium.launchPersistentContext(RABBY_PROFILE, {
    headless,
    ignoreDefaultArgs: ["--disable-extensions"],
    args: [
      `--disable-extensions-except=${RABBY_EXT}`,
      `--load-extension=${RABBY_EXT}`,
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });
}

export async function unlockRabbyIfNeeded(context, extId, password) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extId}/index.html#/dashboard`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  const unlock = page.locator('input[type="password"]');
  if ((await unlock.count()) > 0) {
    await unlock.fill(password);
    await page.getByRole("button", { name: "Unlock" }).click();
    await page.waitForTimeout(1500);
  }
  await page.close();
}

async function approveRabbyPopup(popup) {
  if (!popup) return;
  await popup.waitForLoadState("domcontentloaded");
  const patterns = [/Connect/i, /Approve/i, /Sign/i, /Confirm/i, /Switch/i, /Add network/i];
  for (const pattern of patterns) {
    const btn = popup.getByRole("button", { name: pattern });
    if ((await btn.count()) > 0) {
      await btn.first().click({ timeout: 8_000 }).catch(() => {});
      await popup.waitForTimeout(800);
      if (popup.isClosed()) return;
    }
  }
  await popup.waitForTimeout(500);
  if (!popup.isClosed()) await popup.close().catch(() => {});
}

/**
 * Connect Rabby to the dapp via RainbowKit (Rabby often appears as MetaMask / injected).
 * Skips when the arena connect pitch is already gone (session still connected).
 */
export async function connectRabbyToDapp(page, context) {
  await waitForEthereumProvider(page);

  const pitch = page.getByText(/Connect your Wallet/i);
  if (!(await pitch.isVisible().catch(() => false))) {
    return;
  }

  const popupPromise = context.waitForEvent("page", { timeout: 12_000 }).catch(() => null);
  await page.getByRole("button", { name: /connect/i }).first().click();

  const modal = page.locator('[role="dialog"]');
  await modal.waitFor({ state: "visible", timeout: 12_000 });

  const rabbyOpt = modal.getByRole("button", { name: /Rabby/i });
  const metaMaskOpt = modal.getByRole("button", { name: /MetaMask/i });
  if (await rabbyOpt.isVisible().catch(() => false)) {
    await rabbyOpt.click();
  } else if (await metaMaskOpt.isVisible().catch(() => false)) {
    await metaMaskOpt.click();
  } else {
    await modal.getByRole("button").nth(1).click();
  }

  await approveRabbyPopup(await popupPromise);
  await pitch.waitFor({ state: "hidden", timeout: 25_000 });
}

/** Wait until Rabby injects `window.ethereum` (content scripts can lag first navigation). */
export async function waitForEthereumProvider(page, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let reloaded = false;
  while (Date.now() < deadline) {
    const ok = await page.evaluate(() => Boolean(window.ethereum?.request)).catch(() => false);
    if (ok) return;
    if (!reloaded && Date.now() > deadline - timeoutMs / 2) {
      await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
      await page.waitForTimeout(3000);
      reloaded = true;
    }
    await page.waitForTimeout(500);
  }
  throw new Error("Timed out waiting for Rabby window.ethereum injection");
}

async function requestSwitchChain(page, chainIdHex) {
  return page.evaluate(async (chainIdHexInner) => {
    const eth = window.ethereum;
    if (!eth?.request) throw new Error("No window.ethereum provider (Rabby not injected?)");
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHexInner }],
      });
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? err.code : null;
      if (code !== 4902) throw err;
      if (chainIdHexInner === "0x7a69") {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: chainIdHexInner,
              chainName: "Anvil Local",
              nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
              rpcUrls: ["http://127.0.0.1:8545"],
            },
          ],
        });
        await eth.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: chainIdHexInner }],
        });
      } else {
        throw err;
      }
    }
  }, chainIdHex);
}

function findRabbyPopup(context, appPage) {
  return context.pages().find(
    (p) => p !== appPage && !p.isClosed() && p.url().includes("chrome-extension"),
  );
}

const CHAIN_UI_LABELS = {
  1: /Ethereum Mainnet|Ethereum(?!.*test)/i,
  31337: /Anvil|Localhost|31337/i,
};

/** Switch active chain from Rabby dashboard (more reliable than hanging on popup approve). */
export async function switchNetworkInRabbyDashboard(context, extId, chainIdDecimal) {
  const label = CHAIN_UI_LABELS[chainIdDecimal];
  if (!label) return false;
  const dash = await context.newPage();
  try {
    await dash.goto(`chrome-extension://${extId}/index.html#/dashboard`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const unlock = dash.locator('input[type="password"]');
    if ((await unlock.count()) > 0) {
      await unlock.fill(process.env.RABBY_DEV_PASSWORD ?? "YieldomegaDevOnly1!");
      await dash.getByRole("button", { name: "Unlock" }).click();
      await dash.waitForTimeout(1500);
    }
    const chainChip = dash.locator(".chain-logo, .chain-name, [class*='chain']").first();
    if (await chainChip.isVisible().catch(() => false)) {
      await chainChip.click();
    } else {
      await dash.getByText(/Network|Chain/i).first().click().catch(() => {});
    }
    await dash.waitForTimeout(800);
    await dash.getByText(label).first().click({ timeout: 10_000 });
    await dash.waitForTimeout(1500);
    return true;
  } catch {
    return false;
  } finally {
    if (!dash.isClosed()) await dash.close().catch(() => {});
  }
}

/** `wallet_switchEthereumChain` via injected provider (Rabby); approves Rabby popup when shown. */
export async function switchWalletChain(page, context, chainIdDecimal) {
  await waitForEthereumProvider(page);
  const extId = rabbyExtensionIdFromPath(RABBY_EXT);
  if (await switchNetworkInRabbyDashboard(context, extId, chainIdDecimal)) {
    await page.waitForTimeout(1500);
    const chain = await readWalletChainId(page).catch(() => null);
    if (chain === chainIdDecimal) return;
  }
  const hex = `0x${chainIdDecimal.toString(16)}`;
  const switchWait = requestSwitchChain(page, hex);
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const popup = findRabbyPopup(context, page);
    if (popup) {
      await approveRabbyPopup(popup);
      break;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  await switchWait;
  await page.waitForTimeout(1000);
}

export async function readWalletChainId(page) {
  return page.evaluate(async () => {
    const hex = await window.ethereum.request({ method: "eth_chainId" });
    return Number.parseInt(hex, 16);
  });
}
