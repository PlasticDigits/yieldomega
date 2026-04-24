// SPDX-License-Identifier: AGPL-3.0-only

import { useReadContracts } from "wagmi";
import { AmountDisplay } from "@/components/AmountDisplay";
import { PageHero } from "@/components/ui/PageHero";
import { PageSection } from "@/components/ui/PageSection";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { UnixTimestampDisplay } from "@/components/UnixTimestampDisplay";
import {
  feeRouterReadAbi,
  linearCharmPriceReadAbi,
  timeCurveReadAbi,
} from "@/lib/abis";
import { addresses, type HexAddress } from "@/lib/addresses";
import { formatLocaleInteger, formatBpsAsPercent } from "@/lib/formatAmount";
import { formatCompactFromRaw } from "@/lib/compactNumberFormat";
import { TimeCurveSubnav } from "@/pages/timecurve/TimeCurveSubnav";
import { derivePhase, phaseBadge } from "@/pages/timecurve/timeCurveSimplePhase";

/**
 * Protocol view for `/timecurve/protocol` — a focused dump of authoritative
 * onchain reads + reserve fee routing for operators / power users.
 *
 * Invariant: every value rendered here is read directly from a public view
 * function on `TimeCurve`, `LinearCharmPrice`, or `FeeRouter`. We never derive
 * values that the contract does not expose, so this page can be used to
 * verify the simple / arena views.
 */
type ContractReadRow = {
  status: "success" | "failure";
  result?: unknown;
};

const FEE_SINK_LABELS = [
  "DOUB / CL8Y locked liquidity",
  "CL8Y burned (sale proceeds)",
  "Podium pool",
  "Team / reserved",
  "Rabbit Treasury",
] as const;

const TC_READS = [
  "saleStart",
  "deadline",
  "ended",
  "totalRaised",
  "totalCharmWeight",
  "totalTokensForSale",
  "currentMinBuyAmount",
  "currentMaxBuyAmount",
  "currentPricePerCharmWad",
  "initialMinBuy",
  "growthRateWad",
  "timerExtensionSec",
  "initialTimerSec",
  "timerCapSec",
  "buyCooldownSec",
  "REFERRAL_EACH_BPS",
  "feeRouter",
  "podiumPool",
  "charmPrice",
  "acceptedAsset",
  "launchedToken",
  "prizesDistributed",
  "warbowPendingFlagOwner",
  "warbowPendingFlagPlantAt",
  "WARBOW_FLAG_SILENCE_SEC",
  "WARBOW_FLAG_CLAIM_BP",
  "WARBOW_MAX_STEALS_PER_VICTIM_PER_DAY",
  "WARBOW_STEAL_BURN_WAD",
  "WARBOW_GUARD_BURN_WAD",
  "WARBOW_REVENGE_WINDOW_SEC",
] as const;

export function TimeCurveProtocolPage() {
  const tc = addresses.timeCurve;

  const reads = useReadContracts({
    contracts: tc
      ? TC_READS.map((fn) => ({
          address: tc,
          abi: timeCurveReadAbi,
          functionName: fn,
        }))
      : [],
    query: { enabled: Boolean(tc), refetchInterval: 1500 },
  });

  const reading = (reads.data ?? []) as readonly ContractReadRow[];
  const get = (i: number) => reading[i];

  const charmPriceAddr =
    get(18)?.status === "success" ? (get(18)!.result as HexAddress) : undefined;
  const feeRouterAddr =
    get(16)?.status === "success" ? (get(16)!.result as HexAddress) : undefined;

  const { data: charmPriceParams } = useReadContracts({
    contracts: charmPriceAddr
      ? [
          {
            address: charmPriceAddr,
            abi: linearCharmPriceReadAbi,
            functionName: "basePriceWad",
          },
          {
            address: charmPriceAddr,
            abi: linearCharmPriceReadAbi,
            functionName: "dailyIncrementWad",
          },
        ]
      : [],
    query: { enabled: Boolean(charmPriceAddr) },
  });

  const sinks = useReadContracts({
    contracts: feeRouterAddr
      ? FEE_SINK_LABELS.map((_, i) => ({
          address: feeRouterAddr,
          abi: feeRouterReadAbi,
          functionName: "sinks" as const,
          args: [BigInt(i)] as const,
        }))
      : [],
    query: { enabled: Boolean(feeRouterAddr) },
  });

  if (!tc) {
    return (
      <div className="page timecurve-protocol-page">
        <TimeCurveSubnav active="protocol" />
        <PageHero
          title="Protocol view"
          lede="Authoritative onchain reads for TimeCurve."
          badgeLabel="Protocol"
          badgeTone="info"
        />
        <PageSection title="Configuration missing">
          <StatusMessage variant="error">
            VITE_TIMECURVE_ADDRESS is not configured. Update <code>frontend/.env.local</code>.
          </StatusMessage>
        </PageSection>
      </div>
    );
  }

  const renderUnix = (i: number) => {
    const r = get(i);
    if (r?.status === "success" && r.result !== undefined) {
      return <UnixTimestampDisplay raw={String(r.result as bigint)} />;
    }
    return "—";
  };
  const renderAmount = (i: number, decimals: number) => {
    const r = get(i);
    if (r?.status === "success" && r.result !== undefined) {
      return <AmountDisplay raw={String(r.result as bigint)} decimals={decimals} />;
    }
    return "—";
  };
  const renderInt = (i: number) => {
    const r = get(i);
    if (r?.status === "success" && r.result !== undefined) {
      return formatLocaleInteger(BigInt(r.result as bigint));
    }
    return "—";
  };
  const renderBool = (i: number) => {
    const r = get(i);
    if (r?.status === "success" && r.result !== undefined) {
      return String(r.result as boolean);
    }
    return "—";
  };
  const renderAddress = (i: number) => {
    const r = get(i);
    if (r?.status === "success" && r.result !== undefined) {
      return <span className="mono">{String(r.result)}</span>;
    }
    return "—";
  };

  // Mirror the Simple/Arena hero badge so the three TimeCurve views share a
  // single visual language for sale phase. We use wall-clock seconds because
  // the Protocol view is intentionally indexer-free (every value is a direct
  // RPC view-call); a few seconds of skew vs the chain block timestamp is
  // acceptable for a status pictogram.
  const saleStartRow = get(0);
  const deadlineRow = get(1);
  const endedRow = get(2);
  const protocolPhase = derivePhase({
    hasCoreData: reading.length > 0,
    ended: endedRow?.status === "success" ? (endedRow.result as boolean) : undefined,
    saleStartSec:
      saleStartRow?.status === "success" ? Number(saleStartRow.result as bigint) : undefined,
    deadlineSec:
      deadlineRow?.status === "success" ? Number(deadlineRow.result as bigint) : undefined,
    ledgerSecInt: Math.floor(Date.now() / 1000),
  });
  const protocolPhaseBadge = phaseBadge(protocolPhase);

  return (
    <div className="page timecurve-protocol-page">
      <TimeCurveSubnav active="protocol" />

      <PageHero
        title="Protocol view"
        lede="Raw, authoritative onchain reads for TimeCurve. Use this surface to verify what the simple and arena views show."
        badgeLabel={protocolPhaseBadge.label}
        badgeTone={protocolPhaseBadge.tone}
        badgeIconSrc={protocolPhaseBadge.iconSrc}
        coinSrc="/art/icons/token-cl8y.png"
        coinAlt="CL8Y reserve token glyph"
        sceneSrc="/art/scenes/timecurve-protocol.jpg"
      />

      <PageSection
        title="Sale state (live reads)"
        spotlight
        badgeLabel="contract reads"
        badgeTone="info"
        lede="These match what the contract is returning right now. Refreshed every ~1.5s."
      >
        <dl className="kv">
          <dt>saleStart</dt>
          <dd>{renderUnix(0)}</dd>
          <dt>deadline</dt>
          <dd>{renderUnix(1)}</dd>
          <dt>ended</dt>
          <dd>{renderBool(2)}</dd>
          <dt>totalRaised</dt>
          <dd>{renderAmount(3, 18)}</dd>
          <dt>totalCharmWeight</dt>
          <dd>{renderAmount(4, 18)}</dd>
          <dt>totalTokensForSale</dt>
          <dd>{renderAmount(5, 18)}</dd>
          <dt>currentMinBuyAmount</dt>
          <dd>{renderAmount(6, 18)}</dd>
          <dt>currentMaxBuyAmount</dt>
          <dd>{renderAmount(7, 18)}</dd>
          <dt>currentPricePerCharmWad</dt>
          <dd>{renderAmount(8, 18)}</dd>
          <dt>prizesDistributed</dt>
          <dd>{renderBool(21)}</dd>
        </dl>
      </PageSection>

      <PageSection
        title="Immutable parameters"
        badgeLabel="constructor args"
        badgeTone="info"
        lede="These were fixed at deploy time and cannot change."
      >
        <dl className="kv">
          <dt>initialMinBuy (envelope ref)</dt>
          <dd>{renderAmount(9, 18)}</dd>
          <dt>growthRateWad</dt>
          <dd>
            {(() => {
              const r = get(10);
              return r?.status === "success" && r.result !== undefined
                ? formatCompactFromRaw(r.result as bigint, 18)
                : "—";
            })()}
          </dd>
          <dt>timerExtensionSec</dt>
          <dd>{renderInt(11)}</dd>
          <dt>initialTimerSec</dt>
          <dd>{renderInt(12)}</dd>
          <dt>timerCapSec</dt>
          <dd>{renderInt(13)}</dd>
          <dt>buyCooldownSec</dt>
          <dd>{renderInt(14)}</dd>
          <dt>REFERRAL_EACH_BPS</dt>
          <dd>
            {(() => {
              const r = get(15);
              return r?.status === "success" && r.result !== undefined
                ? formatBpsAsPercent(Number(r.result))
                : "—";
            })()}
          </dd>
          <dt>charmPrice basePriceWad</dt>
          <dd>
            {charmPriceParams?.[0]?.status === "success" && charmPriceParams[0].result !== undefined ? (
              <AmountDisplay raw={String(charmPriceParams[0].result)} decimals={18} />
            ) : (
              "—"
            )}
          </dd>
          <dt>charmPrice dailyIncrementWad</dt>
          <dd>
            {charmPriceParams?.[1]?.status === "success" && charmPriceParams[1].result !== undefined ? (
              <AmountDisplay raw={String(charmPriceParams[1].result)} decimals={18} />
            ) : (
              "—"
            )}
          </dd>
        </dl>
      </PageSection>

      <PageSection
        title="WarBow rule constants"
        badgeLabel="PvP rules"
        badgeTone="info"
        lede="Onchain caps that bound steal / guard / flag mechanics."
      >
        <dl className="kv">
          <dt>WARBOW_FLAG_SILENCE_SEC</dt>
          <dd>{renderInt(24)}</dd>
          <dt>WARBOW_FLAG_CLAIM_BP</dt>
          <dd>{renderInt(25)}</dd>
          <dt>WARBOW_MAX_STEALS_PER_VICTIM_PER_DAY</dt>
          <dd>{renderInt(26)}</dd>
          <dt>WARBOW_STEAL_BURN_WAD</dt>
          <dd>{renderAmount(27, 18)}</dd>
          <dt>WARBOW_GUARD_BURN_WAD</dt>
          <dd>{renderAmount(28, 18)}</dd>
          <dt>WARBOW_REVENGE_WINDOW_SEC</dt>
          <dd>{renderInt(29)}</dd>
          <dt>warbowPendingFlagOwner</dt>
          <dd>{renderAddress(22)}</dd>
          <dt>warbowPendingFlagPlantAt</dt>
          <dd>{renderUnix(23)}</dd>
        </dl>
      </PageSection>

      <PageSection
        title="Wired contracts"
        badgeLabel="addresses"
        badgeTone="info"
        lede="Addresses that TimeCurve forwards to."
      >
        <dl className="kv">
          <dt>acceptedAsset (CL8Y)</dt>
          <dd>{renderAddress(19)}</dd>
          <dt>launchedToken</dt>
          <dd>{renderAddress(20)}</dd>
          <dt>charmPrice</dt>
          <dd>{renderAddress(18)}</dd>
          <dt>feeRouter</dt>
          <dd>{renderAddress(16)}</dd>
          <dt>podiumPool</dt>
          <dd>{renderAddress(17)}</dd>
        </dl>
      </PageSection>

      <PageSection
        title="Reserve fee routing"
        badgeLabel="FeeRouter sinks"
        badgeTone="info"
        lede="How CL8Y reserves move once a buy lands. Weights come straight from the FeeRouter."
      >
        {!feeRouterAddr && (
          <StatusMessage variant="muted">Waiting for FeeRouter address…</StatusMessage>
        )}
        {feeRouterAddr && (
          <ul className="event-list">
            {FEE_SINK_LABELS.map((label, i) => {
              const row = sinks.data?.[i];
              if (row?.status !== "success" || row.result === undefined) {
                return (
                  <li key={label}>
                    <strong>{label}</strong> · loading…
                  </li>
                );
              }
              const [destination, weightBps] = row.result as readonly [HexAddress, number];
              return (
                <li key={label}>
                  <strong>{label}</strong> · weight {formatBpsAsPercent(Number(weightBps))} ·{" "}
                  <span className="mono">{destination}</span>
                </li>
              );
            })}
          </ul>
        )}
      </PageSection>
    </div>
  );
}

export default TimeCurveProtocolPage;
