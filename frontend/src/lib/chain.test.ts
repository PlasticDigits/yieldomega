// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { megaethMainnetOrderedRpcUrls, resolveChainRpcConfig } from "./chain";

describe("megaethMainnetOrderedRpcUrls", () => {
  it("puts the primary first and appends fallbacks without duplicates", () => {
    expect(megaethMainnetOrderedRpcUrls("https://mainnet.megaeth.com/rpc")).toEqual([
      "https://mainnet.megaeth.com/rpc",
      "https://rpc-megaeth-mainnet.globalstake.io",
      "https://carrot.megaeth.com/rpc",
    ]);
  });

  it("does not repeat the primary when it matches a fallback entry", () => {
    expect(
      megaethMainnetOrderedRpcUrls("https://rpc-megaeth-mainnet.globalstake.io"),
    ).toEqual([
      "https://rpc-megaeth-mainnet.globalstake.io",
      "https://carrot.megaeth.com/rpc",
    ]);
  });
});

describe("resolveChainRpcConfig", () => {
  it("defaults when env-like strings are empty", () => {
    expect(resolveChainRpcConfig(undefined, undefined)).toEqual({
      id: 31337,
      defaultRpcHttp: "http://127.0.0.1:8545",
    });
  });

  it("parses trimmed chain id and RPC URL", () => {
    expect(resolveChainRpcConfig(" 31337 ", " https://rpc.example ")).toEqual({
      id: 31337,
      defaultRpcHttp: "https://rpc.example",
    });
  });

  it("falls back on invalid chain id when RPC is not default Anvil", () => {
    expect(resolveChainRpcConfig("not-a-number", "http://x")).toEqual({
      id: 31337,
      defaultRpcHttp: "http://x",
    });
    expect(resolveChainRpcConfig("-1", undefined)).toEqual({
      id: 31337,
      defaultRpcHttp: "http://127.0.0.1:8545",
    });
  });

  it("uses Anvil chain id 31337 when RPC is default local 8545 and chain id unset or invalid", () => {
    expect(resolveChainRpcConfig(undefined, "http://127.0.0.1:8545")).toEqual({
      id: 31337,
      defaultRpcHttp: "http://127.0.0.1:8545",
    });
    expect(resolveChainRpcConfig("not-a-number", "http://127.0.0.1:8545")).toEqual({
      id: 31337,
      defaultRpcHttp: "http://127.0.0.1:8545",
    });
  });

  it("defaults MegaETH mainnet RPC to canonical public URL when chain id is set but RPC is empty", () => {
    expect(resolveChainRpcConfig("4326", undefined)).toEqual({
      id: 4326,
      defaultRpcHttp: "https://mainnet.megaeth.com/rpc",
    });
  });
});
