// SPDX-License-Identifier: AGPL-3.0-only
//
// Single-transaction ETH / USDM → Kumbaya `exactOutput` → `TimeArena.buyFor` via
// `TimeArenaBuyRouter.buyViaKumbaya` (GitLab #251 / #264).

import { readContract } from "wagmi/actions";
import { waitForWriteReceipt } from "@/lib/realtimeTransaction";
import { writeContractWithGasBuffer, asWriteContractAsyncFn } from "@/lib/writeContractWithGasBuffer";
import { chainSecondsAtReceiptBlock } from "@/lib/timeArenaBuyCooldownUx";
import { assertSuccessfulBuyReceipt } from "@/lib/timeArenaBuyReceipt";
import type { Config } from "wagmi";
import { erc20Abi, timeArenaBuyRouterAbi, timeArenaReadAbi } from "@/lib/abis";
import {
  formatKumbayaWei,
  kumbayaBuyDebugError,
  kumbayaBuyDebugLog,
} from "@/lib/kumbayaBuyDebug";
import {
  quoteKumbayaArenaExactOutputAmountIn,
  readGrossDoubForCharmWad,
} from "@/lib/kumbayaQuoter";
import type { HexAddress } from "@/lib/addresses";
import type { KumbayaChainConfigResolved, RouteForPayOk } from "@/lib/kumbayaRoutes";
import {
  fetchSwapDeadlineUnixSec,
  KUMBAYA_SWAP_SLIPPAGE_BPS,
  swapMaxInputFromQuoted,
} from "@/lib/timeArenaKumbayaSwap";
import {
  assertWalletBuySessionUnchanged,
  type WalletBuySessionSnapshot,
} from "@/lib/walletBuySessionGuard";
import { playGameSfxCoinHitBuySubmit } from "@/audio/playGameSfx";

/** Same shape as `useWriteContract().writeContractAsync` (avoids hook import in a pure module). */
export type WalletWriteAsync = (args: {
  address: `0x${string}`;
  abi: readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
  gas?: bigint;
}) => Promise<`0x${string}`>;

const BYTES32_ZERO =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;
const PAY_ETH = 0;
const PAY_STABLE = 1;
const PAY_CL8Y = 2;

function bytes32OrZero(codeHash: `0x${string}` | undefined): `0x${string}` {
  if (codeHash && codeHash.length === 66) {
    return codeHash;
  }
  return BYTES32_ZERO;
}

export async function submitArenaKumbayaSingleTxBuy(params: {
  wagmiConfig: Config;
  writeContractAsync: WalletWriteAsync;
  userAddress: `0x${string}`;
  chainId: number;
  timeArenaBuyRouter: HexAddress;
  timeArenaAddress: HexAddress;
  doubAddress: HexAddress;
  payWith: "eth" | "usdm" | "cl8y";
  kConfig: KumbayaChainConfigResolved;
  route: RouteForPayOk;
  charmWad: bigint;
  codeHash: `0x${string}` | undefined;
  plantWarBowFlag: boolean;
  sessionSnapshot: WalletBuySessionSnapshot;
  onBuyMinedBeforeChainTimestamp?: () => void;
}): Promise<number> {
  const {
    wagmiConfig: cfg,
    writeContractAsync,
    userAddress,
    chainId,
    timeArenaBuyRouter,
    timeArenaAddress,
    doubAddress,
    payWith,
    kConfig,
    route,
    charmWad,
    codeHash,
    plantWarBowFlag,
    sessionSnapshot,
    onBuyMinedBeforeChainTimestamp,
  } = params;
  const router = timeArenaBuyRouter as `0x${string}`;
  const payDecimals = payWith === "usdm" ? 6 : 18;
  const paySymbol = payWith === "eth" ? "ETH" : payWith === "usdm" ? "USDM" : "CL8Y";

  kumbayaBuyDebugLog("arena-submit:start", {
    userAddress,
    chainId,
    payWith,
    router,
    timeArena: timeArenaAddress,
    doub: doubAddress,
    charmWad: charmWad.toString(),
    path: route.path,
  });

  try {
    const grossDoub = await readGrossDoubForCharmWad(cfg, timeArenaAddress, charmWad);
    assertWalletBuySessionUnchanged(cfg, sessionSnapshot);
    const qIn = await quoteKumbayaArenaExactOutputAmountIn(cfg, {
      quoter: kConfig.quoter,
      kConfig,
      payWith,
      doubAddress,
      amountOut: grossDoub,
    });
    assertWalletBuySessionUnchanged(cfg, sessionSnapshot);
    const maxIn = swapMaxInputFromQuoted(qIn, KUMBAYA_SWAP_SLIPPAGE_BPS);
    const payKind = payWith === "eth" ? PAY_ETH : payWith === "usdm" ? PAY_STABLE : PAY_CL8Y;
    const h = bytes32OrZero(codeHash);

    if (payWith === "usdm" || payWith === "cl8y") {
      const uAllow = await readContract(cfg, {
        address: route.tokenIn,
        abi: erc20Abi,
        functionName: "allowance",
        args: [userAddress, router],
      });
      assertWalletBuySessionUnchanged(cfg, sessionSnapshot);
      if (uAllow < maxIn) {
        const { hash: uAp } = await writeContractWithGasBuffer({
          wagmiConfig: cfg,
          writeContractAsync: asWriteContractAsyncFn(writeContractAsync),
          account: userAddress,
          chainId,
          address: route.tokenIn,
          abi: erc20Abi,
          functionName: "approve",
          args: [router, maxIn],
        });
        await waitForWriteReceipt(cfg, { hash: uAp });
        assertWalletBuySessionUnchanged(cfg, sessionSnapshot);
      }
    }

    const deadline = await fetchSwapDeadlineUnixSec(cfg, 600);
    assertWalletBuySessionUnchanged(cfg, sessionSnapshot);

    const buyArgs = [charmWad, h, plantWarBowFlag, payKind, deadline, maxIn, route.path] as const;
    kumbayaBuyDebugLog("arena-submit:write", {
      grossDoub: grossDoub.toString(),
      quotedIn: formatKumbayaWei(qIn, payDecimals, paySymbol),
      maxIn: formatKumbayaWei(maxIn, payDecimals, paySymbol),
    });

    const { hash } = await writeContractWithGasBuffer({
      wagmiConfig: cfg,
      writeContractAsync: asWriteContractAsyncFn(writeContractAsync),
      account: userAddress,
      chainId,
      address: router,
      abi: timeArenaBuyRouterAbi,
      functionName: "buyViaKumbaya",
      args: [...buyArgs],
      value: payWith === "eth" ? maxIn : undefined,
      onEstimateRevert: "rethrow",
      softCapGas: 8_000_000n,
    });
    assertWalletBuySessionUnchanged(cfg, sessionSnapshot);
    playGameSfxCoinHitBuySubmit();
    const receipt = await waitForWriteReceipt(cfg, { hash });
    assertSuccessfulBuyReceipt(receipt);
    onBuyMinedBeforeChainTimestamp?.();
    return chainSecondsAtReceiptBlock(cfg, receipt);
  } catch (err) {
    kumbayaBuyDebugError("arena-submit:failed", err, { payWith, charmWad: charmWad.toString(), router });
    throw err;
  }
}

export async function readArenaBuyRouterPreflight(
  wagmiConfig: Config,
  timeArenaAddress: HexAddress,
): Promise<{ paused: boolean; arenaStart: bigint; deadline: bigint }> {
  const [arenaStart, deadline, paused] = await Promise.all([
    readContract(wagmiConfig, {
      address: timeArenaAddress,
      abi: timeArenaReadAbi,
      functionName: "arenaStart",
    }),
    readContract(wagmiConfig, {
      address: timeArenaAddress,
      abi: timeArenaReadAbi,
      functionName: "deadline",
    }),
    readContract(wagmiConfig, {
      address: timeArenaAddress,
      abi: timeArenaReadAbi,
      functionName: "paused",
    }),
  ]);
  return { paused, arenaStart: arenaStart as bigint, deadline: deadline as bigint };
}
