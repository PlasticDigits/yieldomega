// SPDX-License-Identifier: AGPL-3.0-only
/** Shared Playwright + unpacked Rabby helpers for Cloud agent QA. */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, unlinkSync } from "node:fs";
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

const SYSTEM_CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  "/usr/local/bin/google-chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
].filter(Boolean);

function bundledPlaywrightChromiumBin() {
  const cacheDir = process.env.PLAYWRIGHT_BROWSERS_PATH ?? join(process.env.HOME ?? "", ".cache/ms-playwright");
  if (!existsSync(cacheDir)) return null;
  for (const entry of readdirSync(cacheDir)) {
    if (!entry.startsWith("chromium-")) continue;
    const chrome = join(cacheDir, entry, "chrome-linux", "chrome");
    if (existsSync(chrome)) return chrome;
  }
  return null;
}

function systemChromeBin() {
  for (const candidate of SYSTEM_CHROME_CANDIDATES) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  return null;
}

/** Install bundled Chromium when missing (bootstrap should have done this already). */
export function ensurePlaywrightChromium() {
  const bundled = bundledPlaywrightChromiumBin();
  if (bundled) return bundled;
  try {
    execFileSync("npx", ["playwright", "install", "chromium"], {
      cwd: join(ROOT, "frontend"),
      stdio: "inherit",
    });
  } catch {
    // fall through to system Chrome
  }
  return bundledPlaywrightChromiumBin() ?? systemChromeBin();
}

/** Launch options for Rabby: bundled Chromium, else system Chrome via executablePath. */
export function chromiumLaunchOptions({ headless = false } = {}) {
  const bundled = bundledPlaywrightChromiumBin();
  if (bundled) return { headless };
  const systemChrome = ensurePlaywrightChromium();
  if (!systemChrome) {
    throw new Error(
      "Playwright Chromium is not installed and no system Chrome/Chromium was found. " +
        "Run: cd frontend && npx playwright install chromium",
    );
  }
  if (systemChrome !== bundledPlaywrightChromiumBin()) {
    console.warn(
      `Rabby helper: Playwright bundled Chromium missing; using system browser at ${systemChrome}`,
    );
  }
  return { headless, executablePath: systemChrome };
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


export function activeAppPage(context) {
  const pages = context.pages().filter((p) => !p.isClosed());
  return (
    pages.find((p) => /^https?:/.test(p.url())) ??
    pages.find((p) => !p.url().includes("chrome-extension")) ??
    pages.at(-1) ??
    null
  );
}

export function refreshAppPage(page, context) {
  if (page && !page.isClosed()) return page;
  return activeAppPage(context) ?? page;
}

export async function launchRabbyContext({ headless = false } = {}) {
  assertRabbyInstalled();
  releaseRabbyProfileLock();
  const { chromium } = resolvePlaywright();
  const launchOpts = chromiumLaunchOptions({ headless });
  return chromium.launchPersistentContext(RABBY_PROFILE, {
    ...launchOpts,
    ignoreDefaultArgs: ["--disable-extensions"],
    args: [
      `--disable-extensions-except=${RABBY_EXT}`,
      `--load-extension=${RABBY_EXT}`,
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });
}

/** Open Rabby dashboard so content scripts inject before dapp navigation (Cloud xvfb). */
export async function warmUpRabbyExtension(context, extId, password) {
  await unlockRabbyIfNeeded(context, extId, password);
  const page = await context.newPage();
  try {
    await page.goto(`chrome-extension://${extId}/index.html#/dashboard`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForTimeout(8_000);
  } finally {
    if (!page.isClosed()) await page.close().catch(() => {});
  }
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

async function approveRabbyPopup(popup, password = process.env.RABBY_DEV_PASSWORD ?? "YieldomegaDevOnly1!") {
  if (!popup || popup.isClosed()) return;
  await popup.waitForLoadState("domcontentloaded");
  const unlockInput = popup.locator('input[type="password"]');
  if ((await unlockInput.count()) > 0) {
    await unlockInput.fill(password);
    await popup.getByRole("button", { name: "Unlock" }).click({ timeout: 8_000 }).catch(() => {});
    await popup.waitForTimeout(1_500);
    if (popup.isClosed()) return;
  }
  const patterns = [
    /Connect/i,
    /Approve/i,
    /Sign/i,
    /Confirm/i,
    /Switch/i,
    /Add network/i,
    /^Add$/i,
    /Got it/i,
  ];
  for (let round = 0; round < 4; round += 1) {
    for (const pattern of patterns) {
      const btn = popup.getByRole("button", { name: pattern });
      if ((await btn.count()) > 0) {
        await btn.first().click({ timeout: 8_000 }).catch(() => {});
        await popup.waitForTimeout(1_000);
        if (popup.isClosed()) return;
      }
    }
    await popup.waitForTimeout(500);
  }
}

/**
 * Connect Rabby to the dapp via RainbowKit (Rabby often appears as MetaMask / injected).
 * Skips when the arena connect pitch is already gone (session still connected).
 */
export async function connectRabbyToDapp(page, context) {
  page = refreshAppPage(page, context) ?? page;
  await waitForEthereumProvider(page);

  const pitch = page.getByText(/Connect (your )?wallet/i);
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
  const result = await page.evaluate(async (chainIdHexInner) => {
    const eth = window.ethereum;
    if (!eth?.request) return { ok: false, message: "No window.ethereum provider (Rabby not injected?)" };
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHexInner }],
      });
      return { ok: true };
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? err.code : null;
      const msg = err && typeof err === "object" && "message" in err ? String(err.message) : String(err);
      if (/same chain|already/i.test(msg)) return { ok: true };
      const needsAdd =
        chainIdHexInner === "0x7a69" &&
        (code === 4902 || code === -32603 || /defaultChain|unrecognized chain/i.test(msg));
      if (!needsAdd) return { ok: false, code, message: msg };
      try {
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
        return { ok: true };
      } catch (err2) {
        const code2 = err2 && typeof err2 === "object" && "code" in err2 ? err2.code : null;
        const msg2 = err2 && typeof err2 === "object" && "message" in err2 ? String(err2.message) : String(err2);
        return { ok: false, code: code2, message: msg2 };
      }
    }
  }, chainIdHex);
  if (!result?.ok) {
    throw new Error(`wallet_switch/add failed: ${JSON.stringify(result)}`);
  }
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


/** Add Anvil (31337) via Rabby dashboard when provider switch returns Rabby -32603. */
export async function addAnvilNetworkInRabbyDashboard(context, extId, password) {
  const dash = await context.newPage();
  try {
    await dash.goto(`chrome-extension://${extId}/index.html#/dashboard`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const unlock = dash.locator('input[type="password"]');
    if ((await unlock.count()) > 0) {
      await unlock.fill(password);
      await dash.getByRole("button", { name: "Unlock" }).click();
      await dash.waitForTimeout(1500);
    }
    const chainChip = dash.locator(".chain-logo, .chain-name, [class*='chain']").first();
    if (await chainChip.isVisible().catch(() => false)) await chainChip.click();
    await dash.waitForTimeout(800);
    const addCustom = dash.getByText(/Add custom network|Custom network|Add a network/i);
    if ((await addCustom.count()) > 0) {
      await addCustom.first().click();
      await dash.waitForTimeout(800);
      await dash.getByLabel(/RPC URL|RPC/i).first().fill("http://127.0.0.1:8545").catch(async () => {
        await dash.locator("input").filter({ hasText: "" }).nth(0).fill("http://127.0.0.1:8545");
      });
      const idField = dash.getByLabel(/Chain ID|ID/i).first();
      if (await idField.isVisible().catch(() => false)) await idField.fill("31337");
      await dash.getByRole("button", { name: /Confirm|Save|Add/i }).first().click({ timeout: 10_000 }).catch(() => {});
      await dash.waitForTimeout(1500);
      return true;
    }
    return false;
  } catch {
    return false;
  } finally {
    if (!dash.isClosed()) await dash.close().catch(() => {});
  }
}

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
export async function switchWalletChain(page, context, chainIdDecimal, password = process.env.RABBY_DEV_PASSWORD ?? "YieldomegaDevOnly1!") {
  page = refreshAppPage(page, context) ?? (await context.newPage());
  await waitForEthereumProvider(page);
  const current = await readWalletChainId(page).catch(() => null);
  if (current === chainIdDecimal) return;
  const extId = rabbyExtensionIdFromPath(RABBY_EXT);
  if (chainIdDecimal === 31337) {
    await addAnvilNetworkInRabbyDashboard(context, extId, password);
  }
  if (await switchNetworkInRabbyDashboard(context, extId, chainIdDecimal)) {
    page = refreshAppPage(page, context) ?? page;
    await page.waitForTimeout(1500);
    const chain = await readWalletChainId(page).catch(() => null);
    if (chain === chainIdDecimal) return;
  }
  const appUrl = page && !page.isClosed() ? page.url() : "http://127.0.0.1:5173/";
  const rpcPage = await context.newPage();
  await rpcPage.goto(appUrl.split("#")[0], { waitUntil: "domcontentloaded", timeout: 60_000 });
  await waitForEthereumProvider(rpcPage);
  page = rpcPage;
  const hex = `0x${chainIdDecimal.toString(16)}`;
  const popupEvents = [];
  const onPage = (p) => popupEvents.push(p);
  context.on("page", onPage);
  const switchWait = requestSwitchChain(rpcPage, hex);
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    page = refreshAppPage(page, context) ?? page;
    const popup =
      popupEvents.find((p) => !p.isClosed() && p.url().includes("chrome-extension")) ??
      findRabbyPopup(context, page);
    if (popup) await approveRabbyPopup(popup, password);
    if ((await readWalletChainId(page).catch(() => null)) === chainIdDecimal) {
      context.off("page", onPage);
      await switchWait.catch(() => {});
      return;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  context.off("page", onPage);
  try {
    await switchWait;
  } catch (err) {
    const chain = await readWalletChainId(page).catch(() => null);
    if (chain === chainIdDecimal) return;
    throw err;
  }
  page = refreshAppPage(page, context) ?? page;
  await page.waitForTimeout(1000);
}

export async function readWalletChainId(page) {
  return page.evaluate(async () => {
    const hex = await window.ethereum.request({ method: "eth_chainId" });
    return Number.parseInt(hex, 16);
  });
}
