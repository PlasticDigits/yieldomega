// SPDX-License-Identifier: AGPL-3.0-only

import { CutoutDecoration } from "@/components/CutoutDecoration";
import { PageHero } from "@/components/ui/PageHero";
import { PageSection } from "@/components/ui/PageSection";
import { PLACEHOLDER_CUTOUTS_BY_SLUG } from "@/lib/surfaceContent";
import { ReferralRegisterSection } from "@/pages/referrals/ReferralRegisterSection";

const CUT = PLACEHOLDER_CUTOUTS_BY_SLUG.referrals;

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
      <PageSection
        title="Links that count"
        badgeLabel="Client capture"
        badgeTone="info"
        lede="Pending codes persist in localStorage and sessionStorage (not a secret, clearable in devtools). A valid `?ref=` in the query wins over a path when both are present."
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
