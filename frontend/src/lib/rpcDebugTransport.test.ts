// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { formatJsonRpcMethodLabel } from "./rpcDebugTransport";

describe("formatJsonRpcMethodLabel", () => {
  it("formats single request body", () => {
    expect(formatJsonRpcMethodLabel({ method: "eth_blockNumber", id: 1, jsonrpc: "2.0" })).toBe(
      "eth_blockNumber",
    );
  });

  it("formats batch bodies", () => {
    expect(
      formatJsonRpcMethodLabel([
        { method: "eth_chainId", id: 1, jsonrpc: "2.0" },
        { method: "eth_call", id: 2, jsonrpc: "2.0" },
      ]),
    ).toBe("eth_chainId, eth_call");
  });

  it("returns ? for unknown shapes", () => {
    expect(formatJsonRpcMethodLabel(null)).toBe("?");
    expect(formatJsonRpcMethodLabel("x")).toBe("?");
  });
});
