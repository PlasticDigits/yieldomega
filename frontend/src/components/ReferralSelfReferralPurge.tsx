// SPDX-License-Identifier: AGPL-3.0-only

import { useLayoutEffect } from "react";
import { useAccount } from "wagmi";
import { purgePendingReferralIfSelfReferral } from "@/lib/referralSelfReferralPending";
import {
  subscribeMyReferralCodeCache,
  subscribePendingReferralCode,
} from "@/lib/referralStorage";

/**
 * Clears pending referral capture when it matches the connected wallet's own
 * registered code — on connect, capture, or post-register cache write ([GitLab #222](https://gitlab.com/PlasticDigits/yieldomega/-/issues/222)).
 */
export function ReferralSelfReferralPurge() {
  const { address } = useAccount();
  const wallet = address as `0x${string}` | undefined;

  useLayoutEffect(() => {
    purgePendingReferralIfSelfReferral(wallet);
  }, [wallet]);

  useLayoutEffect(() => {
    if (!wallet) {
      return;
    }
    const run = () => {
      purgePendingReferralIfSelfReferral(wallet);
    };
    const unsubPending = subscribePendingReferralCode(run);
    const unsubMy = subscribeMyReferralCodeCache(run);
    return () => {
      unsubPending();
      unsubMy();
    };
  }, [wallet]);

  return null;
}
