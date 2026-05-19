// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  takeRealtimeSubmitReceipt,
  wrapTransportWithRealtimeSendRaw,
} from "@/lib/realtimeRpcTransport";
import { http } from "viem";

describe("realtimeRpcTransport", () => {
  it("wrapTransportWithRealtimeSendRaw returns a transport factory", () => {
    const t = wrapTransportWithRealtimeSendRaw(http("http://127.0.0.1:8545"));
    expect(typeof t).toBe("function");
  });

  it("takeRealtimeSubmitReceipt returns undefined when no receipt cached", () => {
    expect(
      takeRealtimeSubmitReceipt("0xabc123" as const),
    ).toBeUndefined();
  });
});
