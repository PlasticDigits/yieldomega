// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import type { BuyItem } from "@/lib/indexerApi";
import { peerBuyHeadSfxId } from "@/pages/arena/peerBuyHeadSfxTick";

export type LastBuyHeadShakeTickResult =
  | { kind: "noop" }
  | { kind: "seed"; nextHeadId: string }
  | { kind: "shake"; nextHeadId: string };

/** Pure transition for indexer “latest buy” head changes → optional first-place trophy shake. */
export function lastBuyHeadShakeTick(args: {
  previousHeadId: string | null;
  head: BuyItem | null | undefined;
}): LastBuyHeadShakeTickResult {
  const head = args.head ?? null;
  if (!head) return { kind: "noop" };
  const id = peerBuyHeadSfxId(head);
  if (args.previousHeadId === null) return { kind: "seed", nextHeadId: id };
  if (args.previousHeadId === id) return { kind: "noop" };
  return { kind: "shake", nextHeadId: id };
}

/** Bumps a nonce whenever `recentBuys` gets a new head row (latest Last Buy). */
export function useLastBuyHeadShakeNonce(
  recentBuys: readonly BuyItem[] | null | undefined,
): number {
  const reduceMotion = Boolean(useReducedMotion());
  const lastHeadId = useRef<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const tick = lastBuyHeadShakeTick({
      previousHeadId: lastHeadId.current,
      head: recentBuys?.[0],
    });
    if (tick.kind === "noop") return;
    lastHeadId.current = tick.nextHeadId;
    if (tick.kind === "shake") setNonce((n) => n + 1);
  }, [recentBuys, reduceMotion]);

  return nonce;
}
