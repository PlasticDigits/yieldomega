// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it, vi } from "vitest";
import {
  ARENA_SESSION_CORE_ROW_COUNT,
  coreReadRowsFromArenaTimers,
  mapArenaV2CoreRows,
} from "./arenaV2SaleSessionBridge";

const DOUB = "0x" + "1".repeat(40);
const REF = "0x" + "2".repeat(40);
const BUY_ROUTER = "0x" + "3".repeat(40);

describe("mapArenaV2CoreRows", () => {
  it("returns 23 rows aligned with useArenaSaleSession destructuring", () => {
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
      { status: "success", result: BUY_ROUTER },
      { status: "success", result: 5n * 10n ** 18n },
    ] as const;

    const rows = mapArenaV2CoreRows(raw);
    expect(rows).toBeDefined();
    expect(rows).toHaveLength(ARENA_SESSION_CORE_ROW_COUNT);

    expect(rows![3]?.result).toBe((99n * 10n ** 16n * 10n ** 18n) / 10n ** 18n);
    expect(rows![7]?.result).toBe(DOUB);
    expect(rows![8]?.result).toBe(REF);
    expect(rows![10]?.result).toBe(120n);
    expect(rows![14]?.result).toBe(false);
    expect(rows![15]?.result).toBe(BUY_ROUTER);
    expect(typeof rows![15]?.result).toBe("string");
    expect(rows![21]?.result).toBe(5n * 10n ** 18n);
  });

  it("returns undefined when required reads are missing", () => {
    expect(mapArenaV2CoreRows(undefined)).toBeUndefined();
    expect(
      mapArenaV2CoreRows([{ status: "failure" }, { status: "success", result: 1n }]),
    ).toBeUndefined();
  });
});

describe("coreReadRowsFromArenaTimers", () => {
  it("maps extended timers JSON into 23 core session rows", () => {
    const rows = coreReadRowsFromArenaTimers({
      read_block_number: "1",
      block_timestamp_sec: "100",
      last_buy_deadline_sec: "200",
      timer_cap_sec: "86400",
      arena_start_sec: "50",
      paused: false,
      total_doub_raised: "1000",
      podium_deadlines_sec: ["0", "1", "2", "3"],
      charm_price_wad: "1000000000000000000",
      doub: DOUB,
      referral_registry: REF,
      buy_cooldown_sec: "300",
      timer_extension_sec: "120",
      time_arena_buy_router: BUY_ROUTER,
      referral_cred_flat_wad: "5000000000000000000",
    });
    expect(rows).toBeDefined();
    expect(rows).toHaveLength(ARENA_SESSION_CORE_ROW_COUNT);
    expect(rows![7]?.result).toBe(DOUB);
    expect(rows![8]?.result).toBe(REF);
    expect(rows![15]?.result).toBe(BUY_ROUTER);
  });

  it("returns undefined when sale-head fields are missing", () => {
    expect(
      coreReadRowsFromArenaTimers({
        read_block_number: "1",
        block_timestamp_sec: "100",
        last_buy_deadline_sec: "200",
        timer_cap_sec: "86400",
        arena_start_sec: "50",
        paused: false,
        total_doub_raised: "0",
        podium_deadlines_sec: ["0", "1", "2", "3"],
      }),
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
