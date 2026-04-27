#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""Generate social / editorial post images for Yieldomega (Replicate openai/gpt-image-2).

Outputs to ``frontend/public/art/posts/`` as ``001.jpg`` … ``006.jpg`` (zero-padded id
matches the post list numbering).

Environment (same secret stack as ``generate_assets.py`` / ``issue57_batch.py``)::

  Set REPLICATE_API_TOKEN in the environment, or in a ``.env`` file (first match wins;
  later files fill unset keys only):
    - <repo>/.env
    - <repo>/scripts/replicate-art/.env
    - <repo>/frontend/.env
    - <repo>/frontend/.env.local

  Example line::
    REPLICATE_API_TOKEN=r8_xxxxxxxx

  Optional: REPLICATE_MAX_GENERATION_SECONDS (default 600) for other scripts; this batch defaults
  to ``--max-generation-seconds 300`` (5 minute poll cap per image) unless overridden.

Run::

  cd scripts/replicate-art
  .venv/bin/python -m pip install -r requirements.txt   # if needed
  .venv/bin/python posts_batch.py
  .venv/bin/python posts_batch.py --dry-run
  .venv/bin/python posts_batch.py --only 003 --exact
  .venv/bin/python posts_batch.py --skip-existing

Variety (read before extending the catalog)::

  When you add new post jobs, **vary visual density and format** across the set.
  Mix **dense infographics** (charts, diagrams, timelines, comparison panels) with
  **light narrative worldbuilding** (character moments, implied story, cinematic staging
  on blockie hills). Avoid six near-identical hero strips — alternate chart-heavy frames
  with mood-first scenes.

  **Typography rule (this script only):** jobs tagged ``infographic`` use a relaxed
  reference block so the model **must** add short headlines, section titles, and chart
  callouts (chunky cartoon type). Jobs tagged ``story`` keep the global art rule: **no**
  readable captions, speech bubbles, or slogans — pictorial storytelling only.

This batch encodes one concept per numbered post (001–006); edit ``POST_JOBS`` to
change prompts or aspect ratios.

**Recover outputs if the API succeeded but files were not written** (e.g. interrupted run)::

  One post (no image model call; only metadata + download)::

    .venv/bin/python posts_batch.py --pull-one 004,xykaha2bq9rmr0cxsvksjqf5w8

  All six in **post order** (001 first, 006 last)::

    .venv/bin/python posts_batch.py --pull-replicate-predictions 'id001,id002,...,id006'
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import generate_assets as ga  # noqa: E402

DEFAULT_POSTS_DIR = ga.REPO_ROOT / "frontend" / "public" / "art" / "posts"

REFERENCE_INSTRUCTIONS_INFOGRAPHIC = """
CRITICAL — infographic typography: this job is a marketing chart/poster, not a silent key-art still. You MUST render clearly readable English words as chunky cartoon lettering (headlines, panel titles, chart callouts). An image with no on-picture text is wrong for this task. Keep labels short and scannable like a game HUD; no watermarks, no dense paragraphs, no fake fine print.

Reference images are supplied as input_images in this exact order:
(1) style.png — preserve its core character design language and worldbuilding: adult yet playful bunny leprechaun girl mascot (clearly adult, non-minor), red-bearded leprechauns, bright green-and-gold fantasy wardrobe, thick dark outlines, glossy toy-like shading, cheerful magical arcade energy, voxel-like hills, rainbow/sparkle accents, and chunky collectible coin aesthetics. Keep the same brand universe, mascot types, and overall visual identity.
(2) token-logo.png — use as the canonical emblem/style reference for hat-token details: green leprechaun hat, yellow band, chunky yellow D buckle, thick black outlines, circular badge feel.

Important balance: keep the characters, costume language, palette, token motif, and overall aesthetic clearly consistent with the references, but do not make a direct edit or near-duplicate of the reference image. Change the composition, camera angle, staging, pose, layout, and scene arrangement while keeping the same brand identity.

Typography checklist: at minimum one bold headline across the top, short section titles for panels or columns, micro-labels on chart elements or callouts (single words or 2–3 word phrases), and where useful small numeric ticks on axes (e.g. min/max). Use thick rounded arcade cartoon letterforms with high contrast fills and dark outlines.
""".strip()


def build_infographic_post_prompt(subject: str) -> str:
    """Like ``generate_assets.build_prompt`` but allows marketing type on-chart."""
    return (
        f"{ga.STYLE_GUIDE}\n\n"
        f"{REFERENCE_INSTRUCTIONS_INFOGRAPHIC}\n\n"
        f"Consistency requirement:\n"
        f"Stay close to the reference brand identity: same mascot archetypes, same green-and-gold fantasy styling, "
        f"same cheerful blocky arcade-cartoon finish, same glossy collectible token language, and same high-saturation magical tone.\n\n"
        f"Originality requirement:\n"
        f"Generate a new composition with distinct staging and layout. "
        f"The result should feel like another official campaign infographic, not a repaint of the reference images.\n\n"
        f"Subject and composition:\n{subject.strip()}\n\n"
        f"Strictly avoid:\n{ga.NEGATIVE_GUIDE}"
    )


def build_story_post_prompt(subject: str) -> str:
    """Standard brand prompt: no captions or speech-bubble copy (pictorial only)."""
    return ga.build_prompt(subject)


def _parse_prediction_id(raw: str) -> str:
    s = raw.strip()
    m = re.search(r"replicate\.com/p/([a-z0-9]+)", s, re.I)
    if m:
        return m.group(1)
    if re.fullmatch(r"[a-z0-9]+", s, re.I):
        return s
    raise ValueError(f"Could not parse prediction id from: {raw!r}")


def _output_url(pred: object) -> str:
    out = getattr(pred, "output", None)
    if out is None:
        raise RuntimeError("Prediction has no output.")
    if isinstance(out, list):
        if not out:
            raise RuntimeError("Prediction output is an empty list.")
        out = out[0]
    if isinstance(out, str) and out.startswith("http"):
        return out
    url = getattr(out, "url", None)
    if isinstance(url, str) and url.startswith("http"):
        return url
    raise RuntimeError(f"Unexpected prediction.output type: {type(out)!r}")


def _bytes_image_ext(data: bytes) -> str:
    if len(data) >= 3 and data[:3] == b"\xff\xd8\xff":
        return "jpg"
    if len(data) >= 8 and data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    return "jpg"


def _download_url(url: str, *, job_label: str) -> bytes:
    last: BaseException | None = None
    for attempt in range(1, 6):
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "yieldomega-posts-batch/1.0"},
            )
            with urllib.request.urlopen(req, timeout=300) as resp:
                data = resp.read()
            if len(data) < 512:
                raise RuntimeError(f"short download: {len(data)} bytes")
            return data
        except (urllib.error.URLError, TimeoutError, OSError, RuntimeError) as exc:
            last = exc
            if attempt >= 5:
                break
            wait = min(45.0, 3.0 * attempt)
            print(
                f"[{job_label}] GET failed ({exc!r}); retry {attempt}/5 in {wait:.0f}s",
                file=sys.stderr,
            )
            time.sleep(wait)
    assert last is not None
    raise last


def pull_replicate_predictions_to_posts(csv: str, out_dir: Path) -> int:
    """Write ``001.*`` … from succeeded Replicate prediction ids (post order)."""
    raw_ids = [x.strip() for x in csv.split(",") if x.strip()]
    if len(raw_ids) != len(POST_JOBS):
        print(
            f"Error: --pull-replicate-predictions needs exactly {len(POST_JOBS)} "
            f"comma-separated ids (001 order first); got {len(raw_ids)}.",
            file=sys.stderr,
        )
        return 1
    ga.load_env()
    token = os.environ.get("REPLICATE_API_TOKEN", "").strip()
    if not token:
        print("REPLICATE_API_TOKEN is not set (needed to fetch prediction metadata).", file=sys.stderr)
        return 2
    os.environ["REPLICATE_API_TOKEN"] = token

    import replicate

    client = replicate.Client()
    out_dir.mkdir(parents=True, exist_ok=True)

    for (stem, _aspect, _fmt, _bg, _frag, _kind), raw in zip(POST_JOBS, raw_ids):
        pid = _parse_prediction_id(raw)
        pred = client.predictions.get(pid)
        st = getattr(pred, "status", "")
        if st != "succeeded":
            print(f"Error: prediction {pid} status={st!r} (need succeeded).", file=sys.stderr)
            return 1
        url = _output_url(pred)
        print(f"[{stem}] pull {pid} …", file=sys.stderr)
        data = _download_url(url, job_label=stem)
        ext = _bytes_image_ext(data)
        out_path = out_dir / f"{stem}.{ext}"
        out_path.write_bytes(data)
        print(f"[ok] {out_path} ({len(data)} bytes)")

    return 0


def pull_one_post_from_replicate(spec: str, out_dir: Path) -> int:
    """Download a single succeeded prediction into ``{stem}.{jpg|png}`` (no model create)."""
    raw = spec.strip()
    if "," not in raw:
        print(
            "Error: --pull-one expects STEM,PREDICTION_ID (e.g. 004,xykaha2bq9rmr0cxsvksjqf5w8).",
            file=sys.stderr,
        )
        return 1
    stem, id_part = raw.split(",", 1)
    stem = stem.strip()
    id_part = id_part.strip()
    valid_stems = {j[0] for j in POST_JOBS}
    if stem not in valid_stems:
        print(f"Error: unknown post stem {stem!r}; expected one of {sorted(valid_stems)}.", file=sys.stderr)
        return 1

    ga.load_env()
    token = os.environ.get("REPLICATE_API_TOKEN", "").strip()
    if not token:
        print("REPLICATE_API_TOKEN is not set (needed to fetch prediction metadata).", file=sys.stderr)
        return 2
    os.environ["REPLICATE_API_TOKEN"] = token

    import replicate

    client = replicate.Client()
    out_dir.mkdir(parents=True, exist_ok=True)

    pid = _parse_prediction_id(id_part)
    pred = client.predictions.get(pid)
    st = getattr(pred, "status", "")
    if st != "succeeded":
        print(f"Error: prediction {pid} status={st!r} (need succeeded).", file=sys.stderr)
        return 1
    url = _output_url(pred)
    print(f"[{stem}] pull {pid} …", file=sys.stderr)
    data = _download_url(url, job_label=stem)
    ext = _bytes_image_ext(data)
    out_path = out_dir / f"{stem}.{ext}"
    out_path.write_bytes(data)
    print(f"[ok] {out_path} ({len(data)} bytes)")
    return 0


# (stem, aspect_ratio, output_format, background, subject_fragment, post_kind)
# post_kind: "infographic" → typography allowed; "story" → global no-text-in-image (build_prompt).
POST_JOBS: list[tuple[str, str, str, str, str, str]] = [
    (
        "001",
        "3:2",
        "jpeg",
        "opaque",
        (
            "SOCIAL POST VISUAL — dense infographic poster (not a photo). "
            "Theme: most bonding curves train a reflex of speed — in/out/repeat as abstract "
            "looping arrows and stopwatch motifs on the left. Contrast on the right with "
            "TimeCurve Arena: a structural idea that the player who stays longest has a fair "
            "reason to win. Show a bold diagram of a 'Short Clock Zone' as a highlighted "
            "segment on a chunky countdown ring or arena clock where extra time is visibly "
            "capped (ceiling arc). Connect paths with pictogram wallets and podium shapes. "
            "Adult bunny-leprechaun girl and red-bearded leprechaun as small icons in corners, "
            "not the whole frame. Editorial layout, strong grid, high information density, "
            "flat vector-like planes with thick outlines. "
            "Required on-image type (spell out legibly): big headline FAST IN / FAST OUT vs STAY TO WIN; "
            "subheads SHORT CLOCK ZONE and STRUCTURAL EDGE; tiny axis labels TIME and EDGE."
        ),
        "infographic",
    ),
    (
        "002",
        "3:2",
        "jpeg",
        "opaque",
        (
            "SOCIAL POST VISUAL — data-story editorial (medium density). "
            "Theme: most wallets drift out before the experience matures — not malice, "
            "just nothing rewarding staying. Show an abstract chart: many small shapes "
            "fading left along a downward stair or broken bridge, versus a single warm "
            "column or streak holding through on the right. "
            "Add empty podium plinths, a dull medal outline, and a dim tension wire on the "
            "left; on the right sparkles, a fuller podium, and a visible streak ribbon. "
            "Blockie hills as a thin lower band. Mascots tiny or absent. "
            "Required on-image type (spell out legibly): headline EARLY EXITS; chart callouts NO STREAK, NO PODIUM, NO TENSION "
            "on the weak side vs CONVICTION PAYS on the strong side; small axis labels PLAYERS and TIME."
        ),
        "infographic",
    ),
    (
        "003",
        "1:1",
        "jpeg",
        "opaque",
        (
            "SOCIAL POST VISUAL — light narrative worldbuilding (character-forward, low chart density). "
            "Theme: launch energy — 'sniper sharks' vs 'leprechaun token collectors' as two "
            "playstyles in the same blockie green hills. Left: a sleek cartoon shark mascot in "
            "playful tactical gear, circling above voxel water or coin shallows. Right: cheerful "
            "red-bearded leprechaun with a pot of glossy hat-coins and charm sparkles, relaxed stance. "
            "Split composition with a sunlit path between them; rainbow hint; both look competent, "
            "not evil vs good — different games. Adult bunny-leprechaun girl waving from a distant "
            "hill center as host. Cinematic, story moment, breathing room, not an infographic. "
            "No captions, speech bubbles, or overlaid lettering — communicate only through poses and scenery."
        ),
        "story",
    ),
    (
        "004",
        "2:3",
        "jpeg",
        "opaque",
        (
            "SOCIAL POST VISUAL — cozy story panel (light information, warm tableau). "
            "Theme: the patient path — leprechaun collectors not playing the sniper sprint; "
            "accumulating across the sale and redeeming when the clock hits zero. Interior or "
            "porch scene: red-bearded leprechaun at a wooden table with stacks of stylized "
            "charm tokens (glowing green discs), a small hourglass, and a chest suggesting "
            "doubloons; open window shows a distant chunky countdown clock in the hills. "
            "Adult bunny-leprechaun girl leaning in with a knowing smile, tea or map vibe. "
            "Soft lamp light, tactile props; clock face is pictorial only (no numerals). "
            "No captions, labels, or UI text."
        ),
        "story",
    ),
    (
        "005",
        "3:2",
        "jpeg",
        "opaque",
        (
            "SOCIAL POST VISUAL — high-density trust / mechanics explainer diagram. "
            "Theme: no blind trust — give every player a visible role, a visible clock, "
            "a visible reason to stay. Three tall columns as a triptych with large icons: "
            "(1) role silhouette with hat-coin badge shapes, (2) layered clock rings with "
            "clear segments and podium hooks, (3) anchor chain or bridge motif linking "
            "streak glow to podium. MegaETH suggested only as abstract emerald network nodes "
            "or gem lattice in the background — no logos or spelled chain names. "
            "Mascots appear as medium cutouts between columns. "
            "Required on-image type (spell out legibly): banner TRUST THROUGH VISIBILITY; column titles VISIBLE ROLE, "
            "VISIBLE CLOCK, REASON TO STAY; micro-tags READABLE, ON-CHAIN, FAIR."
        ),
        "infographic",
    ),
    (
        "006",
        "3:2",
        "jpeg",
        "opaque",
        (
            "SOCIAL POST VISUAL — wide celebratory key art (moderate detail, poster energy). "
            "Theme: clock hit zero — blockie green hills are alive with launch night. "
            "Central burst: giant stylized arena clock at zero with confetti and sparkles. "
            "Foreground: leprechaun collectors cheering with charm trails; midground: shark "
            "mascots already repositioning for the next play; background: voxel hills, rainbow "
            "arc, flying hat-coins. Adult bunny-leprechaun girl center-front welcoming the viewer. "
            "Inviting 'everyone in the room' mood — diverse silhouettes of fantasy participants. "
            "No captions, slogan lettering, speech bubbles, or numerals on the clock — pure celebration art."
        ),
        "story",
    ),
]


def main() -> int:
    p = argparse.ArgumentParser(description="Generate numbered post images under art/posts/")
    p.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_POSTS_DIR,
        help=f"Output directory (default: {DEFAULT_POSTS_DIR})",
    )
    p.add_argument("--style-ref", type=Path, default=ga.DEFAULT_STYLE_REF)
    p.add_argument("--token-ref", type=Path, default=ga.DEFAULT_TOKEN_REF)
    p.add_argument(
        "--quality",
        choices=("low", "medium", "high", "auto"),
        default="high",
        help="gpt-image-2 quality (default: high for social stills)",
    )
    p.add_argument(
        "--moderation",
        choices=("auto", "low"),
        default="low",
        help="gpt-image-2 moderation (default: low, aligned with other art batches)",
    )
    p.add_argument("--output-compression", type=int, default=90, metavar="PCT")
    p.add_argument(
        "--wait-seconds",
        type=int,
        default=1,
        help=(
            "Replicate Prefer: wait on create (1–60s). Default 1: return quickly and poll, "
            "avoiding long-held HTTP that proxies drop (which used to trigger duplicate creates)."
        ),
    )
    p.add_argument(
        "--retry-max",
        type=int,
        default=1,
        help="Outer create attempts per post (default 1 = no retry on failure).",
    )
    p.add_argument("--retry-delay", type=float, default=20.0)
    p.add_argument(
        "--max-generation-seconds",
        type=float,
        default=300.0,
        metavar="SEC",
        help="Wall-clock cap for polling each prediction (default 300 = 5 minutes).",
    )
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--no-ref-images", action="store_true")
    p.add_argument("--only", type=str, default="", help="Substring match on stem (001…006)")
    p.add_argument("--exact", action="store_true", help="With --only, match stem exactly")
    p.add_argument("--skip-existing", action="store_true")
    p.add_argument(
        "--pull-replicate-predictions",
        metavar="CSV",
        default="",
        help=(
            "Comma-separated succeeded prediction ids in post order (001 first, 006 last). "
            "Downloads bytes to art/posts/001.* … 006.* without calling the image model. "
            "Use when generations succeeded on Replicate but the local batch did not finish writing files."
        ),
    )
    p.add_argument(
        "--pull-one",
        metavar="STEM,ID",
        default="",
        help=(
            "Download one succeeded prediction into that post slot, e.g. "
            "004,xykaha2bq9rmr0cxsvksjqf5w8. No gpt-image-2 create call."
        ),
    )
    args = p.parse_args()

    args.wait_seconds = ga.clamp_prefer_wait(args.wait_seconds)

    out_dir = args.output_dir.resolve()
    if args.pull_one.strip() and args.pull_replicate_predictions.strip():
        print("Error: use either --pull-one or --pull-replicate-predictions, not both.", file=sys.stderr)
        return 1
    if args.pull_one.strip():
        return pull_one_post_from_replicate(args.pull_one, out_dir)
    if args.pull_replicate_predictions.strip():
        return pull_replicate_predictions_to_posts(args.pull_replicate_predictions, out_dir)

    ga.load_env()
    token = os.environ.get("REPLICATE_API_TOKEN", "").strip()
    if not args.dry_run and not token:
        print(
            "Error: REPLICATE_API_TOKEN is not set.\n"
            "Add it to .env (repo root, scripts/replicate-art/.env, or frontend/.env / .env.local)\n"
            "or export it in the shell. See docstring at top of posts_batch.py.",
            file=sys.stderr,
        )
        return 1
    if not args.dry_run:
        os.environ["REPLICATE_API_TOKEN"] = token

    only = args.only.strip().lower()
    ran = 0
    skipped = 0

    for stem, aspect, out_fmt, bg, fragment, kind in POST_JOBS:
        if only:
            s = stem.lower()
            if args.exact:
                if s != only:
                    continue
            elif only not in s:
                continue
        ext = ga.format_to_ext(ga.effective_output_format(out_fmt, bg))
        candidate = out_dir / f"{stem}.{ext}"
        if args.skip_existing and candidate.is_file() and candidate.stat().st_size >= 512:
            print(f"Skip existing: {candidate}")
            skipped += 1
            continue
        if kind == "infographic":
            custom_prompt = build_infographic_post_prompt(fragment)
        elif kind == "story":
            custom_prompt = build_story_post_prompt(fragment)
        else:
            raise ValueError(f"unknown post_kind {kind!r} for {stem}")

        ga.run_job(
            stem,
            aspect,
            out_fmt,
            bg,
            fragment,
            out_dir,
            args.style_ref,
            args.token_ref,
            args.quality,
            args.moderation,
            args.output_compression,
            args.wait_seconds,
            args.retry_max,
            args.retry_delay,
            args.dry_run,
            args.no_ref_images,
            custom_prompt=custom_prompt,
            max_wall_seconds=args.max_generation_seconds,
        )
        ran += 1

    print(f"Done. Ran {ran} job(s), skipped {skipped}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
