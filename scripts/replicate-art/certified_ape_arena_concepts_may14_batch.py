#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""Five Arena / WarBow / TimeCurve social concepts (mixed infographic + worldbuilding).

Runs all images in parallel with ``retry_max=1`` (no API retries on capacity-style errors).
Each image is one Replicate prediction create + bounded poll — recover by prediction URL if needed.
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


OUT_DIR = ga.DEFAULT_OUT / "gen_social" / "arena-certified-ape-may14"


@dataclass(frozen=True)
class ConceptJob:
    slug: str
    title: str
    kind: str  # "infographic" | "worldbuilding"
    concept: str
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
text unless the subject explicitly asks for a diegetic sign, gate wordmark, or countdown numerals.
Prefer symbols, architecture, weapons, clocks, trails, energy, poses, and emotion over captions.
""".strip()


def build_prompt(job: ConceptJob, *, using_refs: bool) -> str:
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

Concept brief:
{job.concept.strip()}

Image mode: {job.kind}
Image title: {job.title}

Subject and composition:
{job.subject.strip()}

Strictly avoid:
{ga.NEGATIVE_GUIDE}
""".strip()


def jobs() -> list[ConceptJob]:
    return [
        ConceptJob(
            slug="ca-01-every-buy-reshapes-arena",
            title="Every Buy Reshapes The Arena",
            kind="infographic",
            concept=(
                "Turn the chat line into a readable ‘rule shock’ poster: one hero buy press sends a visible "
                "timer shockwave through the crowd, with honest on-chain timer rules called out in type."
            ),
            subject="""
Wide 3:2 finished infographic poster. Headline text exactly: "EVERY BUY CHANGES THE GAME". Hero center: a glowing
contract pedestal BUY button with an adult hand about to press it; a magical arena timer column visibly stretches
upward while concentric pressure waves ripple through stylized player silhouettes (panic, excitement, focus). Three
side callout panels with bold titles: "+120s EXTENSION", "UNDER 13m → SNAP TOWARD 15m", "96h ROUND CAP". Small footer
strip labels: "TimeCurve", "on-chain timer", "arena pressure wave". High-energy fantasy GameFi look, integrated chunky
cartoon typography, no fine print.
""",
        ),
        ConceptJob(
            slug="ca-02-warbow-activation-overcharge",
            title="WarBow Activation — Overcharge",
            kind="worldbuilding",
            concept=(
                "Legendary WarBow charging in a dark arena: blockchain-energy arrows, target lock, neon green "
                "PvP tension — splash art, not a manual."
            ),
            subject="""
Wide 3:2 cinematic worldbuilding splash. Inside a dim emerald arena, a legendary WarBow hovers mid-charge, veins of
glowing green circuit-runes wrapping the limbs. Arrows coalesce from linked cube shards and CL8Y-like sparks (abstract,
not a price). A minimal target-lock reticle and Battle Points ember trail suggest PvP focus without dense HUD. Rim light
in intense green neon, glossy arcade materials, dramatic low angle. Limited text: at most one small diegetic plaque
reading "WarBow"; no captions, no tutorial panels.
""",
        ),
        ConceptJob(
            slug="ca-03-warbow-versus-time",
            title="WarBow Versus Time",
            kind="worldbuilding",
            concept=(
                "Symbolic duel: precision archery against a colossal ticking clock — fantasy cyberpunk crypto arena, "
                "no explainer grid."
            ),
            subject="""
Wide 3:2 cinematic action shot. Adult archer draws a glowing WarBow aimed at a giant suspended arena clock whose face
is cracking with light; the arrow is a braided beam of emerald chain-energy threading through floating timer rings.
Foreground motion blur, background voxel hills and rainbow sparks softened. Fantasy cyberpunk crypto mood, high contrast,
no infographic panels, no slogans, no profit copy.
""",
        ),
        ConceptJob(
            slug="ca-04-new-player-yieldomega-gate",
            title="New Player — Yieldomega Gate",
            kind="infographic",
            concept=(
                "New player crosses into the Yieldomega Arena: gate wordmark, referral holograms as stylized slugs, "
                "welcoming but intense — as a compact onboarding board."
            ),
            subject="""
Wide 3:2 onboarding infographic poster. Massive glowing arena gate with wordmark exactly "YIELDOMEGA" across the lintel.
A new adult player avatar steps through while short holographic referral slugs float nearby (readable but fake codes like
"yo-friend-7qk" style, not real user data). Three labeled steps along the path: "ENTER", "BRING A CODE", "JOIN THE ARENA".
Small badge: "REFERRALS ON-CHAIN". Welcoming hosts (bunny-leprechaun + red-bearded leprechaun) wave from the sides without
speech bubbles. Fantasy crypto metaverse lighting, green-gold portal flare, chunky readable type.
""",
        ),
        ConceptJob(
            slug="ca-05-final-seconds-melee",
            title="Final Seconds",
            kind="worldbuilding",
            concept=(
                "Countdown at five seconds: players scramble for last moves — pure cinematic stakes, one clear time readout."
            ),
            subject="""
Wide 3:2 cinematic worldbuilding scene. A colossal arena scoreclock shows one clear readable countdown: "00:05" only.
Adult players burst into motion: one lunges toward a glowing buy pedestal, another raises a WarBow with energy arcing,
others show shock, grit, and triumph faces. Explosive emerald-gold light, debris of hat-token sparks, pressure waves
from the timer. Dramatic rim light and motion streaks. No extra captions, no multi-panel explainer, no guarantees.
""",
        ),
    ]


def write_manifest(selected: list[ConceptJob], *, using_refs: bool) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {
        "model": ga.MODEL,
        "output_dir": str(OUT_DIR.relative_to(ga.REPO_ROOT)),
        "retry_max": 1,
        "parallel_workers": len(selected),
        "reference_images_used": using_refs,
        "jobs": [
            {
                "slug": job.slug,
                "title": job.title,
                "kind": job.kind,
                "output": f"{job.slug}.png",
                "concept": job.concept.strip(),
                "subject": job.subject.strip(),
            }
            for job in selected
        ],
    }
    (OUT_DIR / "prompts.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    (OUT_DIR / "README.md").write_text(
        "# Certified Ape Arena Concepts (May 14)\n\n"
        "Generated with `scripts/replicate-art/certified_ape_arena_concepts_may14_batch.py` — "
        "one Replicate create per image, `retry_max=1`, parallel workers. See `prompts.json`.\n",
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

    def run_one(idx: int, job: ConceptJob) -> None:
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

    print(f"Wrote images to {OUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
