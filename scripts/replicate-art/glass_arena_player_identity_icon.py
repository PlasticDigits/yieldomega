#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""Regenerate the Glass Arena player identity badge for the timer extension chip.

Output replaces the stable public asset path used by the Last Buy extension pill:

  frontend/public/art/icons/arena-player-identity.png

Prediction ID is written to ``glass_arena_player_identity_icon.ledger.json`` so
reconnects or retries do not duplicate Replicate jobs.
"""

from __future__ import annotations

import argparse
import io
import json
import os
import sys
from pathlib import Path

try:
    import httpx
except ImportError:
    httpx = None  # type: ignore[misc, assignment]

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import flagged_inputs as _flagged_inputs  # noqa: E402
import generate_assets as ga  # noqa: E402
import replicate_bounded_run as _bounded  # noqa: E402

LEDGER = SCRIPT_DIR / "glass_arena_player_identity_icon.ledger.json"
ART_ROOT = ga.REPO_ROOT / "frontend" / "public" / "art"
ICONS_DIR = ART_ROOT / "icons"
SCRATCH_DIR = ART_ROOT / "pending_manual_review" / "glass-arena-player-identity-icon"
FILENAME = "arena-player-identity.png"
LEDGER_KEY = "arena-player-identity"

IDENTITY_PROMPT = """
Yield Omega Glass Arena player identity badge.
Create a single square 256x256 transparent PNG circular medallion for a compact
live-buy timer chip (14–18 px display beside a wallet tail hex label). Subject:
a minimal glass player avatar tile — abstract tactical head-and-shoulders
silhouette inside a round emerald/teal live-state rim, deep navy translucent
glass fill, warm gold DOUB accent glint, sparse purple opponent-energy spark
used sparingly. Cyberminimalist command-console finish: crisp circular silhouette,
luminous bevels, subtle glass reflections, no readable text, no hex digits, no
wallet address, no letters, no numerals, no UI frame, no watermark, no
photorealism, no pixel-art blockie. Center the round badge with transparent padding.
""".strip()


def _reference_paths() -> list[Path]:
    refs = [
        ga.DEFAULT_TOKEN_REF,
        ga.REPO_ROOT / "frontend" / "public" / "tokens" / "doub.png",
        ICONS_DIR / "arena-podium-rank-first.png",
    ]
    return _flagged_inputs.filter_reference_paths(refs, ga.REPO_ROOT, job_label=LEDGER_KEY)


def _square_icon_png(raw: bytes) -> bytes:
    from PIL import Image

    im = Image.open(io.BytesIO(raw)).convert("RGBA")
    w, h = im.size
    side = max(w, h)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.alpha_composite(im, ((side - w) // 2, (side - h) // 2))
    canvas = canvas.resize((256, 256), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    canvas.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def _load_ledger() -> dict[str, str]:
    if not LEDGER.is_file():
        return {}
    try:
        data = json.loads(LEDGER.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    if not isinstance(data, dict):
        return {}
    return {str(k): str(v) for k, v in data.items() if v}


def _save_ledger(data: dict[str, str]) -> None:
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    tmp = LEDGER.with_suffix(LEDGER.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    tmp.replace(LEDGER)


def _forget_ledger_key() -> None:
    data = _load_ledger()
    data.pop(LEDGER_KEY, None)
    _save_ledger(data)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Print the output path without calling Replicate")
    parser.add_argument("--force-new", action="store_true", help="Forget the existing ledger entry before creating")
    parser.add_argument("--no-refs", action="store_true", help="Skip token/trophy reference images")
    args = parser.parse_args()

    ga.load_env()
    token = os.environ.get("REPLICATE_API_TOKEN", "").strip()
    if args.dry_run:
        print(f"{LEDGER_KEY}\t{FILENAME}")
        return 0
    if not token:
        print("REPLICATE_API_TOKEN is unset; export it or add it to repo-root .env.", file=sys.stderr)
        return 2
    if args.force_new:
        _forget_ledger_key()

    import replicate

    inp: dict = {
        "prompt": ga.augment_prompt_chroma_backdrop(IDENTITY_PROMPT),
        "aspect_ratio": "1:1",
        "quality": "high",
        "background": "opaque",
        "moderation": "low",
        "output_format": "png",
        "number_of_images": 1,
        "output_compression": 90,
        "input_images": [],
    }
    client = (
        replicate.Client(timeout=httpx.Timeout(120.0, connect=60.0, write=600.0, read=900.0, pool=300.0))
        if httpx is not None
        else replicate.Client()
    )

    handles = [] if args.no_refs else [open(p, "rb") for p in _reference_paths()]  # noqa: SIM115
    try:
        inp["input_images"] = handles
        output = _bounded.run_model_bounded(
            client,
            ga.MODEL,
            inp,
            prefer_wait=1,
            job_label=LEDGER_KEY,
            ledger_path=LEDGER,
            ledger_key=LEDGER_KEY,
            poll_progress=True,
        )
    finally:
        for handle in handles:
            handle.close()

    if not output:
        raise RuntimeError(f"no output for {LEDGER_KEY}")
    raw = ga.postprocess_chroma_to_transparent(ga._read_output_bytes(output))
    raw = _square_icon_png(raw)

    SCRATCH_DIR.mkdir(parents=True, exist_ok=True)
    ICONS_DIR.mkdir(parents=True, exist_ok=True)
    (SCRATCH_DIR / FILENAME).write_bytes(raw)
    final = ICONS_DIR / FILENAME
    final.write_bytes(raw)
    print(f"[{LEDGER_KEY}] promoted {final.relative_to(ga.REPO_ROOT)} ({len(raw)} b)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
