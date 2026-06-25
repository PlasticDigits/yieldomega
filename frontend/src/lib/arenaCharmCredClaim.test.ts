// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it, vi } from "vitest";
import { canClaimCred, claimableCredEpoch } from "./arenaCharmCredClaim";

describe("arenaCharmCredClaim (GitLab #257)", () => {
  it("claimableCredEpoch is lastBuyEpoch - 1 when epoch > 0", () => {
    expect(claimableCredEpoch(0n)).toBeUndefined();
    expect(claimableCredEpoch(1n)).toBe(0n);
    expect(claimableCredEpoch(3n)).toBe(2n);
  });

  it("canClaimCred requires wallet, ended epoch, and positive pending", () => {
    expect(
      canClaimCred({ address: "0x1", claimEpoch: 0n, claimPending: 1n }),
    ).toBe(true);
    expect(
      canClaimCred({ address: undefined, claimEpoch: 0n, claimPending: 1n }),
    ).toBe(false);
    expect(
      canClaimCred({ address: "0x1", claimEpoch: undefined, claimPending: 1n }),
    ).toBe(false);
    expect(
      canClaimCred({ address: "0x1", claimEpoch: 0n, claimPending: 0n }),
    ).toBe(false);
  });
});

describe("executeClaimCred (GitLab #347)", () => {
  it("invalidates wallet stats only after a successful receipt", async () => {
    const writeContractAsync = vi.fn().mockResolvedValue("0x1234");
    const waitForWriteReceipt = vi.fn().mockResolvedValue({ status: "success" });
    const invalidateArenaWalletStatsQueries = vi.fn();
    const queryClient = { tag: "qc" };

    const { executeClaimCred } = await import("./arenaCharmCredClaim");

    await executeClaimCred({
      arena: "0x1111111111111111111111111111111111111111",
      claimEpoch: 1n,
      abi: [],
      writeContractAsync,
      wagmiConfig: {} as never,
      queryClient: queryClient as never,
      waitForWriteReceipt,
      invalidateArenaWalletStatsQueries,
    });

    expect(invalidateArenaWalletStatsQueries).toHaveBeenCalledOnce();
    expect(invalidateArenaWalletStatsQueries).toHaveBeenCalledWith(queryClient);
  });

  it("skips invalidation when receipt status is reverted", async () => {
    const invalidateArenaWalletStatsQueries = vi.fn();

    const { executeClaimCred } = await import("./arenaCharmCredClaim");

    await expect(
      executeClaimCred({
        arena: "0x1111111111111111111111111111111111111111",
        claimEpoch: 1n,
        abi: [],
        writeContractAsync: vi.fn().mockResolvedValue("0x9999"),
        wagmiConfig: {} as never,
        queryClient: {} as never,
        waitForWriteReceipt: vi.fn().mockResolvedValue({ status: "reverted" }),
        invalidateArenaWalletStatsQueries,
      }),
    ).rejects.toThrow(/reverted/i);

    expect(invalidateArenaWalletStatsQueries).not.toHaveBeenCalled();
  });
});
