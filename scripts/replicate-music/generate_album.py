#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""Generate a full instrumental album (minimax/music-2.6) with unified theme, unique tracks.

Each track shares the same style bible (cheerful fantasy arcade + hills adventure) and varies
BPM, key, lead voice, and energy. Reuses generation helpers from ``generate_instrumental.py``.

  cd scripts/replicate-music
  . .venv/bin/activate
  export REPLICATE_API_TOKEN=...
  python generate_album.py --part 1 --all
  python generate_album.py --part 2 --all
  python generate_album.py --part 2 --track 5
  python generate_album.py --part 1 --all --resume --dry-run
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import generate_instrumental as inst

# Shared tail on every prompt so the album feels like one release (keep under ~2k chars total).
STYLE_BIBLE = (
    "Cheerful fantasy arcade hybrid, bright and playful not moody, bouncy quantized groove, "
    "fantasy hills and hat-coin adventure energy, glossy casual mobile-game lobby mix, "
    "wide happy soundstage, "
    "instrumental only, no vocals, no singing, no voice, no choir, no spoken word"
)

# Order = album flow. ``unique`` is the per-track hook; full prompt = unique + bible.
ALBUM_PART_1: tuple[dict[str, Any], ...] = (
    {
        "index": 1,
        "slug": "01-hills-dawn",
        "title": "Hills Dawn",
        "unique": (
            "G major, 100 BPM, opening title energy, warm pennywhistle lead with answering fiddle, "
            "sparkly plucky synth arps, gentle orchestral strings, tight punchy drums, "
            "full cheerful hybrid as the album anchor"
        ),
    },
    {
        "index": 2,
        "slug": "02-coin-path",
        "title": "Coin Path",
        "unique": (
            "D major, 108 BPM, browsing and shopping energy, plucky marimba-like arps and bright "
            "staccato strings in front, whistle fills in gaps, drums light and nimble, airy mix"
        ),
    },
    {
        "index": 3,
        "slug": "03-rainbow-switchback",
        "title": "Rainbow Switchback",
        "unique": (
            "C major, 112 BPM, playful arcade level, chiptune-style square lead slightly forward, "
            "fiddle counter-melody every four bars, bubbly bass, snappy hats, rainbow sparkle accents"
        ),
    },
    {
        "index": 4,
        "slug": "04-moss-and-brass",
        "title": "Moss & Brass",
        "unique": (
            "G major, 96 BPM, safe hub and settings vibe, rounder warmer tone, soft hand percussion, "
            "low warm brass pads very gentle, fewer chiptune edges, cozy midrange, relaxed swing feel"
        ),
    },
    {
        "index": 5,
        "slug": "05-jig-generator",
        "title": "Jig Generator",
        "unique": (
            "A major, 118 BPM, mini-game intensity, jig-like dotted rhythmic drive still quantized, "
            "whistle lead, snappier kick and snare, fiddle harmony stabs, rising energy no darkness"
        ),
    },
    {
        "index": 6,
        "slug": "06-starline-overworld",
        "title": "Starline Overworld",
        "unique": (
            "E minor, 104 BPM, bright melodic fantasy not sad, airy pads with light delay tails, "
            "sparse drums in verses building to fuller chorus lift, twinkling highs, open sky mood"
        ),
    },
    {
        "index": 7,
        "slug": "07-lucky-run",
        "title": "Lucky Run",
        "unique": (
            "G major, 114 BPM, streak and near-win excitement, driving four-on-the-floor friendly kick, "
            "very light brassy synth stabs for cheer not aggression, fiddle and arp doubles, forward motion"
        ),
    },
    {
        "index": 8,
        "slug": "08-kumbaya-campfire",
        "title": "Kumbaya Campfire",
        "unique": (
            "D major, 92 BPM, finale wind-down after play session, strip back to warm nylon guitar plucks, "
            "soft string pad, minimal drums, tiny sparkle percussion, intimate close happy ending"
        ),
    },
)

# Part 2: same world / style bible, new scenes and arrangements (no duplicate titles vs part 1).
ALBUM_PART_2: tuple[dict[str, Any], ...] = (
    {
        "index": 1,
        "slug": "01-emerald-gate",
        "title": "Emerald Gate",
        "unique": (
            "Bb major, 102 BPM, regal welcome pulse, soft synth fanfare hits blended with Irish flute, "
            "shimmering harp-like plucks, confident walking bass, bright hall reverb, stately but cute"
        ),
    },
    {
        "index": 2,
        "slug": "02-rabbit-run",
        "title": "Rabbit Run",
        "unique": (
            "F major, 106 BPM, nimble staccato strings and skipping pennywhistle call-and-response, "
            "light tom fills, forest-path scamper energy that stays playful never intense"
        ),
    },
    {
        "index": 3,
        "slug": "03-pot-of-pulse",
        "title": "Pot of Pulse",
        "unique": (
            "Eb major, 110 BPM, syncopated groove pocket, clavinet chunk chords, funky electric bass, "
            "disco-adjacent hi-hat sparkle, tiny gold glitter percussion hits"
        ),
    },
    {
        "index": 4,
        "slug": "04-cloud-save-point",
        "title": "Cloud Save Point",
        "unique": (
            "A major, 88 BPM, floating save-menu calm, wide soft supersaw pad bed, solo celeste-like "
            "lead very gentle, minimal kick, airy mix, low distraction"
        ),
    },
    {
        "index": 5,
        "slug": "05-arcade-scuffle",
        "title": "Arcade Scuffle",
        "unique": (
            "C major, 116 BPM, playful cartoon competition, brassy oompah synth punches, "
            "bouncy pizzicato low strings, snappy snare, never aggressive or dark, comedy battle vibe"
        ),
    },
    {
        "index": 6,
        "slug": "06-prism-shop",
        "title": "Prism Shop",
        "unique": (
            "E major, 100 BPM, glassy FM bell keys and rainbow-tint delay throws, muted funky guitar "
            "scratch ghost notes, boutique shopping sparkle, crisp transients"
        ),
    },
    {
        "index": 7,
        "slug": "07-double-rainbow-bridge",
        "title": "Double Rainbow Bridge",
        "unique": (
            "D major, 102 BPM, crossing epic lite, stacked octave string rises, chiptune echo lead "
            "doubled by fiddle, hopeful plateau climax, wide crescendo then breathe"
        ),
    },
    {
        "index": 8,
        "slug": "08-logging-off-lullaby",
        "title": "Logging Off Lullaby",
        "unique": (
            "G major, 90 BPM, session end wind-down, soft felt piano and muted nylon guitar, "
            "whisper-soft brushed drums, cozy firefly fade, intimate close mix"
        ),
    },
)

ALBUM_SPECS: dict[str, dict[str, Any]] = {
    "1": {"key": "part_1", "dir_name": "album_part_1", "tracks": ALBUM_PART_1},
    "2": {"key": "part_2", "dir_name": "album_part_2", "tracks": ALBUM_PART_2},
}


def full_prompt(track: dict[str, Any]) -> str:
    return f"{track['unique'].strip()}. {STYLE_BIBLE}"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Generate album part 1 or 2 (8 unified instrumental tracks each) via minimax/music-2.6."
    )
    p.add_argument(
        "--part",
        type=str,
        choices=("1", "2"),
        default="1",
        help="Album part: 1 (default) or 2 — separate track lists and output folders.",
    )
    p.add_argument(
        "--all",
        action="store_true",
        help="Generate every track in album order (01–08).",
    )
    p.add_argument(
        "--track",
        type=int,
        metavar="N",
        choices=range(1, 9),
        help="Generate a single track by index 1–8.",
    )
    p.add_argument(
        "--list",
        action="store_true",
        help="Print track list and exit (no API calls).",
    )
    p.add_argument(
        "--out-dir",
        type=Path,
        default=None,
        help="Output directory (default: ./output/album_part_<N> from --part).",
    )
    p.add_argument(
        "--sample-rate",
        type=int,
        default=32000,
        choices=inst.SAMPLE_RATES,
        help="Sample rate (default: 32000).",
    )
    p.add_argument(
        "--bitrate",
        type=int,
        default=128000,
        choices=inst.BITRATES,
        help="Bitrate (default: 128000).",
    )
    p.add_argument(
        "--audio-format",
        type=str,
        default="mp3",
        choices=inst.AUDIO_FORMATS,
        help="Output format (default: mp3).",
    )
    p.add_argument(
        "--prefer-wait",
        type=int,
        default=1,
        help="Replicate Prefer: wait seconds 1–60 (default: 1).",
    )
    p.add_argument(
        "--max-wall-seconds",
        type=float,
        default=None,
        help="Override REPLICATE_MAX_GENERATION_SECONDS for this run.",
    )
    p.add_argument("--dry-run", action="store_true")
    p.add_argument(
        "--resume",
        action="store_true",
        help="Skip tracks whose output file already exists (>= 512 bytes).",
    )
    return p.parse_args()


def main() -> None:
    inst.load_env()
    args = parse_args()
    prefer_wait = max(1, min(60, args.prefer_wait))
    spec = ALBUM_SPECS[args.part]
    album_tracks: tuple[dict[str, Any], ...] = spec["tracks"]
    album_key: str = spec["key"]

    if args.list:
        print(f"Album {album_key} ({spec['dir_name']}/)")
        for t in album_tracks:
            print(f"{t['index']:02d}  {t['slug']}  —  {t['title']}")
        return

    if args.all and args.track is not None:
        print("Use either --all or --track N, not both.", file=sys.stderr)
        sys.exit(2)

    if not args.all and args.track is None:
        print("Specify --all, --track N (1–8), or --list.", file=sys.stderr)
        sys.exit(2)

    tracks = list(album_tracks) if args.all else [t for t in album_tracks if t["index"] == args.track]
    if not tracks:
        sys.exit(2)

    out_dir = (
        args.out_dir.resolve()
        if args.out_dir is not None
        else (inst.SCRIPT_DIR / "output" / spec["dir_name"]).resolve()
    )
    manifest: list[dict[str, Any]] = []
    total = len(tracks)

    for i, t in enumerate(tracks, start=1):
        ext = args.audio_format if args.audio_format != "pcm" else "pcm"
        out_path = out_dir / f"{t['slug']}.{ext}"
        prompt = full_prompt(t)
        preview = prompt.replace("\n", " ")
        if len(preview) > 140:
            preview = preview[:137] + "..."
        print(
            f"[{t['slug']}] ({i}/{total}) {t['title']} — preview: {preview}",
            file=sys.stderr,
        )

        if (
            args.resume
            and not args.dry_run
            and out_path.is_file()
            and out_path.stat().st_size >= 512
        ):
            print(
                f"[resume] skip existing ({out_path.stat().st_size} bytes): {out_path}",
                file=sys.stderr,
            )
            manifest.append(
                {
                    "album": album_key,
                    "index": t["index"],
                    "slug": t["slug"],
                    "title": t["title"],
                    "model": inst.MODEL_REF,
                    "is_instrumental": True,
                    "sample_rate": args.sample_rate,
                    "bitrate": args.bitrate,
                    "audio_format": args.audio_format,
                    "output": str(out_path),
                    "prompt": prompt,
                    "style_bible": STYLE_BIBLE,
                    "skipped_existing": True,
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            continue

        inp = inst.build_input(
            prompt=prompt,
            sample_rate=args.sample_rate,
            bitrate=args.bitrate,
            audio_format=args.audio_format,
        )
        written = inst.run_generation(
            inp=inp,
            dry_run=args.dry_run,
            out_path=out_path,
            job_label=t["slug"],
            prefer_wait=prefer_wait,
            max_wall_seconds=args.max_wall_seconds,
        )
        manifest.append(
            {
                "album": album_key,
                "index": t["index"],
                "slug": t["slug"],
                "title": t["title"],
                "model": inst.MODEL_REF,
                "is_instrumental": True,
                "sample_rate": args.sample_rate,
                "bitrate": args.bitrate,
                "audio_format": args.audio_format,
                "output": str(written) if written else None,
                "prompt": prompt,
                "style_bible": STYLE_BIBLE,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }
        )

    if not args.dry_run and manifest:
        man_path = out_dir / f"manifest_album_{album_key}.json"
        man_path.parent.mkdir(parents=True, exist_ok=True)
        merged_by_slug: dict[str, Any] = {}
        if man_path.is_file():
            try:
                prev = json.loads(man_path.read_text(encoding="utf-8"))
                if isinstance(prev, list):
                    for row in prev:
                        if isinstance(row, dict) and row.get("slug"):
                            merged_by_slug[str(row["slug"])] = row
            except json.JSONDecodeError:
                pass
        for row in manifest:
            merged_by_slug[str(row["slug"])] = row
        merged = sorted(merged_by_slug.values(), key=lambda r: int(r.get("index", 0)))
        man_path.write_text(json.dumps(merged, indent=2) + "\n", encoding="utf-8")
        print(f"[ok] wrote {man_path}")


if __name__ == "__main__":
    main()
