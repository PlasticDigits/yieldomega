// SPDX-License-Identifier: AGPL-3.0-only

import { AddressInline } from "@/components/AddressInline";
import { formatCompactFromRaw } from "@/lib/compactNumberFormat";
import { formatLocaleInteger, parseBigIntString } from "@/lib/formatAmount";
import { humanizeKvLabel } from "@/lib/humanizeIdentifier";
import { formatDdHhMmSsCountdown } from "@/pages/arena/formatTimer";
import type { ProtocolPodiumAuditRow } from "@/pages/arena/useArenaProtocolPodiumAudit";
import type { WalletFormatShort } from "@/lib/addressFormat";

const PLACE_LABELS = ["1st", "2nd", "3rd"] as const;

function formatTimerDdHhMmSs(sec: number | undefined): string {
  if (sec === undefined || !Number.isFinite(sec)) {
    return "—";
  }
  return formatDdHhMmSsCountdown(sec);
}

function isZeroAddress(addr: string): boolean {
  const normalized = addr.trim().toLowerCase();
  return (
    normalized === "" ||
    normalized === "0x" ||
    normalized === "0x0000000000000000000000000000000000000000"
  );
}

function PrizeTriple(props: {
  label: string;
  prizes: readonly [string, string, string] | undefined;
  decimals: number;
}) {
  const { label, prizes, decimals } = props;
  if (!prizes) {
    return (
      <>
        <dt>{label}</dt>
        <dd>—</dd>
      </>
    );
  }
  return (
    <>
      <dt>{label}</dt>
      <dd>
        <ul className="protocol-podium-audit__prize-list">
          {PLACE_LABELS.map((place, i) => (
            <li key={place} className="protocol-podium-audit__prize-item">
              <span className="protocol-podium-audit__place">{place}:</span>{" "}
              <span className="mono">
                {formatCompactFromRaw(parseBigIntString(prizes[i]!), decimals, { sigfigs: 4 })} DOUB
              </span>
            </li>
          ))}
        </ul>
      </dd>
    </>
  );
}

export function ProtocolPodiumParamsCards(props: {
  rows: readonly ProtocolPodiumAuditRow[];
  decimals: number;
  formatWallet: WalletFormatShort;
  epochPlus1Label: (epoch: string | undefined) => string | undefined;
  epochPlus2Label: (epoch: string | undefined) => string | undefined;
}) {
  const { rows, decimals, formatWallet, epochPlus1Label, epochPlus2Label } = props;

  return (
    <div className="protocol-podium-audit-grid">
      {rows.map((row) => {
        const epochPlus1 = epochPlus1Label(row.epoch);
        const epochPlus2 = epochPlus2Label(row.epoch);
        return (
          <div className="podium-block" key={row.label}>
            <h3>{row.label} parameters</h3>
            <dl className="kv">
              <dt>{humanizeKvLabel("epoch")}</dt>
              <dd>{row.epoch ?? "—"}</dd>
              <dt>Time remaining</dt>
              <dd>{row.timerDisplay}</dd>
              <dt>{humanizeKvLabel("timerExtensionSec")}</dt>
              <dd>{formatTimerDdHhMmSs(row.timerExtensionSec)}</dd>
              <dt>{humanizeKvLabel("initialTimerSec")}</dt>
              <dd>{formatTimerDdHhMmSs(row.initialTimerSec)}</dd>
              <dt>{humanizeKvLabel("timerCapSec")}</dt>
              <dd>{formatTimerDdHhMmSs(row.timerCapSec)}</dd>
              <dt>Total participants</dt>
              <dd>
                {row.participantCount !== undefined
                  ? formatLocaleInteger(row.participantCount)
                  : "—"}
              </dd>
              <dt>Current winners</dt>
              <dd>
                <ul className="protocol-podium-audit__winner-list">
                  {PLACE_LABELS.map((place, i) => {
                    const winner = row.winners[i]!;
                    const score = row.values[i] ?? "0";
                    return (
                      <li key={place}>
                        <span className="protocol-podium-audit__place">{place}</span>{" "}
                        {isZeroAddress(winner) ? (
                          "—"
                        ) : (
                          <>
                            <AddressInline address={winner} formatWallet={formatWallet} size={16} />
                            <span className="mono"> · {formatLocaleInteger(BigInt(score))}</span>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </dd>
              <PrizeTriple
                label={`Prizes epoch ${row.epoch ?? "—"}`}
                prizes={row.prizesCurrent}
                decimals={decimals}
              />
              <PrizeTriple
                label={`Prizes epoch ${epochPlus1 ?? "—"}`}
                prizes={row.prizesEpochPlus1}
                decimals={decimals}
              />
              <PrizeTriple
                label={`Prizes epoch ${epochPlus2 ?? "—"}`}
                prizes={row.prizesEpochPlus2}
                decimals={decimals}
              />
            </dl>
          </div>
        );
      })}
    </div>
  );
}
