# SPDX-License-Identifier: AGPL-3.0-only
"""
Render reference WAVs from `presets.py` into a target directory (e.g. frontend public).

  cd scripts/sound-effects && python -m venv .venv && . .venv/bin/activate
  pip install -r requirements.txt
  python generate.py --out ../../frontend/public/sound-effects
"""

from __future__ import annotations

import argparse
from pathlib import Path

import presets
from sfx_synth import save_wav_mono16, DEFAULT_SR

PRESETS: dict[str, object] = {
    "ui_button_click": presets.ui_button_click,
    "coin_hit_shallow": presets.coin_hit_shallow,
    "charmed_confirm": presets.charmed_confirm,
    "peer_buy_distant": presets.peer_buy_distant,
    "timer_heartbeat_calm": lambda: presets.timer_heartbeat(urgent=False),
    "timer_heartbeat_urgent": lambda: presets.timer_heartbeat(urgent=True),
    "warbow_twang": presets.warbow_twang,
    "kumbaya_whoosh": presets.kumbaya_whoosh,
}


def main() -> None:
    p = argparse.ArgumentParser(description="Render procedural SFX to WAV.")
    p.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).resolve().parent / "out",
        help="Output directory (default: scripts/sound-effects/out)",
    )
    p.add_argument(
        "--name",
        default=None,
        help="Render a single preset key (default: all)",
    )
    args = p.parse_args()
    out: Path = args.out
    names = [args.name] if args.name else list(PRESETS.keys())
    for k in names:
        if k not in PRESETS:
            raise SystemExit(f"Unknown preset {k!r}. Known: {', '.join(sorted(PRESETS))}")
        gen = PRESETS[k]
        arr = gen() if callable(gen) else gen
        path = out / f"{k}.wav"
        save_wav_mono16(path, arr, DEFAULT_SR)
        print(path)


if __name__ == "__main__":
    main()
