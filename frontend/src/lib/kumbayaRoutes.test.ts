// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  buildV3PathExactOutput,
  minOutFromSlippage,
  resolveKumbayaRouting,
  resolveTimeCurveBuyRouterForKumbayaSingleTx,
  routingForPayAsset,
  type KumbayaChainConfigResolved,
} from "./kumbayaRoutes";

const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const;
const USDM = "0x1111111111111111111111111111111111111111" as const;
const CL8Y = "0x2222222222222222222222222222222222222222" as const;
const ROUTER = "0x3333333333333333333333333333333333333333" as const;
const QUOTER = "0x4444444444444444444444444444444444444444" as const;
const BUY_R = "0x5555555555555555555555555555555555555555" as const;

function sampleConfig(over?: Partial<KumbayaChainConfigResolved>): KumbayaChainConfigResolved {
  return {
    chainId: 31337,
    weth: WETH,
    usdm: USDM,
    swapRouter: ROUTER,
    quoter: QUOTER,
    cl8yWethFee: 3000,
    usdmWethFee: 500,
    ...over,
  };
}

describe("resolveKumbayaRouting", () => {
  it("fails closed on unknown chain", () => {
    const r = resolveKumbayaRouting(1, {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("unsupported_chain");
  });

  it("fails when router or quoter missing on 31337", () => {
    const r = resolveKumbayaRouting(31337, {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("missing_router");
  });

  it("merges env overrides", () => {
    const r = resolveKumbayaRouting(31337, {
      VITE_KUMBAYA_WETH: WETH,
      VITE_KUMBAYA_USDM: USDM,
      VITE_KUMBAYA_SWAP_ROUTER: ROUTER,
      VITE_KUMBAYA_QUOTER: QUOTER,
      VITE_KUMBAYA_FEE_CL8Y_WETH: "500",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.weth).toBe(WETH);
      expect(r.config.cl8yWethFee).toBe(500);
      expect(r.config.usdmWethFee).toBe(3000);
    }
  });

  it("resolves MegaETH mainnet (4326) from integrator-kit defaults without env", () => {
    const r = resolveKumbayaRouting(4326, {});
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.config.weth).toBe("0x4200000000000000000000000000000000000006");
    expect(r.config.swapRouter).toBe("0xE5BbEF8De2DB447a7432A47EBa58924d94eE470e");
    expect(r.config.quoter).toBe("0x1F1a8dC7E138C34b503Ca080962aC10B75384a27");
    expect(r.config.usdm).toBe("0xFAfDdbb3FC7688494971a79cc65DCa3EF82079E7");
  });

  it("resolves MegaETH testnet (6343) router + quoter without env; stable via env only", () => {
    const r = resolveKumbayaRouting(6343, {});
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.config.weth).toBe("0x4200000000000000000000000000000000000006");
    expect(r.config.swapRouter).toBe("0x8268DC930BA98759E916DEd4c9F367A844814023");
    expect(r.config.quoter).toBe("0xfb230b93803F90238cB03f254452bA3a3b0Ec38d");
    expect(r.config.usdm).toBe("0x0000000000000000000000000000000000000000");
  });
});

describe("buildV3PathExactOutput", () => {
  it("packs single hop CL8Y <- WETH", () => {
    const p = buildV3PathExactOutput([CL8Y, WETH], [3000]);
    expect(p).toMatch(/^0x/);
    expect(p.slice(2).length).toBe((20 + 3 + 20) * 2);
  });

  it("packs two-hop CL8Y <- WETH <- USDM", () => {
    const p = buildV3PathExactOutput([CL8Y, WETH, USDM], [3000, 500]);
    expect(p.slice(2).length).toBe((20 + 3 + 20 + 3 + 20) * 2);
  });
});

describe("routingForPayAsset", () => {
  const cfg = sampleConfig();

  it("CL8Y is direct", () => {
    const r = routingForPayAsset("cl8y", CL8Y, cfg);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.path).toBe("0x");
      expect(r.tokenIn).toBe(CL8Y);
    }
  });

  it("ETH uses WETH path", () => {
    const r = routingForPayAsset("eth", CL8Y, cfg);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.tokenIn).toBe(WETH);
      expect(r.path.startsWith("0x")).toBe(true);
      expect(r.path.length).toBeGreaterThan(2);
    }
  });

  it("USDM fails when usdm zero", () => {
    const r = routingForPayAsset("usdm", CL8Y, { ...cfg, usdm: "0x0000000000000000000000000000000000000000" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("missing_usdm");
  });

  it("USDM works on mainnet defaults", () => {
    const r = resolveKumbayaRouting(4326, {});
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const pay = routingForPayAsset("usdm", CL8Y, r.config);
    expect(pay.ok).toBe(true);
  });

  it("USDM mode on 6343 without VITE_KUMBAYA_USDM fails closed", () => {
    const r = resolveKumbayaRouting(6343, {});
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const pay = routingForPayAsset("usdm", CL8Y, r.config);
    expect(pay.ok).toBe(false);
    if (!pay.ok) expect(pay.reason).toBe("missing_usdm");
  });
});

describe("minOutFromSlippage", () => {
  it("applies BPS", () => {
    expect(minOutFromSlippage(10000n, 100)).toBe(9900n);
  });
});

describe("resolveTimeCurveBuyRouterForKumbayaSingleTx (issue #66)", () => {
  it("returns none when onchain is zero and env unset", () => {
    const r = resolveTimeCurveBuyRouterForKumbayaSingleTx("0x0000000000000000000000000000000000000000", {});
    expect(r).toEqual({ kind: "none" });
  });

  it("returns none when onchain is undefined and env unset", () => {
    const r = resolveTimeCurveBuyRouterForKumbayaSingleTx(undefined, {});
    expect(r).toEqual({ kind: "none" });
  });

  it("mismatch when onchain is zero but env is set", () => {
    const r = resolveTimeCurveBuyRouterForKumbayaSingleTx("0x0000000000000000000000000000000000000000", {
      VITE_KUMBAYA_TIMECURVE_BUY_ROUTER: BUY_R,
    });
    expect(r.kind).toBe("mismatch");
  });

  it("ok when onchain is set; env may be unset", () => {
    const r = resolveTimeCurveBuyRouterForKumbayaSingleTx(BUY_R, {});
    expect(r).toEqual({ kind: "ok", router: BUY_R });
  });

  it("mismatch when env and onchain differ (case-insensitive check)", () => {
    const r = resolveTimeCurveBuyRouterForKumbayaSingleTx(BUY_R, {
      VITE_KUMBAYA_TIMECURVE_BUY_ROUTER: "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    });
    expect(r.kind).toBe("mismatch");
  });
});
