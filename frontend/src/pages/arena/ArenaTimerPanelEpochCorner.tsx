// SPDX-License-Identifier: AGPL-3.0-only

type Props = {
  podiumLabel?: string;
  epoch: string | undefined;
};

/** Top-right podium epoch stamp on the command-console timer bay — out of document flow. */
export function ArenaTimerPanelEpochCorner({ podiumLabel = "Last Buy", epoch }: Props) {
  const epochLabel = epoch !== undefined ? `EPOCH ${epoch}` : "EPOCH —";

  return (
    <p
      className="arena-simple__timer-panel-epoch-corner"
      data-testid="arena-timer-panel-epoch-corner"
      aria-label={`${podiumLabel} ${epochLabel}`}
    >
      <span className="arena-simple__timer-panel-epoch-corner__title">{podiumLabel}</span>
      <span className="arena-simple__timer-panel-epoch-corner__epoch">{epochLabel}</span>
    </p>
  );
}
