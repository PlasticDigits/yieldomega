// SPDX-License-Identifier: AGPL-3.0-only

import { formatLocaleInteger } from "@/lib/formatAmount";

/** Primary helper lines shown under the Arena claim-flag CTA (GitLab #218). */
export function warbowClaimFlagHelperLines(opts: {
  claimBp: bigint;
}): { rewardLine: string; penaltyLine: string; earlyInterruptLine: string } {
  const claimBp = opts.claimBp;
  const penaltyBp = claimBp * 2n;
  return {
    rewardLine: `+${formatLocaleInteger(claimBp)} BP if you claim after the silence window with no other buyer in between`,
    penaltyLine: `−${formatLocaleInteger(penaltyBp)} BP if another wallet buys after silence ends but before you claim`,
    earlyInterruptLine:
      "If another buyer purchases before silence ends, the pending slot is cleared without the 2× penalty — you only lose the claim opportunity.",
  };
}
