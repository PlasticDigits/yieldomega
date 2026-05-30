// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { PageSection } from "@/components/ui/PageSection";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { formatCompactFromRaw } from "@/lib/compactNumberFormat";
import { fetchReferralWalletCredSummary, type ReferralWalletCredSummary } from "@/lib/indexerApi";

/** Guide CRED (referrer) line: compact humanized amount with six significant figures. */
const REFERRAL_GUIDE_CRED_DISPLAY_SIGFIGS = 6;

type Props = { className?: string };

export function ReferralProgramEarningsSection({ className }: Props) {
  const { address, isConnected } = useAccount();
  const [summary, setSummary] = useState<ReferralWalletCredSummary | null | undefined>(undefined);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setSummary(undefined);
      setLoadErr(null);
      return;
    }
    let cancelled = false;
    setSummary(undefined);
    setLoadErr(null);
    void fetchReferralWalletCredSummary(address).then(
      (r) => {
        if (!cancelled) {
          setSummary(r);
          if (!r) {
            setLoadErr("No referral summary is available yet.");
          }
        }
      },
      () => {
        if (!cancelled) {
          setSummary(null);
          setLoadErr("Could not load referral summary. Try again in a moment.");
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [address]);

  const totals = useMemo(() => {
    if (!summary) {
      return null;
    }
    const totalCred = BigInt(summary.referrer_cred_wad) + BigInt(summary.buyer_cred_wad);
    return { totalCred };
  }, [summary]);

  const guideCredHumanized = useMemo(() => {
    if (!summary) {
      return "";
    }
    return formatCompactFromRaw(summary.referrer_cred_wad, 18, { sigfigs: REFERRAL_GUIDE_CRED_DISPLAY_SIGFIGS });
  }, [summary]);

  return (
    <PageSection
      className={className}
      title="Your earnings"
      lede="Track Play CRED earned when people buy on TimeArena after clicking your link (5 CRED per referred DOUB buy per side)"
    >
      {!isConnected || !address ? (
        <div className="referrals-empty-state referrals-empty-state--charm">
          <span className="referrals-empty-state__icon" aria-hidden="true">
            CR
          </span>
          <div>
            <strong>Connect to see your CRED</strong>
            <p>The page will load guide CRED and referral buy counts from the indexer.</p>
          </div>
        </div>
      ) : loadErr ? (
        <StatusMessage variant="error">{loadErr}</StatusMessage>
      ) : summary === undefined ? (
        <StatusMessage variant="muted">Loading referral totals…</StatusMessage>
      ) : !summary || !totals ? (
        <StatusMessage variant="muted">No summary data.</StatusMessage>
      ) : (
        <div className="data-panel data-panel--stack" data-testid="referrals-program-earnings">
          {totals.totalCred === 0n ? (
            <StatusMessage variant="muted" data-testid="referrals-earnings-zero-banner">
              <strong>No referral CRED yet.</strong> Totals stay at zero until qualifying referral purchases show up
              here for this wallet.
            </StatusMessage>
          ) : null}
          <p className="data-panel__label referrals-earnings-charm-line" data-testid="referrals-earnings-guide-cred">
            <span>YOUR CRED EARNED (GUIDE):</span>{" "}
            <strong className="tabular-nums">{guideCredHumanized}</strong>
          </p>
          <p
            className="data-panel__label referrals-earnings-recorded-buys-line"
            data-testid="referrals-earnings-recorded-buys"
          >
            <span>RECORDED BUYS:</span>{" "}
            <strong className="tabular-nums">{summary.referred_buy_count}</strong>
          </p>
          {totals.totalCred === 0n ? (
            <p className="muted" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
              No referral activity recorded for this wallet yet — buys with your code (or a code you used) appear here
              shortly after they settle onchain.
            </p>
          ) : null}
        </div>
      )}
    </PageSection>
  );
}
