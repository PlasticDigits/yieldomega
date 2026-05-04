// SPDX-License-Identifier: AGPL-3.0-only
//
// Single-transaction ETH / USDM → Kumbaya `exactOutput` → `TimeCurve.buyFor` via
// `TimeCurveBuyRouter.buyViaKumbaya` (issue #66). Two-step swap + `buy` remains when
// `timeCurveBuyRouter` is zero onchain.

import { readContract, waitForTransactionReceipt } from "wagmi/actions";
import type { Config } from "wagmi";
import { erc20Abi, kumbayaQuoterV2Abi, timeCurveBuyRouterAbi } from "@/lib/abis";
import type { HexAddress } from "@/lib/addresses";
import type { KumbayaChainConfigResolved, RouteForPayOk } from "@/lib/kumbayaRoutes";
import {
  fetchSwapDeadlineUnixSec,
  KUMBAYA_SWAP_SLIPPAGE_BPS,
  swapMaxInputFromQuoted,
} from "@/lib/timeCurveKumbayaSwap";
import {
  assertWalletBuySessionUnchanged,
  type WalletBuySessionSnapshot,
} from "@/lib/walletBuySessionGuard";
import { playGameSfxCoinHitBuySubmit } from "@/audio/playGameSfx";

const BYTES32_ZERO =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;
const PAY_ETH = 0;
const PAY_STABLE = 1;

/** Same shape as `useWriteContract().writeContractAsync` (avoids hook import in a pure module). */
export type WalletWriteAsync = (args: {
  address: `0x${string}`;
  abi: readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
}) => Promise<`0x${string}`>;

function bytes32OrZero(codeHash: `0x${string}` | undefined): `0x${string}` {
  if (codeHash && codeHash.length === 66) {
    return codeHash;
  }
  return BYTES32_ZERO;
}

/**
 * `quoteExactOutput` + slippage + `buyViaKumbaya` in one user-signed write (or two when USDM
 * still needs a separate `approve` to `timeCurveBuyRouter`).
 *
 * **`sessionSnapshot`** — latched wallet session after submit-time sizing; aborts if account or
 * chain drift across internal awaits ([GitLab #144](https://gitlab.com/PlasticDigits/yieldomega/-/issues/144)).
 */
export async function submitKumbayaSingleTxBuy(params: {
  wagmiConfig: Config;
  writeContractAsync: WalletWriteAsync;
  userAddress: `0x${string}`;
  timeCurveBuyRouter: HexAddress;
  payWith: "eth" | "usdm";
  kConfig: KumbayaChainConfigResolved;
  route: RouteForPayOk;
  cl8yOut: bigint;
  charmWad: bigint;
  codeHash: `0x${string}` | undefined;
  /** Same opt-in as `TimeCurve.buy` / `buyFor` ([issue #63](https://gitlab.com/PlasticDigits/yieldomega/-/issues/63)). */
  plantWarBowFlag: boolean;
  sessionSnapshot: WalletBuySessionSnapshot;
}): Promise<void> {
  const {
    wagmiConfig: cfg,
    writeContractAsync,
    userAddress,
    timeCurveBuyRouter,
    payWith,
    kConfig,
    route,
    cl8yOut,
    charmWad,
    codeHash,
    plantWarBowFlag,
    sessionSnapshot,
  } = params;
  const router = timeCurveBuyRouter as `0x${string}`;

  const quote = await readContract(cfg, {
    address: kConfig.quoter,
    abi: kumbayaQuoterV2Abi,
    functionName: "quoteExactOutput",
    args: [route.path, cl8yOut],
  });
  assertWalletBuySessionUnchanged(cfg, sessionSnapshot);
  const qIn = (quote as readonly [bigint, ...unknown[]])[0];
  const maxIn = swapMaxInputFromQuoted(qIn, KUMBAYA_SWAP_SLIPPAGE_BPS);
  const payKind = payWith === "eth" ? PAY_ETH : PAY_STABLE;
  const h = bytes32OrZero(codeHash);

  if (payWith === "usdm") {
    const uAllow = await readContract(cfg, {
      address: route.tokenIn,
      abi: erc20Abi,
      functionName: "allowance",
      args: [userAddress, router],
    });
    assertWalletBuySessionUnchanged(cfg, sessionSnapshot);
    if (uAllow < maxIn) {
      const uAp = await writeContractAsync({
        address: route.tokenIn,
        abi: erc20Abi,
        functionName: "approve",
        args: [router, maxIn],
      });
      await waitForTransactionReceipt(cfg, { hash: uAp });
      assertWalletBuySessionUnchanged(cfg, sessionSnapshot);
    }
  }

  const deadline = await fetchSwapDeadlineUnixSec(cfg, 600);
  assertWalletBuySessionUnchanged(cfg, sessionSnapshot);
  const hash = await writeContractAsync({
    address: router,
    abi: timeCurveBuyRouterAbi,
    functionName: "buyViaKumbaya",
    args: [charmWad, h, plantWarBowFlag, payKind, deadline, maxIn, route.path],
    value: payWith === "eth" ? maxIn : undefined,
  });
  assertWalletBuySessionUnchanged(cfg, sessionSnapshot);
  playGameSfxCoinHitBuySubmit();
  await waitForTransactionReceipt(cfg, { hash });
  assertWalletBuySessionUnchanged(cfg, sessionSnapshot);
}

export { BYTES32_ZERO, PAY_ETH, PAY_STABLE };
