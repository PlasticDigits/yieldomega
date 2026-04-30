// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { AmountDisplay } from "@/components/AmountDisplay";
import { PageSection } from "@/components/ui/PageSection";
import { StatusMessage } from "@/components/ui/StatusMessage";
import {
  fetchReferralReferrerLeaderboard,
  type ReferralReferrerLeaderboardItem,
} from "@/lib/indexerApi";
import { PLACEHOLDER_CUTOUTS_BY_SLUG } from "@/lib/surfaceContent";
import { truncateHexAddress } from "@/pages/referrals/referralAddressDisplay";
import { RankingList, type RankingRow } from "@/pages/timecurve/timecurveUi";

const REF_CUT = PLACEHOLDER_CUTOUTS_BY_SLUG.referrals;

export function ReferralLeaderboardSection() {
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
            setErr("Indexer unavailable — set VITE_INDEXER_URL to load the leaderboard.");
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

  const rows: RankingRow[] = useMemo(() => {
    if (!items) {
      return [];
    }
    return items.map((it) => {
      const ref = it.referrer.toLowerCase();
      const you = address?.toLowerCase() === ref;
      return {
        key: it.referrer,
        rank: it.rank,
        label: (
          <code className="code-inline" title={it.referrer}>
            {truncateHexAddress(it.referrer, 8, 6)}
          </code>
        ),
        value: (
          <>
            <AmountDisplay raw={it.total_referrer_charm_wad} decimals={18} /> CHARM
          </>
        ),
        meta: (
          <>
            {it.referred_buy_count} indexed {Number(it.referred_buy_count) === 1 ? "buy" : "buys"} · sum of{" "}
            <code className="code-inline">referrerCharmAdded</code>
          </>
        ),
        highlight: you,
      };
    });
  }, [items, address]);

  return (
    <PageSection
      title="Referrer leaderboard"
      badgeLabel="Indexer"
      badgeTone="live"
      lede="Ranked by the sum of referrerCharmAdded from indexed ReferralApplied events (same units as on-chain CHARM weight). No synthetic scores — empty until referral buys exist."
      cutout={{
        src: REF_CUT.tertiary,
        width: 120,
        height: 120,
        className: "cutout-decoration--bob",
      }}
    >
      {err ? <StatusMessage variant="error">{err}</StatusMessage> : null}
      {!items ? (
        <StatusMessage variant="muted">Loading leaderboard…</StatusMessage>
      ) : (
        <RankingList
          rows={rows}
          emptyText="No indexed referral activity yet — the table fills after ReferralApplied rows land in Postgres."
        />
      )}
    </PageSection>
  );
}
