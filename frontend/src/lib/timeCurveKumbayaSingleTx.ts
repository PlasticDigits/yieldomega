// SPDX-License-Identifier: AGPL-3.0-only
//
// Single-transaction ETH / USDM → Kumbaya `exactOutput` → `TimeArena.buyFor` via
// `TimeArenaBuyRouter.buyViaKumbaya` (GitLab #251 / #264).

import { simulateContract } from "viem/actions";
import { getPublicClient, readContract } from "wagmi/actions";
import { waitForWriteReceipt } from "@/lib/realtimeTransaction";
import { writeContractWithGasBuffer, asWriteContractAsyncFn } from "@/lib/writeContractWithGasBuffer";
import { chainSecondsAtReceiptBlock } from "@/lib/timeCurveBuyCooldownUx";
import { assertSuccessfulBuyReceipt } from "@/lib/timeCurveBuyReceipt";
import type { Config } from "wagmi";
import { erc20Abi, timeArenaBuyRouterAbi, timeArenaReadAbi } from "@/lib/abis";
import { ARENA_CHARM_MAX_WAD, ARENA_CHARM_MIN_WAD } from "@/lib/arenaConstants";
import {
  formatKumbayaWei,
  isKumbayaBuyDebugEnabled,
  kumbayaBuyDebugError,
  kumbayaBuyDebugLog,
} from "@/lib/kumbayaBuyDebug";
import { quoteKumbayaExactOutputAmountIn, readGrossDoubForCharmWad } from "@/lib/kumbayaQuoter";
import type { HexAddress } from "@/lib/addresses";
import type { KumbayaChainConfigResolved, RouteForPayOk } from "@/lib/kumbayaRoutes";
import {
  fetchSwapDeadlineUnixSec,
  KUMBAYA_SWAP_SLIPPAGE_BPS,
  readSwapDeadlineChainTimestampSec,
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
  gas?: bigint;
}) => Promise<`0x${string}`>;

function bytes32OrZero(codeHash: `0x${string}` | undefined): `0x${string}` {
  if (codeHash && codeHash.length === 66) {
    return codeHash;
  }
  return BYTES32_ZERO;
}

async function logBuyViaKumbayaPreflight(params: {
  wagmiConfig: Config;
  timeArenaAddress: HexAddress;
  timeArenaBuyRouter: HexAddress;
  userAddress: `0x${string}`;
  chainId: number;
  payWith: "eth" | "usdm";
  charmWad: bigint;
  grossDoub: bigint;
  qIn: bigint;
  maxIn: bigint;
  deadline: bigint;
  route: RouteForPayOk;
  kConfig: KumbayaChainConfigResolved;
}): Promise<void> {
  const {
    wagmiConfig,
    timeArenaAddress,
    timeArenaBuyRouter,
    userAddress,
    chainId,
    payWith,
    charmWad,
    grossDoub,
    qIn,
    maxIn,
    deadline,
    route,
    kConfig,
  } = params;

  const [arenaStart, deadlineSec, priceNow, ethBal, usdmBal, uAllow] = await Promise.all([
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
      functionName: "charmPriceWad",
    }),
    payWith === "eth"
      ? getPublicClient(wagmiConfig, { chainId })?.getBalance({ address: userAddress })
      : Promise.resolve(undefined),
    payWith === "usdm"
      ? readContract(wagmiConfig, {
          address: route.tokenIn,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [userAddress],
        })
      : Promise.resolve(undefined),
    payWith === "usdm"
      ? readContract(wagmiConfig, {
          address: route.tokenIn,
          abi: erc20Abi,
          functionName: "allowance",
          args: [userAddress, timeArenaBuyRouter],
        })
      : Promise.resolve(undefined),
  ]);

  const chainNow = await readSwapDeadlineChainTimestampSec(wagmiConfig);
  const grossOnchain = (charmWad * (priceNow as bigint)) / 10n ** 18n;

  kumbayaBuyDebugLog("preflight:onchain-reads", {
    chainId,
    chainNowSec: chainNow,
    swapDeadline: deadline.toString(),
    deadlineExpired: chainNow > Number(deadlineSec),
    arenaStart: (arenaStart as bigint).toString(),
    charmWad: charmWad.toString(),
    charmBounds: { min: ARENA_CHARM_MIN_WAD.toString(), max: ARENA_CHARM_MAX_WAD.toString() },
    charmPriceWad: (priceNow as bigint).toString(),
    grossDoubFrontend: grossDoub.toString(),
    grossDoubOnchainNow: grossOnchain.toString(),
    grossDoubDriftWei: (grossOnchain - grossDoub).toString(),
    quotedPayIn: qIn.toString(),
    maxIn: maxIn.toString(),
    slippageBps: KUMBAYA_SWAP_SLIPPAGE_BPS,
    maxInCoversQuote: maxIn >= qIn,
    payWith,
    path: route.path,
    router: timeArenaBuyRouter,
    swapRouter: kConfig.swapRouter,
    quoter: kConfig.quoter,
    weth: kConfig.weth,
    usdm: kConfig.usdm,
    ethBalanceWei: ethBal?.toString(),
    usdmBalance: usdmBal?.toString(),
    usdmAllowanceRouter: uAllow?.toString(),
    msgValueEqualsMaxIn: payWith === "eth",
  });
}

async function simulateBuyViaKumbaya(params: {
  wagmiConfig: Config;
  chainId: number;
  router: `0x${string}`;
  userAddress: `0x${string}`;
  charmWad: bigint;
  codeHash: `0x${string}`;
  plantWarBowFlag: boolean;
  payKind: number;
  deadline: bigint;
  maxIn: bigint;
  path: `0x${string}`;
  payWith: "eth" | "usdm";
}): Promise<void> {
  const client = getPublicClient(params.wagmiConfig, { chainId: params.chainId });
  if (!client) {
    kumbayaBuyDebugLog("simulate:skip", { reason: "no public client" });
    return;
  }
  try {
    await simulateContract(client, {
      address: params.router,
      abi: timeArenaBuyRouterAbi,
      functionName: "buyViaKumbaya",
      args: [
        params.charmWad,
        params.codeHash,
        params.plantWarBowFlag,
        params.payKind,
        params.deadline,
        params.maxIn,
        params.path,
      ],
      account: params.userAddress,
      value: params.payWith === "eth" ? params.maxIn : undefined,
    });
    kumbayaBuyDebugLog("simulate:ok");
  } catch (simErr) {
    kumbayaBuyDebugError("simulate:reverted", simErr);
  }
}

/**
 * `quoteExactOutput` + slippage + `buyViaKumbaya` in one user-signed write (or two when USDM
 * still needs a separate `approve` to `timeArenaBuyRouter`).
 */
export async function submitKumbayaSingleTxBuy(params: {
  wagmiConfig: Config;
  writeContractAsync: WalletWriteAsync;
  userAddress: `0x${string}`;
  chainId: number;
  timeCurveBuyRouter: HexAddress;
  /** TimeArena proxy — used to match router gross DOUB at inclusion. */
  timeCurveAddress: HexAddress;
  payWith: "eth" | "usdm";
  kConfig: KumbayaChainConfigResolved;
  route: RouteForPayOk;
  /** TimeArena `doub()` — swap `exactOutput` target token. */
  acceptedCl8y: HexAddress;
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
    timeCurveBuyRouter,
    timeCurveAddress,
    payWith,
    kConfig,
    route,
    acceptedCl8y,
    charmWad,
    codeHash,
    plantWarBowFlag,
    sessionSnapshot,
    onBuyMinedBeforeChainTimestamp,
  } = params;
  const router = timeCurveBuyRouter as `0x${string}`;
  const payDecimals = payWith === "usdm" ? 6 : 18;

  kumbayaBuyDebugLog("submit:start", {
    userAddress,
    chainId,
    payWith,
    router,
    timeArena: timeCurveAddress,
    doub: acceptedCl8y,
    charmWad: charmWad.toString(),
    plantWarBowFlag,
    codeHash: codeHash ?? null,
    path: route.path,
    tokenIn: route.tokenIn,
  });

  try {
    const grossDoub = await readGrossDoubForCharmWad(cfg, timeCurveAddress, charmWad);
    assertWalletBuySessionUnchanged(cfg, sessionSnapshot);
    const qIn = await quoteKumbayaExactOutputAmountIn(cfg, {
      quoter: kConfig.quoter,
      kConfig,
      payWith,
      acceptedCl8y,
      amountOut: grossDoub,
    });
    assertWalletBuySessionUnchanged(cfg, sessionSnapshot);
    const maxIn = swapMaxInputFromQuoted(qIn, KUMBAYA_SWAP_SLIPPAGE_BPS);
    const payKind = payWith === "eth" ? PAY_ETH : PAY_STABLE;
    const h = bytes32OrZero(codeHash);

    kumbayaBuyDebugLog("submit:sized", {
      grossDoub: grossDoub.toString(),
      quotedIn: formatKumbayaWei(qIn, payDecimals, payWith === "eth" ? "ETH" : "USDM"),
      maxIn: formatKumbayaWei(maxIn, payDecimals, payWith === "eth" ? "ETH" : "USDM"),
      payKind,
    });

    if (payWith === "usdm") {
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

    if (isKumbayaBuyDebugEnabled()) {
      await logBuyViaKumbayaPreflight({
        wagmiConfig: cfg,
        timeArenaAddress: timeCurveAddress,
        timeArenaBuyRouter: timeCurveBuyRouter,
        userAddress,
        chainId,
        payWith,
        charmWad,
        grossDoub,
        qIn,
        maxIn,
        deadline,
        route,
        kConfig,
      });
      await simulateBuyViaKumbaya({
        wagmiConfig: cfg,
        chainId,
        router,
        userAddress,
        charmWad,
        codeHash: h,
        plantWarBowFlag,
        payKind,
        deadline,
        maxIn,
        path: route.path,
        payWith,
      });
    }

    const buyArgs = [charmWad, h, plantWarBowFlag, payKind, deadline, maxIn, route.path] as const;
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
    assertWalletBuySessionUnchanged(cfg, sessionSnapshot);
    onBuyMinedBeforeChainTimestamp?.();
    return chainSecondsAtReceiptBlock(cfg, receipt);
  } catch (err) {
    kumbayaBuyDebugError("submit:failed", err, {
      payWith,
      charmWad: charmWad.toString(),
      router,
      path: route.path,
    });
    throw err;
  }
}

export { BYTES32_ZERO, PAY_ETH, PAY_STABLE };
