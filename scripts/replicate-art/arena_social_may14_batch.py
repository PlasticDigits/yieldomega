#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""Generate five mixed Yieldomega Arena social images.

This intentionally uses one Replicate create attempt per image. If polling or
create responses flake, recover by prediction id instead of retrying blindly.
"""

from __future__ import annotations

import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import generate_assets as ga  # noqa: E402


OUT_DIR = ga.DEFAULT_OUT / "gen_social" / "arena-may14"


@dataclass(frozen=True)
class ArenaSocialJob:
    slug: str
    title: str
    kind: str  # "infographic" | "worldbuilding"
    seed: str
    subject: str


INFOGRAPHIC_REFERENCE = """
CRITICAL — infographic typography: this job is a finished marketing poster, not silent key art.
Render clearly readable English words as chunky arcade cartoon lettering: headline, panel labels,
arrows, badges, and short callouts. An image with no on-picture text is wrong. Keep text sparse,
large, high contrast, and scannable. Do not add dense fine print, legal claims, dates, prices,
watermarks, or return/profit promises.

Reference images are supplied as input_images in this order:
(1) style.png — preserve the Yieldomega blocky arcade fantasy world, adult playful bunny-leprechaun mascot,
red-bearded leprechauns, green-gold palette, thick dark outlines, glossy toy depth, voxel hills, rainbow
accents, and magical arena energy.
(2) token-logo.png — use as canonical hat-token / DOUB-style coin language.
""".strip()


WORLDBUILDING_REFERENCE = """
Reference images are supplied as input_images in this order:
(1) style.png for the Yieldomega blocky arcade fantasy world, adult mascots, green-gold palette,
chunky outlines, glossy toy depth, and cheerful magical tone.
(2) token-logo.png for canonical hat-token details.

Text rule: this is worldbuilding / cinematic splash art, not an explainer. Use limited or no readable
text unless the subject explicitly asks for a diegetic sign or countdown. Prefer symbols, architecture,
weapons, clocks, trails, energy, poses, and emotion over captions.
""".strip()


def build_prompt(job: ArenaSocialJob, *, using_refs: bool) -> str:
    if using_refs:
        reference_block = INFOGRAPHIC_REFERENCE if job.kind == "infographic" else WORLDBUILDING_REFERENCE
    else:
        reference_block = (
            "No reference images are available for this run. Follow the written Yieldomega style guide closely: "
            "blocky arcade fantasy, green-gold magical finance, glossy hat-token currency, adult playful mascots, "
            "thick outlines, and high-clarity staging."
        )

    return f"""
{ga.STYLE_GUIDE}

{reference_block}

Accuracy constraints:
- TimeCurve is onchain. Each qualifying buy changes the round state.
- Default buy timer branch: +120 seconds, capped by the remaining-time cap.
- Hard-reset branch: when remaining time before the buy is below 13 minutes, the deadline snaps toward 15 minutes.
- WarBow is Battle Points PvP: buys can earn BP, flag planting is opt-in, and steal/guard/revenge are distinct CL8Y-burn actions.
- The WarBow top-3 Battle Points ladder is one of the reserve podium categories.
- Do not imply guaranteed returns, guaranteed wins, legal advice, or offchain authority.
- Characters must be adult mascots or adult player avatars.

Post seed:
{job.seed.strip()}

Image mode: {job.kind}
Image title: {job.title}

Subject and composition:
{job.subject.strip()}

Strictly avoid:
{ga.NEGATIVE_GUIDE}
""".strip()


def jobs() -> list[ArenaSocialJob]:
    return [
        ArenaSocialJob(
            slug="01-every-buy-changes-game",
            title="Every Buy Changes The Game",
            kind="infographic",
            seed="Every buy changes the game. A magical timer extending upward after a player presses a glowing buy button; other players react in panic and excitement; visual pressure waves spread through the arena; TimeCurve mechanics visualized.",
            subject="""
Wide 3:2 finished infographic poster. Big headline text exactly: "EVERY BUY CHANGES THE GAME". Center: adult player hand presses a glowing BUY button on a smart-contract pedestal; a giant magical arena timer extends upward with pressure waves rippling through the crowd. Use three clear labeled callout cards: "+120s BUY EXTENSION", "UNDER 13m -> RESET TOWARD 15m", "96h CAP". Add small labels "TimeCurve", "onchain timer", and "pressure wave". Other adult players react with panic, excitement, and strategy around the arena. High-energy fantasy crypto game style, readable typography integrated with art.
""",
        ),
        ArenaSocialJob(
            slug="02-warbow-activation",
            title="WarBow Activation",
            kind="worldbuilding",
            seed="Warbow activation. Legendary glowing WarBow weapon charging with energy inside a dark arena, arrows made of blockchain energy, target lock system, futuristic fantasy PvP vibe, intense green neon lighting, cinematic game splash art, ultra detailed.",
            subject="""
Wide 3:2 cinematic worldbuilding splash. A legendary glowing WarBow weapon charges inside a dark emerald arena, held by an adult armored archer silhouette. Arrows made of blockchain energy float and assemble from glowing cube links. A stylized target-lock halo and Battle Points sparks orbit the bow, but keep UI minimal and mostly symbolic. Intense green neon lighting, fantasy PvP atmosphere, dramatic rim light, glossy arcade finish. Limited text: at most one small diegetic weapon plaque reading "WarBow"; otherwise no captions or explainer panels.
""",
        ),
        ArenaSocialJob(
            slug="03-warbow-vs-time",
            title="WarBow Vs Time",
            kind="worldbuilding",
            seed="Warbow vs Time. Archer aiming a glowing WarBow directly at a giant ticking clock, symbolic battle between timing and precision, cinematic action shot, fantasy cyberpunk crypto style.",
            subject="""
Wide 3:2 cinematic action shot. Adult archer aims a glowing WarBow directly at a giant ticking clock suspended over the TimeCurve arena. The arrow is made of emerald blockchain energy and threads through floating timer rings. The clock face glows with pressure, cracks of light, and hat-token sparks, symbolizing timing versus precision. Fantasy cyberpunk crypto style, dramatic camera angle, motion streaks, no infographic panels, no captions, no profit language.
""",
        ),
        ArenaSocialJob(
            slug="04-new-player-enters-arena",
            title="New Player Enters Yieldomega Arena",
            kind="worldbuilding",
            seed="New player entering into Yieldomega Arena. New player entering a giant glowing arena gate marked YieldOmega, referral code holograms floating around, welcoming but intense atmosphere, fantasy crypto metaverse aesthetic.",
            subject="""
Wide 3:2 worldbuilding scene. A new adult player avatar walks through a giant glowing arena gate marked exactly "YIELDOMEGA". Referral code holograms float around the entry path as short stylized lowercase slugs and glowing codeHash crystals, pointing toward the TimeCurve arena inside. Adult bunny-leprechaun host and red-bearded leprechaun guides welcome the player while the crowd and timer energy make the atmosphere intense. Fantasy crypto metaverse aesthetic, green-gold portal light, coins, wallet lanterns. Limited text only: the gate word "YIELDOMEGA" and a few short code holograms; no explanatory captions.
""",
        ),
        ArenaSocialJob(
            slug="05-final-seconds",
            title="Final Seconds",
            kind="worldbuilding",
            seed="Final Seconds. Countdown at 00:05 while players rush to make moves inside the arena, explosive energy, emotional reactions, high-stakes GameFi battle scene, dramatic cinematic lighting.",
            subject="""
Wide 3:2 cinematic worldbuilding scene. The arena clock shows one clear readable countdown: "00:05". Adult players rush to make last-second moves: one reaches for a glowing buy button, another raises a WarBow, others react with shock, focus, and excitement. Explosive emerald-gold energy erupts from the timer; pressure waves and chain sparks fill the arena. High-stakes GameFi battle scene, dramatic cinematic lighting, no extra captions, no dense UI, no guarantees.
""",
        ),
    ]


def write_manifest(selected: list[ArenaSocialJob], *, using_refs: bool) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {
        "model": ga.MODEL,
        "output_dir": str(OUT_DIR.relative_to(ga.REPO_ROOT)),
        "single_attempt_per_image": True,
        "parallel": True,
        "reference_images_used": using_refs,
        "jobs": [
            {
                "slug": job.slug,
                "title": job.title,
                "kind": job.kind,
                "output": f"{job.slug}.png",
                "seed": job.seed,
                "subject": job.subject.strip(),
            }
            for job in selected
        ],
    }
    (OUT_DIR / "prompts.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    (OUT_DIR / "README.md").write_text(
        "# May 14 Arena Social Art\n\n"
        "Generated with `scripts/replicate-art/arena_social_may14_batch.py` using one "
        "Replicate create attempt per image. See `prompts.json` for mode decisions and prompts.\n",
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

    existing = [OUT_DIR / f"{job.slug}.png" for job in selected if (OUT_DIR / f"{job.slug}.png").exists()]
    if existing:
        print("Refusing to run with existing PNG outputs; remove them first for a fresh one-attempt set.", file=sys.stderr)
        for path in existing:
            print(f"  existing: {path}", file=sys.stderr)
        return 2

    def run_one(idx: int, job: ArenaSocialJob) -> None:
        print(f"[{idx}/{len(selected)}] {job.slug} ({job.kind})")
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

    with ThreadPoolExecutor(max_workers=len(selected)) as executor:
        futures = {executor.submit(run_one, idx, job): job.slug for idx, job in enumerate(selected, start=1)}
        for future in as_completed(futures):
            slug = futures[future]
            try:
                future.result()
                print(f"[{slug}] complete")
            except Exception as exc:
                print(f"[{slug}] failed: {exc!s}", file=sys.stderr)
                raise

    print(f"Wrote arena social images to {OUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
