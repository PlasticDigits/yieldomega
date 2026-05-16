// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { PageSection } from "@/components/ui/PageSection";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { timeCurveReadAbi } from "@/lib/abis";
import { addresses } from "@/lib/addresses";
import { formatCompactFromRaw } from "@/lib/compactNumberFormat";
import { fetchReferralWalletCharmSummary, type ReferralWalletCharmSummary } from "@/lib/indexerApi";

const WAD = 10n ** 18n;

/** Guide CHARM (referrer) line: compact humanized amount with six significant figures. */
const REFERRAL_GUIDE_CHARM_DISPLAY_SIGFIGS = 6;

type Props = { className?: string };

export function ReferralProgramEarningsSection({ className }: Props) {
  const { address, isConnected } = useAccount();
  const tc = addresses.timeCurve;
  const [summary, setSummary] = useState<ReferralWalletCharmSummary | null | undefined>(undefined);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const { data: pricePerCharmWad } = useReadContract({
    address: tc,
    abi: timeCurveReadAbi,
    functionName: "currentPricePerCharmWad",
    query: { enabled: Boolean(tc && isConnected && address), refetchInterval: 15_000 },
  });

  useEffect(() => {
    if (!address) {
      setSummary(undefined);
      setLoadErr(null);
      return;
    }
    let cancelled = false;
    setSummary(undefined);
    setLoadErr(null);
    void fetchReferralWalletCharmSummary(address).then(
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
    const totalCharm =
      BigInt(summary.referrer_charm_wad) + BigInt(summary.referee_charm_wad);
    const p = pricePerCharmWad !== undefined ? BigInt(pricePerCharmWad) : 0n;
    const cl8yWei = p > 0n && totalCharm > 0n ? (totalCharm * p) / WAD : 0n;
    return {
      totalCharm,
      cl8yWei,
      hasPrice: p > 0n,
    };
  }, [summary, pricePerCharmWad]);

  const guideCharmHumanized = useMemo(() => {
    if (!summary) {
      return "";
    }
    return formatCompactFromRaw(summary.referrer_charm_wad, 18, { sigfigs: REFERRAL_GUIDE_CHARM_DISPLAY_SIGFIGS });
  }, [summary]);

  return (
    <PageSection
      className={className}
      title="Your earnings"
      lede="Track the CHARM you earned when people buy CHARM on TimeCurve after clicking your link"
    >
      {!isConnected || !address ? (
        <div className="referrals-empty-state referrals-empty-state--charm">
          <span className="referrals-empty-state__icon" aria-hidden="true">
            CH
          </span>
          <div>
            <strong>Connect to see your CHARM</strong>
            <p>The page will load guide CHARM and referral-weight details.</p>
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
          {totals.totalCharm === 0n ? (
            <StatusMessage variant="muted" data-testid="referrals-earnings-zero-banner">
              <strong>No referral CHARM yet.</strong> Totals stay at zero until qualifying referral purchases show up
              here for this wallet.
            </StatusMessage>
          ) : null}
          <p className="data-panel__label referrals-earnings-charm-line" data-testid="referrals-earnings-guide-charm">
            <span>YOUR CHARM EARNED:</span>{" "}
            <strong className="tabular-nums">{guideCharmHumanized}</strong>
          </p>
          <p
            className="data-panel__label referrals-earnings-recorded-buys-line"
            data-testid="referrals-earnings-recorded-buys"
          >
            <span>RECORDED BUYS:</span>{" "}
            <strong className="tabular-nums">{summary.referred_buy_count}</strong>
          </p>
          {totals.totalCharm === 0n ? (
            <p className="muted" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
              No referral activity recorded for this wallet yet — buys with your code (or a code you used) appear here
              shortly after they settle onchain.
            </p>
          ) : !totals.hasPrice || totals.cl8yWei === 0n ? (
            <p className="muted" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
              Set `VITE_TIMECURVE_ADDRESS` and ensure the sale view can read `currentPricePerCharmWad` to show CL8Y
              notionals.
            </p>
          ) : null}
        </div>
      )}
    </PageSection>
  );
}
