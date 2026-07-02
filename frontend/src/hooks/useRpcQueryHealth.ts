// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect } from "react";
import { extractHttpResponseStatus } from "@/lib/extractHttpResponseStatus";
import { reportRpcFetchAttempt, reportRpcRateLimited } from "@/lib/rpcConnectivity";

/** HTTP statuses that should jump straight to shared RPC backoff (rate limits / overload). */
function isRpcThrottleHttpStatus(status: number | undefined): boolean {
  return status === 429 || status === 403 || status === 503;
}

type RpcQueryHealthPick = {
  isFetched: boolean;
  isFetching: boolean;
  isError: boolean;
  isSuccess: boolean;
  error: Error | null;
};

/**
 * After RPC-backed react-query reads settle, drive {@link getRpcBackoffPollMs} so intermittent
 * failures and 429s slow refetch across audit / protocol surfaces together.
 */
export function useRpcQueryHealthForRefetch(query: RpcQueryHealthPick): void {
  useEffect(() => {
    if (!query.isFetched || query.isFetching) {
      return;
    }
    if (query.isError && query.error) {
      const status = extractHttpResponseStatus(query.error);
      if (isRpcThrottleHttpStatus(status)) {
        reportRpcRateLimited();
      } else {
        reportRpcFetchAttempt(false);
      }
      return;
    }
    if (query.isSuccess) {
      reportRpcFetchAttempt(true);
    }
  }, [query.isFetched, query.isFetching, query.isError, query.isSuccess, query.error]);
}
