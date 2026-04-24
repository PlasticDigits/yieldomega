#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""GitLab issue #57 — art gap fill: derivatives + Replicate batch → production paths.

Mirrors ``issue45_batch.py`` (same model, refs, chroma transparent path, bounded polling).

Run from repo root or ``cd scripts/replicate-art``::

  .venv/bin/python issue57_batch.py              # derivatives + API jobs
  .venv/bin/python issue57_batch.py --derivatives-only
  .venv/bin/python issue57_batch.py --generate-only --skip-existing

Manifest (human-readable): ``issue57/prompts.json``.
Scratch outputs (gitignored): ``frontend/public/art/pending_manual_review/issue57-gen/``.
"""

from __future__ import annotations

import argparse
import io
import json
import os
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

try:
    import httpx
except ImportError:
    httpx = None  # type: ignore[misc, assignment]

try:
    from PIL import Image
except ImportError:
    Image = None  # type: ignore[misc, assignment]

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import generate_assets as ga  # noqa: E402
import flagged_inputs as _flagged_inputs  # noqa: E402
import replicate_bounded_run as _bounded  # noqa: E402

ResizeMode = Literal["scene_wide", "scene_mid", "portrait_768_1024", "cutout", "icon_256", "none"]
PostDeliver = Literal["none", "cursor_24x24_hot_4_4", "cursor_24x24_hot_4_2", "cursor_16x24_hot_8_12", "icon_128"]


@dataclass(frozen=True)
class BatchJob:
    filename: str
    checklist_section: str
    checklist_item: str
    aspect_ratio: str
    background: str
    output_format: str
    resize: ResizeMode
    subject: str
    """Path under frontend/public/art/ (e.g. cursors/foo.png)."""
    deliver_relative: str
    post_deliver: PostDeliver


def _art_root() -> Path:
    return ga.REPO_ROOT / "frontend" / "public" / "art"


def _refs_for_slug(slug: str) -> list[Path]:
    refs = [ga.DEFAULT_STYLE_REF, ga.DEFAULT_TOKEN_REF]
    if "sir" in slug.lower() and ga.DEFAULT_SIR_CARD_REF.is_file():
        refs.append(ga.DEFAULT_SIR_CARD_REF)
    return _flagged_inputs.filter_reference_paths(refs, ga.REPO_ROOT, job_label=slug)


def _read_output_bytes(output: object) -> bytes:
    return ga._read_output_bytes(output)


def _scale_max_long_edge(im: Image.Image, max_edge: int) -> Image.Image:
    w, h = im.size
    long_edge = max(w, h)
    if long_edge <= max_edge:
        return im
    s = max_edge / long_edge
    nw, nh = max(1, int(w * s)), max(1, int(h * s))
    return im.resize((nw, nh), Image.Resampling.LANCZOS)


def _fit_inside(im: Image.Image, max_w: int, max_h: int) -> Image.Image:
    w, h = im.size
    scale = min(max_w / w, max_h / h, 1.0)
    if scale >= 1.0:
        return im
    return im.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.LANCZOS)


def _resize_bytes(data: bytes, resize: ResizeMode, output_format: str) -> bytes:
    if resize == "none" or Image is None:
        return data
    im = Image.open(io.BytesIO(data))
    if output_format == "png" and resize in ("cutout", "icon_256"):
        im = im.convert("RGBA")

    if resize == "scene_wide":
        im = _scale_max_long_edge(im, 1536)
    elif resize == "scene_mid":
        im = _scale_max_long_edge(im, 1280)
    elif resize == "portrait_768_1024":
        im = _scale_max_long_edge(im, 1024)
        im = _fit_inside(im, 768, 1024)
    elif resize == "cutout":
        im = _scale_max_long_edge(im, 1024)
    elif resize == "icon_256":
        im = _fit_inside(im, 256, 256)
    else:
        raise ValueError(resize)

    buf = io.BytesIO()
    if output_format == "png":
        im.save(buf, format="PNG", optimize=True)
    else:
        rgb = im.convert("RGB")
        rgb.save(buf, format="JPEG", quality=88, optimize=True)
    return buf.getvalue()


def _magick(args: list[str]) -> bool:
    for cmd in (["magick"], ["convert"]):
        try:
            subprocess.run(cmd + args, check=True, capture_output=True)
            return True
        except (FileNotFoundError, subprocess.CalledProcessError):
            continue
    return False


def deliver_derivatives() -> None:
    """Copies / crops from existing issue #45 assets (no API)."""
    art = _art_root()
    if not art.is_dir():
        raise FileNotFoundError(f"Art root missing: {art}")

    def cp(src: Path, dst: Path) -> None:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        print(f"Copied {src.relative_to(art)} → {dst.relative_to(art)}")

    cp(art / "social" / "og-wide.jpg", art / "opengraph.jpg")
    cp(art / "social" / "og-square.jpg", art / "opengraph-square.jpg")

    prel = art / "icons" / "status-prelanch.png"
    pre_ok = art / "icons" / "status-prelaunch.png"
    if prel.is_file():
        cp(prel, pre_ok)

    for sym in ("cl8y", "doub", "charm", "usdm"):
        src = art / "icons" / f"token-{sym}.png"
        dst = art / "icons" / f"token-{sym}-24.png"
        if not src.is_file():
            print(f"Skip token resize (missing): {src}", file=sys.stderr)
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        if Image is not None:
            im = Image.open(src).convert("RGBA")
            im = _fit_inside(im, 24, 24)
            im.save(dst, format="PNG", optimize=True)
            print(f"Wrote {dst.relative_to(art)} (24×24)")
        else:
            print("Pillow missing; cannot resize tokens", file=sys.stderr)

    for sym in ("flag", "guard", "revenge", "steal"):
        src = art / "icons" / f"warbow-{sym}.png"
        dst = art / "icons" / f"warbow-{sym}-20.png"
        if not src.is_file():
            continue
        if Image is not None:
            im = Image.open(src).convert("RGBA")
            im = _fit_inside(im, 20, 20)
            im.save(dst, format="PNG", optimize=True)
            print(f"Wrote {dst.relative_to(art)} (20×20)")

    wrong = art / "scenes" / "error-wrong-network.jpg"
    portrait = art / "scenes" / "error-wrong-network-portrait.jpg"
    if wrong.is_file():
        if _magick(
            [
                str(wrong),
                "-resize",
                "900x1600^",
                "-gravity",
                "center",
                "-extent",
                "900x1600",
                "-quality",
                "88",
                str(portrait),
            ]
        ):
            print(f"Wrote {portrait.relative_to(art)} (cover crop)")
        elif Image is not None:
            im = Image.open(wrong).convert("RGB")
            im = im.resize((900, 1600), Image.Resampling.LANCZOS)
            im.save(portrait, format="JPEG", quality=88, optimize=True)
            print(f"Wrote {portrait.relative_to(art)} (PIL resize fallback)")

    ref_net = art / "scenes" / "referrals-network.jpg"
    ref_hero = art / "scenes" / "referrals-hero.jpg"
    if ref_net.is_file():
        if _magick(
            [
                str(ref_net),
                "-resize",
                "1600x900^",
                "-gravity",
                "center",
                "-extent",
                "1600x900",
                "-quality",
                "88",
                str(ref_hero),
            ]
        ):
            print(f"Wrote {ref_hero.relative_to(art)}")
        elif Image is not None:
            im = Image.open(ref_net).convert("RGB")
            im = im.resize((1600, 900), Image.Resampling.LANCZOS)
            im.save(ref_hero, format="JPEG", quality=88, optimize=True)
            print(f"Wrote {ref_hero.relative_to(art)} (PIL fallback)")

    circle = art / "cutouts" / "loading-mascot-circle.png"
    ring = art / "icons" / "loading-mascot-ring.png"
    if circle.is_file() and Image is not None:
        im = Image.open(circle).convert("RGBA")
        im = _fit_inside(im, 256, 256)
        ring.parent.mkdir(parents=True, exist_ok=True)
        im.save(ring, format="PNG", optimize=True)
        print(f"Wrote {ring.relative_to(art)} (from loading-mascot-circle)")


def _deliver_replicate_fallbacks(art: Path) -> None:
    """When Replicate has not run yet, promote readable stand-ins from existing art (issue #45 pack)."""
    if Image is None:
        return

    def rs(src_rel: str, dst_rel: str, w: int, h: int) -> None:
        dst = art / dst_rel
        if dst.is_file():
            return
        src = art / src_rel
        if not src.is_file():
            print(f"Fallback skip (missing source): {src_rel}", file=sys.stderr)
            return
        im = Image.open(src).convert("RGBA")
        im = _fit_inside(im, w, h)
        dst.parent.mkdir(parents=True, exist_ok=True)
        im.save(dst, format="PNG", optimize=True)
        print(f"Fallback {dst_rel} ← {src_rel} ({w}×{h})")

    rs("icons/nav-simple.png", "cursors/default-pointer.png", 24, 24)
    rs("icons/status-cooldown.png", "cursors/text-caret.png", 16, 24)
    rs("icons/warbow-guard.png", "cursors/disabled.png", 24, 24)
    rs("icons/status-net-warn.png", "cursors/external-link.png", 24, 24)
    rs("icons/token-cl8y.png", "icons/fee-burn.png", 128, 128)
    rs("icons/token-doub.png", "icons/fee-treasury.png", 128, 128)
    rs("icons/token-charm.png", "icons/fee-referral.png", 128, 128)
    rs("cutouts/mascot-leprechaun-with-bag-cutout.png", "cutouts/indexer-down-mascot.png", 512, 512)


def _post_deliver_png(data: bytes, post: PostDeliver) -> bytes:
    if post == "none" or Image is None:
        return data
    im = Image.open(io.BytesIO(data)).convert("RGBA")
    if post == "cursor_24x24_hot_4_4" or post == "cursor_24x24_hot_4_2":
        im = _fit_inside(im, 24, 24)
    elif post == "cursor_16x24_hot_8_12":
        im = _fit_inside(im, 16, 24)
    elif post == "icon_128":
        im = _fit_inside(im, 128, 128)
    else:
        raise ValueError(post)
    buf = io.BytesIO()
    im.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def run_batch_job(
    job: BatchJob,
    *,
    scratch_dir: Path,
    retry_max: int,
    retry_delay: float,
    no_refs: bool,
) -> Path:
    import replicate

    catalog_bg = job.background
    prompt = ga.build_prompt(job.subject)
    if catalog_bg == "transparent":
        prompt = ga.augment_prompt_chroma_backdrop(prompt)
    api_bg = ga.api_background_for_replicate(catalog_bg)
    out_fmt = ga.effective_output_format(job.output_format, catalog_bg)
    ext = ga.format_to_ext(out_fmt)
    stem = job.filename.rsplit(".", 1)[0]
    scratch_path = scratch_dir / f"{stem}.{ext}"

    inp: dict = {
        "prompt": prompt,
        "aspect_ratio": job.aspect_ratio,
        "quality": "high",
        "background": api_bg,
        "moderation": "low",
        "output_format": out_fmt,
        "number_of_images": 1,
        "output_compression": 90,
        "input_images": [],
    }

    ref_paths = _refs_for_slug(stem)

    client = (
        replicate.Client(
            timeout=httpx.Timeout(
                120.0,
                connect=60.0,
                write=600.0,
                read=900.0,
                pool=300.0,
            )
        )
        if httpx is not None
        else replicate.Client()
    )

    def call_model() -> object:
        if not no_refs:
            missing = [p for p in ref_paths if not p.is_file()]
            if missing:
                raise FileNotFoundError("Reference images missing:\n  " + "\n  ".join(str(p) for p in missing))
            handles = [open(p, "rb") for p in ref_paths]
            try:
                inp["input_images"] = handles
                return _bounded.run_model_bounded(
                    client,
                    ga.MODEL,
                    inp,
                    prefer_wait=1,
                    job_label=stem,
                )
            finally:
                for h in handles:
                    h.close()
        inp["input_images"] = []
        return _bounded.run_model_bounded(
            client,
            ga.MODEL,
            inp,
            prefer_wait=1,
            job_label=stem,
        )

    output = ga.run_with_retries(
        call_model,
        max_attempts=retry_max,
        base_delay_sec=retry_delay,
        job_label=stem,
    )
    if not output:
        raise RuntimeError(f"No output for {stem}")

    raw = _read_output_bytes(output)
    if catalog_bg == "transparent":
        raw = ga.postprocess_chroma_to_transparent(raw)
    if Image is not None and job.resize != "none":
        raw = _resize_bytes(raw, job.resize, "png" if out_fmt == "png" else "jpeg")
    scratch_dir.mkdir(parents=True, exist_ok=True)
    scratch_path.write_bytes(raw)

    final_path = _art_root() / job.deliver_relative
    final_path.parent.mkdir(parents=True, exist_ok=True)
    out_final = _post_deliver_png(raw, job.post_deliver) if out_fmt == "png" else raw
    final_path.write_bytes(out_final)
    print(f"Wrote {scratch_path} → promoted {final_path} ({len(out_final)} bytes)")
    return final_path


def jobs() -> list[BatchJob]:
    j: list[BatchJob] = []

    j.append(
        BatchJob(
            "issue57-cursor-default-pointer.png",
            "Cursors",
            "Default arcade pointer (24×24)",
            "1:1",
            "transparent",
            "png",
            "icon_256",
            "UI cursor sprite only: a chunky bright-green arcade arrow pointer with thick black outline and glossy "
            "highlight, same toy-game finish as the brand—simple arrow shape like a mouse pointer, no characters, "
            "no text, centered with generous transparent margin, designed to read clearly at 24px.",
            "cursors/default-pointer.png",
            "cursor_24x24_hot_4_4",
        )
    )
    j.append(
        BatchJob(
            "issue57-cursor-text-caret.png",
            "Cursors",
            "Text caret (16×24)",
            "2:3",
            "transparent",
            "png",
            "portrait_768_1024",
            "UI text-caret sprite only: vertical I-beam text caret in chunky arcade style—bright green stem with "
            "gold cap nibs and thick black outline, glossy toy finish, no characters, no text labels, tall narrow "
            "composition for a 16×24 cursor, transparent background.",
            "cursors/text-caret.png",
            "cursor_16x24_hot_8_12",
        )
    )
    j.append(
        BatchJob(
            "issue57-cursor-disabled.png",
            "Cursors",
            "Disabled / no-entry (24×24)",
            "1:1",
            "transparent",
            "png",
            "icon_256",
            "UI cursor sprite only: a small round leprechaun shield badge with a bold red diagonal NO bar and thick "
            "black outline—friendly arcade 'not allowed' icon, glossy toy finish, no readable words, centered, "
            "transparent background, readable at 24px.",
            "cursors/disabled.png",
            "cursor_24x24_hot_4_4",
        )
    )
    j.append(
        BatchJob(
            "issue57-cursor-external-link.png",
            "Cursors",
            "External-link cursor (24×24)",
            "1:1",
            "transparent",
            "png",
            "icon_256",
            "UI cursor sprite only: a tiny square-with-arrow-out icon in sky-blue and gold with thick black "
            "outline—classic 'opens external' affordance, chunky arcade toy style, no characters, no letters, centered, "
            "transparent background, readable at 24px.",
            "cursors/external-link.png",
            "cursor_24x24_hot_4_2",
        )
    )
    j.append(
        BatchJob(
            "issue57-icon-fee-burn.png",
            "Icons",
            "Fee sink — burn",
            "1:1",
            "transparent",
            "png",
            "icon_256",
            "Single flat UI icon: stylized flame consuming a glossy hat-coin (token-logo emblem style), thick black "
            "outline, arcade sticker look, centered, transparent background, no text.",
            "icons/fee-burn.png",
            "icon_128",
        )
    )
    j.append(
        BatchJob(
            "issue57-icon-fee-treasury.png",
            "Icons",
            "Fee sink — treasury",
            "1:1",
            "transparent",
            "png",
            "icon_256",
            "Single flat UI icon: cute treasure chest overflowing with hat-coins, chunky arcade outlines, green and gold "
            "palette, centered, transparent background, no text.",
            "icons/fee-treasury.png",
            "icon_128",
        )
    )
    j.append(
        BatchJob(
            "issue57-icon-fee-referral.png",
            "Icons",
            "Fee sink — referral / share",
            "1:1",
            "transparent",
            "png",
            "icon_256",
            "Single flat UI icon: two mascots high-fiving while a glowing hat-coin bounces between them—referral "
            "teamwork motif, thick outlines, cheerful arcade style, centered, transparent background, no text.",
            "icons/fee-referral.png",
            "icon_128",
        )
    )
    j.append(
        BatchJob(
            "issue57-cutout-indexer-down-mascot.png",
            "Cutouts",
            "Indexer-down sad leprechaun",
            "1:1",
            "transparent",
            "png",
            "cutout",
            "Character cutout: a sympathetic red-bearded leprechaun mascot looking a little sad and shrugging—gentle "
            "'service hiccup' mood, holding a tilted empty coin bag, chunky arcade outlines, adult character, fully "
            "clothed, transparent chroma-friendly backdrop for keying, no text, no UI chrome.",
            "cutouts/indexer-down-mascot.png",
            "none",
        )
    )
    return j


def sync_prompts_json() -> None:
    """Refresh issue57/prompts.json ``jobs`` array from ``jobs()`` (keeps manifest in sync)."""
    manifest = SCRIPT_DIR / "issue57" / "prompts.json"
    if not manifest.is_file():
        return
    data = json.loads(manifest.read_text(encoding="utf-8"))
    rows = []
    for job in jobs():
        stem = job.filename.rsplit(".", 1)[0]
        rows.append(
            {
                "id": stem,
                "filename": job.filename,
                "deliver_to": f"frontend/public/art/{job.deliver_relative}",
                "aspect_ratio": job.aspect_ratio,
                "background": job.background,
                "output_format": job.output_format,
                "resize": job.resize,
                "post_deliver": job.post_deliver,
                "checklist": job.checklist_item,
                "subject": job.subject,
            }
        )
    data["jobs"] = rows
    manifest.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"Updated {manifest}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Issue #57 art — derivatives + Replicate → art/")
    parser.add_argument("--derivatives-only", action="store_true")
    parser.add_argument("--generate-only", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--skip-existing", action="store_true")
    parser.add_argument("--start-from", type=int, default=0, help="0-based job index")
    parser.add_argument("--sleep", type=float, default=28.0)
    parser.add_argument("--no-ref-images", action="store_true")
    parser.add_argument("--sync-prompts-json", action="store_true", help="Rewrite issue57/prompts.json jobs from code")
    parser.add_argument("--max-jobs", type=int, default=0, help="Stop after N API jobs (0 = no limit)")
    args = parser.parse_args()

    if args.sync_prompts_json:
        sync_prompts_json()
        return 0

    ga.load_env()

    if not args.generate_only:
        if Image is None:
            print("Warning: Pillow not installed; some derivatives may be skipped.", file=sys.stderr)
        deliver_derivatives()

    token = os.environ.get("REPLICATE_API_TOKEN", "").strip()

    if args.derivatives_only:
        if not args.dry_run and not token:
            _deliver_replicate_fallbacks(_art_root())
        return 0

    if not args.dry_run and not token:
        print(
            "REPLICATE_API_TOKEN missing — skipping API jobs. Heuristic fallbacks from issue #45 art will fill "
            "cursor/fee/indexer slots until you re-run with a token (omit --skip-existing for paths you want "
            "replaced).",
            file=sys.stderr,
        )
        _deliver_replicate_fallbacks(_art_root())
        return 0 if args.generate_only else 0

    if not args.dry_run:
        os.environ["REPLICATE_API_TOKEN"] = token

    scratch = ga.REPO_ROOT / "frontend" / "public" / "art" / "pending_manual_review" / "issue57-gen"
    scratch.mkdir(parents=True, exist_ok=True)

    all_jobs = jobs()
    finished = 0
    for idx, job in enumerate(all_jobs):
        if idx < args.start_from:
            continue
        stem = job.filename.rsplit(".", 1)[0]
        ext_guess = ga.format_to_ext(ga.effective_output_format(job.output_format, job.background))
        final = _art_root() / job.deliver_relative
        if args.skip_existing and final.is_file():
            print(f"Skip existing {final}")
            continue

        print(f"[{idx + 1}/{len(all_jobs)}] {job.filename} …")
        if args.dry_run:
            print(f"  → {job.deliver_relative} post={job.post_deliver}")
            continue

        run_batch_job(
            job,
            scratch_dir=scratch,
            retry_max=8,
            retry_delay=20.0,
            no_refs=args.no_ref_images,
        )
        finished += 1
        if args.max_jobs and finished >= args.max_jobs:
            print(f"--max-jobs {args.max_jobs} reached; stopping.")
            break
        if idx < len(all_jobs) - 1 and args.sleep > 0:
            time.sleep(args.sleep)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
