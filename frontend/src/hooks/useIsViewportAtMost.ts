// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from "react";

/** True while `window` width is ≤ `maxWidthPx` (inclusive). SSR / first paint defaults to false. */
export function useIsViewportAtMost(maxWidthPx: number): boolean {
  const [match, setMatch] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidthPx}px)`);
    const apply = () => {
      setMatch(mq.matches);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => {
      mq.removeEventListener("change", apply);
    };
  }, [maxWidthPx]);

  return match;
}
