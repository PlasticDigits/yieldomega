#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""
Generate Yieldomega art assets via Replicate (openai/gpt-image-2).

Reference images (recommended for consistent style):
  <repo>/frontend/public/art/style.png       — full-scene style anchor
  <repo>/frontend/public/art/token-logo.png — hat + D token emblem for coins/UI

Authentication:
  Set REPLICATE_API_TOKEN in the environment, or in a .env file (first match wins; later files
  fill in keys that are still unset):
    - Repository root:     <repo>/.env
    - This directory:      <repo>/scripts/replicate-art/.env
    - Frontend (optional): <repo>/frontend/.env
    - Frontend local:      <repo>/frontend/.env.local

  Example .env line:
    REPLICATE_API_TOKEN=r8_xxxxxxxx

  (.env* under repo are gitignored for secrets — never commit tokens.)

Usage:
  cd scripts/replicate-art
  python3 -m venv .venv && source .venv/bin/activate
  pip install -r requirements.txt
  python generate_assets.py
  python generate_assets.py --dry-run
  python generate_assets.py --only hero-home --exact
  python generate_assets.py --background opaque   # override catalog (auto|transparent|opaque)

Reference images that false-trigger Replicate moderation (see logs) can be excluded via
  scripts/replicate-art/replicate_flagged_inputs.json — use flagged_inputs.py add/remove.

Replicate limits Prefer: wait to 1-60 seconds; use --wait-seconds in that range (default 60).
Polling is capped by REPLICATE_MAX_GENERATION_SECONDS (default 600); overdue runs are canceled.

Slow image generation still completes via the client polling loop until that cap.

When the catalog asks for background=transparent, the Replicate model is called with opaque output
plus a flat #FF00FF chroma screen in the prompt; magenta is removed locally so PNGs still get alpha.
"""

from __future__ import annotations

import argparse
import os
import random
import sys
import time
from pathlib import Path
from typing import Callable, TypeVar

try:
    import httpx
except ImportError:
    httpx = None  # type: ignore[misc, assignment]

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None  # type: ignore[misc, assignment]

import flagged_inputs as _flagged_inputs
import replicate_bounded_run as _bounded

# --- Shared style (applies to every image) ------------------------------------

STYLE_GUIDE = """
Create artwork in a bright blocky arcade-cartoon mascot style. Use chunky geometric forms, clean vector-like edges, thick dark outlines, glossy highlights, toy-like depth, and high visual clarity. The world should feel like a polished mobile game promo mixed with retro arcade fantasy. Use saturated greens, golds, blues, and rainbow accents with strong contrast and a cheerful magical atmosphere. Characters should be cute, expressive, and simplified, with rounded faces, bold silhouettes, and playful exaggerated poses. Coins and tokens should look embossed, shiny, and collectible, like premium game currency. Backgrounds should use stacked blocky hills, soft clouds, sparkles, and simple layered scenery that supports the characters without clutter. Overall look should be crisp, clean, colorful, polished, readable, and energetic.
""".strip()

NEGATIVE_GUIDE = """
no realism, no painterly texture, no muted palette, no gritty rendering, no photorealism, no messy composition, no thin outlines, no low contrast, no dull lighting, no horror elements, no blurry details, no complex background clutter, no anatomical realism, no rough sketch style, no VHS filter, no film grain
""".strip()

REFERENCE_INSTRUCTIONS = """
Reference images are supplied as input_images in this exact order:
(1) style.png — preserve its core character design language and worldbuilding: adult yet playful bunny leprechaun girl mascot (clearly adult, non-minor), red-bearded leprechauns, bright green-and-gold fantasy wardrobe, thick dark outlines, glossy toy-like shading, cheerful magical arcade energy, voxel-like hills, rainbow/sparkle accents, and chunky collectible coin aesthetics. Keep the same brand universe, mascot types, and overall visual identity.
(2) token-logo.png — use as the canonical emblem/style reference for hat-token details: green leprechaun hat, yellow band, chunky yellow D buckle, thick black outlines, circular badge feel. For any coins, tokens, badges, or currency icons, keep them closely aligned to this emblem design language and finish.
(3) some jobs may include an extra character/logo reference image — when present, preserve that character's recognizable silhouette, face shape, and key identity markers while translating it fully into the same Yieldomega blocky arcade cartoon universe.

Important balance: keep the characters, costume language, palette, token motif, and overall aesthetic clearly consistent with the references, but do not make a direct edit or near-duplicate of the reference image. Change the composition, camera angle, staging, pose, layout, and scene arrangement while keeping the same brand identity. Do not render readable text, letters beyond the stylized D buckle motif on token emblems, watermarks, or UI chrome in the output image.
""".strip()

MODEL = "openai/gpt-image-2"

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT = REPO_ROOT / "frontend" / "public" / "art"
DEFAULT_STYLE_REF = DEFAULT_OUT / "style.png"
DEFAULT_TOKEN_REF = DEFAULT_OUT / "token-logo.png"
# Legacy gorilla ref used by some catalog jobs; production Sir product card is `art/sir-card.png` below.
DEFAULT_SIR_CARD_REF = REPO_ROOT / "frontend" / "public" / "sir.png"
# Partner-approved production marketing cards (Kumbaya DEX + Sir venue); see partner_card_refresh.py
DEFAULT_KUMBAYA_CARD_REF = REPO_ROOT / "frontend" / "public" / "art" / "kumbaya-card.jpg"
DEFAULT_SIR_PRODUCTION_CARD_REF = REPO_ROOT / "frontend" / "public" / "art" / "sir-card.png"

# Replicate only allows Prefer: wait between 1 and 60 seconds. Longer generations
# still complete: the Python client polls prediction.reload() until a terminal state.
REPLICATE_PREFER_WAIT_MAX = 60

# gpt-image-2 output_format enum: png | jpeg | webp
OutputFmt = str
BackgroundMode = str  # "auto" | "transparent" | "opaque"


def clamp_prefer_wait(seconds: int) -> int:
    return max(1, min(REPLICATE_PREFER_WAIT_MAX, seconds))


def format_to_ext(output_format: str) -> str:
    if output_format == "jpeg":
        return "jpg"
    if output_format == "webp":
        return "webp"
    return "png"


def effective_output_format(output_format: str, background: str) -> str:
    """JPEG cannot carry alpha; force PNG when the API is asked for a transparent background."""
    if background == "transparent" and output_format == "jpeg":
        return "png"
    return output_format


# Replicate openai/gpt-image-2 may reject background="transparent" (invalid_value). Use a flat
# chroma screen in the prompt + opaque API mode, then strip the key color in postprocess.
CHROMA_KEY_RGB = (255, 0, 255)
CHROMA_KEY_TOLERANCE = 52


def api_background_for_replicate(catalog_background: BackgroundMode) -> str:
    if catalog_background == "transparent":
        return "opaque"
    return catalog_background


def augment_prompt_chroma_backdrop(built_prompt: str) -> str:
    return (
        built_prompt
        + "\n\nChroma backdrop requirement:\n"
        "Place all subjects on a perfectly flat, uniform magenta (#FF00FF) backdrop only—no gradients, "
        "no floor plane, no horizon, no scenery. Do not use #FF00FF on characters, clothing, coins, props, "
        "or rainbow bands that blend into the backdrop."
    )


def postprocess_chroma_to_transparent(data: bytes) -> bytes:
    """Turn flat chroma (#FF00FF) from the model into alpha; output PNG bytes."""
    try:
        import io

        from PIL import Image
    except ImportError:
        return data
    im = Image.open(io.BytesIO(data)).convert("RGBA")
    kr, kg, kb = CHROMA_KEY_RGB
    tol = CHROMA_KEY_TOLERANCE
    keyed = [
        (0, 0, 0, 0)
        if abs(r - kr) <= tol and abs(g - kg) <= tol and abs(b - kb) <= tol
        else (r, g, b, a)
        for (r, g, b, a) in im.getdata()
    ]
    im.putdata(keyed)
    buf = io.BytesIO()
    im.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def build_prompt(subject: str) -> str:
    return (
        f"{STYLE_GUIDE}\n\n"
        f"{REFERENCE_INSTRUCTIONS}\n\n"
        f"Consistency requirement:\n"
        f"Stay close to the reference brand identity: same mascot archetypes, same green-and-gold fantasy styling, "
        f"same cheerful blocky arcade-cartoon finish, same glossy collectible token language, and same high-saturation magical tone.\n\n"
        f"Originality requirement:\n"
        f"Generate a new composition with distinct staging, distinct character poses, and a distinct environment layout. "
        f"The result should feel like another official scene from the same campaign, not a repaint, direct edit, or near-duplicate of the reference images.\n\n"
        f"Subject and composition:\n{subject.strip()}\n\n"
        f"Strictly avoid:\n{NEGATIVE_GUIDE}"
    )


def build_partner_card_refresh_prompt(*, which: str, subject_notes: str = "") -> str:
    """Prompt for re-rendering partner-approved cards: same layout/characters, better pixels + DOUB emblem.

    Reference order sent to the API: style.png, token-logo.png, then the current production card image.
    """
    return (
        "Partner-approved third-party card refresh — same scene and character beats as the supplied card image; "
        "higher quality re-render, not a redesign.\n\n"
        "CRITICAL — keep the approved composition:\n"
        "- The last reference in input_images is the current production card. Preserve the same character identities, "
        "poses, expressions, and relationships; the same key props, horizon, and overall layout. "
        "Do not add or remove characters, do not change the story moment, and do not move the camera to a new angle or crop.\n"
        "- Minor cleanup (sharper edges, more consistent line weight, better coin embossing) is expected; large layout drift is not.\n\n"
        "Brand and Doubloon (DOUB) mark:\n"
        "- The first two references (style.png, then token-logo.png) are canonical for world tone and the coin emblem. "
        "On every coin face, token, or shield plaque, use the same stylized D / hat-buckle design language as token-logo.png. "
        "No misspelled wordmarks, no different letter shapes, and no extra readable text beyond the stylized D motif where a coin or badge should appear.\n\n"
        f"Card / venue: {which}.\n"
        f"{subject_notes.strip()}\n\n"
        f"Strictly avoid:\n{NEGATIVE_GUIDE}"
    )


def _is_capacity_like_error(exc: BaseException) -> bool:
    """Heuristic: retry on rate limits, overload, capacity, and transient network faults."""
    if isinstance(exc, TimeoutError):
        return False
    text = f"{type(exc).__name__}: {exc!s}".lower()
    if any(
        n in text
        for n in (
            "invalid_value",
            "image_generation_user_error",
            "transparent background is not supported",
        )
    ):
        return False
    needles = (
        "429",
        "503",
        "502",
        "504",
        "capacity",
        "rate limit",
        "too many requests",
        "overloaded",
        "unavailable",
        "try again",
        "busy",
        "throttl",
        "temporar",
        "high usage",
        "at capacity",
        "remoteprotocolerror",
        "disconnected",
        "connection reset",
        "connection aborted",
        "timeout",
        "timed out",
        "eof",
        # OpenAI / proxy flakes (Replicate surfaces these as ModelError)
        "server_error",
        "server had an error",
        "failed to generate",
    )
    return any(n in text for n in needles)


T = TypeVar("T")


def run_with_retries(
    fn: Callable[[], T],
    *,
    max_attempts: int,
    base_delay_sec: float,
    job_label: str,
) -> T:
    last: BaseException | None = None
    for attempt in range(max_attempts):
        try:
            return fn()
        except Exception as e:
            last = e
            if attempt >= max_attempts - 1 or not _is_capacity_like_error(e):
                raise
            wait = base_delay_sec * (2**attempt) + random.uniform(0.0, 4.0)
            print(
                f"[{job_label}] capacity/rate ({e!s}); retry {attempt + 2}/{max_attempts} in {wait:.0f}s…",
                file=sys.stderr,
            )
            time.sleep(wait)
    assert last is not None
    raise last


# Jobs: name, aspect_ratio (gpt-image-2: 1:1 | 3:2 | 2:3), output_format (png|jpeg|webp),
#       background (auto|transparent|opaque), subject.
# Former 16:9 heroes use 3:2 (widest ratio supported by the model).
JOBS: list[tuple[str, str, OutputFmt, BackgroundMode, str]] = [
    (
        "timecurve-doubloon-launch",
        "3:2",
        "jpeg",
        "opaque",
        "TimeCurve Doubloon launch banner: wide arcade fantasy sale arena. Left: stylized upward curve and stepped platforms suggesting minimum buy rising over time. Center: giant magical countdown ring or chunky clock face with extra segments lighting up when buys extend time, capped by a visible ceiling arc so time cannot grow forever. Adult yet playful bunny leprechaun girl and red-bearded leprechaun mascots at a cheerful kiosk handing over stacks of glossy green-gold stable-style coins between a visible low floor and a higher ceiling bar suggesting min buy and per-purchase cap. Flowing charm-glow ribbons from spend toward a mountain of glossy Doubloon hat-tokens using the token-logo hat and D buckle emblem on coins. Colorful ribbon streams split toward separate treasure chests and vaults hinting at fee sinks. Right: three podium blocks with trophy hat-coins for abstract prize categories. Distant sunrise and sunset arches suggesting opening and closing windows. Rainbow sparkles, voxel hills, energetic horizontal composition, hero negative space, no readable text or numbers, no UI chrome",
    ),
    (
        "hero-home",
        "3:2",
        "jpeg",
        "opaque",
        "Homepage hero banner: adult yet playful bunny leprechaun girl mascot centered, smiling and playful, white rabbit ears, green fantasy dress, red-bearded leprechauns with green hats on both sides carrying bags of glossy hat-coins, rainbow arc, sparkles, voxel hills, treasure field, high energy landing page art, leave clear negative space for UI overlays at top",
    ),
    (
        "hero-home-wide",
        "3:2",
        "jpeg",
        "opaque",
        "Extra wide feeling website hero: adult yet playful bunny leprechaun girl mascot in foreground, two red-bearded leprechauns flanking the mascot, flying hat-coins, chunky cube landscape, bright sky, rainbow, strong horizontal composition with breathing room on left and right for nav and CTAs",
    ),
    (
        "mascot-bunny-leprechaun-full",
        "2:3",
        "png",
        "transparent",
        "Full body adult yet playful bunny leprechaun girl mascot, facing slightly toward camera, confident friendly pose, green and gold outfit, rabbit ears, alpha background, character cutout quality for UI compositing, centered, no text",
    ),
    (
        "mascot-bunny-leprechaun-wave",
        "2:3",
        "png",
        "transparent",
        "Full body adult yet playful bunny leprechaun girl mascot waving toward the viewer, playful arcade game host pose, green dress, white gloves, rabbit tail, alpha background, character cutout quality, centered, no text",
    ),
    (
        "mascot-redbeard-leprechaun",
        "2:3",
        "png",
        "transparent",
        "Full body red-bearded leprechaun mascot, big green hat, cheerful grin, carrying a sack of glossy hat-coins, chunky cartoon proportions, alpha background, character cutout quality, centered, no text",
    ),
    (
        "mascot-redbeard-leprechaun-cheer",
        "2:3",
        "png",
        "transparent",
        "Full body red-bearded leprechaun mascot cheering with one hand up and one bag of coins, arcade fantasy merchant vibe, alpha background, character cutout quality, centered, no text",
    ),
    (
        "hat-coin-front",
        "1:1",
        "png",
        "transparent",
        "Single gold collectible coin, front facing, use token-logo hat+D emblem in the center, glossy embossed highlights, UI icon quality, centered, no extra coins, no text, transparent background behind the coin",
    ),
    (
        "hat-coin-stack",
        "1:1",
        "png",
        "transparent",
        "Small stack of glossy gold hat-tokens, front three quarter view, token-logo emblem visible on top coin, game reward icon, centered composition, no text, transparent background",
    ),
    (
        "hat-coin-rain",
        "1:1",
        "png",
        "transparent",
        "Cluster of floating glossy hat-token coins raining downward, dynamic arcade reward burst, token-logo style emblems, centered composition, no text, transparent background",
    ),
    (
        "rabbit-treasury-card",
        "3:2",
        "jpeg",
        "opaque",
        "Rabbit Treasury feature illustration: cute white rabbit mascot near treasure vault, green and gold coin piles, chunky cube cliffs, cheerful premium treasure room mood, clean marketing card composition, no text",
    ),
    (
        "collection-card",
        "3:2",
        "jpeg",
        "opaque",
        "Leprechaun collection feature art: lineup of adult yet playful bunny leprechaun girl and red-bearded leprechauns like a collectible character roster, rainbow sparkles, display card composition, no text",
    ),
    (
        "referrals-card",
        "3:2",
        "jpeg",
        "opaque",
        "Referrals feature art: mascots passing glowing hat-coins between each other like combo bonus rewards, friendly teamwork energy, cube background, clean marketing card, no text",
    ),
    (
        "kumbaya-card",
        "3:2",
        "jpeg",
        "opaque",
        "Liquidity pool feature art: glossy green and gold streams flowing into a magical pool or cauldron, hat-coins orbiting, playful fantasy finance, stylized not realistic, no text",
    ),
    (
        "sir-card",
        "3:2",
        "png",
        "opaque",
        "Trading arena feature art: SIRDoub gorilla mascot behind the counter as the main merchant, using the supplied gorilla logo reference translated into the same bright Yieldomega blocky arcade cartoon style, with a black top hat with gold band (not a green leprechaun hat) and fantasy marketkeeper presentation, plus a smaller red-bearded leprechaun customer at the counter, green gold banners, hat-coin trophies, bold readable shapes, fantasy not gritty, no text",
    ),
    (
        "bg-voxel-hills",
        "3:2",
        "jpeg",
        "opaque",
        "Environment background only, no characters: bright voxel cube hills, blue sky, soft blocky clouds, rainbow fragments, gentle treasure glow, usable as a website section background, simple layered scenery, no text",
    ),
    (
        "bg-coins-and-stars",
        "3:2",
        "jpeg",
        "opaque",
        "Decorative background only, no characters: flying hat-coins, sparkles, stars, soft cube shapes, bright emerald and gold palette, suitable behind UI cards, uncluttered, no text",
    ),
    (
        "loading-mascot",
        "1:1",
        "png",
        "transparent",
        "Adult yet playful bunny leprechaun girl mascot holding a glowing hat-coin and smiling, compact loading-state sticker composition, centered, no text, transparent background",
    ),
    (
        "app-icon",
        "1:1",
        "png",
        "transparent",
        "App icon: single glossy gold coin with green leprechaun hat emblem matching token-logo (yellow D buckle), tiny rainbow sparkle accents, bold centered composition, readable at small size, no letters besides the stylized D on the buckle, no watermark, transparent background outside the round icon",
    ),
    (
        "opengraph",
        "3:2",
        "jpeg",
        "opaque",
        "Social link preview / Open Graph card for messaging apps and X: wide landscape, bold readable composition safe for center crops. Adult yet playful bunny leprechaun girl mascot and red-bearded leprechauns, glossy hat-coins, rainbow, voxel hills, bright arcade fantasy promo energy, strong focal cluster in the middle third for Telegram and Twitter thumbnail framing, generous sky and ground bands, no readable text, no logos spelled out, no UI chrome, no watermarks",
    ),
]


def load_env() -> None:
    art_dir = Path(__file__).resolve().parent
    if load_dotenv:
        load_dotenv(REPO_ROOT / ".env")
        load_dotenv(art_dir / ".env")
        load_dotenv(REPO_ROOT / "frontend" / ".env")
        load_dotenv(REPO_ROOT / "frontend" / ".env.local")


def _read_output_bytes(output: object) -> bytes:
    """Normalize Replicate FileOutput / list / iterator."""
    first = output[0] if isinstance(output, (list, tuple)) else output
    if hasattr(first, "read"):
        data = first.read()
        if isinstance(data, bytes):
            return data
        raise RuntimeError(f"read() did not return bytes: {type(data)}")
    raise RuntimeError(f"Unexpected output type: {type(first)}")


def ref_paths_for_job(name: str, style_ref: Path, token_ref: Path) -> list[Path]:
    refs = [style_ref, token_ref]
    if name == "sir-card" and DEFAULT_SIR_CARD_REF.is_file():
        refs.append(DEFAULT_SIR_CARD_REF)
    return _flagged_inputs.filter_reference_paths(refs, REPO_ROOT, job_label=name)


def run_job(
    name: str,
    aspect_ratio: str,
    output_format: OutputFmt,
    background: BackgroundMode,
    subject: str,
    out_dir: Path,
    style_ref: Path,
    token_ref: Path,
    quality: str,
    moderation: str,
    output_compression: int,
    prefer_wait: int,
    retry_max: int,
    retry_delay_sec: float,
    dry_run: bool,
    no_refs: bool,
    *,
    custom_prompt: str | None = None,
    ref_paths_override: list[Path] | None = None,
    max_wall_seconds: float | None = None,
    log_monitor: bool = False,
    poll_progress: bool = False,
) -> Path | None:
    catalog_bg = background
    if custom_prompt is not None:
        prompt = custom_prompt
    else:
        prompt = build_prompt(subject)
    if catalog_bg == "transparent":
        prompt = augment_prompt_chroma_backdrop(prompt)
    api_bg = api_background_for_replicate(catalog_bg)
    out_fmt = effective_output_format(output_format, catalog_bg)
    if out_fmt != output_format:
        print(
            f"[{name}] Note: transparent background requires PNG; using output_format=png "
            f"(catalog had {output_format}).",
            file=sys.stderr,
        )
    ext = format_to_ext(out_fmt)
    out_path = out_dir / f"{name}.{ext}"

    inp: dict = {
        "prompt": prompt,
        "aspect_ratio": aspect_ratio,
        "quality": quality,
        "background": api_bg,
        "moderation": moderation,
        "output_format": out_fmt,
        "number_of_images": 1,
        "output_compression": output_compression,
        "input_images": [],
    }

    if ref_paths_override is not None:
        ref_paths = _flagged_inputs.filter_reference_paths(
            [p.resolve() for p in ref_paths_override], REPO_ROOT, job_label=name
        )
    else:
        ref_paths = ref_paths_for_job(name, style_ref, token_ref)

    if dry_run:
        print(f"[dry-run] would write {out_path}")
        wall = f" max_wall_seconds={max_wall_seconds}" if max_wall_seconds is not None else ""
        print(
            f"  model={MODEL} aspect_ratio={aspect_ratio} quality={quality} background={api_bg} "
            f"(catalog={catalog_bg}) "
            f"moderation={moderation} output_format={out_fmt} output_compression={output_compression} "
            f"prefer_wait={prefer_wait}s (max {REPLICATE_PREFER_WAIT_MAX}s; polling handles longer runs){wall}"
        )
        if not no_refs:
            print("  input_images: " + " , ".join(str(p) for p in ref_paths))
        else:
            print("  input_images: (none, --no-ref-images)")
        return None

    import replicate

    client = (
        replicate.Client(
            timeout=httpx.Timeout(
                60.0,
                connect=30.0,
                write=300.0,
                read=300.0,
                pool=120.0,
            )
        )
        if httpx is not None
        else replicate.Client()
    )

    def call_model() -> object:
        if not no_refs:
            missing = [p for p in ref_paths if not p.is_file()]
            if missing:
                raise FileNotFoundError(
                    "Reference images missing. Expected:\n  "
                    + "\n  ".join(str(p) for p in missing)
                )
            handles = [open(p, "rb") for p in ref_paths]
            try:
                inp["input_images"] = handles
                return _bounded.run_model_bounded(
                    client,
                    MODEL,
                    inp,
                    prefer_wait=prefer_wait,
                    max_wall_seconds=max_wall_seconds,
                    job_label=name,
                    log_monitor=log_monitor,
                    poll_progress=poll_progress,
                )
            finally:
                for handle in handles:
                    handle.close()
        inp["input_images"] = []
        return _bounded.run_model_bounded(
            client,
            MODEL,
            inp,
            prefer_wait=prefer_wait,
            max_wall_seconds=max_wall_seconds,
            job_label=name,
            log_monitor=log_monitor,
            poll_progress=poll_progress,
        )

    output = run_with_retries(
        call_model,
        max_attempts=retry_max,
        base_delay_sec=retry_delay_sec,
        job_label=name,
    )

    if not output:
        raise RuntimeError(f"No output from {MODEL} for {name}")

    data = _read_output_bytes(output)
    if catalog_bg == "transparent":
        data = postprocess_chroma_to_transparent(data)
    out_dir.mkdir(parents=True, exist_ok=True)
    with open(out_path, "wb") as f:
        f.write(data)
    print(f"Wrote {out_path}")
    return out_path


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate art via Replicate openai/gpt-image-2")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUT,
        help=f"Directory for generated files (default: {DEFAULT_OUT})",
    )
    parser.add_argument(
        "--style-ref",
        type=Path,
        default=DEFAULT_STYLE_REF,
        help="Full-scene style reference image (PNG)",
    )
    parser.add_argument(
        "--token-ref",
        type=Path,
        default=DEFAULT_TOKEN_REF,
        help="Hat + D token logo reference (PNG)",
    )
    parser.add_argument(
        "--quality",
        choices=("low", "medium", "high", "auto"),
        default="auto",
        help="gpt-image-2 quality (default: auto)",
    )
    parser.add_argument(
        "--moderation",
        choices=("auto", "low"),
        default="auto",
        help="gpt-image-2 moderation level (default: auto)",
    )
    parser.add_argument(
        "--background",
        choices=("auto", "transparent", "opaque"),
        default=None,
        help=(
            "Override background for every job (auto | transparent | opaque). "
            "Default: use per-job value from the catalog."
        ),
    )
    parser.add_argument(
        "--output-compression",
        type=int,
        default=90,
        metavar="PCT",
        help="Output compression 0-100 for lossy formats (default: 90)",
    )
    parser.add_argument(
        "--wait-seconds",
        type=int,
        default=60,
        metavar="SEC",
        help=(
            "Prefer: wait header for the create-prediction request (must be 1-60 per Replicate API). "
            "Default 60. Total image time can be many minutes; the client polls until the prediction finishes."
        ),
    )
    parser.add_argument(
        "--retry-max",
        type=int,
        default=8,
        metavar="N",
        help="Max attempts per job when API fails with capacity/rate-like errors (default: 8)",
    )
    parser.add_argument(
        "--retry-delay",
        type=float,
        default=20.0,
        metavar="SEC",
        help="Base delay in seconds before first retry; doubles each attempt (default: 20)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Print jobs only; do not call API")
    parser.add_argument(
        "--no-ref-images",
        action="store_true",
        help="Do not pass style/token images (breaks consistency; for debugging only)",
    )
    parser.add_argument(
        "--only",
        type=str,
        default="",
        help="Filter jobs by name (case-insensitive). Default: substring match; use --exact for full stem match",
    )
    parser.add_argument(
        "--exact",
        action="store_true",
        help="With --only, match the job stem exactly instead of substring",
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip a job if the output file already exists",
    )
    args = parser.parse_args()
    if not 0 <= args.output_compression <= 100:
        parser.error("--output-compression must be between 0 and 100")
    requested_wait = args.wait_seconds
    args.wait_seconds = clamp_prefer_wait(args.wait_seconds)
    if requested_wait != args.wait_seconds:
        print(
            f"Note: --wait-seconds {requested_wait} is outside 1-{REPLICATE_PREFER_WAIT_MAX}; "
            f"using {args.wait_seconds}. (Total generation time is not limited; the client polls until done.)",
            file=sys.stderr,
        )

    load_env()
    token = os.environ.get("REPLICATE_API_TOKEN", "").strip()
    if not args.dry_run and not token:
        print(
            "Error: REPLICATE_API_TOKEN is not set.\n"
            "Add it to your environment or to .env (repo root, scripts/replicate-art/.env, or frontend/.env / .env.local)\n"
            "Example: export REPLICATE_API_TOKEN=r8_...",
            file=sys.stderr,
        )
        return 1

    if not args.dry_run:
        os.environ["REPLICATE_API_TOKEN"] = token

    out_dir: Path = args.output_dir
    only = args.only.strip().lower()
    style_ref = args.style_ref
    token_ref = args.token_ref

    def name_matches(job_name: str) -> bool:
        if not only:
            return True
        n = job_name.lower()
        if args.exact:
            return n == only
        return only in n

    ran = 0
    skipped = 0
    for name, aspect_ratio, output_format, job_background, subject in JOBS:
        if not name_matches(name):
            continue
        background = args.background if args.background is not None else job_background
        out_fmt = effective_output_format(output_format, background)
        ext = format_to_ext(out_fmt)
        candidate = out_dir / f"{name}.{ext}"
        if args.skip_existing and candidate.is_file():
            print(f"Skip existing: {candidate}")
            skipped += 1
            continue
        run_job(
            name,
            aspect_ratio,
            output_format,
            background,
            subject,
            out_dir,
            style_ref,
            token_ref,
            args.quality,
            args.moderation,
            args.output_compression,
            args.wait_seconds,
            args.retry_max,
            args.retry_delay,
            args.dry_run,
            args.no_ref_images,
        )
        ran += 1

    print(f"Done. Ran {ran} job(s), skipped {skipped}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
