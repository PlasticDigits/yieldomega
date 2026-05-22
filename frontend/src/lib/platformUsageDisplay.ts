// SPDX-License-Identifier: AGPL-3.0-only

import type { PlatformUsageVelocityWindow } from "@/lib/indexerApi";

/** Locale-formatted mean/median from indexer decimal strings ([GitLab #234](https://gitlab.com/PlasticDigits/yieldomega/-/issues/234)). */
export function formatPlatformUsageDecimalStat(raw: string | undefined): string | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return raw;
  }
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** Velocity summary label — window-specific so 24h is not read as “per hour in last day” only ([GitLab #234](https://gitlab.com/PlasticDigits/yieldomega/-/issues/234)). */
export function platformUsageVelocityAvgSuffix(window: PlatformUsageVelocityWindow): string {
  switch (window) {
    case "1h":
      return "avg buys / hour (last hour)";
    case "24h":
      return "avg buys / hour (24h window)";
    case "sale":
      return "avg buys / hour (since sale start)";
    default:
      return "avg buys / hour";
  }
}
