// SPDX-License-Identifier: AGPL-3.0-only

/** Shared wagmi/react-query poll + retry options under {@link getRpcBackoffPollMs} ([GitLab #221](https://gitlab.com/PlasticDigits/yieldomega/-/issues/221)). */
export function rpcBackedReadQueryOptions(pollIntervalMs: number, isRpcOffline: boolean) {
  return {
    refetchInterval: pollIntervalMs,
    /** Stop react-query automatic retries during offline-tier backoff — viem fallback already fans out across URLs. */
    retry: isRpcOffline ? 0 : 1,
  } as const;
}
