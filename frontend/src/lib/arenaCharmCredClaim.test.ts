// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
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
