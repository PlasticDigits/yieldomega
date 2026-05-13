// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { AmountDisplay } from "@/components/AmountDisplay";
import { PageSection } from "@/components/ui/PageSection";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { timeCurveReadAbi } from "@/lib/abis";
import { addresses } from "@/lib/addresses";
import { fetchReferralWalletCharmSummary, type ReferralWalletCharmSummary } from "@/lib/indexerApi";
import { fallbackPayTokenWeiForCl8y } from "@/lib/kumbayaDisplayFallback";

const WAD = 10n ** 18n;

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
    const refW = BigInt(summary.referrer_charm_wad);
    const refeW = BigInt(summary.referee_charm_wad);
    const totalCharm = refW + refeW;
    const p = pricePerCharmWad !== undefined ? BigInt(pricePerCharmWad) : 0n;
    const cl8yWei = p > 0n && totalCharm > 0n ? (totalCharm * p) / WAD : 0n;
    return {
      refW,
      refeW,
      totalCharm,
      cl8yWei,
      hasPrice: p > 0n,
    };
  }, [summary, pricePerCharmWad]);

  return (
    <PageSection
      className={className}
      title="Your referral CHARM"
      badgeLabel="Referrals + TimeCurve"
      badgeTone="info"
      lede="Track the extra CHARM weight credited when people use your code or when you buy through someone else's trail."
    >
      {!isConnected || !address ? (
        <div className="referrals-empty-state referrals-empty-state--charm">
          <span className="referrals-empty-state__icon" aria-hidden="true">
            CH
          </span>
          <div>
            <strong>Connect to see your CHARM</strong>
            <p>The page will load guide CHARM, traveler CHARM, and an illustrative current CL8Y view.</p>
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
          <p className="data-panel__label">As guide (others used your code)</p>
          <p style={{ margin: 0 }}>
            <strong>
              <AmountDisplay raw={summary.referrer_charm_wad} decimals={18} />
            </strong>{" "}
            CHARM weight ·{" "}
            <span className="muted">
              {summary.referred_buy_count} recorded{" "}
              {Number(summary.referred_buy_count) === 1 ? "buy" : "buys"}
            </span>
          </p>
          <p className="data-panel__label" style={{ marginTop: "1rem" }}>
            As traveler (you used someone else&apos;s code)
          </p>
          <p style={{ margin: 0 }}>
            <strong>
              <AmountDisplay raw={summary.referee_charm_wad} decimals={18} />
            </strong>{" "}
            CHARM weight ·{" "}
            <span className="muted">
              {summary.referee_buy_count} recorded{" "}
              {Number(summary.referee_buy_count) === 1 ? "buy" : "buys"}
            </span>
          </p>
          <p className="data-panel__label" style={{ marginTop: "1rem" }}>
            Combined referral CHARM
          </p>
          <p style={{ margin: 0 }}>
            <strong>
              <AmountDisplay raw={totals.totalCharm.toString()} decimals={18} />
            </strong>
          </p>
          {totals.totalCharm === 0n ? (
            <p className="muted" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
              No referral activity recorded for this wallet yet — buys with your code (or a code you used) appear here
              shortly after they settle onchain.
            </p>
          ) : totals.hasPrice && totals.cl8yWei > 0n ? (
            <>
              <p className="data-panel__label" style={{ marginTop: "1rem" }}>
                Notional CL8Y (illustrative)
              </p>
              <p className="muted" style={{ marginTop: 0 }}>
                <strong>
                  <AmountDisplay raw={totals.cl8yWei.toString()} decimals={18} />
                </strong>{" "}
                CL8Y at <strong>current</strong> <code className="code-inline">currentPricePerCharmWad</code> ×
                combined referral CHARM — not historical spend per buy, not a wallet transfer, and not tax or legal
                advice.
              </p>
              <p className="data-panel__label" style={{ marginTop: "1rem" }}>
                Pay-asset hints (static fallback)
              </p>
              <p className="muted" style={{ marginTop: 0, marginBottom: 0 }}>
                Same CL8Y notional mapped with the app&apos;s non-quoter fallback rates used elsewhere for labels:{" "}
                <strong>
                  <AmountDisplay raw={fallbackPayTokenWeiForCl8y(totals.cl8yWei, "usdm").toString()} decimals={18} />
                </strong>{" "}
                USDM-shaped units ·{" "}
                <strong>
                  <AmountDisplay raw={fallbackPayTokenWeiForCl8y(totals.cl8yWei, "eth").toString()} decimals={18} />
                </strong>{" "}
                ETH-shaped units — see repo <code className="code-inline">docs/product/referrals.md</code> (reward
                math) and <code className="code-inline">frontend/src/lib/kumbayaDisplayFallback.ts</code>.
              </p>
            </>
          ) : (
            <p className="muted" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
              Set `VITE_TIMECURVE_ADDRESS` and ensure the sale view can read `currentPricePerCharmWad` to show CL8Y
              notionals.
            </p>
          )}
        </div>
      )}
    </PageSection>
  );
}
