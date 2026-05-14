#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""Generate two sparse-text worldbuilding stills for May 14 social posts.

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


OUT_DIR = ga.DEFAULT_OUT / "post-worldbuilding-may14"


@dataclass(frozen=True)
class WorldbuildingJob:
    slug: str
    title: str
    post_seed: str
    concept: str
    subject: str


def build_prompt(job: WorldbuildingJob, *, using_refs: bool) -> str:
    reference_block = (
        "Reference images are supplied as input_images in this order:\n"
        "(1) style.png for the Yieldomega blocky arcade fantasy world, mascots, green-gold palette, chunky outlines, glossy toy depth, and cheerful magical tone.\n"
        "(2) token-logo.png for canonical coin, badge, and DOUB-style hat-token details.\n"
        "Keep the same brand universe without making a direct edit or near-duplicate of either reference."
        if using_refs
        else "No reference images are available for this run. Follow the written Yieldomega style guide closely: blocky arcade fantasy, green-gold magical finance, glossy hat-token currency, adult playful mascots, thick outlines, and cheerful high-clarity staging."
    )
    return f"""
{ga.STYLE_GUIDE}

{reference_block}

Worldbuilding brief:
Create a new campaign still that goes with the post seed, not a literal illustration of the post copy. The image should feel like one discovered location, ritual, or arena rule inside the Yieldomega world.

Post seed:
{job.post_seed.strip()}

Concept:
{job.concept.strip()}

Text rule:
Use limited or no readable text. Prefer pictorial worldbuilding, symbols, plaques, silhouettes, paths, light, and architecture. Do not make an infographic, chart, poster, meme, comparison table, or panel explainer. If tiny glyphs appear, keep them abstract or unreadable except the stylized D buckle motif on token emblems.

Accuracy constraints:
- TimeCurve and CHARM/DOUB mechanics are onchain; show blocks, wallet signatures, contract pedestals, transparent rails, or MegaETH-like speed lanes as environmental authority.
- Do not imply guaranteed returns, guaranteed wins, or offchain servers as the authority.
- Do not add dates, prices, dense UI, fine print, slogans, speech bubbles, or legal claims.
- Characters, if present, are adult mascots or player avatars.

Subject and composition:
{job.subject.strip()}

Strictly avoid:
{ga.NEGATIVE_GUIDE}
""".strip()


def jobs() -> list[WorldbuildingJob]:
    return [
        WorldbuildingJob(
            slug="arena-seat-gate",
            title="Arena Seat Gate",
            post_seed=(
                "the arena opens soon. do you have your spot? no entry, no CHARM. "
                "no CHARM, no DOUB. the setup is simple and the window is closing. "
                "all of this runs on MegaETH. the speed is what makes it possible."
            ),
            concept=(
                "A high-speed onchain coliseum threshold where CHARM behaves like a glowing seat-key "
                "and empty spots are visibly disappearing as the gate warms up."
            ),
            subject="""
Wide 3:2 cinematic worldbuilding scene at the outside rim of a floating emerald-gold arcade arena. A transparent smart-contract gate stands open just a crack, fed by bright MegaETH-speed lanes that look like luminous block rails streaking across the sky. Inside the gate, a ring of numbered-looking but unreadable glowing seat pedestals spirals upward; several seats are already lit, while a few remaining dark seats hover near the entrance as scarce open spots. Adult mascot hands and player avatars carry small CHARM-like crystal keys toward the gate, but keep the scene mostly architectural rather than character-heavy. DOUB-style hat-coins glow faintly beyond the threshold as distant treasure silhouettes, not a payout promise. Mood: urgent, magical, clean, fast, and fair; no readable text, no countdown numerals, no infographic panels.
""",
        ),
        WorldbuildingJob(
            slug="transparent-tidepath",
            title="Transparent Tidepath",
            post_seed=(
                "bonding curves hand the sharks the map and tell everyone else to keep up. "
                "TimeCurve flips that. the mechanics are visible, the arena is fair, and the Believers have a real path."
            ),
            concept=(
                "A glass-floored TimeCurve arena built over old shark waters, where the route is visible to ordinary Believers instead of hidden on a predator map."
            ),
            subject="""
Wide 3:2 worldbuilding scene split by environment rather than by infographic layout. In the lower shadowy water below, stylized shark silhouettes circle around an old treasure-map table, but the map is blurred, torn, and losing relevance. Above them, a bright transparent glass arena spans the water like a fair launch bridge: visible time rails, charm-band steps, block links, and wallet-signature lanterns are built into the floor so every path can be seen. A small group of adult Believer avatars and bunny-leprechaun mascots walk calmly across the illuminated path toward a central TimeCurve podium, with no single whale dominating. The camera angle should make the clear path and visible mechanics obvious through architecture and light, not labels. No readable words, no chart axes, no comparison poster, no speech bubbles.
""",
        ),
    ]


def write_manifest(selected: list[WorldbuildingJob], *, using_refs: bool) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {
        "model": ga.MODEL,
        "output_dir": str(OUT_DIR.relative_to(ga.REPO_ROOT)),
        "single_attempt_per_image": True,
        "reference_images_used": using_refs,
        "jobs": [
            {
                "slug": job.slug,
                "title": job.title,
                "output": f"{job.slug}.png",
                "post_seed": job.post_seed,
                "concept": job.concept,
                "subject": job.subject.strip(),
            }
            for job in selected
        ],
    }
    (OUT_DIR / "prompts.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    (OUT_DIR / "README.md").write_text(
        "# May 14 Post Worldbuilding Art\n\n"
        "Generated with `scripts/replicate-art/post_worldbuilding_may14_batch.py` using one "
        "Replicate create attempt per image. See `prompts.json` for the exact concepts.\n",
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
    using_refs = ga.DEFAULT_STYLE_REF.is_file() and ga.DEFAULT_TOKEN_REF.is_file()
    write_manifest(selected, using_refs=using_refs)

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
            not using_refs,
            custom_prompt=build_prompt(job, using_refs=using_refs),
            max_wall_seconds=float(os.environ.get("REPLICATE_MAX_GENERATION_SECONDS", "900")),
            poll_progress=True,
            log_monitor=True,
        )
        if idx < len(selected):
            time.sleep(8.0)

    print(f"Wrote worldbuilding images to {OUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
