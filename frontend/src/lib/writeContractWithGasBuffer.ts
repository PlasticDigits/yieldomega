// SPDX-License-Identifier: AGPL-3.0-only

import { estimateContractGas as defaultEstimateContractGas } from "viem/actions";
import { getPublicClient as defaultGetPublicClient } from "wagmi/actions";
import type { Abi } from "viem";
import type { Config } from "wagmi";
import { wagmiConfig as defaultWagmiConfig } from "@/wagmi-config";

type GetPublicClientFn = typeof defaultGetPublicClient;
type EstimateContractGasFn = typeof defaultEstimateContractGas;

/**
 * Writer signature compatible with `useWriteContract().writeContractAsync` plus an optional
 * `gas: bigint` override. Same shape that `WalletWriteAsync` advertises after the #176 extension
 * (see `frontend/src/lib/timeCurveKumbayaSingleTx.ts`).
 */
/**
 * Cast wagmi's `useWriteContract().writeContractAsync` (a complex discriminated union) to the
 * shape this helper expects. Use at the call site:
 *
 * ```ts
 * writeContractAsync: asWriteContractAsyncFn(writeContractAsync),
 * ```
 */
export function asWriteContractAsyncFn(fn: unknown): WriteContractAsyncFn {
  return fn as WriteContractAsyncFn;
}

export type WriteContractAsyncFn = (args: {
  address: `0x${string}`;
  abi: readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
  gas?: bigint;
}) => Promise<`0x${string}`>;

export type WriteContractWithGasBufferParams<TAbi extends Abi = Abi, TFn extends string = string> = {
  /** Override for tests; defaults to the shared `wagmiConfig`. */
  wagmiConfig?: Config;
  writeContractAsync: WriteContractAsyncFn;
  account: `0x${string}`;
  chainId?: number;
  address: `0x${string}`;
  abi: TAbi;
  functionName: TFn;
  args?: readonly unknown[];
  value?: bigint;
  /** Buffer numerator/denominator pair. Default 130/100 = +30%. Integer math only. */
  bufferNumerator?: bigint;
  bufferDenominator?: bigint;
  /**
   * Hard ceiling on the buffered gas units. When set and the buffered estimate exceeds it,
   * throw `GasSoftCapExceededError` instead of submitting. Caller picks the cap per site.
   */
  softCapGas?: bigint;
  /**
   * Behaviour when `estimateContractGas` itself rejects (RPC error, simulation revert, etc.):
   *  - `"submit-without-override"` (default) — fall through to `writeContractAsync` without
   *    the `gas` field; wallet's own estimator is used.
   *  - `"rethrow"` — surface the estimation error so the caller's existing `try/catch`
   *    (e.g. `friendlyRevertFromUnknown`) blocks submission.
   */
  onEstimateRevert?: "submit-without-override" | "rethrow";
  /** Override for tests; defaults to wagmi's `getPublicClient`. */
  getPublicClient?: GetPublicClientFn;
  /** Override for tests; defaults to viem's `estimateContractGas`. */
  estimateContractGas?: EstimateContractGasFn;
};

export type WriteContractWithGasBufferResult = {
  hash: `0x${string}`;
  /** `undefined` when the `gas` override was not applied (no client / estimate skipped). */
  gasUsedOverride: bigint | undefined;
  /** Raw estimate before buffering, when available. */
  estimatedGas: bigint | undefined;
};

export class GasSoftCapExceededError extends Error {
  readonly estimatedGas: bigint;
  readonly bufferedGas: bigint;
  readonly softCapGas: bigint;
  constructor(estimatedGas: bigint, bufferedGas: bigint, softCapGas: bigint) {
    super(
      `Gas estimate exceeds soft cap: estimated=${estimatedGas} buffered=${bufferedGas} cap=${softCapGas}`,
    );
    this.name = "GasSoftCapExceededError";
    this.estimatedGas = estimatedGas;
    this.bufferedGas = bufferedGas;
    this.softCapGas = softCapGas;
  }
}

const DEFAULT_BUFFER_NUMERATOR = 130n;
const DEFAULT_BUFFER_DENOMINATOR = 100n;

/**
 * Pre-flight `estimateContractGas`, multiply by `bufferNumerator/bufferDenominator` (default
 * +30%), optionally enforce a soft cap, then submit via `writeContractAsync` with the buffered
 * gas units as `gas`. On estimation failure the behaviour follows `onEstimateRevert`.
 *
 * Bigint arithmetic only — no `Number()` round-trip.
 */
export async function writeContractWithGasBuffer<TAbi extends Abi, TFn extends string>(params: WriteContractWithGasBufferParams<TAbi, TFn>): Promise<WriteContractWithGasBufferResult> {
  const {
    wagmiConfig = defaultWagmiConfig,
    writeContractAsync,
    account,
    chainId,
    address,
    abi,
    functionName,
    args,
    value,
    bufferNumerator = DEFAULT_BUFFER_NUMERATOR,
    bufferDenominator = DEFAULT_BUFFER_DENOMINATOR,
    softCapGas,
    onEstimateRevert = "submit-without-override",
    getPublicClient = defaultGetPublicClient,
    estimateContractGas = defaultEstimateContractGas,
  } = params;

  const client = chainId !== undefined ? getPublicClient(wagmiConfig, { chainId }) : getPublicClient(wagmiConfig);

  let estimatedGas: bigint | undefined;
  if (client) {
    try {
      estimatedGas = await estimateContractGas(client, {
        address,
        abi,
        functionName,
        args,
        account,
        value,
      } as Parameters<typeof estimateContractGas>[1]);
    } catch (estErr) {
      if (onEstimateRevert === "rethrow") {
        throw estErr;
      }
      estimatedGas = undefined;
    }
  }

  let bufferedGas: bigint | undefined;
  if (estimatedGas !== undefined) {
    bufferedGas = (estimatedGas * bufferNumerator) / bufferDenominator;
    if (softCapGas !== undefined && bufferedGas > softCapGas) {
      throw new GasSoftCapExceededError(estimatedGas, bufferedGas, softCapGas);
    }
  }

  const hash = await writeContractAsync(
    bufferedGas !== undefined
      ? { address, abi, functionName, args, value, gas: bufferedGas }
      : { address, abi, functionName, args, value },
  );
  return { hash, gasUsedOverride: bufferedGas, estimatedGas };
}
