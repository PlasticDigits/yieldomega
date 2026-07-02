// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { PageSection } from "@/components/ui/PageSection";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { formatCompactFromRaw } from "@/lib/compactNumberFormat";
import { TokenLogo } from "@/components/TokenLogo";
import { fetchReferralWalletCredSummary, type ReferralWalletCredSummary } from "@/lib/indexerApi";
import { CRED_TOKEN_LOGO } from "@/lib/tokenMedia";

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

  const credHumanized = useMemo(() => {
    if (!summary) {
      return null;
    }
    return {
      guide: formatCompactFromRaw(summary.referrer_cred_wad, 18, {
        sigfigs: REFERRAL_GUIDE_CRED_DISPLAY_SIGFIGS,
      }),
      buyer: formatCompactFromRaw(summary.buyer_cred_wad, 18, {
        sigfigs: REFERRAL_GUIDE_CRED_DISPLAY_SIGFIGS,
      }),
      total: formatCompactFromRaw(
        (BigInt(summary.referrer_cred_wad) + BigInt(summary.buyer_cred_wad)).toString(),
        18,
        { sigfigs: REFERRAL_GUIDE_CRED_DISPLAY_SIGFIGS },
      ),
    };
  }, [summary]);

  return (
    <PageSection
      className={className}
      title="Your CRED"
    >
      {!isConnected || !address ? (
        <div className="referrals-empty-state referrals-empty-state--charm">
          <TokenLogo className="referrals-empty-state__token cred-token-icon" src={CRED_TOKEN_LOGO} width={40} height={40} />
          <div>
            <strong>Connect to see your CRED</strong>
            <p title="Reads GET /v1/referrals/wallet-cred-summary for referrer and buyer CRED totals.">
              Indexer-backed referral totals.
            </p>
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
              <strong>No referral CRED yet.</strong>
            </StatusMessage>
          ) : null}
          <p
            className="data-panel__label referrals-earnings-cred-line"
            data-testid="referrals-earnings-guide-cred"
            title="CRED minted to this wallet as the referrer side of ReferralCredApplied."
          >
            <span><TokenLogo src={CRED_TOKEN_LOGO} width={18} height={18} /> GUIDE CRED:</span>{" "}
            <strong className="tabular-nums">{credHumanized?.guide}</strong>
          </p>
          <p
            className="data-panel__label referrals-earnings-cred-line"
            data-testid="referrals-earnings-buyer-cred"
            title="CRED minted to this wallet as the referred buyer side of ReferralCredApplied."
          >
            <span><TokenLogo src={CRED_TOKEN_LOGO} width={18} height={18} /> BUYER CRED:</span>{" "}
            <strong className="tabular-nums">{credHumanized?.buyer}</strong>
          </p>
          <p
            className="data-panel__label referrals-earnings-cred-line"
            data-testid="referrals-earnings-total-cred"
            title="Guide-side plus buyer-side referral Play CRED for this wallet."
          >
            <span><TokenLogo src={CRED_TOKEN_LOGO} width={18} height={18} /> TOTAL CRED:</span>{" "}
            <strong className="tabular-nums">{credHumanized?.total}</strong>
          </p>
          <p
            className="data-panel__label referrals-earnings-recorded-buys-line"
            data-testid="referrals-earnings-recorded-buys"
          >
            <span>RECORDED BUYS:</span>{" "}
            <strong className="tabular-nums">{summary.referred_buy_count}</strong>
          </p>
        </div>
      )}
    </PageSection>
  );
}
