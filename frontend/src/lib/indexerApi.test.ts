// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchIndexerStatus,
  fetchArenaBuys,
  fetchTimecurveChainTimer,
  fetchTimecurveWarbowLeaderboardAll,
  referralAppliedApiPath,
  referralReferrerLeaderboardApiPath,
  referralRegistrationsApiPath,
  referralWalletCharmSummaryApiPath,
  timecurveBuyerStatsApiPath,
  timecurvePlatformUsageApiPath,
  timecurvePrizeDistributionsApiPath,
  timecurvePrizePayoutsApiPath,
} from "./indexerApi";
import {
  getIndexerBackoffPollMs,
  resetIndexerConnectivityForTests,
} from "./indexerConnectivity";

describe("timecurveBuyerStatsApiPath", () => {
  it("maps to arena wallet stats path", () => {
    const buyer = "0xdddddddddddddddddddddddddddddddddddddddd";
    expect(timecurveBuyerStatsApiPath(buyer)).toBe(
      `/v1/arena/wallet/${buyer.toLowerCase()}/stats`,
    );
  });
});

describe("timecurvePlatformUsageApiPath", () => {
  it("points at arena timers after platform-usage retirement (#266)", () => {
    expect(timecurvePlatformUsageApiPath(20, 0)).toBe("/v1/arena/timers");
  });
});

describe("timecurvePrizeDistributionsApiPath", () => {
  it("includes limit and default offset", () => {
    expect(timecurvePrizeDistributionsApiPath(20)).toBe("/v1/arena/prize-distributions?limit=20&offset=0");
  });

  it("includes custom offset", () => {
    expect(timecurvePrizeDistributionsApiPath(10, 30)).toBe(
      "/v1/arena/prize-distributions?limit=10&offset=30",
    );
  });
});

describe("timecurvePrizePayoutsApiPath", () => {
  it("includes limit and default offset", () => {
    expect(timecurvePrizePayoutsApiPath(30)).toBe("/v1/arena/prize-payouts?limit=30&offset=0");
  });

  it("includes custom offset", () => {
    expect(timecurvePrizePayoutsApiPath(25, 5)).toBe("/v1/arena/prize-payouts?limit=25&offset=5");
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

  it("encodes owner filter for query safety", () => {
    const owner = "0xdddddddddddddddddddddddddddddddddddddddd";
    expect(referralRegistrationsApiPath(10, 0, owner)).toBe(
      `/v1/referrals/registrations?limit=10&offset=0&owner=${encodeURIComponent(owner)}`,
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

  it("returns null when /v1/status is not OK", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("", { status: 503 }));

    await expect(fetchIndexerStatus()).resolves.toBeNull();
  });
});

describe("HTTP 429 triggers shared indexer backoff", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubEnv("VITE_INDEXER_URL", "http://127.0.0.1:3100");
    resetIndexerConnectivityForTests();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
    resetIndexerConnectivityForTests();
  });

  it("fetchArenaBuys bumps backoff immediately", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("", { status: 429 }));
    await expect(fetchArenaBuys(20, 0)).resolves.toBeNull();
    expect(getIndexerBackoffPollMs(1000)).toBe(5_000);
  });

  it("fetchTimecurveChainTimer bumps backoff immediately", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("", { status: 429 }));
    await expect(fetchTimecurveChainTimer()).resolves.toBeNull();
    expect(getIndexerBackoffPollMs(1000)).toBe(5_000);
  });

  it("fetchIndexerStatus bumps backoff on 429 from /v1/status", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("", { status: 429 }));
    await expect(fetchIndexerStatus()).resolves.toBeNull();
    expect(getIndexerBackoffPollMs(1000)).toBe(5_000);
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

  it("fetchArenaBuys resolves null when response is 200 OK but body is not JSON", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("not json", { status: 200, headers: { "content-type": "application/json" } }),
    );
    await expect(fetchArenaBuys(20, 0)).resolves.toBeNull();
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
  it("returns null after TimeCurve v1 indexer retirement (#266)", async () => {
    await expect(fetchTimecurveWarbowLeaderboardAll()).resolves.toBeNull();
  });
});
