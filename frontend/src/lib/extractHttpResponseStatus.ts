// SPDX-License-Identifier: AGPL-3.0-only

/** Best-effort HTTP status from viem / fetch error chains (429 rate limits, etc.). */
export function extractHttpResponseStatus(err: unknown): number | undefined {
  let cur: unknown = err;
  const seen = new Set<unknown>();
  for (let depth = 0; depth < 8 && cur && typeof cur === "object" && !seen.has(cur); depth++) {
    seen.add(cur);
    const o = cur as Record<string, unknown>;

    const status = o.status;
    if (typeof status === "number" && Number.isFinite(status)) {
      return status;
    }

    const response = o.response;
    if (response && typeof response === "object") {
      const rs = (response as { status?: unknown }).status;
      if (typeof rs === "number" && Number.isFinite(rs)) {
        return rs;
      }
    }

    cur = o.cause;
  }
  return undefined;
}
