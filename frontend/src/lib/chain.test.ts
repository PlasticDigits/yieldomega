// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { resolveChainRpcConfig } from "./chain";

describe("resolveChainRpcConfig", () => {
  it("defaults when env-like strings are empty", () => {
    expect(resolveChainRpcConfig(undefined, undefined)).toEqual({
      id: 6343,
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
      id: 6343,
      defaultRpcHttp: "http://x",
    });
    expect(resolveChainRpcConfig("-1", undefined)).toEqual({
      id: 6343,
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
});
