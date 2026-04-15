// SPDX-License-Identifier: AGPL-3.0-only

import type { BuyItem } from "@/lib/indexerApi";
import { buySpendEnvelopeFillRatio, formatBuyAge, type EnvelopeCurveParams } from "@/lib/timeCurveBuyDisplay";
import { listBuyImpactTicks } from "@/lib/timeCurveUx";
import type { WalletFormatShort } from "@/lib/addressFormat";
import { explorerTxUrl } from "@/lib/explorer";
import { BuyEnvelopeMiniPie } from "@/pages/timecurve/BuyEnvelopeMiniPie";

type Props = {
  buy: BuyItem;
  formatWallet: WalletFormatShort;
  onSelectBuy?: (buy: BuyItem) => void;
  nowUnixSec: number;
  envelopeParams: EnvelopeCurveParams | null;
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

export function LiveBuyRow({ buy, formatWallet, onSelectBuy, nowUnixSec, envelopeParams, variant }: Props) {
  const ticks = listBuyImpactTicks(buy, 5);
  const age = formatBuyAge(buy.block_timestamp, nowUnixSec);
  const ratio = envelopeParams ? buySpendEnvelopeFillRatio(buy, envelopeParams) : null;
  const who = formatWallet(buy.buyer, "—");
  const txUrl = explorerTxUrl(buy.tx_hash);
  const interactive = onSelectBuy !== undefined;
  const pieTitle =
    ratio === null
      ? "Band fill needs indexer block time on this buy"
      : `Spend ~${Math.round(ratio * 100)}% from min toward max gross at that block`;

  const body = (
    <>
      <div className="live-buy-row__pie">
        <BuyEnvelopeMiniPie ratio={ratio} title={pieTitle} />
      </div>
      <div className="live-buy-row__body">
        <div className="live-buy-row__head">
          <span className="live-buy-row__who mono" title={buy.buyer}>
            {who}
          </span>
          {age !== null ? (
            <span className="live-buy-row__age">{age}</span>
          ) : (
            <span className="live-buy-row__age live-buy-row__age--muted" title="Indexer block time missing">
              —
            </span>
          )}
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

  if (interactive) {
    return (
      <div className={rootClass}>
        <button
          type="button"
          className="live-buy-row__hit"
          onClick={() => onSelectBuy(buy)}
          aria-label={`View details for buy by ${who}`}
        >
          {body}
        </button>
        {txUrl ? (
          <a
            className="live-buy-row__tx"
            href={txUrl}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={`View transaction ${buy.tx_hash.slice(0, 10)}… on explorer`}
            onClick={(e) => e.stopPropagation()}
          >
            tx
          </a>
        ) : (
          <span className="live-buy-row__tx live-buy-row__tx--muted" aria-hidden>
            ·
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={rootClass}>
      <div className="live-buy-row__hit live-buy-row__hit--static">{body}</div>
      {txUrl ? (
        <a className="live-buy-row__tx" href={txUrl} target="_blank" rel="noreferrer noopener">
          tx
        </a>
      ) : (
        <span className="live-buy-row__tx live-buy-row__tx--muted" aria-hidden>
          ·
        </span>
      )}
    </div>
  );
}
