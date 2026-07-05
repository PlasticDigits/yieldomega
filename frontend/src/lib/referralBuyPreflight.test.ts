// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it, vi, beforeEach } from "vitest";
import { assertReferralReadyForBuy, resolveReferralCodeHashForBuy } from "./referralBuyPreflight";

const REGISTRY = "0x1111111111111111111111111111111111111111" as const;
const BUYER = "0x2222222222222222222222222222222222222222" as const;
const REFERRER = "0x3333333333333333333333333333333333333333" as const;

vi.mock("wagmi/actions", () => ({
  readContract: vi.fn(),
}));

import { readContract } from "wagmi/actions";

describe("assertReferralReadyForBuy", () => {
  beforeEach(() => {
    vi.mocked(readContract).mockReset();
  });

  it("rejects unregistered codes", async () => {
    vi.mocked(readContract).mockResolvedValue(
      "0x0000000000000000000000000000000000000000",
    );
    const r = await assertReferralReadyForBuy({
      wagmiConfig: {} as never,
      referralRegistry: REGISTRY,
      buyer: BUYER,
      pendingCode: "test1",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toContain("not registered");
      expect(r.message).toContain("test1");
    }
  });

  it("rejects self-referral", async () => {
    vi.mocked(readContract).mockResolvedValue(BUYER);
    const r = await assertReferralReadyForBuy({
      wagmiConfig: {} as never,
      referralRegistry: REGISTRY,
      buyer: BUYER,
      pendingCode: "test1",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("own referral");
  });

  it("accepts a registered third-party referrer", async () => {
    vi.mocked(readContract).mockResolvedValue(REFERRER);
    const r = await assertReferralReadyForBuy({
      wagmiConfig: {} as never,
      referralRegistry: REGISTRY,
      buyer: BUYER,
      pendingCode: "test1",
    });
    expect(r).toEqual({ ok: true });
  });
});

describe("resolveReferralCodeHashForBuy", () => {
  beforeEach(() => {
    vi.mocked(readContract).mockReset();
  });

  it("drops blocked brand slug and clears pending", async () => {
    const clear = vi.fn();
    const h = await resolveReferralCodeHashForBuy({
      wagmiConfig: {} as never,
      referralRegistry: REGISTRY,
      buyer: BUYER,
      pendingCode: "yieldomega",
      clearPendingReferral: clear,
    });
    expect(h).toBeUndefined();
    expect(clear).toHaveBeenCalledOnce();
    expect(readContract).not.toHaveBeenCalled();
  });

  it("keeps pending when ownerOfCode is zero after retry (transient unregistered read)", async () => {
    vi.mocked(readContract).mockResolvedValue(
      "0x0000000000000000000000000000000000000000",
    );
    const clear = vi.fn();
    const h = await resolveReferralCodeHashForBuy({
      wagmiConfig: {} as never,
      referralRegistry: REGISTRY,
      buyer: BUYER,
      pendingCode: "test1",
      clearPendingReferral: clear,
    });
    expect(h).toBeUndefined();
    expect(clear).not.toHaveBeenCalled();
    expect(readContract).toHaveBeenCalledTimes(2);
  });

  it("returns hash when first ownerOfCode read is zero and retry succeeds", async () => {
    vi.mocked(readContract)
      .mockResolvedValueOnce("0x0000000000000000000000000000000000000000")
      .mockResolvedValueOnce(REFERRER);
    const clear = vi.fn();
    const h = await resolveReferralCodeHashForBuy({
      wagmiConfig: {} as never,
      referralRegistry: REGISTRY,
      buyer: BUYER,
      pendingCode: "test1",
      clearPendingReferral: clear,
    });
    expect(h).toMatch(/^0x[a-f0-9]{64}$/);
    expect(clear).not.toHaveBeenCalled();
    expect(readContract).toHaveBeenCalledTimes(2);
  });

  it("clears pending on self-referral", async () => {
    vi.mocked(readContract).mockResolvedValue(BUYER);
    const clear = vi.fn();
    const h = await resolveReferralCodeHashForBuy({
      wagmiConfig: {} as never,
      referralRegistry: REGISTRY,
      buyer: BUYER,
      pendingCode: "test1",
      clearPendingReferral: clear,
    });
    expect(h).toBeUndefined();
    expect(clear).toHaveBeenCalledOnce();
  });

  it("propagates ownerOfCode read errors without clearing pending", async () => {
    vi.mocked(readContract).mockRejectedValue(new Error("rpc down"));
    const clear = vi.fn();
    await expect(
      resolveReferralCodeHashForBuy({
        wagmiConfig: {} as never,
        referralRegistry: REGISTRY,
        buyer: BUYER,
        pendingCode: "test1",
        clearPendingReferral: clear,
      }),
    ).rejects.toThrow("rpc down");
    expect(clear).not.toHaveBeenCalled();
  });

  it("returns hash for registered third-party referrer", async () => {
    vi.mocked(readContract).mockResolvedValue(REFERRER);
    const clear = vi.fn();
    const h = await resolveReferralCodeHashForBuy({
      wagmiConfig: {} as never,
      referralRegistry: REGISTRY,
      buyer: BUYER,
      pendingCode: "test1",
      clearPendingReferral: clear,
    });
    expect(h).toMatch(/^0x[a-f0-9]{64}$/);
    expect(clear).not.toHaveBeenCalled();
  });
});
