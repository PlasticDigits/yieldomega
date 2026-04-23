#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""Batch-generate GitLab issue #45 art pack into frontend/public/art/pending_manual_review.

Run from repo:  cd scripts/replicate-art && .venv/bin/python issue45_batch.py
Options: --dry-run  --skip-existing  --start-from N  --sleep SEC (default 28)

Reference PNGs that Replicate false-flags (NSFW / channel-dimension warnings) are listed in
replicate_flagged_inputs.json and omitted from input_images (see flagged_inputs.py).
"""

from __future__ import annotations

import argparse
import io
import os
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

ResizeMode = Literal["scene_wide", "scene_mid", "portrait_768_1024", "cutout", "icon_256", "none"]

BUNNY_MOOD = (
    "Mature adult woman bunny-leprechaun mascot, confident playful body language and stylish fantasy arcade "
    "costume; tasteful pin-up-adjacent cartoon energy like a premium mobile game host—fully clothed, "
    "non-explicit, no nudity."
)


@dataclass(frozen=True)
class BatchJob:
    filename: str  # e.g. issue45-scene-home-desktop.jpg
    checklist_section: str  # "1) Scenes" etc.
    checklist_item: str  # verbatim short label from issue
    aspect_ratio: str
    background: str
    output_format: str  # png | jpeg
    resize: ResizeMode
    subject: str


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


def run_batch_job(
    job: BatchJob,
    *,
    out_dir: Path,
    retry_max: int,
    retry_delay: float,
    no_refs: bool,
) -> Path:
    import replicate

    prompt = ga.build_prompt(job.subject)
    out_fmt = ga.effective_output_format(job.output_format, job.background)
    ext = ga.format_to_ext(out_fmt)
    stem = job.filename.rsplit(".", 1)[0]
    final_name = f"{stem}.{ext}"
    out_path = out_dir / final_name

    inp: dict = {
        "prompt": prompt,
        "aspect_ratio": job.aspect_ratio,
        "quality": "high",
        "background": job.background,
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
                # Prefer short initial server wait; finish via client poll (avoids long-held HTTP disconnects).
                return client.run(ga.MODEL, input=inp, wait=1)
            finally:
                for h in handles:
                    h.close()
        inp["input_images"] = []
        return client.run(ga.MODEL, input=inp, wait=1)

    output = ga.run_with_retries(
        call_model,
        max_attempts=retry_max,
        base_delay_sec=retry_delay,
        job_label=stem,
    )
    if not output:
        raise RuntimeError(f"No output for {stem}")

    raw = _read_output_bytes(output)
    if Image is not None and job.resize != "none":
        raw = _resize_bytes(raw, job.resize, "png" if out_fmt == "png" else "jpeg")
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(raw)
    print(f"Wrote {out_path} ({len(raw)} bytes)")
    return out_path


def jobs() -> list[BatchJob]:
    j: list[BatchJob] = []

    # --- §1 Scenes ---
    j.append(
        BatchJob(
            "issue45-scene-home-hero-desktop.jpg",
            "1) Scenes & wide compositions",
            "Home / hub: wide hero (desktop)",
            "3:2",
            "opaque",
            "jpeg",
            "scene_wide",
            "Home hub wide landscape hero for desktop: arcade green-and-gold palette, hard-shadow panel language, "
            "bunny leprechaun girl + red-bearded leprechauns, hat-coins, voxel hills, rainbow, strong horizontal "
            "composition with negative space for nav and CTAs, energetic fair-launch story mood.",
        )
    )
    j.append(
        BatchJob(
            "issue45-scene-home-hero-mobile.jpg",
            "1) Scenes & wide compositions",
            "Home / hub: mobile crop variant",
            "2:3",
            "opaque",
            "jpeg",
            "portrait_768_1024",
            "Mobile-first vertical hero crop variant of the home hub: same arcade palette and mascots, bold focal "
            "cluster in upper-middle for small screens, breathable sky and ground bands, social-share friendly.",
        )
    )
    j.append(
        BatchJob(
            "issue45-scene-timecurve-simple.jpg",
            "1) Scenes & wide compositions",
            "TimeCurve Simple: timer + fair launch calm energy",
            "3:2",
            "opaque",
            "jpeg",
            "scene_wide",
            "TimeCurve Simple dedicated scene: calm fair-launch story, oversized friendly countdown dial, soft "
            "sparkle trails, voxel hills, bunny leprechaun girl as welcoming guide, less aggressive than Arena—"
            "trust and clarity mood.",
        )
    )
    j.append(
        BatchJob(
            "issue45-scene-timecurve-arena.jpg",
            "1) Scenes & wide compositions",
            "TimeCurve Arena: PvP / podium tension",
            "3:2",
            "opaque",
            "jpeg",
            "scene_wide",
            "TimeCurve Arena backplate: competitive podium energy, dramatic side lighting, rival leprechaun teams, "
            "trophy hat-coins, tension lines and arena gates, distinct from Simple calm—PvP spectacle.",
        )
    )
    j.append(
        BatchJob(
            "issue45-scene-timecurve-protocol.jpg",
            "1) Scenes & wide compositions",
            "TimeCurve Protocol: operator / audit neutral backdrop",
            "3:2",
            "opaque",
            "jpeg",
            "scene_mid",
            "Neutral protocol backdrop: cleaner geometry, muted-but-on-brand greens, ledger scroll motifs, shield "
            "and check-badge shapes, still arcade cartoon but more serious—audit and operator clarity.",
        )
    )
    j.append(
        BatchJob(
            "issue45-scene-rabbit-treasury.jpg",
            "1) Scenes & wide compositions",
            "Rabbit Treasury: reserve / burrow / chart-adjacent",
            "3:2",
            "opaque",
            "jpeg",
            "scene_wide",
            "Rabbit Treasury scene: cozy burrow vault, stacked reserves, white rabbit mascot, emerald charts as "
            "decorative stained glass—not readable numbers—coin piles, warm premium treasury mood.",
        )
    )
    j.append(
        BatchJob(
            "issue45-scene-collection-gallery.jpg",
            "1) Scenes & wide compositions",
            "Collection: gallery-forward (shelves / vault / grid)",
            "3:2",
            "opaque",
            "jpeg",
            "scene_wide",
            "NFT collection gallery scene: glowing shelves, magical vault door grid, portrait frames with "
            "silhouettes only (no specific NFT art), rainbow accent lighting, collectible showcase vibe.",
        )
    )
    j.append(
        BatchJob(
            "issue45-scene-referrals-network.jpg",
            "1) Scenes & wide compositions",
            "Referrals: network / invitation threads motif",
            "3:2",
            "opaque",
            "jpeg",
            "scene_wide",
            "Referrals illustration: glowing invitation threads between mascots, combo bonus ribbons, share nodes as "
            "chunky gems, distinct from generic home hero—social graph fantasy.",
        )
    )
    j.append(
        BatchJob(
            "issue45-scene-kumbaya-strip.jpg",
            "1) Scenes & wide compositions",
            "Kumbaya: branded scene strip for embedded DEX",
            "3:2",
            "opaque",
            "jpeg",
            "scene_mid",
            "Short wide branded strip for embedded liquidity page: cauldron pool, flowing green-gold liquidity, "
            "hat-coins orbiting, fits above/below iframe—compact readable band.",
        )
    )
    j.append(
        BatchJob(
            "issue45-scene-sir-strip.jpg",
            "1) Scenes & wide compositions",
            "Sir: branded scene strip for embedded DEX",
            "3:2",
            "opaque",
            "jpeg",
            "scene_mid",
            "Short wide branded strip for Sir trading embed: market counter energy, gorilla merchant silhouette in "
            "blocky arcade style, leprechaun customer, banners—compact strip not a full page.",
        )
    )
    j.append(
        BatchJob(
            "issue45-scene-launch-countdown.jpg",
            "1) Scenes & wide compositions",
            "Launch countdown key art (OG/social ratio)",
            "3:2",
            "opaque",
            "jpeg",
            "scene_wide",
            "Launch countdown key art: locked composition for LaunchCountdownPage, central countdown hero, "
            "mascots cheering, fireworks sparkles, voxel hills, bold center-weighted for crops.",
        )
    )
    j.append(
        BatchJob(
            "issue45-scene-error-indexer-down.jpg",
            "1) Scenes & wide compositions",
            "Error / empty: indexer degraded illustration",
            "3:2",
            "opaque",
            "jpeg",
            "scene_mid",
            "Light error illustration: bunny leprechaun girl shrugging beside a sleepy tortoise-indexer mascot, "
            "broken sparkle cable, friendly apology mood—not alarming.",
        )
    )
    j.append(
        BatchJob(
            "issue45-scene-error-wrong-network.jpg",
            "1) Scenes & wide compositions",
            "Error / empty: wrong network illustration",
            "3:2",
            "opaque",
            "jpeg",
            "scene_mid",
            "Wrong network illustration: mascots at a mismatched portal gate, confused leprechaun holding two "
            "different glowing chain orbs (abstract), humorous gentle correction mood.",
        )
    )

    # --- §2 Cutouts ---
    for pose_slug, pose_desc in [
        ("wave", f"Full body wave toward viewer, welcoming host energy. {BUNNY_MOOD}"),
        ("jump", f"Full body mid-jump arc, energetic victory hop. {BUNNY_MOOD}"),
        ("thinking", f"Full body thoughtful pose, hand on chin, clever scheme expression. {BUNNY_MOOD}"),
        ("podium-win", f"Full body on winner podium step, trophy hat-coin held high. {BUNNY_MOOD}"),
        ("guarding", f"Full body defensive guard stance protecting a pile of hat-coins, WarBow personality. {BUNNY_MOOD}"),
        ("sneak-steal", f"Full body sneaky tiptoe steal pose with grin, playful rogue energy for Arena copy. {BUNNY_MOOD}"),
    ]:
        j.append(
            BatchJob(
                f"issue45-cutout-bunny-{pose_slug}.png",
                "2) Cutouts & characters",
                f"Mascot pose: {pose_slug.replace('-', ' ')}",
                "2:3",
                "transparent",
                "png",
                "cutout",
                f"Bunny leprechaun girl mascot cutout, alpha background, consistent lighting, bold line weight. {pose_desc}",
            )
        )
    j.append(
        BatchJob(
            "issue45-cutout-leprechaun-bag-bunny-pair.png",
            "2) Cutouts & characters",
            "Leprechaun w/ bag vs bunny-leprechaun-girl style pairing reference",
            "2:3",
            "transparent",
            "png",
            "cutout",
            "Pair cutout for style parity: red-bearded leprechaun with coin bag standing beside bunny leprechaun girl, "
            "matched line weight, matched drop shadow style, same scale for header use—transparent background.",
        )
    )
    j.append(
        BatchJob(
            "issue45-cutout-trait-silos-concept.png",
            "2) Cutouts & characters",
            "Trait-adjacent silos (style alignment concept)",
            "1:1",
            "transparent",
            "png",
            "cutout",
            "Concept board: four blank silhouette mannequins in different hat silhouettes only—style alignment demo "
            "for future traits, no copied NFT art, chunky outlines.",
        )
    )
    j.append(
        BatchJob(
            "issue45-cutout-footer-micro.png",
            "2) Cutouts & characters",
            "Footer / micro-decoration (indexer / fee hint)",
            "1:1",
            "transparent",
            "png",
            "icon_256",
            "Tiny leprechaun peeking from behind a gold coin stack, subtle footer decoration, minimal detail noise.",
        )
    )

    # --- §3 Icons (raster drafts; trace to SVG in production) ---
    def icon_subject(label: str, glyph: str) -> str:
        return (
            f"Single UI icon glyph centered on transparent background: {label}. {glyph} "
            "Bold chunky arcade silhouette, readable at 32px, thick outlines, no text, no extra icons."
        )

    for sym, subj in [
        ("token-cl8y", "CL8Y token badge: stylized clover-eight motif abstract, green-gold"),
        ("token-doub", "DOUB token badge: doubled coin motif, green-gold"),
        ("token-charm", "CHARM token badge: heart-charm loop motif, pink-green-gold accent"),
        ("token-usdm", "USDm stable context coin: muted slate-green ring with small peg motif, calm"),
    ]:
        j.append(
            BatchJob(
                f"issue45-icon-{sym}.png",
                "3) Icons & UI micro-graphics",
                f"Token / asset icon draft: {sym.split('-')[-1].upper()}",
                "1:1",
                "transparent",
                "png",
                "icon_256",
                icon_subject(sym.replace("-", " "), subj),
            )
        )

    for sym, subj in [
        ("status-live", "pulsing play-dot with soft aura, LIVE badge"),
        ("status-ended", "checkered finish flag with coin, ENDED"),
        ("status-prelanch", "sleeping moon over coin, PRE-LAUNCH"),
        ("status-cooldown", "chunky clock with frozen gear, cooldown"),
        ("status-net-ok", "shield with green check, network healthy"),
        ("status-net-warn", "triangle alert with chain link crack, network warning"),
        ("status-indexer-ok", "rabbit with green pulse bars, indexer ok"),
        ("status-indexer-bad", "rabbit with dim bars and snail, indexer degraded"),
    ]:
        j.append(
            BatchJob(
                f"issue45-icon-{sym}.png",
                "3) Icons & UI micro-graphics",
                f"Status icon: {sym}",
                "1:1",
                "transparent",
                "png",
                "icon_256",
                icon_subject(sym, subj),
            )
        )

    for sym, subj in [
        ("warbow-guard", "raised shield blocking spark, GUARD"),
        ("warbow-steal", "swift swipe arc with grabbed coin, STEAL"),
        ("warbow-revenge", "boomerang coin coming back, REVENGE"),
        ("warbow-flag", "tiny flag on pole with coin emblem, FLAG"),
    ]:
        j.append(
            BatchJob(
                f"issue45-icon-{sym}.png",
                "3) Icons & UI micro-graphics",
                f"WarBow action icon: {sym}",
                "1:1",
                "transparent",
                "png",
                "icon_256",
                icon_subject(sym, subj),
            )
        )

    for sym, subj in [
        ("nav-simple", "calm sun-over-hill, Simple mode"),
        ("nav-arena", "crossed swords made of coins, Arena mode"),
        ("nav-protocol", "gears with shield, Protocol mode"),
    ]:
        j.append(
            BatchJob(
                f"issue45-icon-{sym}.png",
                "3) Icons & UI micro-graphics",
                f"TimeCurve subnav pictogram: {sym}",
                "1:1",
                "transparent",
                "png",
                "icon_256",
                icon_subject(sym, subj),
            )
        )

    j.append(
        BatchJob(
            "issue45-icon-chart-accessibility.png",
            "3) Icons & UI micro-graphics",
            "Charts: color-blind safe pair swatch concept",
            "1:1",
            "transparent",
            "png",
            "icon_256",
            "Single reference tile showing two thick chart lines—teal vs amber—with hatch patterns for accessibility, "
            "no axes text, icon sheet style.",
        )
    )

    # --- §4 Cursors (PNG drafts; document hotspot in checklist) ---
    j.append(
        BatchJob(
            "issue45-cursor-primary-cta.png",
            "4) Mouse cursors & pointer affordances",
            "Primary CTA cursor / pointer draft (hotspot top-left)",
            "1:1",
            "transparent",
            "png",
            "icon_256",
            "Large arrow-pointer made of glossy gold with green outline, game UI style, transparent—design intent "
            "for .cur export with hotspot top-left.",
        )
    )
    j.append(
        BatchJob(
            "issue45-cursor-danger-pvp.png",
            "4) Mouse cursors & pointer affordances",
            "Danger / PvP hover treatment glyph",
            "1:1",
            "transparent",
            "png",
            "icon_256",
            "Cursor alternative: not prank—clear crimson-gold warning ring pointer, chunky, transparent background.",
        )
    )
    j.append(
        BatchJob(
            "issue45-cursor-slider-grab.png",
            "4) Mouse cursors & pointer affordances",
            "Slider / buy control grab hand draft",
            "1:1",
            "transparent",
            "png",
            "icon_256",
            "Chunky gloved grab hand for slider, green gold, open palm to closed—static single pose open grab.",
        )
    )

    # --- §5 Social ---
    j.append(
        BatchJob(
            "issue45-social-og-wide.jpg",
            "5) Social / meta & app chrome",
            "Open Graph wide image draft",
            "3:2",
            "opaque",
            "jpeg",
            "scene_wide",
            "Wide OG share art: bold center cluster, mascots, hat-coins, voxel hills—safe for messaging crop.",
        )
    )
    j.append(
        BatchJob(
            "issue45-social-og-square.jpg",
            "5) Social / meta & app chrome",
            "Twitter / square 1:1 share variant",
            "1:1",
            "opaque",
            "jpeg",
            "scene_mid",
            "Square 1:1 social avatar/preview: bunny leprechaun girl portrait bust with hat-coin, vibrant background.",
        )
    )
    j.append(
        BatchJob(
            "issue45-social-favicon-source.png",
            "5) Social / meta & app chrome",
            "Favicon / maskable PWA source from mascot geometry",
            "1:1",
            "transparent",
            "png",
            "icon_256",
            "Single centered hat-coin emblem suitable for favicon trace—bold simple shapes, transparent.",
        )
    )
    j.append(
        BatchJob(
            "issue45-social-wallet-modal-chrome.jpg",
            "5) Social / meta & app chrome",
            "Wallet modal surrounding chrome (page background)",
            "2:3",
            "opaque",
            "jpeg",
            "portrait_768_1024",
            "Soft vertical page chrome when wallet modal imagined open: blurred-stylized arcade panels behind, "
            "non-distracting, vertical mobile proportion.",
        )
    )

    # --- §6 Motion (still keyframes / concepts) ---
    j.append(
        BatchJob(
            "issue45-motion-route-transition.jpg",
            "6) Motion & VFX",
            "Route transition VFX concept still",
            "3:2",
            "opaque",
            "jpeg",
            "scene_mid",
            "Motion concept still: soft whoosh ribbon between two panels, coin sparkle trail, subtle not flashy—"
            "for documentation of max-duration VFX.",
        )
    )
    j.append(
        BatchJob(
            "issue45-motion-countdown-tick.png",
            "6) Motion & VFX",
            "Countdown tick / flip motif concept",
            "1:1",
            "transparent",
            "png",
            "icon_256",
            "Split flap board showing abstract segments, no numbers, chunky—concept for countdown tick without seizure "
            "risk colors.",
        )
    )
    j.append(
        BatchJob(
            "issue45-motion-victory-podium.jpg",
            "6) Motion & VFX",
            "Victory / podium confetti motif",
            "3:2",
            "opaque",
            "jpeg",
            "scene_mid",
            "Victory podium still: confetti burst, medal hat-coins, separated from trading UI context—celebration panel.",
        )
    )

    return j


def write_checklist_md(out_dir: Path, all_jobs: list[BatchJob]) -> None:
    issue_url = "https://gitlab.com/PlasticDigits/yieldomega/-/issues/45"
    lines = [
        f"# GitLab issue #45 — generated art pack (pending manual review)",
        "",
        f"Source checklist: [{issue_url}]({issue_url})",
        "",
        "All files below are **drafts** for human QA before promoting into production paths. "
        "Icons are **PNG raster** drafts—trace to SVG per export spec where required.",
        "",
        "Generation settings: **openai/gpt-image-2**, `quality=high`, `moderation=low`, `number_of_images=1`, "
        "reference `style.png` + `token-logo.png` (+ `sir.png` for Sir strip). "
        "Post-process: longest side capped (**≤1920**, typically **≤1536** for wide scenes; cutouts **≤1024**; "
        "icons **≤256**; portrait mobile fits **768×1024** box without upscaling). "
        "API calls use short `Prefer: wait` and client-side polling for completion.",
        "",
    ]

    by_section: dict[str, list[BatchJob]] = {}
    for job in all_jobs:
        by_section.setdefault(job.checklist_section, []).append(job)

    for section in sorted(by_section.keys()):
        lines.append(f"## {section}")
        lines.append("")
        for job in by_section[section]:
            stem = job.filename.rsplit(".", 1)[0]
            final = f"{stem}.{ga.format_to_ext(ga.effective_output_format(job.output_format, job.background))}"
            lines.append(f"- [ ] **{job.checklist_item}** — [`{final}`](./{final})")
        lines.append("")

    lines.extend(
        [
            "## 7) Audio",
            "",
            "- [ ] **UI sounds (optional scope)** — *No raster deliverable; see issue text (off by default, opt-in).*",
            "",
            "## Deliverable notes (from issue)",
            "",
            "- Link export specs: format (SVG vs PNG@2x), max file size for IPFS, license—align with maintainers before ship.",
            "",
        ]
    )

    (out_dir / "ISSUE_45_CHECKLIST.md").write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {out_dir / 'ISSUE_45_CHECKLIST.md'}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Issue #45 art batch → pending_manual_review")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--skip-existing", action="store_true")
    parser.add_argument("--start-from", type=int, default=0, help="0-based job index to start from")
    parser.add_argument("--sleep", type=float, default=28.0, help="Seconds between successful API calls")
    parser.add_argument("--no-ref-images", action="store_true")
    parser.add_argument("--write-md-only", action="store_true", help="Only rewrite ISSUE_45_CHECKLIST.md from job list")
    parser.add_argument("--max-jobs", type=int, default=0, help="Stop after N successful API jobs (0 = no limit)")
    args = parser.parse_args()

    ga.load_env()
    token = os.environ.get("REPLICATE_API_TOKEN", "").strip()
    if not args.dry_run and not args.write_md_only and not token:
        print("REPLICATE_API_TOKEN missing", file=sys.stderr)
        return 1
    if not args.dry_run:
        os.environ["REPLICATE_API_TOKEN"] = token

    out_dir = ga.REPO_ROOT / "frontend" / "public" / "art" / "pending_manual_review"
    out_dir.mkdir(parents=True, exist_ok=True)

    all_jobs = jobs()
    if args.write_md_only:
        write_checklist_md(out_dir, all_jobs)
        return 0

    if Image is None and not args.dry_run:
        print("Warning: Pillow not installed; images will not be resized. pip install Pillow", file=sys.stderr)

    finished = 0

    for idx, job in enumerate(all_jobs):
        if idx < args.start_from:
            continue
        stem = job.filename.rsplit(".", 1)[0]
        ext_guess = ga.format_to_ext(ga.effective_output_format(job.output_format, job.background))
        candidate = out_dir / f"{stem}.{ext_guess}"
        if args.skip_existing and candidate.is_file():
            print(f"Skip existing {candidate}")
            continue

        print(f"[{idx + 1}/{len(all_jobs)}] {job.filename} …")
        if args.dry_run:
            print(f"  section: {job.checklist_section}")
            print(f"  item: {job.checklist_item}")
            continue

        run_batch_job(
            job,
            out_dir=out_dir,
            retry_max=8,
            retry_delay=20.0,
            no_refs=args.no_ref_images,
        )
        finished += 1
        if args.max_jobs and finished >= args.max_jobs:
            print(f"--max-jobs {args.max_jobs} reached; stopping early.")
            break
        if idx < len(all_jobs) - 1 and args.sleep > 0:
            time.sleep(args.sleep)

    write_checklist_md(out_dir, all_jobs)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
