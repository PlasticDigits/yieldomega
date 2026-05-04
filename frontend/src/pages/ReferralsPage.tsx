// SPDX-License-Identifier: AGPL-3.0-only

import { CutoutDecoration } from "@/components/CutoutDecoration";
import { PageHero } from "@/components/ui/PageHero";
import { PageSection } from "@/components/ui/PageSection";
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
        <p>Referral bonuses are CHARM weight from TimeCurve events; the indexer only mirrors and ranks them.</p>
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
      <PageSection
        className="referrals-panel referrals-panel--links"
        title="Links that count"
        badgeLabel="Client capture"
        badgeTone="info"
        lede="Pending referral codes use yieldomega.ref.v1 in localStorage + sessionStorage. Registered share-link plaintext is cached per wallet under yieldomega.myrefcode.v1.<wallet>. Neither store owns codes onchain."
      >
        <ul className="accent-list">
          <li>
            <code>/?ref=yourcode</code> — same as today; query takes precedence if both a path code and a query are present.
          </li>
          <li>
            <code>/timecurve/{`{code}`}</code> — the live route shape for a path-based slug (the second segment is not <code>arena</code> or{" "}
            <code>protocol</code>, or a reserved name mirrored from app routing). A root <code>/{`{code}`}</code> short link is not exposed as a route,
            to avoid a dynamic segment colliding with real paths like <code>/home</code> in the post-launch tree.
          </li>
        </ul>
        <p className="muted" style={{ marginBottom: 0 }}>
          A governance-tunable on-chain <strong>reserved-word</strong> set is planned; the in-app list in{" "}
          <code>referralPathReserved.ts</code> should stay aligned when new product routes are added.
        </p>
      </PageSection>
      <PageSection
        className="referrals-panel referrals-panel--slug"
        title="Slug transfer"
        badgeLabel="Contract"
        badgeTone="soon"
        lede="This deployment of ReferralRegistry binds one code per address with no on-chain transfer hook. A future version could add a transfer/reset path through governance; until then, treat codes as account-bound for UX."
      >
        <p className="muted" style={{ margin: 0 }}>
          Track on-chain work for governance-updatable reserved words in the product issue; the web layer starts with a static mirror for routing.
        </p>
      </PageSection>
      <ReferralRegisterSection className="referral-register" />
    </section>
  );
}
