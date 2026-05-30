// SPDX-License-Identifier: AGPL-3.0-only

import { parseUnits } from "viem";

/** Fixed onchain CHARM bounds for TimeArena buys (GitLab #256). */
export const ARENA_CHARM_MIN_WAD = parseUnits("0.99", 18);
export const ARENA_CHARM_MAX_WAD = parseUnits("10", 18);
