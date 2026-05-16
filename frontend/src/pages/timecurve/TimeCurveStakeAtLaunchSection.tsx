// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from "react";
import { AmountDisplay } from "@/components/AmountDisplay";
import { CutoutDecoration } from "@/components/CutoutDecoration";
import { EmptyDataPlaceholder } from "@/components/EmptyDataPlaceholder";
import { PageBadge } from "@/components/ui/PageBadge";
import { SIMPLE_STAKE_LAUNCH_USD_EQUIV_TITLE } from "@/lib/cl8yUsdEquivalentDisplay";
import { formatCompactFromRaw } from "@/lib/compactNumberFormat";
import { fallbackPayTokenWeiForCl8y } from "@/lib/kumbayaDisplayFallback";
import type { PayWithAsset } from "@/lib/kumbayaRoutes";

export type TimeCurveStakeAtLaunchSectionProps = {
  visible: boolean;
  charmWeightWad: bigint | undefined;
  launchCl8yValueWei: bigint | undefined;
  /** Pay mode from the rate board — stake “≈” line mirrors the selected asset (CL8Y / ETH / USDM). */
  payWith: PayWithAsset;
  /** ERC-20 decimals for ETH/USDM when `payWith` is not CL8Y. */
  payTokenDecimals: number;
  /** Display wei for the ≈ line (CL8Y-at-launch or scaled Kumbaya / fallback pay token). */
  stakeLaunchEquivPayWei: bigint | undefined;
  /** When paying ETH/USDM during a live quoter fetch for the launch leg. */
  stakeLaunchEquivQuoteLoading: boolean;
  decimals: number;
  /** When true after sale end, CHARM weight stays onchain but allocation was redeemed for DOUB ([issue #90](https://gitlab.com/PlasticDigits/yieldomega/-/issues/90)). */
  charmsRedeemed: boolean | undefined;
  /** Matches `TimeCurve.redeemCharms` `tokenOut` (`totalTokensForSale * charmWeight / totalCharmWeight`); charm weight is not burned on redeem so this stays derivable. */
  expectedTokenFromCharms: bigint | undefined;
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
 * CHARM count + **worth at launch** projection (`participantLaunchValueCl8yWei`), shown in the
 * selected pay asset (CL8Y, or ETH/USDM via Kumbaya launch quote scaled to CHARM weight / fallback).
 * After `redeemCharms`, onchain `charmWeight` still reflects historical allocation; UI treats redeemed state per issue #90 (DOUB line + settled chrome + crossed-out launch projection — **not** replacing the anchor line with DOUB; mixed pay rails mean “worth” stays anchored in CL8Y terms then converted for display).
 */
export function TimeCurveStakeAtLaunchSection({
  visible,
  charmWeightWad,
  launchCl8yValueWei,
  payWith,
  payTokenDecimals,
  stakeLaunchEquivPayWei,
  stakeLaunchEquivQuoteLoading,
  decimals,
  charmsRedeemed,
  expectedTokenFromCharms,
}: TimeCurveStakeAtLaunchSectionProps) {
  if (!visible) return null;

  const redeemed = charmsRedeemed === true;
  const hasCharm = charmWeightWad !== undefined && charmWeightWad > 0n;
  const noCharm = charmWeightWad !== undefined && charmWeightWad === 0n;
  const equivDecimals = payWith === "cl8y" ? decimals : payTokenDecimals;
  const equivSymbol = payWith === "cl8y" ? "CL8Y" : payWith === "eth" ? "ETH" : "USDM";
  const charmMoodCopy = redeemed
    ? "Your round is settled, but the onchain CHARM trail stays visible."
    : hasCharm
      ? "Nice Stash!"
      : noCharm
        ? "No CHARM yet. BUY CHARM above to light up your launch stake."
        : "Checking your wallet for CHARM weight.";
  const charmMascotSrc = hasCharm
    ? "/art/cutouts/mascot-bunnyleprechaungirl-jump-cutout.png"
    : "/art/cutouts/cutout-bunnyleprechaungirl-playful.png";

  /** Same static CL8Y→USDM display shape as Simple podium prizes ([GitLab #192](https://gitlab.com/PlasticDigits/yieldomega/-/issues/192)). */
  const stakeUsdApproxLabel =
    launchCl8yValueWei !== undefined && launchCl8yValueWei > 0n
      ? formatCompactFromRaw(
          fallbackPayTokenWeiForCl8y(launchCl8yValueWei, "usdm").toString(),
          18,
          { sigfigs: 3 },
        )
      : undefined;

  const redeemedLede: ReactNode = (
    <>
      You already redeemed your allocation for <strong>DOUB</strong>. The figures below are{" "}
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

  const panelClasses = [
    "data-panel",
    "timecurve-simple__stake-panel",
    redeemed ? "timecurve-simple__stake-panel--redeemed" : "",
    hasCharm ? "timecurve-simple__stake-panel--has-charm" : "",
    noCharm ? "timecurve-simple__stake-panel--no-charm" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={panelClasses}>
      <div className="timecurve-simple__stake-fx" aria-hidden="true">
        <span className="timecurve-simple__stake-particle timecurve-simple__stake-particle--one" />
        <span className="timecurve-simple__stake-particle timecurve-simple__stake-particle--two" />
        <span className="timecurve-simple__stake-particle timecurve-simple__stake-particle--three" />
      </div>
      <CutoutDecoration
        className="timecurve-simple__stake-cutout cutout-decoration--bounce"
        src={charmMascotSrc}
        width={220}
        height={310}
      />
      <div className="timecurve-simple__stake-panel-main">
        <div className="timecurve-simple__stake-mood" aria-live="polite">
          <span className="timecurve-simple__stake-mood-copy">{charmMoodCopy}</span>
        </div>

        {redeemed ? (
          <div className="section-heading">
            <div className="section-heading__copy">
              <div className="section-heading__lede">{redeemedLede}</div>
            </div>
            <div className="section-heading__actions">
              <SettledHeaderDecor />
            </div>
          </div>
        ) : null}

        <div
          className={`timecurve-simple__stake-combined${redeemed ? " timecurve-simple__stake-combined--redeemed" : ""}`}
          role="group"
          aria-label={`CHARM held and projected worth at launch in ${equivSymbol}`}
        >
          <p className="timecurve-simple__stake-combined-line timecurve-simple__stake-combined-line--primary">
            <span className="timecurve-simple__stake-combined-label">YOUR CHARM:</span>{" "}
            {charmWeightWad !== undefined ? (
              <span data-testid="timecurve-simple-stake-charm" className="timecurve-simple__stake-combined-charm">
                <AmountDisplay raw={charmWeightWad.toString()} decimals={18} />
              </span>
            ) : (
              <EmptyDataPlaceholder>Loading CHARM weight…</EmptyDataPlaceholder>
            )}
          </p>
          {charmWeightWad !== undefined && (
            <p className="timecurve-simple__stake-combined-line timecurve-simple__stake-combined-line--approx">
              {launchCl8yValueWei !== undefined ? (
                stakeLaunchEquivQuoteLoading ? (
                  <EmptyDataPlaceholder>Refreshing quote…</EmptyDataPlaceholder>
                ) : stakeLaunchEquivPayWei !== undefined ? (
                  <span
                    data-testid="timecurve-simple-stake-launch-equiv"
                    className="timecurve-simple__stake-combined-launch"
                  >
                    <span aria-hidden="true">≈ </span>
                    <span
                      className={redeemed ? "timecurve-simple__stake-tile-value--redeemed-struck" : undefined}
                    >
                      <AmountDisplay raw={stakeLaunchEquivPayWei.toString()} decimals={equivDecimals} />
                      <span className="timecurve-simple__stake-combined-token"> {equivSymbol}</span>
                    </span>
                    {stakeUsdApproxLabel !== undefined ? (
                      <span
                        className="timecurve-simple__stake-combined-usd"
                        title={SIMPLE_STAKE_LAUNCH_USD_EQUIV_TITLE}
                      >
                        {" "}
                        ({stakeUsdApproxLabel} USD)
                      </span>
                    ) : null}
                    {redeemed && (
                      <span className="timecurve-simple__stake-redeemed-note"> (redeemed)</span>
                    )}
                  </span>
                ) : (
                  <EmptyDataPlaceholder>Equivalent loads with your CHARM read.</EmptyDataPlaceholder>
                )
              ) : (
                <EmptyDataPlaceholder>CL8Y-at-launch loads with your CHARM read.</EmptyDataPlaceholder>
              )}
            </p>
          )}
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
      </div>
    </div>
  );
}
