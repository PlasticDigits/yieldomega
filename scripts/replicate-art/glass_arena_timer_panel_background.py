#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""Generate the Glass Arena Last Buy timer panel background.

Output replaces the stable public asset path used by the command-console timer bay:

  frontend/public/art/scenes/arena-simple-timer-panel.jpg

Prediction ID is written to ``glass_arena_timer_panel_background.ledger.json`` so
reconnects do not duplicate Replicate jobs. Run once per refresh — no retry loop.
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

LEDGER = SCRIPT_DIR / "glass_arena_timer_panel_background.ledger.json"
ART_ROOT = ga.REPO_ROOT / "frontend" / "public" / "art"
SCENES_DIR = ART_ROOT / "scenes"
SCRATCH_DIR = ART_ROOT / "pending_manual_review" / "glass-arena-timer-panel"
FILENAME = "arena-simple-timer-panel.jpg"
LEDGER_KEY = "arena-simple-timer-panel"

# 2× the live CSS panel footprint (644×165) for crisp cover on retina.
TARGET_W = 1288
TARGET_H = 330

TIMER_PANEL_PROMPT = """
Yield Omega Glass Arena — Last Buy timer bay wide background plate.
Create a single ultra-wide horizontal scene backplate with NO characters, NO mascots,
NO people, NO silhouettes, NO faces, NO text, NO numbers, NO UI chrome, NO watermarks.

Style: dark cyberminimalist glassmorphism command-console arena. Deep navy void,
frosted translucent glass panels, restrained emerald/teal live-state rim glow on the left,
warm gold DOUB reward accent bloom on the upper right, subtle cyan grid lines, soft
luminous horizon arcs suggesting a futuristic arena floor, gentle glass reflections and
inset highlights. Keep the central band calm and dark with low contrast so a bright
white countdown clock can sit on top without fighting the art. Edge detail can be richer;
center must stay readable.

Composition: panoramic banner crop feeling, environment-only, architectural depth,
premium esports command bay, not arcade cartoon, not photorealism, not cluttered.
""".strip()


def _reference_paths() -> list[Path]:
    refs = [
        ga.DEFAULT_TOKEN_REF,
        ga.REPO_ROOT / "frontend" / "public" / "tokens" / "doub.png",
        ART_ROOT / "icons" / "header-arena.png",
    ]
    return _flagged_inputs.filter_reference_paths(refs, ga.REPO_ROOT, job_label=LEDGER_KEY)


def _banner_jpg(raw: bytes) -> bytes:
    from PIL import Image

    im = Image.open(io.BytesIO(raw)).convert("RGB")
    w, h = im.size
    # Center-crop the generated 3:2 frame to an ultra-wide ~4:1 banner strip.
    target_ratio = TARGET_W / TARGET_H
    current_ratio = w / h
    if current_ratio > target_ratio:
        new_w = int(h * target_ratio)
        left = (w - new_w) // 2
        im = im.crop((left, 0, left + new_w, h))
    else:
        new_h = int(w / target_ratio)
        top = (h - new_h) // 2
        im = im.crop((0, top, w, top + new_h))
    im = im.resize((TARGET_W, TARGET_H), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=90, optimize=True, progressive=True)
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
    parser.add_argument("--no-refs", action="store_true", help="Skip token/header reference images")
    args = parser.parse_args()

    ga.load_env()
    if args.dry_run:
        print(f"{LEDGER_KEY}\t{FILENAME}\t{TARGET_W}x{TARGET_H}")
        return 0
    if not os.environ.get("REPLICATE_API_TOKEN", "").strip():
        print("REPLICATE_API_TOKEN is unset; export it or add it to repo-root .env.", file=sys.stderr)
        return 2
    if args.force_new:
        _forget_ledger_key()

    import replicate

    inp: dict = {
        "prompt": TIMER_PANEL_PROMPT,
        "aspect_ratio": "3:2",
        "quality": "high",
        "background": "opaque",
        "moderation": "low",
        "output_format": "jpeg",
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
    raw = ga._read_output_bytes(output)
    raw = _banner_jpg(raw)

    SCRATCH_DIR.mkdir(parents=True, exist_ok=True)
    SCENES_DIR.mkdir(parents=True, exist_ok=True)
    (SCRATCH_DIR / FILENAME).write_bytes(raw)
    final = SCENES_DIR / FILENAME
    final.write_bytes(raw)
    print(f"[{LEDGER_KEY}] promoted {final.relative_to(ga.REPO_ROOT)} ({len(raw)} b)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
