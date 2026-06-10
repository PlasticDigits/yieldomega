// SPDX-License-Identifier: AGPL-3.0-only

type Props = {
  epoch: string | undefined;
};

/** Top-right Last Buy epoch stamp on the command-console timer bay — out of document flow. */
export function ArenaTimerPanelEpochCorner({ epoch }: Props) {
  const epochLabel = epoch !== undefined ? `EPOCH ${epoch}` : "EPOCH —";

  return (
    <p
      className="arena-simple__timer-panel-epoch-corner"
      data-testid="arena-timer-panel-epoch-corner"
      aria-label={`Last Buy ${epochLabel}`}
    >
      <span className="arena-simple__timer-panel-epoch-corner__title">Last Buy</span>
      <span className="arena-simple__timer-panel-epoch-corner__epoch">{epochLabel}</span>
    </p>
  );
}
