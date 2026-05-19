// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it, vi, beforeEach } from "vitest";
import { assertReferralReadyForBuy } from "./referralBuyPreflight";

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
