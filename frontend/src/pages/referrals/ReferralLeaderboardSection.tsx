// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { PageSection } from "@/components/ui/PageSection";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { AddressInline } from "@/components/AddressInline";
import { formatAmountTriple, formatLocaleInteger } from "@/lib/formatAmount";
import {
  fetchReferralReferrerLeaderboard,
  type ReferralReferrerLeaderboardItem,
} from "@/lib/indexerApi";
import { PLACEHOLDER_CUTOUTS_BY_SLUG } from "@/lib/surfaceContent";
import { truncateHexAddress } from "@/pages/referrals/referralAddressDisplay";

const REF_CUT = PLACEHOLDER_CUTOUTS_BY_SLUG.referrals;

type Props = { className?: string };

export function ReferralLeaderboardSection({ className }: Props) {
  const { address } = useAccount();
  const [items, setItems] = useState<ReferralReferrerLeaderboardItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setErr(null);
    void fetchReferralReferrerLeaderboard(20, 0).then(
      (page) => {
        if (!cancelled) {
          if (!page) {
            setItems([]);
            setErr("Leaderboard is unavailable right now. Try again in a moment.");
          } else {
            setItems(page.items);
          }
        }
      },
      () => {
        if (!cancelled) {
          setItems([]);
          setErr("Could not load referral leaderboard.");
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const leaderboard = useMemo(() => {
    if (!items) {
      return { rows: [], totalBuys: 0n, totalCharmWad: 0n, totalCodesRegistered: 0n };
    }
    return items.reduce(
      (acc, it) => {
        const codes = it.codes_registered_count ?? "0";
        acc.rows.push({
          ...it,
          codes_registered_count: codes,
          amount: formatAmountTriple(BigInt(it.total_referrer_charm_wad), 18),
          isYou: address?.toLowerCase() === it.referrer.toLowerCase(),
        });
        acc.totalBuys += BigInt(it.referred_buy_count);
        acc.totalCharmWad += BigInt(it.total_referrer_charm_wad);
        acc.totalCodesRegistered += BigInt(codes);
        return acc;
      },
      {
        rows: [] as Array<
          ReferralReferrerLeaderboardItem & {
            amount: ReturnType<typeof formatAmountTriple>;
            isYou: boolean;
          }
        >,
        totalBuys: 0n,
        totalCharmWad: 0n,
        totalCodesRegistered: 0n,
      },
    );
  }, [items, address]);

  const topCharm = formatAmountTriple(leaderboard.totalCharmWad, 18);

  return (
    <PageSection
      className={className}
      title="Guide leaderboard"
      badgeLabel="Guides"
      badgeTone="live"
      lede="Ranked by CHARM earned from qualifying referred buys (indexed ReferralApplied). Guides who registered a code on ReferralRegistry appear as soon as that event is indexed—even before the first qualifying buy."
      cutout={{
        src: REF_CUT.tertiary,
        width: 108,
        height: 108,
        className: "referrals-leaderboard__cutout cutout-decoration--bob",
      }}
    >
      {err ? <StatusMessage variant="error">{err}</StatusMessage> : null}
      {!items ? (
        <StatusMessage variant="muted">Loading leaderboard…</StatusMessage>
      ) : items.length === 0 ? (
        <StatusMessage variant="muted">
          No indexed guide registrations or referral buys yet. Register a code (ReferralRegistry) or link
          buys (TimeCurve ReferralApplied) to appear here.
        </StatusMessage>
      ) : (
        <>
          <div className="referrals-leaderboard__summary" aria-label="Referral leaderboard totals">
            <div>
              <span>Codes registered (this page)</span>
              <strong>{formatLocaleInteger(leaderboard.totalCodesRegistered)}</strong>
            </div>
            <div>
              <span>Recorded referral buys</span>
              <strong>{formatLocaleInteger(leaderboard.totalBuys)}</strong>
            </div>
            <div>
              <span>Total guide CHARM</span>
              <strong>{topCharm.abbrev}</strong>
            </div>
          </div>
          <ol className="referrals-leaderboard-list">
            {leaderboard.rows.map((row) => (
              <li
                key={row.referrer}
                className={[
                  "referrals-leaderboard-row",
                  row.rank === 1 ? "referrals-leaderboard-row--first" : "",
                  row.isYou ? "referrals-leaderboard-row--you" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className="referrals-leaderboard-row__rank">#{row.rank}</span>
                <div className="referrals-leaderboard-row__identity">
                  <AddressInline
                    address={row.referrer}
                    formatWallet={(addr, fb) => (addr ? truncateHexAddress(addr, 8, 6) : fb)}
                    size={22}
                  />
                  <span>
                    {formatLocaleInteger(row.codes_registered_count)} onchain{" "}
                    {row.codes_registered_count === "1" ? "code" : "codes"} registered
                    <br />
                    {formatLocaleInteger(row.referred_buy_count)} recorded{" "}
                    {row.referred_buy_count === "1" ? "buy" : "buys"} with this referrer code
                  </span>
                </div>
                <div className="referrals-leaderboard-row__score">
                  <strong>{row.amount.abbrev}</strong>
                  <span>CHARM</span>
                  <small>{row.amount.decimal}</small>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </PageSection>
  );
}
