// SPDX-License-Identifier: AGPL-3.0-only
//
// Kumbaya (MegaETH v3) routing for TimeCurve multi-asset entry. Deployment runbooks
// and upstream address parity: docs/integrations/kumbaya.md (GitLab #46).

import type { HexAddress } from "@/lib/addresses";
import { parseHexAddress } from "@/lib/addresses";

/** User-selected spend asset for TimeCurve entry (issue #41). */
export type PayWithAsset = "cl8y" | "eth" | "usdm";

export type KumbayaResolveErrorReason =
  | "unsupported_chain"
  | "missing_router"
  | "missing_quoter"
  | "missing_weth"
  | "missing_usdm"
  | "no_route";

const ZERO = "0x0000000000000000000000000000000000000000" as HexAddress;

export type KumbayaChainConfigResolved = {
  chainId: number;
  weth: HexAddress;
  /** USDM (or chain reserve stable); required for `usdm` pay mode. */
  usdm: HexAddress;
  swapRouter: HexAddress;
  quoter: HexAddress;
  /** Pool fee tier CL8Y ↔ WETH (uint24). */
  cl8yWethFee: number;
  /** Pool fee tier USDM ↔ WETH (uint24). */
  usdmWethFee: number;
};

export type KumbayaResolveOk = { ok: true; config: KumbayaChainConfigResolved };
export type KumbayaResolveErr = { ok: false; reason: KumbayaResolveErrorReason; message: string };
export type KumbayaResolveResult = KumbayaResolveOk | KumbayaResolveErr;

/** Env keys merged over the static table (Vite: `import.meta.env`). */
export type KumbayaEnv = Record<string, string | boolean | undefined>;

function isZeroAddr(a: HexAddress | undefined): boolean {
  return !a || a === ZERO;
}

function parseFee(key: string, env: KumbayaEnv, fallback: number): number {
  const raw = env[key];
  if (raw === undefined || raw === "") return fallback;
  const n = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n < 0 || n > 0xffffff) return fallback;
  return n;
}

/**
 * Hardcoded defaults per chain. Unknown `chainId` → unsupported.
 * MegaETH rows mirror [Kumbaya-xyz/integrator-kit](https://github.com/Kumbaya-xyz/integrator-kit)
 * `addresses/megaETH-*.json` (SwapRouter02, QuoterV2, WETH9). Mainnet **USDm** from
 * [default-token-list](https://github.com/Kumbaya-xyz/default-token-list) (`megaeth.json`).
 * Anvil: only fee tiers; addresses from `VITE_KUMBAYA_*` after fixture deploy.
 */
const CHAIN_DEFAULTS: Partial<
  Record<
    number,
    Pick<KumbayaChainConfigResolved, "cl8yWethFee" | "usdmWethFee"> &
      Partial<Pick<KumbayaChainConfigResolved, "weth" | "usdm" | "swapRouter" | "quoter">>
  >
> = {
  // Anvil: addresses come from deploy + VITE_*; fee tiers only here.
  31337: { cl8yWethFee: 3000, usdmWethFee: 3000 },
  /** MegaETH testnet — integrator-kit `megaETH-testnet.json`. No default USDm on token list; set `VITE_KUMBAYA_USDM` when stable pools exist. */
  6343: {
    cl8yWethFee: 3000,
    usdmWethFee: 3000,
    weth: "0x4200000000000000000000000000000000000006",
    swapRouter: "0x8268DC930BA98759E916DEd4c9F367A844814023",
    quoter: "0xfb230b93803F90238cB03f254452bA3a3b0Ec38d",
  },
  /** MegaETH mainnet — integrator-kit `megaETH-mainnet.json`; USDm (MegaUSD) per default-token-list. */
  4326: {
    cl8yWethFee: 3000,
    usdmWethFee: 3000,
    weth: "0x4200000000000000000000000000000000000006",
    swapRouter: "0xE5BbEF8De2DB447a7432A47EBa58924d94eE470e",
    quoter: "0x1F1a8dC7E138C34b503Ca080962aC10B75384a27",
    usdm: "0xFAfDdbb3FC7688494971a79cc65DCa3EF82079E7",
  },
};

function envAddr(env: KumbayaEnv, key: string): HexAddress | undefined {
  const v = env[key];
  if (v === undefined || typeof v === "boolean") return undefined;
  return parseHexAddress(String(v));
}

/**
 * Merge static table + `VITE_KUMBAYA_*` env. Pure aside from reading `env`.
 */
export function resolveKumbayaRouting(chainId: number, env: KumbayaEnv): KumbayaResolveResult {
  const defaults = CHAIN_DEFAULTS[chainId];
  if (defaults === undefined) {
    return {
      ok: false,
      reason: "unsupported_chain",
      message: `Kumbaya routing is not configured for chain ${chainId}.`,
    };
  }

  const weth = envAddr(env, "VITE_KUMBAYA_WETH") ?? defaults.weth;
  const usdm = envAddr(env, "VITE_KUMBAYA_USDM") ?? defaults.usdm;
  const swapRouter = envAddr(env, "VITE_KUMBAYA_SWAP_ROUTER") ?? defaults.swapRouter;
  const quoter = envAddr(env, "VITE_KUMBAYA_QUOTER") ?? defaults.quoter;
  const cl8yWethFee = parseFee("VITE_KUMBAYA_FEE_CL8Y_WETH", env, defaults.cl8yWethFee);
  const usdmWethFee = parseFee("VITE_KUMBAYA_FEE_USDM_WETH", env, defaults.usdmWethFee);

  if (isZeroAddr(swapRouter)) {
    return {
      ok: false,
      reason: "missing_router",
      message: "Kumbaya swap router address is missing for this chain.",
    };
  }
  if (isZeroAddr(quoter)) {
    return {
      ok: false,
      reason: "missing_quoter",
      message: "Kumbaya quoter address is missing for this chain.",
    };
  }
  if (isZeroAddr(weth)) {
    return {
      ok: false,
      reason: "missing_weth",
      message: "Wrapped native (WETH) address is missing for this chain.",
    };
  }

  return {
    ok: true,
    config: {
      chainId,
      weth: weth!,
      usdm: usdm ?? ZERO,
      swapRouter: swapRouter!,
      quoter: quoter!,
      cl8yWethFee,
      usdmWethFee,
    },
  };
}

/** Uniswap v3–style packed path: token + uint24 fee + token + … */
export function buildV3PathExactOutput(
  /** Ordered from **output** token to **input** token (Uniswap `exactOutput` encoding). */
  tokenOutToIn: readonly HexAddress[],
  fees: readonly number[],
): `0x${string}` {
  if (tokenOutToIn.length < 2 || fees.length !== tokenOutToIn.length - 1) {
    throw new Error("kumbayaRoutes: tokenOutToIn and fees length mismatch");
  }
  const norm = (a: HexAddress) => a.slice(2).toLowerCase();
  let hex = norm(tokenOutToIn[0]!);
  for (let i = 0; i < fees.length; i++) {
    const fee = fees[i]!;
    if (fee < 0 || fee > 0xffffff) {
      throw new Error("kumbayaRoutes: fee must fit uint24");
    }
    hex += fee.toString(16).padStart(6, "0");
    hex += norm(tokenOutToIn[i + 1]!);
  }
  return `0x${hex}` as `0x${string}`;
}

export type RouteForPayOk = {
  ok: true;
  /** Path for `exactOutput` / `quoteExactOutput`. */
  path: `0x${string}`;
  /** ERC-20 spent at the start of the path (WETH for ETH mode, USDM for USDM). */
  tokenIn: HexAddress;
};

export type RouteForPayErr = { ok: false; reason: KumbayaResolveErrorReason; message: string };
export type RouteForPayResult = RouteForPayOk | RouteForPayErr;

/**
 * Build `exactOutput` path and input token for paying with ETH (WETH), USDM, or direct CL8Y.
 */
export function routingForPayAsset(
  payWith: PayWithAsset,
  acceptedCl8y: HexAddress,
  config: KumbayaChainConfigResolved,
): RouteForPayResult {
  if (payWith === "cl8y") {
    return { ok: true, path: "0x" as `0x${string}`, tokenIn: acceptedCl8y };
  }
  if (payWith === "eth") {
    try {
      const path = buildV3PathExactOutput([acceptedCl8y, config.weth], [config.cl8yWethFee]);
      return { ok: true, path, tokenIn: config.weth };
    } catch {
      return { ok: false, reason: "no_route", message: "Could not build ETH routing path." };
    }
  }
  if (payWith === "usdm") {
    if (isZeroAddr(config.usdm)) {
      return {
        ok: false,
        reason: "missing_usdm",
        message: "USDM is not configured for this chain.",
      };
    }
    try {
      const path = buildV3PathExactOutput(
        [acceptedCl8y, config.weth, config.usdm],
        [config.cl8yWethFee, config.usdmWethFee],
      );
      return { ok: true, path, tokenIn: config.usdm };
    } catch {
      return { ok: false, reason: "no_route", message: "Could not build USDM routing path." };
    }
  }
  return { ok: false, reason: "no_route", message: "Unsupported pay asset." };
}

/**
 * Onchain `TimeCurve.timeCurveBuyRouter` is authoritative for **single-tx** Kumbaya entry
 * ([`TimeCurveBuyRouter`](../../../contracts/src/TimeCurveBuyRouter.sol), [issue #66](https://gitlab.com/PlasticDigits/yieldomega/-/issues/66)).
 * Optional `VITE_KUMBAYA_TIMECURVE_BUY_ROUTER` must match the onchain address when set (fail closed).
 */
export type TimeCurveBuyRouterForSingleTxResult =
  | { kind: "none" }
  | { kind: "mismatch"; message: string }
  | { kind: "ok"; router: HexAddress };

export function resolveTimeCurveBuyRouterForKumbayaSingleTx(
  onchain: HexAddress | undefined,
  env: KumbayaEnv,
): TimeCurveBuyRouterForSingleTxResult {
  const fromEnv = envAddr(env, "VITE_KUMBAYA_TIMECURVE_BUY_ROUTER");
  if (isZeroAddr(onchain)) {
    if (fromEnv && !isZeroAddr(fromEnv)) {
      return {
        kind: "mismatch",
        message:
          "VITE_KUMBAYA_TIMECURVE_BUY_ROUTER is set but onchain timeCurveBuyRouter is zero — remove the env var or call setTimeCurveBuyRouter on TimeCurve.",
      };
    }
    return { kind: "none" };
  }
  if (fromEnv && !isZeroAddr(fromEnv) && fromEnv.toLowerCase() !== onchain!.toLowerCase()) {
    return {
      kind: "mismatch",
      message: "VITE_KUMBAYA_TIMECURVE_BUY_ROUTER does not match onchain timeCurveBuyRouter.",
    };
  }
  return { kind: "ok", router: onchain! };
}

/** Minimum CL8Y out after slippage (BPS). */
export function minOutFromSlippage(amountOut: bigint, slippageBps: number): bigint {
  if (slippageBps < 0 || slippageBps > 10_000) {
    throw new Error("kumbayaRoutes: slippageBps must be 0..10000");
  }
  return (amountOut * BigInt(10_000 - slippageBps)) / 10_000n;
}
