// SPDX-License-Identifier: AGPL-3.0-only

import { CutoutDecoration } from "@/components/CutoutDecoration";
import { PageHero } from "@/components/ui/PageHero";
import { PLACEHOLDER_CUTOUTS_BY_SLUG } from "@/lib/surfaceContent";
import { ReferralLeaderboardSection } from "@/pages/referrals/ReferralLeaderboardSection";
import { ReferralProgramEarningsSection } from "@/pages/referrals/ReferralProgramEarningsSection";
import { ReferralRegisterSection } from "@/pages/referrals/ReferralRegisterSection";

const CUT = PLACEHOLDER_CUTOUTS_BY_SLUG.referrals;

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
        <span title="ReferralRegistry registration burns 1 CL8Y once when the code is claimed.">1 CL8Y burn</span>
        <span title="ReferralRegistry stores one owner code per wallet.">One code</span>
        <span title="ReferralCredApplied mints 5 CRED to the guide and 5 CRED to the referred buyer.">5 + 5 CRED</span>
      </div>
    </aside>
  );
}

export function ReferralsPage() {
  return (
    <section className="page page--referrals" data-testid="referrals-surface">
      <div className="placeholder-cutout-layer" aria-hidden="true">
        <CutoutDecoration
          className="placeholder-cutout placeholder-cutout--left cutout-decoration--float"
          src={CUT.primary}
          width={300}
          height={320}
        />
        <CutoutDecoration
          className="placeholder-cutout placeholder-cutout--right cutout-decoration--peek"
          src={CUT.secondary}
          width={208}
          height={208}
        />
        <CutoutDecoration
          className="placeholder-cutout placeholder-cutout--orbit cutout-decoration--bob"
          src={CUT.tertiary}
          width={144}
          height={144}
        />
      </div>
      <PageHero
        title="Referrals"
        badgeLabel="CRED Network"
        badgeTone="live"
        coinSrc="/tokens/cl8y.svg"
        coinAlt="CL8Y"
        lede="Guide codes for TimeArena DOUB buys."
        mascot={{
          src: CUT.primary,
          width: 300,
          height: 320,
          className: "cutout-decoration--float",
        }}
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
