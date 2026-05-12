#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""Generate a four-image TimeCurve launch brief pack.

This intentionally uses one Replicate create attempt per image. If polling flakes,
investigate the logged prediction instead of retrying and duplicating generations.
"""

from __future__ import annotations

import json
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import generate_assets as ga  # noqa: E402


OUT_DIR = ga.DEFAULT_OUT / "timecurve-launch-brief"


@dataclass(frozen=True)
class BriefJob:
    slug: str
    title: str
    mode: str
    subject: str


def build_prompt(job: BriefJob) -> str:
    return f"""
{ga.STYLE_GUIDE}

Reference images are supplied as input_images in this order:
(1) style.png for the Yieldomega blocky arcade fantasy world, mascots, green-gold palette, chunky outlines, glossy toy depth, and cheerful magical tone.
(2) token-logo.png for canonical coin, badge, and DOUB-style hat-token details.

This image may include readable text because it is a launch education graphic. Keep text sparse, large, spelled exactly as requested, and inside clean signboards, labels, or UI cards. Do not add extra slogans, legal claims, prices, dates, or return promises.

Accuracy constraints for TimeCurve:
- TimeCurve is a token launch sale with an onchain timer.
- Before the sale is live, the interface counts down to onchain saleStart using "TimeCurve Opens In".
- Initial countdown is 24h by documented default.
- Each buy can add 120s, but remaining time is capped at 96h.
- If remaining time before a buy is strictly below 13m, the deadline resets toward 15m remaining.
- Buys stop after the deadline and also at the 300-day sale wall.
- CHARM buy band grows over time; documented envelope is about 20 percent/day.
- Per-CHARM price is a separate time-based schedule.
- CHARM weight redeems pro-rata for DOUB after end.
- Reserve podium categories are exactly: Last Buy, WarBow, Defended Streak, Time Booster.
- Launch fee split defaults: 30 percent DOUB/CL8Y locked LP, 40 percent CL8Y burn, 20 percent podium pool, 10 percent Rabbit Treasury, team 0 percent.
- Do not depict offchain servers as authoritative. Use chain, blocks, contract plaques, and wallet signatures for authority.
- Do not imply guaranteed returns, guaranteed wins, or pressure to participate.

Image title: {job.title}
Mode: {job.mode}

Subject and composition:
{job.subject.strip()}

Strictly avoid:
{ga.NEGATIVE_GUIDE}
""".strip()


def jobs() -> list[BriefJob]:
    return [
        BriefJob(
            slug="onchain-pressure",
            title="Onchain Pressure",
            mode="character worldbuilding with light infographic labels",
            subject="""
Wide 3:2 cinematic arcade scene. Multiple adult mascot hands and gloved player hands reach toward a single glowing emerald-gold onchain button mounted on a transparent smart-contract pedestal. A chunky countdown clock above the button visibly ticks down with clean large text: "ONCHAIN PRESSURE" and small label "timer ticking down". The button is connected by glowing block-chain links to a wallet signature plaque and a block-height tower, showing the pressure is onchain and public. Atmosphere: tense but playful, not scary, with sparkles, voxel hills, and DOUB hat-coins orbiting the timer. No fake dates, no profit claims, no extra paragraphs.
""",
        ),
        BriefJob(
            slug="nft-identity",
            title="NFT Identity",
            mode="character worldbuilding",
            subject="""
Wide 3:2 collectible roster scene. Three unique adult avatar characters stand on separate glowing NFT identity plinths inside a magical arcade character-select hall. One avatar is a sniper-style patient strategist with scope goggles and a calm blue-green glow; one is a patient defender with shield, guard stance, and warm gold glow; one is a timer-focused tactician with clock charms and purple-green glow. Each avatar has distinct silhouette, accessories, and playstyle aura. Add only tiny readable labels on plinth nameplates: "SNIPER", "DEFENDER", "TIMING". Include token-logo inspired hat badges and NFT card frames, but do not imply immutable offchain metadata or guaranteed advantage.
""",
        ),
        BriefJob(
            slug="pattern-recognition",
            title="Pattern Recognition",
            mode="split character worldbuilding",
            subject="""
Wide 3:2 split-screen composition. Left side: one focused adult player-avatar wearing glowing glasses sees clear highlighted paths, timer arcs, CHARM band rails, and buy-flow lines through a transparent TimeCurve arena map. Right side: other players see colorful chaos: tangled coin trails, spinning clocks, floating blocks, and scattered signals. Make the contrast obvious with two clean labels only: "PATTERNS" on the left and "CHAOS" on the right. The highlighted lines should feel like analysis and timing discipline, not supernatural certainty. Keep it playful, readable, and brand-consistent.
""",
        ),
        BriefJob(
            slug="time-curve-infographic",
            title="Time Curve",
            mode="accurate infographic with text",
            subject="""
Wide 3:2 infographic poster on parchment-like UI cards inside the Yieldomega arcade world. Main headline text exactly: "TIME CURVE". Below it, a clean sequence of five large labeled panels with simple icons:
1. "OPENS AT saleStart" with subtext "TimeCurve Opens In"
2. "24h INITIAL CLOCK"
3. "+120s PER BUY" with small cap label "96h cap"
4. "UNDER 13m -> RESET TOWARD 15m"
5. "300d WALL"
Add a side card titled "KNOW THIS" with four short bullets: "CHARM band grows", "Price schedule is separate", "Redeem CHARM for DOUB after end", "Podium: Last Buy / WarBow / Defended / Booster".
Add a footer fee ribbon with labels: "30 LP", "40 BURN", "20 PODIUM", "10 RABBIT", "0 TEAM".
Use clear typography, lots of whitespace, icons for chain clock, CHARM rail, DOUB coin, podium, rabbit treasury. Do not include a calendar date, dollar returns, or any claim of guaranteed wins.
""",
        ),
    ]


def write_manifest(selected: list[BriefJob]) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {
        "model": ga.MODEL,
        "output_dir": str(OUT_DIR.relative_to(ga.REPO_ROOT)),
        "single_attempt_per_image": True,
        "jobs": [
            {
                "slug": job.slug,
                "title": job.title,
                "mode": job.mode,
                "output": f"{job.slug}.png",
                "subject": job.subject.strip(),
            }
            for job in selected
        ],
    }
    (OUT_DIR / "prompts.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    (OUT_DIR / "README.md").write_text(
        "# TimeCurve Launch Brief Art\n\n"
        "Generated with `scripts/replicate-art/timecurve_launch_brief_batch.py` using one "
        "Replicate create attempt per image. See `prompts.json` for the exact briefs.\n",
        encoding="utf-8",
    )


def main() -> int:
    ga.load_env()
    token = os.environ.get("REPLICATE_API_TOKEN", "").strip()
    if not token:
        print("REPLICATE_API_TOKEN unset.", file=sys.stderr)
        return 1
    os.environ["REPLICATE_API_TOKEN"] = token

    selected = jobs()
    write_manifest(selected)

    for idx, job in enumerate(selected, start=1):
        print(f"[{idx}/{len(selected)}] {job.slug}")
        ga.run_job(
            job.slug,
            "3:2",
            "png",
            "opaque",
            job.subject,
            OUT_DIR,
            ga.DEFAULT_STYLE_REF,
            ga.DEFAULT_TOKEN_REF,
            "high",
            "low",
            90,
            1,
            1,
            20.0,
            False,
            False,
            custom_prompt=build_prompt(job),
            max_wall_seconds=float(os.environ.get("REPLICATE_MAX_GENERATION_SECONDS", "900")),
            poll_progress=True,
        )
        if idx < len(selected):
            time.sleep(8.0)

    print(f"Wrote launch brief images to {OUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
