// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/** UX label order. Contract reads use {@link PODIUM_CONTRACT_CATEGORY_INDEX}. */
export const PODIUM_LABELS = ["Last Buy", "WarBow", "Defended Streak", "Time Booster"] as const;

/** Help blurbs beside each reserve podium category (simple page, protocol page, arena spotlights). */
export const PODIUM_HELP: readonly [ReactNode, ReactNode, ReactNode, ReactNode] = [
  "Last 3 Buyers Win!",
  <>
    Use <Link to="/timecurve/arena">Arena</Link> to Battle for Points!
  </>,
  "Buy streaks under 15 minutes win!",
  "Add the most time to the clock to win!",
];

/** Maps each {@link PODIUM_LABELS} slot to `TimeCurve.podium(category)` index. */
export const PODIUM_CONTRACT_CATEGORY_INDEX: readonly number[] = [0, 3, 2, 1];
