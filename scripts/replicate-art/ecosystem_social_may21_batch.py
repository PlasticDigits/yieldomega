#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""Three ecosystem comparison social images (2 infographic + 1 worldbuilding).

Uses openai/gpt-image-2 with typography baked into the generation — no local text overlay.
Runs all images in parallel with one Replicate create attempt per image (retry_max=1).
Uses an exclusive batch lock and ``prediction-ids.json`` so a second concurrent or restarted
run polls the same prediction instead of creating duplicates.

  cd scripts/replicate-art
  .venv/bin/python ecosystem_social_may21_batch.py --dry-run
  .venv/bin/python ecosystem_social_may21_batch.py
  .venv/bin/python ecosystem_social_may21_batch.py --resume   # skip existing PNGs; reuse ledger ids
"""

from __future__ import annotations

import argparse
import fcntl
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import generate_assets as ga  # noqa: E402


OUT_DIR = ga.DEFAULT_OUT / "gen_social" / "ecosystem-may21"
PREDICTION_IDS_PATH = OUT_DIR / "prediction-ids.json"
BATCH_LOCK_PATH = OUT_DIR / ".batch.lock"


@dataclass(frozen=True)
class EcosystemSocialJob:
    slug: str
    title: str
    kind: str  # "infographic" | "worldbuilding"
    concept: str
    subject: str


INFOGRAPHIC_REFERENCE = """
CRITICAL — infographic typography: this job is a finished marketing poster, not silent key art.
Render clearly readable English words as chunky arcade cartoon lettering: headline, panel labels,
arrows, badges, and short callouts. An image with no on-picture text is wrong. Keep text sparse,
large, high contrast, and scannable. All copy must appear in the generated image itself (gpt-image-2);
do not leave blank zones for post-processing text overlay. Do not add dense fine print, legal claims,
dates, prices, watermarks, or return/profit promises.

Reference images are supplied as input_images in this order:
(1) style.png — preserve the Yieldomega blocky arcade fantasy world, adult playful bunny-mascot mascot,
red-bearded mascots, green-gold palette, thick dark outlines, glossy toy depth, voxel hills, rainbow
accents, and magical arena energy.
(2) token-logo.png — use as canonical hat-token / DOUB-style coin language.
""".strip()


WORLDBUILDING_REFERENCE = """
Reference images are supplied as input_images in this order:
(1) style.png for the Yieldomega blocky arcade fantasy world, adult mascots, green-gold palette,
chunky outlines, glossy toy depth, and cheerful magical tone.
(2) token-logo.png for canonical hat-token details.

Text rule: this is worldbuilding / cinematic splash art, not an explainer. Use limited or no readable
text unless the subject explicitly asks for a diegetic sign or countdown numerals. Prefer symbols,
architecture, weapons, clocks, trails, energy, poses, and emotion over captions. No post-generation
text overlay.
""".strip()


def build_prompt(job: EcosystemSocialJob, *, using_refs: bool) -> str:
    if using_refs:
        reference_block = INFOGRAPHIC_REFERENCE if job.kind == "infographic" else WORLDBUILDING_REFERENCE
    else:
        reference_block = (
            "No reference images are available for this run. Follow the written Yieldomega style guide closely: "
            "blocky arcade fantasy, green-gold magical finance, glossy hat-token currency, adult playful mascots, "
            "thick outlines, and high-clarity staging. Render all infographic copy inside the image; no text overlay."
        )

    return f"""
{ga.STYLE_GUIDE}

{reference_block}

Accuracy constraints:
- TimeCurve is onchain. Each qualifying buy changes the round state.
- Default buy timer branch: +120 seconds, capped by the remaining-time cap.
- Hard-reset branch: when remaining time before the buy is below 13 minutes, the deadline snaps toward 15 minutes.
- WarBow is Battle Points PvP: buys can earn BP, flag planting is opt-in, and steal/guard/revenge are distinct CL8Y-burn actions.
- Reserve podium categories: Last Buy, WarBow (top Battle Points), Defended Streak, Time Booster.
- Do not imply guaranteed returns, guaranteed wins, legal advice, or offchain authority.
- Characters must be adult mascots or adult player avatars.
- Pump.fun / meme-launch comparisons are illustrative contrast only — no ticker spam, no real Pump.fun logo or branding.

Concept brief:
{job.concept.strip()}

Image mode: {job.kind}
Image title: {job.title}

Subject and composition:
{job.subject.strip()}

Strictly avoid:
{ga.NEGATIVE_GUIDE}
""".strip()


def jobs() -> list[EcosystemSocialJob]:
    return [
        EcosystemSocialJob(
            slug="01-pumpfun-end-fast-yieldomega-evolves",
            title="Pump.fun Ends Fast — Yieldomega Evolves",
            kind="infographic",
            concept=(
                "Two-stage crypto ecosystem comparison: quick meme launch that pops and collapses versus "
                "Yieldomega's evolving onchain arena with timers, WarBow, podium rewards, and long-term loops."
            ),
            subject="""
Wide 3:2 finished infographic poster, split comparison layout. Top headline text exactly: "PUMPFUN ENDS FAST / YIELDOMEGA EVOLVES".
Left column title: "QUICK LAUNCH". Show a stylized Pump.fun-like meme coin rocket launching from a conveyor,
instantly exploding into scattered hat-tokens, empty charts, and adult trader silhouettes walking away bored or panicked.
Right column title: "EVOLVING ARENA". Show Yieldomega's glowing green-gold onchain arena: visible countdown timers,
WarBow energy arcs, podium pedestals with four small category badges (Last Buy, WarBow, Defended Streak, Time Booster),
players strategizing around timer extensions and pressure waves. Footer micro-labels: "flash liquidity" left,
"long-term gameplay loops" right. Clean modern infographic arrows between stages, chunky readable cartoon typography,
high contrast, no fine print.
""",
        ),
        EcosystemSocialJob(
            slug="02-traditional-meme-launch-vs-timecurve",
            title="Traditional Meme Launch vs TimeCurve",
            kind="infographic",
            concept=(
                "Side-by-side product education board contrasting straight buy/sell dump behavior with TimeCurve "
                "timer extensions, player interactions, podium system, WarBow, defended streaks, and pressure mechanics."
            ),
            subject="""
Wide 3:2 side-by-side infographic poster, clean modern layout. Left panel headline exactly: "TRADITIONAL MEME LAUNCH".
Show straight vertical buy and sell arrows, a price line spiking then cliff-dumping, bored or fleeing traders, and a
small label "dump cycle". Right panel headline exactly: "TIMECURVE". Show an onchain arena timer with +120s extension
callout, player interaction nodes (buy press, crowd reactions), four podium slots labeled "Last Buy", "WarBow",
"Defended Streak", "Time Booster", a glowing WarBow silhouette, defended streak shield icon, and concentric pressure-wave rings
with label "arena pressure". Use readable arrows, badges, and short callouts; integrated chunky arcade typography;
lots of whitespace; green-gold Yieldomega palette on the right, muted gray-red stress on the left. No dates, prices,
or guaranteed-win language.
""",
        ),
        EcosystemSocialJob(
            slug="03-yieldomega-feels-like-a-game",
            title="Yieldomega Feels Like A Game",
            kind="worldbuilding",
            concept=(
                "Vibrant contrast: excited players inside a fantasy esports arena reacting to timers, WarBow, and "
                "leaderboard shifts versus bored traders refreshing flat meme coin charts."
            ),
            subject="""
Wide 3:2 cinematic worldbuilding split scene (diagonal or hard vertical divide, not a text-heavy infographic).
Foreground right: adult players inside a fantasy esports TimeCurve arena — reacting to a giant countdown timer,
a glowing WarBow shot streaking past, leaderboard hologram tiles shifting ranks, strategic buy gestures on a pedestal,
emerald-gold energy, cheers and focus faces, glossy arcade materials.
Foreground left: muted office-nook traders slumped before flat meme-coin chart screens stuck on sideways red-green lines,
one refreshing a phone, bored expressions, desaturated cool grays versus the arena's vibrant green-gold excitement.
Strong visual contrast between excitement and monotony. No headline slogans, no multi-panel explainer text, no speech
bubbles; at most one small diegetic arena clock numerals if needed. No profit promises.
""",
        ),
    ]


@contextmanager
def _exclusive_batch_lock():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(BATCH_LOCK_PATH, "w", encoding="utf-8") as lock_fp:
        try:
            fcntl.flock(lock_fp.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            raise SystemExit(
                "Another ecosystem_social_may21_batch.py run holds the batch lock. "
                "Wait for it to finish or remove a stale lock only if no process is running."
            ) from exc
        try:
            yield
        finally:
            fcntl.flock(lock_fp.fileno(), fcntl.LOCK_UN)


def write_manifest(selected: list[EcosystemSocialJob], *, using_refs: bool) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {
        "model": ga.MODEL,
        "output_dir": str(OUT_DIR.relative_to(ga.REPO_ROOT)),
        "text_in_image_only": True,
        "local_text_overlay": False,
        "prediction_ids_path": str(PREDICTION_IDS_PATH.relative_to(ga.REPO_ROOT)),
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
                "full_prompt": build_prompt(job, using_refs=using_refs),
            }
            for job in selected
        ],
    }
    (OUT_DIR / "prompts.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    (OUT_DIR / "README.md").write_text(
        "# Ecosystem comparison social (May 21)\n\n"
        "Generated with `scripts/replicate-art/ecosystem_social_may21_batch.py` — "
        "one Replicate create per image, parallel workers, exclusive batch lock, "
        "`prediction-ids.json` ledger (no duplicate creates on re-run), typography from gpt-image-2 only "
        "(no local overlay). See `prompts.json`.\n",
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Write manifest and print prompts; no API calls")
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Skip slugs that already have a PNG; reuse prediction-ids.json for in-flight jobs",
    )
    args = parser.parse_args()

    ga.load_env()
    token = os.environ.get("REPLICATE_API_TOKEN", "").strip()

    selected = jobs()
    using_refs = ga.DEFAULT_STYLE_REF.is_file() and ga.DEFAULT_TOKEN_REF.is_file()
    write_manifest(selected, using_refs=using_refs)

    if args.dry_run:
        print(f"[dry-run] manifest: {OUT_DIR / 'prompts.json'}")
        print(f"[dry-run] reference images: {'yes' if using_refs else 'no'}")
        for idx, job in enumerate(selected, start=1):
            print(f"\n{'=' * 72}\n[{idx}/{len(selected)}] {job.slug} ({job.kind})\n{'=' * 72}\n")
            print(build_prompt(job, using_refs=using_refs))
        return 0

    if not token:
        print("REPLICATE_API_TOKEN unset.", file=sys.stderr)
        return 1
    os.environ["REPLICATE_API_TOKEN"] = token

    existing = [OUT_DIR / f"{job.slug}.png" for job in selected if (OUT_DIR / f"{job.slug}.png").exists()]
    if existing and not args.resume:
        print(
            "Refusing to run with existing PNG outputs; remove them first for a fresh one-attempt set "
            "or pass --resume to skip finished slugs.",
            file=sys.stderr,
        )
        for path in existing:
            print(f"  existing: {path}", file=sys.stderr)
        return 2

    prefer_wait = ga.clamp_prefer_wait(1)
    to_run: list[tuple[int, EcosystemSocialJob]] = []
    for idx, job in enumerate(selected, start=1):
        if (OUT_DIR / f"{job.slug}.png").is_file():
            print(f"[{idx}/{len(selected)}] {job.slug} exists; --resume skipping create")
            continue
        to_run.append((idx, job))

    if not to_run:
        print("All outputs already present; nothing to generate.")
        return 0

    def run_one(idx: int, job: EcosystemSocialJob) -> None:
        print(f"[{idx}/{len(selected)}] {job.slug} ({job.kind})", flush=True)
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
            prefer_wait,
            1,
            20.0,
            False,
            not using_refs,
            custom_prompt=build_prompt(job, using_refs=using_refs),
            max_wall_seconds=float(os.environ.get("REPLICATE_MAX_GENERATION_SECONDS", "900")),
            poll_progress=True,
            log_monitor=True,
            ledger_path=PREDICTION_IDS_PATH,
            ledger_key=job.slug,
        )

    with _exclusive_batch_lock():
        with ThreadPoolExecutor(max_workers=len(to_run)) as executor:
            futures = {executor.submit(run_one, idx, job): job.slug for idx, job in to_run}
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
