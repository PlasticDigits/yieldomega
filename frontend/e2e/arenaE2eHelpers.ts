// SPDX-License-Identifier: AGPL-3.0-only
import { execSync } from "node:child_process";
import { expect, type Page } from "@playwright/test";
import { ARENA_LAST_CLOSED_AT_KEY } from "../src/lib/arenaSessionClose";

export { ARENA_LAST_CLOSED_AT_KEY };

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

/** Seed absent-session timestamp before navigation (While You Were Away #338). */
export async function seedArenaLastClosedAt(page: Page, absentMs: number): Promise<void> {
  await page.addInitScript(
    ({ key, ts }) => {
      localStorage.setItem(key, String(ts));
    },
    { key: ARENA_LAST_CLOSED_AT_KEY, ts: Date.now() - absentMs },
  );
}

/** Dismiss auto level-up celebration when it blocks carousel / buy controls ([#335](https://gitlab.com/PlasticDigits/yieldomega/-/issues/335)). */
export async function dismissLevelUpCelebrationIfPresent(page: Page): Promise<void> {
  const backdrop = page.getByRole("button", { name: /Dismiss level up celebration/i });
  if (await backdrop.isVisible().catch(() => false)) {
    await backdrop.click();
    await expect(page.getByTestId("level-up-celebration")).toHaveCount(0, {
      timeout: ARENA_E2E_TIMEOUT_MS,
    });
  }
}

/** Navigate timer podium carousel via dot control and assert active slide. */
export async function gotoCarouselDot(page: Page, dotIndex: number): Promise<void> {
  await dismissLevelUpCelebrationIfPresent(page);
  const dot = page.getByTestId(`arena-timer-podium-carousel-dot-${dotIndex}`);
  await expect(dot).toBeVisible({ timeout: ARENA_E2E_TIMEOUT_MS });
  await dot.click();
  await expect(dot).toHaveAttribute("aria-selected", "true");
}

/** Anvil account #0 — wagmi mock connector default. */
export const ANVIL_MOCK_WALLET = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

const MIN_CHARM_WAD = "1000000000000000000";
const STARTER_CHARM_WAD = "10000000000000000000";

function requireAnvilEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} for Anvil E2E on-chain helpers`);
  }
  return value;
}

async function anvilRpc(method: string, params: unknown[]): Promise<void> {
  const rpc = process.env.VITE_RPC_URL ?? "http://127.0.0.1:8545";
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) {
    throw new Error(`anvil RPC ${method} HTTP ${res.status}`);
  }
  const body = (await res.json()) as { error?: { message?: string } };
  if (body.error) {
    throw new Error(`anvil RPC ${method}: ${body.error.message ?? "unknown error"}`);
  }
}

function anvilCastCall(contract: string, sig: string, args: string[] = []): string {
  const rpc = process.env.VITE_RPC_URL ?? "http://127.0.0.1:8545";
  const argList = args.length > 0 ? `${args.join(" ")} ` : "";
  return execSync(`cast call "${contract}" "${sig}" ${argList}--rpc-url "${rpc}"`, {
    encoding: "utf-8",
  })
    .trim()
    .split(/\s+/)[0]!;
}

export function anvilCastSend(
  contract: string,
  sig: string,
  args: string[],
  from = ANVIL_MOCK_WALLET,
): void {
  const rpc = process.env.VITE_RPC_URL ?? "http://127.0.0.1:8545";
  const argList = args.map((arg) => `"${arg}"`).join(" ");
  execSync(
    `cast send "${contract}" "${sig}" ${argList} --from "${from}" --unlocked --rpc-url "${rpc}"`,
    { stdio: "pipe" },
  );
}

/** Submit a DOUB `buy(uint256)` from the mock wallet (bypasses UI buy-energy cooldown). */
export async function buyCharmViaCast(charmWad = MIN_CHARM_WAD): Promise<void> {
  const ta = requireAnvilEnv("VITE_TIME_ARENA_ADDRESS");
  const doub = requireAnvilEnv("VITE_DOUB_ADDRESS");
  anvilCastSend(doub, "approve(address,uint256)", [ta, "1000000000000000000000000"]);
  anvilCastSend(ta, "buy(uint256)", [charmWad]);
  await warpAnvilPastBuyCooldown();
}

/** Fast level grind for transition E2E — one max-CHARM buy reaches level 2 ([#350](https://gitlab.com/PlasticDigits/yieldomega/-/issues/350)). */
export async function ensureArenaLevelTwoViaCast(): Promise<void> {
  const ta = requireAnvilEnv("VITE_TIME_ARENA_ADDRESS");
  await buyCharmViaCast(STARTER_CHARM_WAD);
  const level = BigInt(anvilCastCall(ta, "level(address)(uint256)", [ANVIL_MOCK_WALLET]));
  if (level < 2n) {
    await buyCharmViaCast(STARTER_CHARM_WAD);
  }
  const levelAfter = BigInt(anvilCastCall(ta, "level(address)(uint256)", [ANVIL_MOCK_WALLET]));
  if (levelAfter < 2n) {
    throw new Error(`expected level >= 2 after starter buys, got ${levelAfter}`);
  }
}

/** Warp chain time past `podiumDeadline(category)` ([#350](https://gitlab.com/PlasticDigits/yieldomega/-/issues/350)). */
export async function warpAnvilPastPodiumDeadline(contractIndex: number): Promise<void> {
  const ta = requireAnvilEnv("VITE_TIME_ARENA_ADDRESS");
  const deadline = BigInt(
    anvilCastCall(ta, "podiumDeadline(uint256)(uint256)", [String(contractIndex)]),
  );
  if (deadline === 0n) {
    throw new Error(`podiumDeadline[${contractIndex}] is zero — timer not armed`);
  }
  const warpTo = Number(deadline + 5n);
  await anvilRpc("anvil_setNextBlockTimestamp", [warpTo]);
  await anvilRpc("anvil_mine", ["0x1"]);
}

/** Warp into the Last Buy hard-reset band (<13m remaining) ([#350](https://gitlab.com/PlasticDigits/yieldomega/-/issues/350)). */
export async function warpAnvilIntoLastBuyHardResetBand(): Promise<void> {
  const ta = requireAnvilEnv("VITE_TIME_ARENA_ADDRESS");
  const deadline = BigInt(anvilCastCall(ta, "deadline()(uint256)"));
  if (deadline === 0n) {
    throw new Error("Last Buy deadline is zero — timer not armed");
  }
  const warpTo = Number(deadline > 600n ? deadline - 600n : deadline);
  await anvilRpc("anvil_setNextBlockTimestamp", [warpTo]);
  await anvilRpc("anvil_mine", ["0x1"]);
}

/** Permissionless podium epoch roll from the mock wallet ([#350](https://gitlab.com/PlasticDigits/yieldomega/-/issues/350)). */
export function rollPodiumEpochOnchain(contractIndex: number): void {
  const ta = requireAnvilEnv("VITE_TIME_ARENA_ADDRESS");
  anvilCastSend(ta, "rollPodiumEpoch(uint8)", [String(contractIndex)]);
}

/** Poll indexer until head `read_block_number` catches chain tip ([#350](https://gitlab.com/PlasticDigits/yieldomega/-/issues/350)). */
export async function waitIndexerCaughtUp(timeoutMs = 60_000): Promise<void> {
  const base = process.env.VITE_INDEXER_URL ?? "http://127.0.0.1:3100";
  const rpc = process.env.VITE_RPC_URL ?? "http://127.0.0.1:8545";
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const headRes = await fetch(rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
    });
    const headBody = (await headRes.json()) as { result?: string };
    const headBlock = headBody.result ? Number.parseInt(headBody.result, 16) : 0;
    const timersRes = await fetch(`${base}/v1/arena/timers`);
    if (timersRes.ok) {
      const timers = (await timersRes.json()) as { read_block_number?: string };
      const readBlock = Number(timers.read_block_number ?? "0");
      if (readBlock >= headBlock && headBlock > 0) {
        return;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`indexer did not catch up within ${timeoutMs}ms`);
}

/** Poll indexer podiums until UX row epoch reaches `minEpoch` ([#350](https://gitlab.com/PlasticDigits/yieldomega/-/issues/350)). */
export async function waitIndexerPodiumUxEpoch(
  uxRowIndex: number,
  minEpoch: number,
  timeoutMs = 60_000,
): Promise<void> {
  const base = process.env.VITE_INDEXER_URL ?? "http://127.0.0.1:3100";
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${base}/v1/arena/podiums`);
    if (res.ok) {
      const body = (await res.json()) as { rows?: Array<{ epoch?: string }> };
      const epoch = Number(body.rows?.[uxRowIndex]?.epoch ?? "-1");
      if (Number.isFinite(epoch) && epoch >= minEpoch) {
        return;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`podium UX row ${uxRowIndex} epoch did not reach ${minEpoch} within ${timeoutMs}ms`);
}

/** Poll indexer session-summary until buys/podium activity since `sinceMs` (WYWA #338). */
export async function waitIndexerSessionSummaryActivity(
  sinceMs: number,
  timeoutMs = 60_000,
): Promise<void> {
  const base = process.env.VITE_INDEXER_URL ?? "http://127.0.0.1:3100";
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(
      `${base}/v1/arena/session-summary?since_ms=${encodeURIComponent(String(sinceMs))}`,
    );
    if (res.ok) {
      const body = (await res.json()) as { total_buys?: string; podium_updates?: string };
      const buys = Number(body.total_buys ?? "0");
      const updates = Number(body.podium_updates ?? "0");
      if ((Number.isFinite(buys) && buys > 0) || (Number.isFinite(updates) && updates > 0)) {
        return;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`indexer session-summary had no activity since ${sinceMs} within ${timeoutMs}ms`);
}
