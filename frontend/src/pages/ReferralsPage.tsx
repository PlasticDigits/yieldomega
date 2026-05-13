// SPDX-License-Identifier: AGPL-3.0-only

import { CutoutDecoration } from "@/components/CutoutDecoration";
import { PageHero } from "@/components/ui/PageHero";
import { PLACEHOLDER_CUTOUTS_BY_SLUG } from "@/lib/surfaceContent";
import { ReferralConnectedWalletSection } from "@/pages/referrals/ReferralConnectedWalletSection";
import { ReferralLeaderboardSection } from "@/pages/referrals/ReferralLeaderboardSection";
import { ReferralProgramEarningsSection } from "@/pages/referrals/ReferralProgramEarningsSection";
import { ReferralRegisterSection } from "@/pages/referrals/ReferralRegisterSection";

const CUT = PLACEHOLDER_CUTOUTS_BY_SLUG.referrals;

function ReferralOverviewStrip() {
  return (
    <div className="referrals-overview-grid" aria-label="Referral program overview">
      <article className="referrals-overview-card">
        <span className="referrals-overview-card__step">01</span>
        <h2>Claim your sigil</h2>
        <p>
          Pick a short code, burn CL8Y once, and make it yours on ReferralRegistry. The first successful on-chain
          registration wins the name.
        </p>
      </article>
      <article className="referrals-overview-card referrals-overview-card--gold">
        <span className="referrals-overview-card__step">02</span>
        <h2>Send a trail</h2>
        <p>
          Share a TimeCurve path or a <code>?ref=</code> link. Visitors arrive with your code ready for their next
          qualifying buy.
        </p>
      </article>
      <article className="referrals-overview-card referrals-overview-card--blue">
        <span className="referrals-overview-card__step">03</span>
        <h2>Grow CHARM</h2>
        <p>
          When a linked buy qualifies, both traveler and guide gain extra CHARM weight. The board only counts recorded
          TimeCurve events.
        </p>
      </article>
    </div>
  );
}

function ReferralQuestStrip() {
  return (
    <aside className="referrals-quest-strip" aria-label="Referral quest guide">
      <div>
        <span className="referrals-quest-strip__eyebrow">Lucky Ledger Route</span>
        <h2>Guide new buyers through the burrow</h2>
        <p>
          Referrals are not offchain points or promo codes. They are a small onchain quest: register a name, share the
          trail, and let TimeCurve add CHARM weight when a buy uses that code.
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
      <PageHero
        title="Referrals"
        badgeLabel="TimeCurve"
        badgeTone="live"
        coinSrc="/art/hat-coin-stack.png"
        sceneSrc="/art/scenes/referrals-hero.jpg"
        lede="Claim a memorable guide code, share a TimeCurve trail, and help new buyers join the YieldOmega game with CHARM bonuses both sides can understand."
        mascot={{
          src: CUT.secondary,
          width: 208,
          height: 208,
          className: "cutout-decoration--peek",
        }}
      />
      <ReferralOverviewStrip />
      <ReferralQuestStrip />
      <ReferralRegisterSection className="referral-register" />
      <div className="referrals-dashboard-grid">
        <ReferralConnectedWalletSection className="referrals-panel referrals-panel--wallet" />
        <ReferralProgramEarningsSection className="referrals-panel referrals-panel--earnings" />
      </div>
      <ReferralLeaderboardSection className="referrals-panel referrals-panel--leaderboard" />
    </section>
  );
}
