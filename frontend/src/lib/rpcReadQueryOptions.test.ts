// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { rpcBackedReadQueryOptions } from "./rpcReadQueryOptions";

describe("rpcBackedReadQueryOptions (GitLab #221)", () => {
  it("keeps fast poll interval while healthy", () => {
    expect(rpcBackedReadQueryOptions(1000, false)).toMatchObject({
      refetchInterval: 1000,
      retry: 1,
    });
  });

  it("disables react-query retry during offline-tier RPC backoff", () => {
    expect(rpcBackedReadQueryOptions(5000, true)).toMatchObject({
      refetchInterval: 5000,
      retry: 0,
    });
  });
});
