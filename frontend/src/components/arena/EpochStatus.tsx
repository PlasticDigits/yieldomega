// SPDX-License-Identifier: AGPL-3.0-only

type Props = {
  epochLabel: string;
  live?: boolean;
  className?: string;
};

/** Epoch strip above the arena console. */
export function EpochStatus({ epochLabel, live = true, className }: Props) {
  return (
    <header className={["glass-arena-topbar", className].filter(Boolean).join(" ")}>
      <span>
        Epoch <strong>{epochLabel}</strong>
      </span>
      <span>
        <strong>Yield Omega</strong> Glass Arena
      </span>
      {live ? <span className="glass-arena-topbar__live">Live</span> : null}
    </header>
  );
}
