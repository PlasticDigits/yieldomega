// SPDX-License-Identifier: AGPL-3.0-only

import { PageHero } from "@/components/ui/PageHero";
import { DOUB_TOKEN_LOGO } from "@/lib/tokenMedia";
import { ReferralLeaderboardSection } from "@/pages/referrals/ReferralLeaderboardSection";
import { ReferralProgramEarningsSection } from "@/pages/referrals/ReferralProgramEarningsSection";
import { ReferralRegisterSection } from "@/pages/referrals/ReferralRegisterSection";

function ReferralQuestStrip() {
  return (
    <aside className="referrals-quest-strip" aria-label="Referral command summary">
      <div>
        <h2>Register. Share. Track CRED.</h2>
        <p title="ReferralCredApplied mints 5 Play CRED to the referrer and 5 Play CRED to the buyer on each referred TimeArena DOUB buy.">
          Flat referral CRED on referred DOUB buys.
        </p>
      </div>
      <div className="referrals-quest-strip__badges" aria-label="Referral facts">
        <span title="Referral codes normalize to lowercase and accept 3-16 letters or digits.">3-16 chars</span>
        <span title="ReferralRegistry registration burns DOUB equal to the Last Buy epoch CHARM anchor once when the code is claimed.">Epoch-anchor DOUB burn</span>
        <span title="ReferralRegistry stores one owner code per wallet.">One code</span>
        <span title="ReferralCredApplied mints 5 CRED to the guide and 5 CRED to the referred buyer.">5 + 5 CRED</span>
      </div>
    </aside>
  );
}

export function ReferralsPage() {
  return (
    <section className="page page--referrals yga-secondary-page" data-testid="referrals-surface">
      <PageHero
        title="Referrals"
        badgeLabel="CRED Network"
        badgeTone="live"
        coinSrc={DOUB_TOKEN_LOGO}
        coinAlt="DOUB"
        lede="Guide codes for TimeArena DOUB buys."
      />
      <ReferralQuestStrip />
      <ReferralRegisterSection className="referral-register" />
      <div className="referrals-dashboard-grid">
        <ReferralProgramEarningsSection className="referrals-panel referrals-panel--earnings" />
      </div>
      <ReferralLeaderboardSection className="referrals-panel referrals-panel--leaderboard" />
    </section>
  );
}
