#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""Generate and normalize the frontend cursor pack.

Cursors follow the approved **cyberminimalist Glass Arena** direction (#290):
deep navy glass material, emerald/teal live glow, warm gold accents, crisp
silhouettes — not the legacy blocky arcade-cartoon style.

The Replicate path sends Glass Arena icon references plus the MDN unstyled
cursor example for each CSS role. When REPLICATE_API_TOKEN is unavailable,
``--derivatives-only`` still emits small local glass fallbacks.

Run from repo root or scripts/replicate-art::

  python3 scripts/replicate-art/cursor_batch.py --derivatives-only
  python3 scripts/replicate-art/cursor_batch.py --fetch-examples
  python3 scripts/replicate-art/cursor_batch.py --generate-only
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.request
from dataclasses import dataclass
from pathlib import Path

try:
    import httpx
except ImportError:
    httpx = None  # type: ignore[misc, assignment]

try:
    from PIL import Image, ImageDraw
except ImportError:
    Image = None  # type: ignore[misc, assignment]
    ImageDraw = None  # type: ignore[misc, assignment]

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import flagged_inputs as _flagged_inputs  # noqa: E402
import generate_assets as ga  # noqa: E402
import replicate_bounded_run as _bounded  # noqa: E402


CURSOR_SIZE = 32
ICONS_DIR = ga.REPO_ROOT / "frontend" / "public" / "art" / "icons"

# Glass Arena palette (--yga-* / --yo-* in index.css)
_GLASS_NAVY = (7, 18, 31, 255)
_GLASS_FILL = (8, 18, 32, 210)
_GLASS_TEAL = (126, 241, 255, 255)
_GLASS_EMERALD = (45, 212, 168, 255)
_GLASS_GOLD = (232, 192, 74, 255)
_GLASS_DANGER = (255, 107, 122, 255)
_GLASS_HIGHLIGHT = (255, 255, 255, 72)

GLASS_CURSOR_STYLE = """
Yield Omega Glass Arena UI cursor sprite (32x32 display).
Cyberminimalist glassmorphism command-console finish: deep navy glass body,
emerald/teal rim glow, warm gold accent highlights, subtle luminous bevel,
crisp readable silhouette. No arcade cartoon gloves, no chunky mascot outlines,
no blocky hills, no characters, no text, no watermark, no photorealism.
Transparent background only; one cursor affordance per image.
""".strip()


@dataclass(frozen=True)
class CursorJob:
    slug: str
    css_name: str
    fallback: str
    hotspot: tuple[int, int]
    mdn_url: str
    subject: str

    @property
    def filename(self) -> str:
        return f"{self.slug}.png"


def art_root() -> Path:
    return ga.REPO_ROOT / "frontend" / "public" / "art"


def cursor_dir() -> Path:
    return art_root() / "cursors"


def example_dir() -> Path:
    return art_root() / "pending_manual_review" / "cursor-mdn-examples"


def scratch_dir() -> Path:
    return art_root() / "pending_manual_review" / "cursor-gen"


def jobs() -> list[CursorJob]:
    return [
        CursorJob(
            "default",
            "default",
            "auto",
            (4, 4),
            "https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/cursor/default.gif",
            "CSS default cursor: slim glass arrow pointer with navy core, teal rim light, tiny gold tip "
            "highlight. Classic idle-navigation arrow; hotspot at arrow tip (top-left). Minimal detail.",
        ),
        CursorJob(
            "pointer",
            "pointer",
            "pointer",
            (10, 2),
            "https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/cursor/pointer.gif",
            "CSS pointer cursor: minimalist glass pointing hand OR chevron-hand hybrid — index extended, "
            "emerald/teal luminous edge, gold knuckle accent. One hand only, clearly clickable, not cartoon.",
        ),
        CursorJob(
            "grab",
            "grab",
            "grab",
            (16, 16),
            "https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/cursor/grab.gif",
            "CSS grab cursor: open glass grip brackets or half-closed tactical hand ready to drag a slider. "
            "Emerald edge glow, navy glass fill, gold hinge accent.",
        ),
        CursorJob(
            "grabbing",
            "grabbing",
            "grabbing",
            (16, 16),
            "https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/cursor/grabbing.gif",
            "CSS grabbing cursor: closed glass grip / clenched tactical hand actively dragging. Same glass "
            "material language as grab state but clearly closed.",
        ),
        CursorJob(
            "wait",
            "wait",
            "wait",
            (16, 16),
            "https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/cursor/wait.gif",
            "CSS wait cursor: tiny glass hourglass or teal spinning wait ring. Blocking busy state, no digits.",
        ),
        CursorJob(
            "context-menu",
            "context-menu",
            "context-menu",
            (6, 5),
            "https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/cursor/context-menu.png",
            "CSS context-menu cursor: glass arrow pointer plus a small stacked glass menu tile beside it. "
            "Teal borders, navy fill, no text lines that read as letters.",
        ),
        CursorJob(
            "help",
            "help",
            "help",
            (16, 16),
            "https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/cursor/help.gif",
            "CSS help cursor: glossy glass coin-badge with a single teal question-mark symbol. Token-logo "
            "buckle language, no other text.",
        ),
        CursorJob(
            "progress",
            "progress",
            "progress",
            (6, 5),
            "https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/cursor/progress.gif",
            "CSS progress cursor: glass default arrow plus a small partial teal progress ring. Working but "
            "still interactive; extremely simple.",
        ),
        CursorJob(
            "text",
            "text",
            "text",
            (16, 16),
            "https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/cursor/text.gif",
            "CSS text cursor: tall glass I-beam caret with teal stem, gold cap highlights, navy outline. "
            "Very narrow, no letters.",
        ),
        CursorJob(
            "not-allowed",
            "not-allowed",
            "not-allowed",
            (16, 16),
            "https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/cursor/not-allowed.gif",
            "CSS not-allowed cursor: glass prohibition disc with warm gold rim and coral-red diagonal slash. "
            "Friendly but clear; no words.",
        ),
    ]


def _magick(args: list[str]) -> bool:
    for cmd in (["magick"], ["convert"]):
        try:
            subprocess.run(cmd + args, check=True, capture_output=True)
            return True
        except (FileNotFoundError, subprocess.CalledProcessError):
            continue
    return False


def normalize_cursor(src: Path, dst: Path, *, canvas: int = CURSOR_SIZE) -> None:
    """Trim transparent edges, resize, center on a transparent browser-safe canvas."""
    dst.parent.mkdir(parents=True, exist_ok=True)
    real_dst = dst
    if src.resolve() == dst.resolve():
        real_dst = dst.with_name(f".{dst.stem}.normalized{dst.suffix}")
    if _magick(
        [
            str(src),
            "-background",
            "none",
            "-alpha",
            "on",
            "-trim",
            "+repage",
            "-resize",
            f"{canvas}x{canvas}>",
            "-gravity",
            "center",
            "-extent",
            f"{canvas}x{canvas}",
            "-strip",
            "PNG32:" + str(real_dst),
        ]
    ):
        if real_dst != dst:
            real_dst.replace(dst)
        return
    if Image is None:
        raise RuntimeError("ImageMagick or Pillow is required to normalize cursors")
    im = Image.open(src).convert("RGBA")
    bbox = im.getbbox()
    if bbox is not None:
        im = im.crop(bbox)
    im.thumbnail((canvas, canvas), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    out.alpha_composite(im, ((canvas - im.width) // 2, (canvas - im.height) // 2))
    out.save(real_dst, format="PNG", optimize=True)
    if real_dst != dst:
        real_dst.replace(dst)


def _save_drawn(slug: str, draw_fn) -> None:
    if Image is None or ImageDraw is None:
        return
    tmp = scratch_dir() / f"{slug}-fallback-raw.png"
    tmp.parent.mkdir(parents=True, exist_ok=True)
    im = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)
    draw_fn(draw)
    im.save(tmp, format="PNG")
    normalize_cursor(tmp, cursor_dir() / f"{slug}.png")


def _draw_glass_arrow(draw: ImageDraw.ImageDraw, *, offset: tuple[int, int] = (0, 0)) -> None:
    ox, oy = offset
    outline = _GLASS_NAVY
    body = _GLASS_FILL
    pts = [
        (10 + ox, 5 + oy),
        (56 + ox, 48 + oy),
        (37 + ox, 52 + oy),
        (48 + ox, 86 + oy),
        (31 + ox, 91 + oy),
        (20 + ox, 58 + oy),
        (5 + ox, 72 + oy),
    ]
    draw.polygon(pts, fill=outline)
    inner = [
        (17 + ox, 18 + oy),
        (45 + ox, 45 + oy),
        (29 + ox, 48 + oy),
        (39 + ox, 78 + oy),
        (33 + ox, 80 + oy),
        (23 + ox, 50 + oy),
        (12 + ox, 60 + oy),
    ]
    draw.polygon(inner, fill=body)
    draw.line([(22 + ox, 21 + oy), (39 + ox, 38 + oy)], fill=_GLASS_HIGHLIGHT, width=3)
    draw.line([(10 + ox, 8 + oy), (18 + ox, 16 + oy)], fill=_GLASS_GOLD, width=4)


def _draw_glass_pointer_hand(draw: ImageDraw.ImageDraw) -> None:
    draw.polygon(
        [(18, 88), (34, 24), (48, 22), (52, 52), (64, 18), (78, 20), (72, 58), (86, 62), (58, 96)],
        fill=_GLASS_NAVY,
    )
    draw.polygon(
        [(24, 82), (38, 32), (48, 30), (52, 54), (66, 26), (74, 28), (68, 58), (80, 60), (58, 88)],
        fill=_GLASS_FILL,
    )
    draw.line([(38, 32), (48, 30)], fill=_GLASS_TEAL, width=4)
    draw.ellipse((30, 78, 42, 90), fill=_GLASS_GOLD)


def _draw_glass_grab(draw: ImageDraw.ImageDraw, *, closed: bool = False) -> None:
    gap = 6 if closed else 14
    draw.rounded_rectangle((28, 34, 52, 94), radius=10, fill=_GLASS_NAVY)
    draw.rounded_rectangle((76, 34, 100, 94), radius=10, fill=_GLASS_NAVY)
    draw.rounded_rectangle((32, 38, 48, 90), radius=8, fill=_GLASS_FILL)
    draw.rounded_rectangle((80, 38, 96, 90), radius=8, fill=_GLASS_FILL)
    draw.arc((40, 52, 88, 78), 0, 180, fill=_GLASS_EMERALD, width=6)
    if closed:
        draw.line((52, 64, 76, 64), fill=_GLASS_GOLD, width=5)
    else:
        draw.line((52, 64 - gap // 2, 76, 64 + gap // 2), fill=_GLASS_TEAL, width=4)


def deliver_fallbacks() -> None:
    """Emit programmatic Glass Arena cursor fallbacks for every canonical slug."""
    cdir = cursor_dir()
    cdir.mkdir(parents=True, exist_ok=True)

    _save_drawn("default", lambda d: _draw_glass_arrow(d))
    _save_drawn("pointer", _draw_glass_pointer_hand)
    _save_drawn("grab", lambda d: _draw_glass_grab(d, closed=False))
    _save_drawn("grabbing", lambda d: _draw_glass_grab(d, closed=True))
    _save_drawn(
        "wait",
        lambda d: (
            d.polygon([(64, 18), (88, 54), (64, 90), (40, 54)], fill=_GLASS_NAVY),
            d.polygon([(64, 26), (80, 54), (64, 82), (48, 54)], fill=_GLASS_FILL),
            d.line((64, 34, 64, 74), fill=_GLASS_TEAL, width=4),
            d.ellipse((58, 48, 70, 60), fill=_GLASS_GOLD),
        ),
    )
    _save_drawn(
        "context-menu",
        lambda d: (
            _draw_glass_arrow(d),
            d.rounded_rectangle((59, 28, 116, 80), radius=8, fill=_GLASS_NAVY),
            d.rounded_rectangle((65, 34, 110, 74), radius=5, fill=_GLASS_FILL),
            d.line((72, 46, 104, 46), fill=_GLASS_TEAL, width=4),
            d.line((72, 59, 104, 59), fill=_GLASS_GOLD, width=4),
        ),
    )
    _save_drawn(
        "help",
        lambda d: (
            d.ellipse((18, 18, 110, 110), fill=_GLASS_NAVY),
            d.ellipse((27, 27, 101, 101), fill=_GLASS_FILL),
            d.arc((43, 36, 85, 74), 195, 35, fill=_GLASS_TEAL, width=11),
            d.line((65, 72, 65, 82), fill=_GLASS_TEAL, width=9),
            d.ellipse((58, 90, 72, 104), fill=_GLASS_EMERALD),
        ),
    )
    _save_drawn(
        "progress",
        lambda d: (
            _draw_glass_arrow(d),
            d.ellipse((66, 54, 116, 104), fill=_GLASS_NAVY),
            d.arc((74, 62, 108, 96), 25, 310, fill=_GLASS_TEAL, width=8),
            d.polygon([(108, 61), (117, 61), (113, 70)], fill=_GLASS_GOLD),
        ),
    )
    _save_drawn(
        "text",
        lambda d: (
            d.rounded_rectangle((52, 10, 76, 118), radius=8, fill=_GLASS_NAVY),
            d.rounded_rectangle((58, 19, 70, 109), radius=4, fill=_GLASS_EMERALD),
            d.rounded_rectangle((39, 10, 89, 26), radius=7, fill=_GLASS_GOLD, outline=_GLASS_NAVY, width=4),
            d.rounded_rectangle((39, 102, 89, 118), radius=7, fill=_GLASS_GOLD, outline=_GLASS_NAVY, width=4),
        ),
    )
    _save_drawn(
        "not-allowed",
        lambda d: (
            d.ellipse((18, 18, 110, 110), fill=_GLASS_NAVY),
            d.ellipse((27, 27, 101, 101), fill=_GLASS_FILL, outline=_GLASS_GOLD, width=4),
            d.line((40, 40, 88, 88), fill=_GLASS_DANGER, width=16),
            d.line((40, 40, 88, 88), fill=_GLASS_NAVY, width=4),
        ),
    )


def fetch_examples() -> None:
    example_dir().mkdir(parents=True, exist_ok=True)
    for job in jobs():
        dst = example_dir() / f"{job.slug}{Path(job.mdn_url).suffix}"
        if dst.is_file():
            continue
        with urllib.request.urlopen(job.mdn_url, timeout=30) as response:
            dst.write_bytes(response.read())
        print(f"Fetched {dst.relative_to(ga.REPO_ROOT)}")


def _refs_for_job(job: CursorJob) -> list[Path]:
    refs = [
        ga.DEFAULT_TOKEN_REF,
        ga.REPO_ROOT / "frontend" / "public" / "tokens" / "doub.png",
        ICONS_DIR / "header-arena.png",
    ]
    examples = sorted(example_dir().glob(f"{job.slug}.*"))
    refs.extend(examples[:1])
    return _flagged_inputs.filter_reference_paths(refs, ga.REPO_ROOT, job_label=job.slug)


def _build_glass_cursor_prompt(job: CursorJob) -> str:
    return ga.augment_prompt_chroma_backdrop(
        f"{GLASS_CURSOR_STYLE}\n\n"
        "Use the supplied unstyled cursor example only for affordance/silhouette, not for style. "
        "Convert it into a transparent Yield Omega Glass Arena cursor.\n\n"
        f"CSS cursor role: {job.css_name}\n"
        f"Hotspot target after resize: {job.hotspot}\n"
        f"Subject: {job.subject}\n\n"
        "Hard requirements: one cursor only, transparent background, no shadow blob, no scene, "
        "no UI panel, no words, no watermark, very simple and legible at 32px.\n\n"
        f"Strictly avoid:\n{ga.NEGATIVE_GUIDE}"
    )


def run_replicate_job(job: CursorJob, *, retry_max: int, retry_delay: float, no_refs: bool) -> None:
    import replicate

    prompt = _build_glass_cursor_prompt(job)
    inp: dict = {
        "prompt": prompt,
        "aspect_ratio": "1:1",
        "quality": "high",
        "background": ga.api_background_for_replicate("transparent"),
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

    def call_model() -> object:
        if no_refs:
            return _bounded.run_model_bounded(client, ga.MODEL, inp, prefer_wait=1, job_label=job.slug)
        refs = _refs_for_job(job)
        missing = [p for p in refs if not p.is_file()]
        if missing:
            raise FileNotFoundError("Missing cursor refs:\n  " + "\n  ".join(str(p) for p in missing))
        handles = [open(p, "rb") for p in refs]
        try:
            inp["input_images"] = handles
            return _bounded.run_model_bounded(client, ga.MODEL, inp, prefer_wait=1, job_label=job.slug)
        finally:
            for handle in handles:
                handle.close()

    output = ga.run_with_retries(call_model, max_attempts=retry_max, base_delay_sec=retry_delay, job_label=job.slug)
    raw = ga.postprocess_chroma_to_transparent(ga._read_output_bytes(output))
    scratch = scratch_dir() / f"{job.slug}-raw.png"
    scratch.parent.mkdir(parents=True, exist_ok=True)
    scratch.write_bytes(raw)
    normalize_cursor(scratch, cursor_dir() / job.filename)
    print(f"Promoted cursors/{job.filename}")


def write_prompts_json() -> None:
    manifest = SCRIPT_DIR / "cursors" / "prompts.json"
    manifest.parent.mkdir(parents=True, exist_ok=True)
    data = {
        "model": ga.MODEL,
        "style": "cyberminimalist-glass-arena",
        "output": "frontend/public/art/cursors",
        "size": f"{CURSOR_SIZE}x{CURSOR_SIZE}",
        "jobs": [
            {
                "filename": job.filename,
                "css_name": job.css_name,
                "fallback": job.fallback,
                "hotspot": job.hotspot,
                "mdn_example": job.mdn_url,
                "subject": job.subject,
            }
            for job in jobs()
        ],
    }
    manifest.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {manifest.relative_to(ga.REPO_ROOT)}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Yieldomega Glass Arena cursor pack")
    parser.add_argument("--derivatives-only", action="store_true")
    parser.add_argument("--generate-only", action="store_true")
    parser.add_argument("--fetch-examples", action="store_true")
    parser.add_argument("--write-prompts-json", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--skip-existing", action="store_true")
    parser.add_argument("--start-from", type=int, default=0, help="0-based job index to start from")
    parser.add_argument("--max-jobs", type=int, default=0, help="Stop after N generated jobs (0 = no limit)")
    parser.add_argument("--sleep", type=float, default=22.0)
    parser.add_argument("--no-ref-images", action="store_true")
    args = parser.parse_args()

    if args.write_prompts_json:
        write_prompts_json()
        return 0
    if args.fetch_examples:
        fetch_examples()
        return 0

    ga.load_env()
    if not args.generate_only:
        deliver_fallbacks()
    if args.derivatives_only:
        return 0

    token = os.environ.get("REPLICATE_API_TOKEN", "").strip()
    if not args.dry_run and not token:
        print("REPLICATE_API_TOKEN unset - kept local glass cursor fallbacks.", file=sys.stderr)
        return 0
    if not args.dry_run:
        os.environ["REPLICATE_API_TOKEN"] = token

    finished = 0
    for idx, job in enumerate(jobs()):
        if idx < args.start_from:
            continue
        final = cursor_dir() / job.filename
        if args.skip_existing and final.is_file():
            print(f"Skip existing {final.name}")
            continue
        print(f"[{idx + 1}/{len(jobs())}] {job.slug}")
        if not args.dry_run:
            run_replicate_job(job, retry_max=8, retry_delay=20.0, no_refs=args.no_ref_images)
            finished += 1
            if args.max_jobs and finished >= args.max_jobs:
                print(f"--max-jobs {args.max_jobs} reached; stopping.")
                break
        if idx < len(jobs()) - 1 and args.sleep > 0:
            time.sleep(args.sleep)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
