// SPDX-License-Identifier: AGPL-3.0-only

import type { KeyboardEvent, MouseEvent } from "react";
import { useMemo } from "react";
import type { BuyItem } from "@/lib/indexerApi";
import {
  buySpendEnvelopeFillRatio,
  envelopeCurveParamsFromWire,
  formatBuyAge,
  type EnvelopeCurveParamsWire,
} from "@/lib/timeCurveBuyDisplay";
import { listBuyImpactTicks } from "@/lib/timeCurveUx";
import type { WalletFormatShort } from "@/lib/addressFormat";
import { explorerTxUrl } from "@/lib/explorer";
import { AddressInline } from "@/components/AddressInline";
import { BuyEnvelopeMiniMeter } from "@/pages/timecurve/BuyEnvelopeMiniPie";

type Props = {
  buy: BuyItem;
  formatWallet: WalletFormatShort;
  onSelectBuy?: (buy: BuyItem) => void;
  nowUnixSec: number;
  envelopeParams: EnvelopeCurveParamsWire | null;
  /** `hero` = timer strip; `modal` = all-buys list */
  variant: "hero" | "modal";
};

const toneClass: Record<string, string> = {
  danger: "live-buy-tick--danger",
  warning: "live-buy-tick--warning",
  success: "live-buy-tick--success",
  info: "live-buy-tick--info",
  neutral: "live-buy-tick--neutral",
};

function targetIsInsideExplorerLink(target: EventTarget | null): boolean {
  return Boolean(target && (target as HTMLElement).closest?.("a[href]"));
}

export function LiveBuyRow({ buy, formatWallet, onSelectBuy, nowUnixSec, envelopeParams, variant }: Props) {
  const ticks = listBuyImpactTicks(buy, 5);
  const age = formatBuyAge(buy.block_timestamp, nowUnixSec);
  const envParsed = useMemo(() => envelopeCurveParamsFromWire(envelopeParams), [envelopeParams]);
  const ratio = envParsed ? buySpendEnvelopeFillRatio(buy, envParsed) : null;
  const who = formatWallet(buy.buyer, "—");
  const txUrl = explorerTxUrl(buy.tx_hash);
  const interactive = onSelectBuy !== undefined;
  const blockieSize = variant === "modal" ? 40 : 36;
  const pieTitle =
    ratio === null
      ? "Spent amount shown, but band fill needs indexer block time on this buy"
      : `Spend ~${Math.round(ratio * 100)}% of max gross band at that block`;

  const stopExplorerBubble = interactive
    ? (e: MouseEvent<HTMLAnchorElement>) => {
        e.stopPropagation();
      }
    : undefined;

  const body = (
    <>
      {variant === "hero" ? (
        <div className="live-buy-row__identity">
          <div className="live-buy-row__meter">
            <BuyEnvelopeMiniMeter ratio={ratio} amountRaw={buy.amount} title={pieTitle} />
          </div>
        </div>
      ) : null}
      <div className="live-buy-row__body">
        <div className="live-buy-row__head">
          <AddressInline
            address={buy.buyer}
            formatWallet={formatWallet}
            size={blockieSize}
            onExplorerLinkClick={stopExplorerBubble}
          />
          {age !== null ? (
            <span className="live-buy-row__age">{age}</span>
          ) : variant === "hero" ? (
            <span className="live-buy-row__age live-buy-row__age--muted" title="Indexer block time missing">
              —
            </span>
          ) : null}
        </div>
        <ul className="live-buy-row__ticks" aria-label="Buy impacts">
          {ticks.map((t) => (
            <li key={t.id} className={`live-buy-tick ${toneClass[t.tone] ?? ""}`}>
              <span className="live-buy-tick__label">{t.label}</span>
              {t.sub ? <span className="live-buy-tick__sub">{t.sub}</span> : null}
            </li>
          ))}
        </ul>
      </div>
    </>
  );

  const rootClass = variant === "hero" ? "live-buy-row live-buy-row--hero" : "live-buy-row live-buy-row--modal";

  const openDetails = () => onSelectBuy?.(buy);

  const onRowClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!interactive) return;
    if (targetIsInsideExplorerLink(e.target)) return;
    openDetails();
  };

  const onRowKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    if (targetIsInsideExplorerLink(e.target)) return;
    e.preventDefault();
    openDetails();
  };

  const hit = interactive ? (
    <div
      className="live-buy-row__hit"
      role="group"
      tabIndex={0}
      onClick={onRowClick}
      onKeyDown={onRowKeyDown}
      aria-label={`View details for buy by ${who}`}
    >
      {body}
    </div>
  ) : (
    <div className="live-buy-row__hit live-buy-row__hit--static">{body}</div>
  );

  return (
    <div className={rootClass}>
      {hit}
      {txUrl ? (
        <a
          className="live-buy-row__tx"
          href={txUrl}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={`View transaction ${buy.tx_hash.slice(0, 10)}… on explorer`}
        >
          {variant === "modal" ? "view tx" : "tx"}
        </a>
      ) : variant === "hero" ? (
        <span className="live-buy-row__tx live-buy-row__tx--muted" aria-hidden>
          ·
        </span>
      ) : null}
    </div>
  );
}
