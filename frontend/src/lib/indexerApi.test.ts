// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchIndexerStatus,
  fetchTimecurveBuys,
  fetchTimecurveChainTimer,
  fetchTimecurveWarbowLeaderboardAll,
  rabbitDepositsApiPath,
  referralAppliedApiPath,
  referralReferrerLeaderboardApiPath,
  referralRegistrationsApiPath,
  referralWalletCharmSummaryApiPath,
  timecurveBuyerStatsApiPath,
  timecurvePrizeDistributionsApiPath,
  timecurvePrizePayoutsApiPath,
} from "./indexerApi";

describe("rabbitDepositsApiPath", () => {
  it("omits user query when undefined", () => {
    expect(rabbitDepositsApiPath(undefined, 20)).toBe("/v1/rabbit/deposits?limit=20");
  });

  it("encodes user for query injection safety", () => {
    const malicious = "0xabc&limit=999";
    expect(rabbitDepositsApiPath(malicious, 20)).toBe(
      `/v1/rabbit/deposits?limit=20&user=${encodeURIComponent(malicious)}`,
    );
  });
});

describe("timecurveBuyerStatsApiPath", () => {
  it("encodes buyer address", () => {
    const buyer = "0xdddddddddddddddddddddddddddddddddddddddd";
    expect(timecurveBuyerStatsApiPath(buyer)).toBe(
      `/v1/timecurve/buyer-stats?buyer=${encodeURIComponent(buyer)}`,
    );
  });
});

describe("timecurvePrizeDistributionsApiPath", () => {
  it("includes limit and default offset", () => {
    expect(timecurvePrizeDistributionsApiPath(20)).toBe("/v1/timecurve/prize-distributions?limit=20&offset=0");
  });

  it("includes custom offset", () => {
    expect(timecurvePrizeDistributionsApiPath(10, 30)).toBe(
      "/v1/timecurve/prize-distributions?limit=10&offset=30",
    );
  });
});

describe("timecurvePrizePayoutsApiPath", () => {
  it("includes limit and default offset", () => {
    expect(timecurvePrizePayoutsApiPath(30)).toBe("/v1/timecurve/prize-payouts?limit=30&offset=0");
  });

  it("includes custom offset", () => {
    expect(timecurvePrizePayoutsApiPath(25, 5)).toBe("/v1/timecurve/prize-payouts?limit=25&offset=5");
  });
});

describe("referralRegistrationsApiPath", () => {
  it("includes limit and default offset", () => {
    expect(referralRegistrationsApiPath(15)).toBe("/v1/referrals/registrations?limit=15&offset=0");
  });

  it("includes custom offset", () => {
    expect(referralRegistrationsApiPath(20, 40)).toBe(
      "/v1/referrals/registrations?limit=20&offset=40",
    );
  });
});

describe("referralAppliedApiPath", () => {
  it("omits referrer when undefined", () => {
    expect(referralAppliedApiPath(undefined, 20)).toBe("/v1/referrals/applied?limit=20");
  });

  it("encodes referrer for query injection safety", () => {
    const malicious = "0xabc&limit=999";
    expect(referralAppliedApiPath(malicious, 20)).toBe(
      `/v1/referrals/applied?limit=20&referrer=${encodeURIComponent(malicious)}`,
    );
  });
});

describe("referralWalletCharmSummaryApiPath", () => {
  it("encodes wallet", () => {
    const w = "0xdddddddddddddddddddddddddddddddddddddddd";
    expect(referralWalletCharmSummaryApiPath(w)).toBe(
      `/v1/referrals/wallet-charm-summary?wallet=${encodeURIComponent(w)}`,
    );
  });
});

describe("referralReferrerLeaderboardApiPath", () => {
  it("includes limit and offset", () => {
    expect(referralReferrerLeaderboardApiPath(12)).toBe("/v1/referrals/referrer-leaderboard?limit=12&offset=0");
    expect(referralReferrerLeaderboardApiPath(12, 24)).toBe(
      "/v1/referrals/referrer-leaderboard?limit=12&offset=24",
    );
  });
});

describe("fetchIndexerStatus", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubEnv("VITE_INDEXER_URL", "http://127.0.0.1:3100");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("returns /v1/status JSON when that route is healthy", async () => {
    globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo) => {
      const u = String(input);
      if (u.includes("/v1/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ schema_version: "1.7.0", max_indexed_block: 99 }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      return Promise.resolve(new Response("not used", { status: 500 }));
    });

    const s = await fetchIndexerStatus();
    expect(s).toEqual({ schema_version: "1.7.0", max_indexed_block: 99 });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("falls back to fees-distributed when /v1/status is not OK", async () => {
    globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo) => {
      const u = String(input);
      if (u.includes("/v1/status")) {
        return Promise.resolve(new Response("", { status: 404 }));
      }
      if (u.includes("/v1/fee-router/fees-distributed")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              items: [{ block_number: "12" }],
              limit: 1,
              offset: 0,
              next_offset: null,
            }),
            {
              status: 200,
              headers: {
                "content-type": "application/json",
                "x-schema-version": "1.7.0",
              },
            },
          ),
        );
      }
      return Promise.resolve(new Response("", { status: 500 }));
    });

    const s = await fetchIndexerStatus();
    expect(s).toMatchObject({
      schema_version: "1.7.0",
      max_indexed_block: "12",
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("returns null when both status and fallback fail", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("", { status: 503 }));

    await expect(fetchIndexerStatus()).resolves.toBeNull();
  });
});

describe("indexer JSON bodies (issue #111)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubEnv("VITE_INDEXER_URL", "http://127.0.0.1:3100");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("fetchTimecurveBuys resolves null when response is 200 OK but body is not JSON", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("not json", { status: 200, headers: { "content-type": "application/json" } }),
    );
    await expect(fetchTimecurveBuys(20, 0)).resolves.toBeNull();
  });

  it("fetchTimecurveChainTimer resolves null when response is 200 OK but json() rejects", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new SyntaxError("Unexpected token")),
    } as Response);
    await expect(fetchTimecurveChainTimer()).resolves.toBeNull();
  });
});

describe("fetchTimecurveWarbowLeaderboardAll", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubEnv("VITE_INDEXER_URL", "http://127.0.0.1:3100");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("concatenates pages until next_offset is null", async () => {
    const row = (buyer: string, logIndex: number) => ({
      buyer,
      battle_points_after: String(1000 - logIndex),
      block_number: "1",
      tx_hash: `0x${"11".repeat(32)}`,
      log_index: logIndex,
    });
    globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo) => {
      const u = String(input);
      if (u.includes("limit=200&offset=0")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              items: [row(`0x${"22".repeat(20)}`, 0)],
              limit: 200,
              offset: 0,
              next_offset: 200,
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        );
      }
      if (u.includes("limit=200&offset=200")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              items: [row(`0x${"33".repeat(20)}`, 1)],
              limit: 200,
              offset: 200,
              next_offset: null,
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        );
      }
      return Promise.resolve(new Response(`unexpected ${u}`, { status: 500 }));
    });

    const all = await fetchTimecurveWarbowLeaderboardAll();
    expect(all).toHaveLength(2);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("returns null when the first page fails", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("", { status: 503 }));
    await expect(fetchTimecurveWarbowLeaderboardAll()).resolves.toBeNull();
  });
});
