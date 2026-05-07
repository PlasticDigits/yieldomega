// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it, vi } from "vitest";
import {
  writeContractWithGasBuffer,
  GasSoftCapExceededError,
  type WriteContractAsyncFn,
} from "./writeContractWithGasBuffer";

const TX_HASH = "0xabcdef0000000000000000000000000000000000000000000000000000000001" as const;
const ACCOUNT = "0x1111111111111111111111111111111111111111" as const;
const CONTRACT = "0x2222222222222222222222222222222222222222" as const;

const FAKE_CONFIG = { stub: "wagmi-config" } as unknown as Parameters<typeof writeContractWithGasBuffer>[0]["wagmiConfig"];
const FAKE_CLIENT = { stub: "public-client" } as unknown as ReturnType<NonNullable<Parameters<typeof writeContractWithGasBuffer>[0]["getPublicClient"]>>;

function makeWriter(returnHash: `0x${string}` = TX_HASH): { fn: WriteContractAsyncFn; calls: Array<Parameters<WriteContractAsyncFn>[0]> } {
  const calls: Array<Parameters<WriteContractAsyncFn>[0]> = [];
  const fn: WriteContractAsyncFn = async (args) => {
    calls.push(args);
    return returnHash;
  };
  return { fn, calls };
}

describe("writeContractWithGasBuffer", () => {
  it("buffers a 100k estimate to 130k by default and forwards gas to the writer", async () => {
    const { fn: writeContractAsync, calls } = makeWriter();
    const getPublicClient = vi.fn(() => FAKE_CLIENT);
    const estimateContractGas = vi.fn(async () => 100_000n);

    const result = await writeContractWithGasBuffer({
      wagmiConfig: FAKE_CONFIG,
      writeContractAsync,
      account: ACCOUNT,
      address: CONTRACT,
      abi: [],
      functionName: "doStuff",
      getPublicClient,
      estimateContractGas,
    });

    expect(result.estimatedGas).toBe(100_000n);
    expect(result.gasUsedOverride).toBe(130_000n);
    expect(result.hash).toBe(TX_HASH);
    expect(calls).toHaveLength(1);
    expect(calls[0].gas).toBe(130_000n);
  });

  it("supports a custom buffer ratio (numerator/denominator)", async () => {
    const { fn: writeContractAsync, calls } = makeWriter();
    const getPublicClient = vi.fn(() => FAKE_CLIENT);
    const estimateContractGas = vi.fn(async () => 200_000n);

    const result = await writeContractWithGasBuffer({
      wagmiConfig: FAKE_CONFIG,
      writeContractAsync,
      account: ACCOUNT,
      address: CONTRACT,
      abi: [],
      functionName: "doStuff",
      bufferNumerator: 150n,
      bufferDenominator: 100n,
      getPublicClient,
      estimateContractGas,
    });

    expect(result.gasUsedOverride).toBe(300_000n);
    expect(calls[0].gas).toBe(300_000n);
  });

  it("does integer arithmetic on bigints above Number.MAX_SAFE_INTEGER without drift", async () => {
    const { fn: writeContractAsync, calls } = makeWriter();
    const getPublicClient = vi.fn(() => FAKE_CLIENT);
    const huge = 2n ** 53n + 7n;
    const estimateContractGas = vi.fn(async () => huge);

    const result = await writeContractWithGasBuffer({
      wagmiConfig: FAKE_CONFIG,
      writeContractAsync,
      account: ACCOUNT,
      address: CONTRACT,
      abi: [],
      functionName: "doStuff",
      getPublicClient,
      estimateContractGas,
    });

    const expected = (huge * 130n) / 100n;
    expect(result.gasUsedOverride).toBe(expected);
    expect(calls[0].gas).toBe(expected);
  });

  it("submits without a gas field when the public client is null", async () => {
    const { fn: writeContractAsync, calls } = makeWriter();
    const getPublicClient = vi.fn(() => null as unknown as typeof FAKE_CLIENT);
    const estimateContractGas = vi.fn(async () => 100_000n);

    const result = await writeContractWithGasBuffer({
      wagmiConfig: FAKE_CONFIG,
      writeContractAsync,
      account: ACCOUNT,
      address: CONTRACT,
      abi: [],
      functionName: "doStuff",
      getPublicClient,
      estimateContractGas,
    });

    expect(result.gasUsedOverride).toBeUndefined();
    expect(result.estimatedGas).toBeUndefined();
    expect(estimateContractGas).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
    expect(calls[0]).not.toHaveProperty("gas");
  });

  it("falls through without gas when estimate rejects under default 'submit-without-override'", async () => {
    const { fn: writeContractAsync, calls } = makeWriter();
    const getPublicClient = vi.fn(() => FAKE_CLIENT);
    const estimateContractGas = vi.fn(async () => {
      throw new Error("execution reverted");
    });

    const result = await writeContractWithGasBuffer({
      wagmiConfig: FAKE_CONFIG,
      writeContractAsync,
      account: ACCOUNT,
      address: CONTRACT,
      abi: [],
      functionName: "doStuff",
      getPublicClient,
      estimateContractGas,
    });

    expect(result.gasUsedOverride).toBeUndefined();
    expect(result.estimatedGas).toBeUndefined();
    expect(calls).toHaveLength(1);
    expect(calls[0]).not.toHaveProperty("gas");
  });

  it("rethrows estimate failures when onEstimateRevert is 'rethrow' and never invokes the writer", async () => {
    const { fn: writeContractAsync, calls } = makeWriter();
    const getPublicClient = vi.fn(() => FAKE_CLIENT);
    const boom = new Error("execution reverted");
    const estimateContractGas = vi.fn(async () => {
      throw boom;
    });

    await expect(
      writeContractWithGasBuffer({
        wagmiConfig: FAKE_CONFIG,
        writeContractAsync,
        account: ACCOUNT,
        address: CONTRACT,
        abi: [],
        functionName: "doStuff",
        onEstimateRevert: "rethrow",
        getPublicClient,
        estimateContractGas,
      }),
    ).rejects.toBe(boom);

    expect(calls).toHaveLength(0);
  });

  it("submits when buffered gas is at-or-below the soft cap", async () => {
    const { fn: writeContractAsync, calls } = makeWriter();
    const getPublicClient = vi.fn(() => FAKE_CLIENT);
    const estimateContractGas = vi.fn(async () => 100_000n);

    const result = await writeContractWithGasBuffer({
      wagmiConfig: FAKE_CONFIG,
      writeContractAsync,
      account: ACCOUNT,
      address: CONTRACT,
      abi: [],
      functionName: "doStuff",
      softCapGas: 200_000n,
      getPublicClient,
      estimateContractGas,
    });

    expect(result.gasUsedOverride).toBe(130_000n);
    expect(calls).toHaveLength(1);
    expect(calls[0].gas).toBe(130_000n);
  });

  it("throws GasSoftCapExceededError when buffered gas exceeds the soft cap and never submits", async () => {
    const { fn: writeContractAsync, calls } = makeWriter();
    const getPublicClient = vi.fn(() => FAKE_CLIENT);
    const estimateContractGas = vi.fn(async () => 1_000_000n);

    let caught: unknown;
    try {
      await writeContractWithGasBuffer({
        wagmiConfig: FAKE_CONFIG,
        writeContractAsync,
        account: ACCOUNT,
        address: CONTRACT,
        abi: [],
        functionName: "doStuff",
        softCapGas: 1_000_000n,
        getPublicClient,
        estimateContractGas,
      });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(GasSoftCapExceededError);
    const err = caught as GasSoftCapExceededError;
    expect(err.estimatedGas).toBe(1_000_000n);
    expect(err.bufferedGas).toBe(1_300_000n);
    expect(err.softCapGas).toBe(1_000_000n);
    expect(calls).toHaveLength(0);
  });

  it("does not evaluate softCapGas when the estimate failed under 'submit-without-override'", async () => {
    const { fn: writeContractAsync, calls } = makeWriter();
    const getPublicClient = vi.fn(() => FAKE_CLIENT);
    const estimateContractGas = vi.fn(async () => {
      throw new Error("rpc error");
    });

    const result = await writeContractWithGasBuffer({
      wagmiConfig: FAKE_CONFIG,
      writeContractAsync,
      account: ACCOUNT,
      address: CONTRACT,
      abi: [],
      functionName: "doStuff",
      softCapGas: 1n,
      getPublicClient,
      estimateContractGas,
    });

    expect(result.gasUsedOverride).toBeUndefined();
    expect(calls).toHaveLength(1);
    expect(calls[0]).not.toHaveProperty("gas");
  });

  it("forwards 'value' to both estimateContractGas and the writer", async () => {
    const { fn: writeContractAsync, calls } = makeWriter();
    const getPublicClient = vi.fn(() => FAKE_CLIENT);
    let estimateValueArg: bigint | undefined;
    const estimateContractGas = vi.fn(async (_client: unknown, params: { value?: bigint }) => {
      estimateValueArg = params.value;
      return 100_000n;
    });

    await writeContractWithGasBuffer({
      wagmiConfig: FAKE_CONFIG,
      writeContractAsync,
      account: ACCOUNT,
      address: CONTRACT,
      abi: [],
      functionName: "deposit",
      value: 5n,
      getPublicClient,
      estimateContractGas: estimateContractGas as unknown as Parameters<typeof writeContractWithGasBuffer>[0]["estimateContractGas"],
    });

    expect(estimateContractGas).toHaveBeenCalledTimes(1);
    expect(estimateValueArg).toBe(5n);
    expect(calls[0].value).toBe(5n);
  });

  it("forwards chainId to the public-client factory", async () => {
    const { fn: writeContractAsync } = makeWriter();
    const getPublicClient = vi.fn(() => FAKE_CLIENT);
    const estimateContractGas = vi.fn(async () => 100_000n);

    await writeContractWithGasBuffer({
      wagmiConfig: FAKE_CONFIG,
      writeContractAsync,
      account: ACCOUNT,
      chainId: 31337,
      address: CONTRACT,
      abi: [],
      functionName: "doStuff",
      getPublicClient,
      estimateContractGas,
    });

    expect(getPublicClient).toHaveBeenCalledTimes(1);
    expect(getPublicClient).toHaveBeenCalledWith(FAKE_CONFIG, { chainId: 31337 });
  });
});
