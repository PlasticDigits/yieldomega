// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  rabbitDepositsApiPath,
  referralAppliedApiPath,
  referralRegistrationsApiPath,
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
  it("includes limit and offset", () => {
    expect(timecurvePrizePayoutsApiPath(25, 5)).toBe("/v1/timecurve/prize-payouts?limit=25&offset=5");
  });
});

describe("referralRegistrationsApiPath", () => {
  it("includes pagination params", () => {
    expect(referralRegistrationsApiPath(15, 0)).toBe("/v1/referrals/registrations?limit=15&offset=0");
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
