// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it, vi } from "vitest";
import { mapArenaV2CoreRows } from "./arenaV2SaleSessionBridge";

const DOUB = "0x" + "1".repeat(40);
const REF = "0x" + "2".repeat(40);

describe("mapArenaV2CoreRows", () => {
  it("returns 31 TimeCurve-shaped rows aligned with useTimeCurveSaleSession destructuring", () => {
    const raw = [
      { status: "success", result: 100n },
      { status: "success", result: 200n },
      { status: "success", result: false },
      { status: "success", result: 10n ** 18n },
      { status: "success", result: DOUB },
      { status: "success", result: REF },
      { status: "success", result: 50n },
      { status: "success", result: 300n },
      { status: "success", result: 120n },
      { status: "success", result: 86_400n },
      { status: "success", result: "0x" + "3".repeat(40) },
    ] as const;

    const rows = mapArenaV2CoreRows(raw);
    expect(rows).toBeDefined();
    expect(rows).toHaveLength(31);

    const doubPresale = rows![28];
    expect(doubPresale?.status).toBe("success");
    expect(typeof doubPresale?.result).toBe("string");
    expect((doubPresale?.result as string).toLowerCase()).toBe(
      "0x0000000000000000000000000000000000000000",
    );

    const referralEachBps = rows![29];
    expect(referralEachBps?.result).toBe(500n);

    const silenceSec = rows![27];
    expect(silenceSec?.result).toBe(0n);
  });

  it("returns undefined when required reads are missing", () => {
    expect(mapArenaV2CoreRows(undefined)).toBeUndefined();
    expect(
      mapArenaV2CoreRows([{ status: "failure" }, { status: "success", result: 1n }]),
    ).toBeUndefined();
  });
});

describe("indexerBaseUrl empty override", () => {
  it("treats explicit empty VITE_INDEXER_URL as disabled on devnet", async () => {
    vi.stubEnv("VITE_INDEXER_URL", "");
    vi.stubEnv("VITE_CHAIN_ID", "31337");
    vi.stubEnv("VITE_RPC_URL", "http://127.0.0.1:8545");
    const { indexerBaseUrl } = await import("@/lib/addresses");
    expect(indexerBaseUrl()).toBeUndefined();
    vi.unstubAllEnvs();
  });
});
