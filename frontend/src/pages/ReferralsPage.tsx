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
        <h2>Claim a code</h2>
        <p>
          Burn CL8Y once via ReferralRegistry. Ownership is whoever wins the{" "}
          <strong>first successful registration</strong> for that slug (public mempool ordering); plaintext stored here
          only helps share links.
        </p>
      </article>
      <article className="referrals-overview-card referrals-overview-card--gold">
        <span className="referrals-overview-card__step">02</span>
        <h2>Share a live route</h2>
        <p>
          Use <code>/?ref=code</code> or <code>/timecurve/code</code>. Browser storage captures pending codes only.
        </p>
      </article>
      <article className="referrals-overview-card referrals-overview-card--blue">
        <span className="referrals-overview-card__step">03</span>
        <h2>Track CHARM</h2>
        <p>Referral bonuses are CHARM weight from TimeCurve events; rankings here reflect recorded referral activity.</p>
      </article>
    </div>
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
        lede="Short codes, CL8Y registration burn, and TimeCurve buy bonuses — authority stays on ReferralRegistry + TimeCurve; this client captures links and shows read-only on-chain parameters."
        mascot={{
          src: CUT.secondary,
          width: 208,
          height: 208,
          className: "cutout-decoration--peek",
        }}
      />
      <ReferralOverviewStrip />
      <div className="referrals-dashboard-grid">
        <ReferralConnectedWalletSection className="referrals-panel referrals-panel--wallet" />
        <ReferralProgramEarningsSection className="referrals-panel referrals-panel--earnings" />
      </div>
      <ReferralLeaderboardSection className="referrals-panel referrals-panel--leaderboard" />
      <ReferralRegisterSection className="referral-register" />
    </section>
  );
}
