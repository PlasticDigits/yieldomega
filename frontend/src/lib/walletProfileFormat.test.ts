// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  formatWalletProfileRankLabel,
  formatWalletProfileUnixSec,
  formatWalletProfileWinRate,
  walletProfilePodiumLabel,
} from "./walletProfileFormat";

describe("walletProfileFormat (#258)", () => {
  it("maps indexer podium keys to UX labels", () => {
    expect(walletProfilePodiumLabel("last_buy")).toBe("Last Buy");
    expect(walletProfilePodiumLabel("warbow")).toBe("WarBow");
  });

  it("formats win rate fraction as percent", () => {
    expect(formatWalletProfileWinRate("0.25")).toBe("25.0%");
    expect(formatWalletProfileWinRate("")).toBe("—");
  });

  it("formats unix seconds for first buy", () => {
    expect(formatWalletProfileUnixSec("1700000000")).toMatch(/2023/);
    expect(formatWalletProfileUnixSec(null)).toBe("—");
  });

  it("formats podium rank ordinals", () => {
    expect(formatWalletProfileRankLabel(1)).toBe("1st");
    expect(formatWalletProfileRankLabel(3)).toBe("3rd");
  });
});
