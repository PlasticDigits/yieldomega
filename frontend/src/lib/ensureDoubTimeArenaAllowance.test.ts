// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { maxUint256 } from "viem";
import { planDoubTimeArenaApprove } from "./ensureDoubTimeArenaAllowance";

describe("planDoubTimeArenaApprove (GitLab #143)", () => {
  it("skips when needWei is zero", () => {
    expect(planDoubTimeArenaApprove(maxUint256, 0n, true)).toEqual({
      approveAmt: 0n,
      required: false,
    });
  });

  it("skips when finite allowance covers need plus headroom even if below maxUint256", () => {
    const need = 22_000_000_000_000_000_000_000n;
    const sized = need + (need * 50n + 9999n) / 10000n;
    expect(planDoubTimeArenaApprove(sized, need, true)).toEqual({
      approveAmt: maxUint256,
      required: false,
    });
    expect(planDoubTimeArenaApprove(sized + 1n, need, true).required).toBe(false);
  });

  it("skips when allowance is maxUint256", () => {
    expect(planDoubTimeArenaApprove(maxUint256, 1_000n, true)).toEqual({
      approveAmt: maxUint256,
      required: false,
    });
  });

  it("requires approve when allowance is one wei below sized target", () => {
    expect(planDoubTimeArenaApprove(10_049n, 10_000n, true)).toEqual({
      approveAmt: maxUint256,
      required: true,
    });
  });

  it("requires approve when allowance covers need but not headroom", () => {
    expect(planDoubTimeArenaApprove(10_000n, 10_000n, true)).toEqual({
      approveAmt: maxUint256,
      required: true,
    });
  });

  it("requires approve when allowance is zero", () => {
    expect(planDoubTimeArenaApprove(0n, 999n, true)).toEqual({
      approveAmt: maxUint256,
      required: true,
    });
  });

  it("sizes exact approve when unlimited preference is off", () => {
    expect(planDoubTimeArenaApprove(0n, 10_000n, false)).toEqual({
      approveAmt: 10_050n,
      required: true,
    });
  });
});
