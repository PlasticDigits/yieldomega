#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""Generate transparent header bar icons in parallel via Replicate.

Each icon gets one Replicate create attempt. Existing outputs cause the batch to
abort so a rerun cannot silently regenerate any individual icon.
"""

from __future__ import annotations

import io
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

try:
    from PIL import Image
except ImportError:
    Image = None  # type: ignore[misc, assignment]


OUT_DIR = ga.DEFAULT_OUT / "icons"
ICON_SIZE_PX = 256


@dataclass(frozen=True)
class HeaderIconJob:
    slug: str
    title: str
    subject: str


def jobs() -> list[HeaderIconJob]:
    return [
        HeaderIconJob(
            "header-home",
            "YieldOmega home",
            "A compact YieldOmega home text icon: the exact glyphs YΩ centered inside a circular ring, crisp high-contrast arcade badge styling, transparent background, no extra words or symbols.",
        ),
        HeaderIconJob(
            "header-timecurve",
            "TimeCurve",
            "A clear TimeCurve icon: chunky magical stopwatch with emerald-gold rim, two bold clock hands, small sparkle and coin orbit, strong silhouette readable at tiny header size, no numerals, no words.",
        ),
        HeaderIconJob(
            "header-referrals",
            "Referrals",
            "A clear referrals icon: three connected shiny hat-coins as a small network graph, one central coin linked to two smaller coins, cheerful green-gold palette, thick outline, no currency symbols, no words.",
        ),
        HeaderIconJob(
            "header-network-mega",
            "MegaETH network",
            "A clear MegaETH network icon: stylized emerald lightning bolt inside a rounded chain-link ring, glossy arcade finish, high contrast green and cyan accents, simple enough for a 20 pixel header button, no letters, no words.",
        ),
        HeaderIconJob(
            "header-network-local",
            "Local Anvil network",
            "A clear local development network icon: chunky blacksmith anvil with a small golden spark and tiny chain-link accent, friendly arcade-cartoon style, readable silhouette, no emoji, no letters, no words.",
        ),
        HeaderIconJob(
            "header-network-chain",
            "Generic chain network",
            "A clear generic blockchain network icon: two interlocking rounded chain links with a small glowing node spark, blue-green-gold arcade palette, thick outline, no letters, no words.",
        ),
        HeaderIconJob(
            "header-wallet-connect",
            "Connect wallet",
            "A clear connect wallet icon: small glossy wallet with a clasp and one visible golden hat-coin peeking out, compact rounded silhouette, thick outline, no letters, no words.",
        ),
        HeaderIconJob(
            "header-wallet-account",
            "Wallet account",
            "A clear wallet account icon: rounded wallet badge paired with a tiny pixel-blockie avatar tile, green-gold trim, friendly arcade style, no readable address, no letters, no words.",
        ),
        HeaderIconJob(
            "header-wallet-loading",
            "Wallet loading",
            "A clear wallet loading icon: small wallet with a circular sparkle spinner made from four chunky dots around it, readable as loading at header size, no ellipsis, no letters, no words.",
        ),
        HeaderIconJob(
            "header-presale-charm",
            "Presale CHARM bonus",
            "A clear presale CHARM bonus icon: faceted charm gem with a small upward sparkle arrow and golden rim, premium reward badge feeling, no percentage sign, no plus sign, no letters, no words.",
        ),
        HeaderIconJob(
            "header-wrong-network",
            "Wrong network alert",
            "A clear wrong-network alert icon: red-orange warning triangle wrapped around a broken chain link, bold high-contrast silhouette, arcade-polished edges, no exclamation mark, no letters, no words.",
        ),
    ]


def build_prompt(job: HeaderIconJob, *, using_refs: bool) -> str:
    refs = (
        "Reference images are supplied as input_images: style.png for the YieldOmega blocky arcade world and token-logo.png for the hat-token finish."
        if using_refs
        else "No reference images are available; follow the written YieldOmega arcade-cartoon style closely."
    )
    return f"""
{ga.STYLE_GUIDE}

{refs}

Header icon constraints:
- Produce exactly one standalone pictogram centered in the frame.
- Transparent background after local chroma-key processing; do not draw a panel, card, label, border, floor, scenery, shadow blob, or UI chrome behind it.
- No readable text, no letters, no numbers, no watermark, no caption.
- Use a bold silhouette, thick dark outline, high contrast, minimal internal detail, and clear legibility at 20-32 px.
- Keep the design square, balanced, and uncluttered with generous empty space around the subject.

Icon: {job.title}
Subject:
{job.subject}

Strictly avoid:
{ga.NEGATIVE_GUIDE}
""".strip()


def normalize_icon(path: Path) -> None:
    if Image is None:
        return
    with Image.open(path) as src:
        im = src.convert("RGBA")
    alpha = im.getchannel("A")
    bbox = alpha.getbbox()
    if bbox:
        im = im.crop(bbox)
    max_side = max(im.size)
    pad = max(1, int(max_side * 0.18))
    canvas_side = max_side + pad * 2
    canvas = Image.new("RGBA", (canvas_side, canvas_side), (0, 0, 0, 0))
    canvas.alpha_composite(im, ((canvas_side - im.width) // 2, (canvas_side - im.height) // 2))
    canvas = canvas.resize((ICON_SIZE_PX, ICON_SIZE_PX), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    canvas.save(buf, format="PNG", optimize=True)
    path.write_bytes(buf.getvalue())


def write_manifest(selected: list[HeaderIconJob], *, using_refs: bool) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {
        "model": ga.MODEL,
        "output_dir": str(OUT_DIR.relative_to(ga.REPO_ROOT)),
        "single_attempt_per_image": True,
        "parallel": True,
        "transparent_background": True,
        "icon_size_px": ICON_SIZE_PX,
        "reference_images_used": using_refs,
        "jobs": [
            {
                "slug": job.slug,
                "title": job.title,
                "output": f"{job.slug}.png",
                "subject": job.subject,
            }
            for job in selected
        ],
    }
    (OUT_DIR / "header-icons-prompts.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    (OUT_DIR / "header-icons-README.md").write_text(
        "# Header Icons\n\n"
        "Generated with `scripts/replicate-art/header_icons_batch.py` using one Replicate create attempt per icon. "
        "The script runs all icon jobs in parallel and normalizes each transparent PNG to 256x256.\n",
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
        print("Refusing to run with existing header icon PNGs; remove them first for a fresh one-attempt set.", file=sys.stderr)
        for path in existing:
            print(f"  existing: {path}", file=sys.stderr)
        return 2

    def run_one(idx: int, job: HeaderIconJob) -> Path:
        print(f"[{idx}/{len(selected)}] {job.slug}")
        out = ga.run_job(
            job.slug,
            "1:1",
            "png",
            "transparent",
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
            log_monitor=True,
            poll_progress=True,
        )
        if out is None:
            raise RuntimeError(f"No output path for {job.slug}")
        normalize_icon(out)
        return out

    with ThreadPoolExecutor(max_workers=len(selected)) as executor:
        futures = {executor.submit(run_one, idx, job): job.slug for idx, job in enumerate(selected, start=1)}
        for future in as_completed(futures):
            slug = futures[future]
            try:
                path = future.result()
                print(f"[{slug}] complete: {path}")
            except Exception as exc:
                print(f"[{slug}] failed: {exc!s}", file=sys.stderr)
                raise

    print(f"Wrote header icons to {OUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
