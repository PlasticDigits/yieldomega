// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { maxUint256 } from "viem";
import { planCl8yKumbayaApprove } from "./ensureCl8yKumbayaAllowance";

describe("planCl8yKumbayaApprove (GitLab #224)", () => {
  it("skips when needWei is zero", () => {
    expect(planCl8yKumbayaApprove(maxUint256, 0n, false)).toEqual({
      approveAmt: 0n,
      required: false,
    });
  });

  it("skips when allowance is maxUint256 (infinite on-chain)", () => {
    expect(planCl8yKumbayaApprove(maxUint256, 1_000n, false)).toEqual({
      approveAmt: 1005n,
      required: false,
    });
    expect(planCl8yKumbayaApprove(maxUint256, 1_000n, true)).toEqual({
      approveAmt: maxUint256,
      required: false,
    });
  });

  it("skips when exact allowance meets sized target (50 bps headroom)", () => {
    expect(planCl8yKumbayaApprove(10_050n, 10_000n, false)).toEqual({
      approveAmt: 10_050n,
      required: false,
    });
  });

  it("requires approve when allowance is one wei below sized target", () => {
    expect(planCl8yKumbayaApprove(10_049n, 10_000n, false)).toEqual({
      approveAmt: 10_050n,
      required: true,
    });
  });

  it("requires approve when allowance covers need but not headroom (exact mode)", () => {
    expect(planCl8yKumbayaApprove(10_000n, 10_000n, false)).toEqual({
      approveAmt: 10_050n,
      required: true,
    });
  });

  it("skips WarBow-sized burn when allowance equals need exactly but below headroom is OK only if allow >= approveAmt", () => {
    const need = 5_000_000_000_000_000_000n;
    const approveAmt = need + (need * 50n + 9999n) / 10000n;
    expect(planCl8yKumbayaApprove(need, need, false).required).toBe(true);
    expect(planCl8yKumbayaApprove(approveAmt, need, false).required).toBe(false);
  });

  it("unlimited preference sizes to maxUint256 and skips when allow is max", () => {
    expect(planCl8yKumbayaApprove(0n, 999n, true)).toEqual({
      approveAmt: maxUint256,
      required: true,
    });
    expect(planCl8yKumbayaApprove(maxUint256 - 1n, 999n, true).required).toBe(true);
    expect(planCl8yKumbayaApprove(maxUint256, 999n, true).required).toBe(false);
  });
});
