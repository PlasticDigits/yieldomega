// SPDX-License-Identifier: AGPL-3.0-only

/**
 * When `useReadContracts` / multicall rows flip to `failure` during transient
 * JSON-RPC errors, keep rendering the last successful row so operator surfaces
 * (e.g. `/arena/protocol`) do not blank or thrash phase gates.
 */
export type MulticallReadRow = {
  status: "success" | "failure";
  result?: unknown;
};

export function mergeStickyMulticallRows(
  live: readonly MulticallReadRow[] | undefined,
  prevMerged: readonly MulticallReadRow[] | undefined,
): readonly MulticallReadRow[] {
  const liveLen = live?.length ?? 0;
  const prevLen = prevMerged?.length ?? 0;
  const n = Math.max(liveLen, prevLen);
  if (n === 0) {
    return [];
  }
  const out: MulticallReadRow[] = [];
  for (let i = 0; i < n; i += 1) {
    const l = live?.[i];
    const p = prevMerged?.[i];
    if (l?.status === "success" && l.result !== undefined) {
      out.push(l);
      continue;
    }
    if (p?.status === "success" && p.result !== undefined) {
      out.push(p);
      continue;
    }
    out.push(l ?? p ?? ({ status: "failure" } satisfies MulticallReadRow));
  }
  return out;
}
