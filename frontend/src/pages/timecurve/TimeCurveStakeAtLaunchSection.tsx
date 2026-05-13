// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { EmptyDataPlaceholder } from "@/components/EmptyDataPlaceholder";
import { PageBadge } from "@/components/ui/PageBadge";
import { PageSection } from "@/components/ui/PageSection";
import { formatCompactFromRaw } from "@/lib/compactNumberFormat";

export type TimeCurveStakeAtLaunchSectionProps = {
  visible: boolean;
  charmWeightWad: bigint | undefined;
  launchCl8yValueWei: bigint | undefined;
  decimals: number;
  /** When true after sale end, CHARM weight stays onchain but allocation was redeemed for DOUB ([issue #90](https://gitlab.com/PlasticDigits/yieldomega/-/issues/90)). */
  charmsRedeemed: boolean | undefined;
  /** Matches `TimeCurve.redeemCharms` `tokenOut` (`totalTokensForSale * charmWeight / totalCharmWeight`); charm weight is not burned on redeem so this stays derivable. */
  expectedTokenFromCharms: bigint | undefined;
  launchHelperCopy: string;
};

function SettledHeaderDecor() {
  return (
    <div className="timecurve-simple__stake-settled-actions" aria-label="Charm redemption settled">
      <svg
        className="timecurve-simple__stake-settled-check"
        width={20}
        height={20}
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="11" fill="var(--arcade-green-500)" />
        <path
          d="M7 12l3 3 7-7"
          stroke="#fff"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <PageBadge label="Settled" tone="live" />
    </div>
  );
}

/**
 * **Your stake at launch** — CHARM count + CL8Y-at-launch projection (`participantLaunchValueCl8yWei`).
 * After `redeemCharms`, onchain `charmWeight` still reflects historical allocation; UI treats redeemed state per issue #90 (DOUB line + settled chrome + crossed-out launch projection — **not** replacing CL8Y with DOUB; mixed pay rails mean “worth” stays anchored in CL8Y terms).
 */
export function TimeCurveStakeAtLaunchSection({
  visible,
  charmWeightWad,
  launchCl8yValueWei,
  decimals,
  charmsRedeemed,
  expectedTokenFromCharms,
  launchHelperCopy,
}: TimeCurveStakeAtLaunchSectionProps) {
  if (!visible) return null;

  const redeemed = charmsRedeemed === true;

  const defaultLede: ReactNode = (
    <>
      The DOUB/CL8Y locked liquidity seeds at <strong>1.275×</strong> the per-CHARM clearing price, so
      your CHARM is projected in CL8Y here — a number that <strong>only goes up</strong> as the sale
      heats up. Hidden on purpose: the DOUB count, which dilutes as more CHARM mints.
    </>
  );

  const redeemedLede: ReactNode = (
    <>
      You already redeemed your allocation for <strong>DOUB</strong>. The tiles below are{" "}
      <strong>historical</strong> (your CHARM weight stays readable onchain after redemption). The{" "}
      CL8Y-at-launch figure is <strong>struck through</strong> — it described projected stake before
      settlement, not a balance you can claim twice.
    </>
  );

  const redeemedDoubDisplay =
    expectedTokenFromCharms !== undefined && expectedTokenFromCharms > 0n ? (
      formatCompactFromRaw(expectedTokenFromCharms, 18, { sigfigs: 4 })
    ) : (
      <EmptyDataPlaceholder>Redeemed DOUB amount not available yet.</EmptyDataPlaceholder>
    );

  return (
    <PageSection
      title="Your stake at launch"
      className={`timecurve-simple__stake-panel${redeemed ? " timecurve-simple__stake-panel--redeemed" : ""}`}
      badgeLabel="1.275× launch anchor"
      badgeTone="info"
      lede={redeemed ? redeemedLede : defaultLede}
      actions={redeemed ? <SettledHeaderDecor /> : undefined}
    >
      <div className="timecurve-simple__stake-grid">
        <div className="timecurve-simple__stake-tile">
          <span className="timecurve-simple__stake-tile-label">You hold</span>
          <strong
            className="timecurve-simple__stake-tile-value"
            data-testid="timecurve-simple-stake-charm"
          >
            {charmWeightWad !== undefined ? (
              formatCompactFromRaw(charmWeightWad, 18, { sigfigs: 4 })
            ) : (
              <EmptyDataPlaceholder>Loading CHARM weight…</EmptyDataPlaceholder>
            )}
          </strong>
          <span className="timecurve-simple__stake-tile-unit">CHARM</span>
        </div>
        <div
          className={`timecurve-simple__stake-tile timecurve-simple__stake-tile--launch${redeemed ? " timecurve-simple__stake-tile--launch-redeemed" : ""}`}
        >
          <span className="timecurve-simple__stake-tile-label">
            Worth at launch ≈
            {redeemed && (
              <span className="timecurve-simple__stake-redeemed-note"> (redeemed)</span>
            )}
          </span>
          <strong
            className={`timecurve-simple__stake-tile-value${redeemed ? " timecurve-simple__stake-tile-value--redeemed-struck" : ""}`}
            data-testid="timecurve-simple-stake-cl8y-launch"
          >
            {launchCl8yValueWei !== undefined ? (
              formatCompactFromRaw(launchCl8yValueWei, decimals, {
                sigfigs: 4,
              })
            ) : (
              <EmptyDataPlaceholder>CL8Y-at-launch loads with your CHARM read.</EmptyDataPlaceholder>
            )}
          </strong>
          <span className="timecurve-simple__stake-tile-unit">CL8Y</span>
        </div>
      </div>

      {redeemed && (
        <div
          className="timecurve-simple__stake-redeemed-row"
          data-testid="timecurve-simple-stake-redeemed-doub"
        >
          <span className="timecurve-simple__stake-tile-label">Redeemed</span>
          <strong className="timecurve-simple__stake-redeemed-value">{redeemedDoubDisplay}</strong>
          <span className="timecurve-simple__stake-tile-unit">DOUB</span>
        </div>
      )}

      <p className="muted timecurve-simple__stake-foot">
        {launchHelperCopy} · enforced by <code>DoubLPIncentives</code>; see the{" "}
        <Link to="/timecurve/protocol">Protocol view</Link> for raw onchain reads.
      </p>
    </PageSection>
  );
}
