// SPDX-License-Identifier: AGPL-3.0-only

import { parseUnits } from "viem";

/** Fixed onchain CHARM bounds for TimeArena buys (GitLab #256). */
export const ARENA_CHARM_MIN_WAD = parseUnits("0.99", 18);
export const ARENA_CHARM_MAX_WAD = parseUnits("10", 18);

/** Onchain `TimeArena.REFERRAL_CRED_FLAT_WAD` fallback when RPC read is unavailable (GitLab #272). */
export const ARENA_REFERRAL_FLAT_CRED_WAD = parseUnits("5", 18);
