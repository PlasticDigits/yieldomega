#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""Generate one clean TimeCurve mental-model infographic.

This is intentionally stripped down: one Replicate create attempt using the
attached app screenshots as visual references. The image model renders the
infographic and text directly.
Output goes to ``frontend/public/art/pending_manual_review/``.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import generate_assets as ga  # noqa: E402


OUT_DIR = ga.DEFAULT_OUT / "pending_manual_review"
SLUG = "timecurve-mental-model-infographic"

DEFAULT_SCREENSHOT_REFS = [
    Path("/home/answorld/.cursor/projects/home-answorld-repos-yieldomega/assets/image-489d0fd2-d130-45d6-abca-e20270e0f261.png"),
    Path("/home/answorld/.cursor/projects/home-answorld-repos-yieldomega/assets/image-003e9c52-7f21-4ddf-8c22-0828d3a6359a.png"),
    Path("/home/answorld/.cursor/projects/home-answorld-repos-yieldomega/assets/image-ef515899-5f85-45a9-a367-1094c15df518.png"),
    Path("/home/answorld/.cursor/projects/home-answorld-repos-yieldomega/assets/image-8492cad2-b75a-499c-8ef1-6fdda4cdaee4.png"),
    Path("/home/answorld/.cursor/projects/home-answorld-repos-yieldomega/assets/image-5330644d-5681-4db5-8994-853f4174b32f.png"),
    Path("/home/answorld/.cursor/projects/home-answorld-repos-yieldomega/assets/image-a665c7f7-c7b7-4065-82da-87fc6cfee391.png"),
]


@dataclass(frozen=True)
class CopyBlock:
    eyebrow: str
    title: str
    subtitle: str
    cards: tuple[tuple[str, str, str], ...]
    podiums: tuple[str, ...]
    footer: str


COPY = CopyBlock(
    eyebrow="TIMECURVE MENTAL MODEL",
    title="Buy CHARM. Win timing. Redeem DOUB.",
    subtitle="CHARM is your sale allocation: more CHARM means a larger pro-rata share of DOUB when the sale ends.",
    cards=(
        (
            "1. BUY EARLY",
            "Better CHARM price",
            "Earlier buys usually get more CHARM for the same CL8Y spend.",
        ),
        (
            "2. BUY OFTEN",
            "Scores keep moving",
            "Small frequent buys can add +120s and help most prize tracks.",
        ),
        (
            "3. TIME THE END",
            "Last 15m is the battleground",
            "Strategic late buys can swing podiums and win bigger prizes.",
        ),
    ),
    podiums=(
        "Last Buy",
        "WarBow BP",
        "Defended Streak",
        "Time Booster",
    ),
    footer="Simple rule: early and often is good. Save attention for the final 15 minutes.",
)


def build_prompt(*, using_refs: bool) -> str:
    refs = (
        "Reference images are supplied as input_images. Use them only as UI/layout references for the Time Left panel, CHARM buy panel, CHARM balance card, prize podiums, and charts. Do not copy tiny numbers exactly; keep the final graphic cleaner and simpler."
        if using_refs
        else "No screenshots are available. Build a clean product-education poster from the written brief."
    )
    return f"""
Create a clean, straightforward product infographic for Yieldomega TimeCurve.

{refs}

Style:
- Use the same green, cream, gold, and dark-outline UI language seen in the screenshots.
- Minimal or no worldbuilding: no mascots, no fantasy scene, no busy background.
- A polished mobile-game UI poster with large cards, arrows, timer icon, CHARM token icon, DOUB coin icon, and podium icon.
- Render the infographic text directly in large, high-contrast, readable English.
- Keep text sparse and clear. Do not add extra slogans, legal claims, dates, or prices.

Composition:
- Wide 3:2 landscape infographic.
- Top title band.
- Three large step cards left-to-right: early buys, frequent buys, final 15 minutes.
- A simple visual flow: CL8Y spend -> CHARM allocation -> DOUB redemption at sale end.
- A small podium panel with four prize tracks.
- A footer strip for the simple rule.

Required on-image text:
- Eyebrow: "{COPY.eyebrow}"
- Main headline: "{COPY.title}"
- Subtitle: "{COPY.subtitle}"
- Flow labels: "CL8Y spend" -> "CHARM allocation" -> "DOUB at sale end"
- Step card 1: "{COPY.cards[0][0]}" / "{COPY.cards[0][1]}" / "{COPY.cards[0][2]}"
- Step card 2: "{COPY.cards[1][0]}" / "{COPY.cards[1][1]}" / "{COPY.cards[1][2]}"
- Step card 3: "{COPY.cards[2][0]}" / "{COPY.cards[2][1]}" / "{COPY.cards[2][2]}"
- Podium panel title: "Prize podiums"
- Podium labels: {" / ".join(COPY.podiums)}
- Footer: "{COPY.footer}"

Accuracy constraints:
- Buying early is good because price per CHARM starts lower and rises over time.
- Small frequent buys can add 120 seconds and help most prize scores.
- The biggest prize swings happen in the final 15 minutes.
- Strategic timing can help win podium prizes, but wins are never guaranteed.
- CHARM is sale allocation weight; after the sale, CHARM redeems pro-rata for DOUB.
- Do not imply guaranteed profit, guaranteed wins, legal advice, or offchain authority.

Strictly avoid:
{ga.NEGATIVE_GUIDE}, dense text, tiny paragraphs, fake prices, fake dates, guaranteed-return claims, lottery language, worldbuilding clutter
""".strip()


def existing_refs(extra_refs: list[str]) -> list[Path]:
    refs = [p for p in DEFAULT_SCREENSHOT_REFS if p.is_file()]
    refs.extend(Path(p).expanduser().resolve() for p in extra_refs if Path(p).expanduser().is_file())
    return refs


def write_manifest(refs: list[Path], prompt: str) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {
        "model": ga.MODEL,
        "script": "scripts/replicate-art/timecurve_mental_model_infographic.py",
        "output": str((OUT_DIR / f"{SLUG}.png").relative_to(ga.REPO_ROOT)),
        "single_attempt_per_image": True,
        "model_rendered_text": True,
        "reference_images": [str(p) for p in refs],
        "copy": {
            "eyebrow": COPY.eyebrow,
            "title": COPY.title,
            "subtitle": COPY.subtitle,
            "cards": list(COPY.cards),
            "podiums": list(COPY.podiums),
            "footer": COPY.footer,
        },
        "prompt": prompt,
    }
    (OUT_DIR / f"{SLUG}.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--dry-run", action="store_true", help="Print plan only; no API call")
    p.add_argument("--reference", action="append", default=[], help="Additional reference image path")
    p.add_argument("--overwrite", action="store_true", help="Replace an existing output PNG")
    args = p.parse_args()

    ga.load_env()
    token = os.environ.get("REPLICATE_API_TOKEN", "").strip()
    if not args.dry_run and not token:
        print("Error: REPLICATE_API_TOKEN is not set.", file=sys.stderr)
        return 1
    if not args.dry_run:
        os.environ["REPLICATE_API_TOKEN"] = token

    refs = existing_refs(args.reference)
    prompt = build_prompt(using_refs=bool(refs))
    write_manifest(refs, prompt)

    out_path = OUT_DIR / f"{SLUG}.png"
    if out_path.exists() and not args.overwrite:
        print(f"Error: {out_path} already exists. Use --overwrite to replace it.", file=sys.stderr)
        return 2

    ga.run_job(
        SLUG,
        "3:2",
        "png",
        "opaque",
        "TimeCurve mental-model infographic",
        OUT_DIR,
        ga.DEFAULT_STYLE_REF,
        ga.DEFAULT_TOKEN_REF,
        "high",
        "low",
        90,
        1,
        1,
        20.0,
        args.dry_run,
        no_refs=not bool(refs),
        custom_prompt=prompt,
        ref_paths_override=refs if refs else None,
        max_wall_seconds=float(os.environ.get("REPLICATE_MAX_GENERATION_SECONDS", "900")),
        log_monitor=True,
        poll_progress=True,
    )
    if not args.dry_run:
        print(f"Wrote {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
