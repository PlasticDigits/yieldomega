// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from "react";
import { formatRelativeFreshnessEnglish } from "@/lib/cl8yUsdEquivalentDisplay";

const TICK_MS = 8_000;

/**
 * Human relative age for a wall-clock anchor, ticking slowly so the UI stays quiet.
 */
export function useRelativeFreshnessLabel(fromMs: number | undefined): string {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (fromMs === undefined) {
      return;
    }
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, TICK_MS);
    return () => {
      window.clearInterval(id);
    };
  }, [fromMs]);

  if (fromMs === undefined) {
    return "";
  }
  return formatRelativeFreshnessEnglish(fromMs, now);
}
