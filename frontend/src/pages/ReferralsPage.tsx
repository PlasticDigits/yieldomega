// SPDX-License-Identifier: AGPL-3.0-only

import { CutoutDecoration } from "@/components/CutoutDecoration";
import { PageHeroHeading } from "@/components/ui/PageHero";
import { PLACEHOLDER_CUTOUTS_BY_SLUG } from "@/lib/surfaceContent";
import { ReferralLeaderboardSection } from "@/pages/referrals/ReferralLeaderboardSection";
import { ReferralProgramEarningsSection } from "@/pages/referrals/ReferralProgramEarningsSection";
import { ReferralRegisterSection } from "@/pages/referrals/ReferralRegisterSection";

const CUT = PLACEHOLDER_CUTOUTS_BY_SLUG.referrals;

function ReferralQuestStrip() {
  return (
    <aside className="referrals-quest-strip" aria-label="Referral quest guide">
      <div>
        <h2>Guide new buyers through the burrow</h2>
        <p>
          When someone uses your referral link, every TimeCurve buy earns you 5% and gets them 5% bonus CHARM
        </p>
      </div>
      <div className="referrals-quest-strip__badges" aria-label="Referral facts">
        <span>3-16 letters or digits</span>
        <span>1 CL8Y burn</span>
        <span>One code per wallet</span>
        <span>5% CHARM each side</span>
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
      <header className="page-hero">
        <PageHeroHeading title="Referrals" />
      </header>
      <ReferralQuestStrip />
      <ReferralRegisterSection className="referral-register" />
      <div className="referrals-dashboard-grid">
        <ReferralProgramEarningsSection className="referrals-panel referrals-panel--earnings" />
      </div>
      <ReferralLeaderboardSection className="referrals-panel referrals-panel--leaderboard" />
    </section>
  );
}
