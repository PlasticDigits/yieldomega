#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""Generate a full instrumental album (minimax/music-2.6) with unified theme, unique tracks.

Each track shares the same style bible (Yield Omega Glass Arena — Time Arena command
console) and varies BPM, key, lead voice, and energy. Reuses generation helpers from
``generate_instrumental.py``.

**Replicate network timeouts:** ``httpx.ReadTimeout`` during create or poll is normal for
music jobs and usually means the prediction is already processing on Replicate. Each track
writes its prediction id to ``output/album_part_<N>/ledger_part_<N>.json`` immediately after
create succeeds. If create flakes before the id is saved, check the dashboard and pin the id
with ``--pin-prediction SLUG ID`` before retrying — never blind re-run the same track.

Failed tracks are recorded in ``failed_part_<N>.json`` and are **not** retried on later
``--resume`` runs unless you remove the slug from that file.

  cd scripts/replicate-music
  . .venv/bin/activate
  export REPLICATE_API_TOKEN=...
  python generate_album.py --part 1 --all --resume --max-workers 8
  python generate_album.py --both-parts --all --resume --max-workers 8
  python generate_album.py --part 1 --pin-prediction 01-console-boot <prediction_id>
  bash promote_album_to_public.sh
"""

from __future__ import annotations

import argparse
import concurrent.futures
import fcntl
import json
import sys
import threading
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import generate_instrumental as inst

# Shared tail on every prompt so the album feels like one release (keep under ~2k chars total).
STYLE_BIBLE = (
    "Cyberminimalist command-console instrumental, dark tactical navy atmosphere with emerald "
    "and teal live accents, warm gold DOUB prize motifs used sparingly, restrained glassy "
    "synth textures, soft sub bass, hypnotic quantized groove low distraction for long Arena "
    "sessions, wide controlled mix, PvP glass arena energy not cheerful fantasy arcade, "
    "no Irish folk, no chiptune carnival, no pennywhistle, "
    "instrumental only, no vocals, no singing, no voice, no choir, no spoken word"
)

# Order = album flow. ``unique`` is the per-track hook; full prompt = unique + bible.
ALBUM_PART_1: tuple[dict[str, Any], ...] = (
    {
        "index": 1,
        "slug": "01-console-boot",
        "title": "Console Boot",
        "unique": (
            "D major, 90 BPM, gentle console wake with warm hopeful lift not sad or dark, soft bright pad bloom "
            "slow fade-in, mellow sub bass, no filter sweeps no whoosh no riser no scratch wipe no impact hit, "
            "light brushed percussion enters late only, calm optimistic lobby bed, inviting not melancholic"
        ),
    },
    {
        "index": 2,
        "slug": "02-doub-route",
        "title": "DOUB Route",
        "unique": (
            "D minor, 106 BPM, buy-flow and routing energy, tight muted pluck arps, filtered noise "
            "sweeps, teal hi-hat ticks, warm gold transient accents on downbeats, nimble low-mid groove"
        ),
    },
    {
        "index": 3,
        "slug": "03-pay-switch",
        "title": "Pay Switch",
        "unique": (
            "G major, 98 BPM, calm pay-mode routing bed with soft upward energy not tense or sad, rounded muted "
            "pluck chords warm and soft not beepy, smooth legato glass pad glide no stabs no alarms, gentle sub "
            "pulse, soft hi-hats very low in mix, no harsh transients no digital chirps no square lead, "
            "relaxed friendly groove low distraction, bright but not cheesy, compact 2 to 3 minute arrangement"
        ),
    },
    {
        "index": 4,
        "slug": "04-audit-hub",
        "title": "Audit Hub",
        "unique": (
            "A minor, 94 BPM, AUDIT and settings calm, round dark pad bed, soft brushed electronic percussion, "
            "low warm synth brass pads very gentle, minimal transients, relaxed quantized swing, low distraction"
        ),
    },
    {
        "index": 5,
        "slug": "05-podium-pulse",
        "title": "Podium Pulse",
        "unique": (
            "F minor, 116 BPM, podium competition intensity, driving dotted synth bass still quantized, "
            "emerald lead stabs, snappier kick and rim, rising energy tactical not cartoon, forward motion"
        ),
    },
    {
        "index": 6,
        "slug": "06-last-buy",
        "title": "Last Buy",
        "unique": (
            "E minor, 102 BPM, Last Buy timer tension bright not sad, airy navy pads with light delay tails, "
            "sparse drums building to fuller chorus lift, teal twinkle highs, countdown command-center mood"
        ),
    },
    {
        "index": 7,
        "slug": "07-streak-lock",
        "title": "Streak Lock",
        "unique": (
            "G minor, 112 BPM, defended streak and near-win excitement, driving four-on-the-floor kick subdued, "
            "gold synth stabs for reward not aggression, glass arp doubles, hypnotic forward motion"
        ),
    },
    {
        "index": 8,
        "slug": "08-session-close",
        "title": "Session Close",
        "unique": (
            "D minor, 90 BPM, session wind-down after Arena play, strip back to muted nylon plucks through "
            "low-pass, soft dark string pad, minimal drums, faint emerald sparkle percussion, intimate close"
        ),
    },
)

# Part 2: same glass-arena bible, new scenes (public album indices 09–16).
ALBUM_PART_2: tuple[dict[str, Any], ...] = (
    {
        "index": 1,
        "slug": "01-arena-gate",
        "title": "Arena Gate",
        "unique": (
            "Bb minor, 100 BPM, regal console welcome pulse, soft synth fanfare hits emerald tinted, "
            "shimmering glass plucks, confident walking sub bass, dark hall reverb, stately tactical not cute"
        ),
    },
    {
        "index": 2,
        "slug": "02-warbow-scout",
        "title": "WarBow Scout",
        "unique": (
            "F minor, 104 BPM, nimble staccato synth strings and skipping glass lead call-and-response, "
            "light tom fills, recon scamper energy that stays tense never cartoon"
        ),
    },
    {
        "index": 3,
        "slug": "03-prize-pulse",
        "title": "Prize Pulse",
        "unique": (
            "Eb minor, 108 BPM, syncopated groove pocket, muted clavinet chunk chords, funky sub bass, "
            "teal hi-hat sparkle, tiny gold glitter percussion hits on prize moments"
        ),
    },
    {
        "index": 4,
        "slug": "04-indexer-sync",
        "title": "Indexer Sync",
        "unique": (
            "A minor, 86 BPM, floating indexer-sync calm, wide soft dark supersaw pad bed, solo glass "
            "lead very gentle, minimal kick, airy navy mix, low distraction background bed"
        ),
    },
    {
        "index": 5,
        "slug": "05-warbow-scuffle",
        "title": "WarBow Scuffle",
        "unique": (
            "C minor, 114 BPM, PvP ladder competition, brassy tactical synth punches low in mix, "
            "bouncy pizzicato low strings dark, snappy snare, adversarial edge not comedy battle"
        ),
    },
    {
        "index": 6,
        "slug": "06-charm-vault",
        "title": "CHARM Vault",
        "unique": (
            "E minor, 98 BPM, glassy FM bell keys with teal delay throws, muted guitar scratch ghost notes "
            "through low-pass, vault sparkle, crisp transients, restrained boutique feel"
        ),
    },
    {
        "index": 7,
        "slug": "07-bridge-span",
        "title": "Bridge Span",
        "unique": (
            "D minor, 100 BPM, crossing epic lite, stacked octave dark string rises, glass echo lead "
            "doubled by synth, hopeful plateau climax, wide crescendo then breathe"
        ),
    },
    {
        "index": 8,
        "slug": "08-logout-lullaby",
        "title": "Logout Lullaby",
        "unique": (
            "G minor, 88 BPM, session end wind-down, soft felt piano dark and muted nylon guitar, "
            "whisper-soft brushed drums, emerald firefly fade, intimate close mix"
        ),
    },
)

ALBUM_SPECS: dict[str, dict[str, Any]] = {
    "1": {"key": "part_1", "dir_name": "album_part_1", "tracks": ALBUM_PART_1},
    "2": {"key": "part_2", "dir_name": "album_part_2", "tracks": ALBUM_PART_2},
}

# Public filenames for part 2 (09–16) — keep in sync with promote_album_to_public.sh.
PART_2_PUBLIC_SLUGS: tuple[str, ...] = tuple(
    f"{i:02d}-{t['slug'][3:]}" for i, t in zip(range(9, 17), ALBUM_PART_2, strict=True)
)

_FAILED_LOCKS: dict[str, threading.Lock] = {}


@dataclass(frozen=True)
class AlbumJob:
    part: str
    album_key: str
    out_dir: Path
    track: dict[str, Any]


def full_prompt(track: dict[str, Any]) -> str:
    return f"{track['unique'].strip()}. {STYLE_BIBLE}"


def ledger_path_for(out_dir: Path, album_key: str) -> Path:
    return out_dir / f"ledger_{album_key}.json"


def failed_path_for(out_dir: Path, album_key: str) -> Path:
    return out_dir / f"failed_{album_key}.json"


def load_failed_slugs(path: Path) -> set[str]:
    if not path.is_file():
        return set()
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return set()
    if isinstance(raw, list):
        return {str(s) for s in raw}
    return set()


def _failed_lock(path: Path) -> threading.Lock:
    key = str(path.resolve())
    if key not in _FAILED_LOCKS:
        _FAILED_LOCKS[key] = threading.Lock()
    return _FAILED_LOCKS[key]


def record_failed_slug(path: Path, slug: str, *, error: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with _failed_lock(path):
        slugs = load_failed_slugs(path)
        if slug in slugs:
            return
        slugs.add(slug)
        if not path.is_file():
            path.write_text("[]\n", encoding="utf-8")
        with path.open("r+", encoding="utf-8") as f:
            fcntl.flock(f.fileno(), fcntl.LOCK_EX)
            try:
                f.seek(0)
                raw = f.read()
                try:
                    current = json.loads(raw) if raw.strip() else []
                except json.JSONDecodeError:
                    current = []
                if not isinstance(current, list):
                    current = []
                merged = sorted({str(s) for s in current} | {slug})
                f.seek(0)
                f.truncate()
                f.write(json.dumps(merged, indent=2) + "\n")
                f.flush()
            finally:
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)
    print(f"[{slug}] recorded failure (will not retry): {error}", file=sys.stderr)


def pin_ledger_prediction(out_dir: Path, album_key: str, slug: str, prediction_id: str) -> Path:
    """Record a Replicate prediction id for recovery after a create-time network flake."""
    if str(inst.REPLICATE_ART_DIR) not in sys.path:
        sys.path.insert(0, str(inst.REPLICATE_ART_DIR))
    import replicate_bounded_run as bounded  # noqa: E402

    path = ledger_path_for(out_dir, album_key)
    bounded._save_ledger_entry(path, slug, prediction_id.strip())
    return path


def out_dir_for_part(part: str, override: Path | None) -> Path:
    spec = ALBUM_SPECS[part]
    if override is not None:
        return override.resolve()
    return (inst.SCRIPT_DIR / "output" / spec["dir_name"]).resolve()


def skip_reason(
    *,
    slug: str,
    out_path: Path,
    resume: bool,
    dry_run: bool,
    failed_slugs: set[str],
) -> str | None:
    if slug in failed_slugs:
        return "failed (not retrying; edit failed_*.json to override)"
    if (
        resume
        and not dry_run
        and out_path.is_file()
        and out_path.stat().st_size >= 512
    ):
        return f"existing ({out_path.stat().st_size} bytes)"
    return None


def manifest_row(
    *,
    job: AlbumJob,
    prompt: str,
    out_path: Path,
    sample_rate: int,
    bitrate: int,
    audio_format: str,
    skipped: str | None = None,
    failed: str | None = None,
) -> dict[str, Any]:
    row: dict[str, Any] = {
        "album": job.album_key,
        "index": job.track["index"],
        "slug": job.track["slug"],
        "title": job.track["title"],
        "model": inst.MODEL_REF,
        "is_instrumental": True,
        "sample_rate": sample_rate,
        "bitrate": bitrate,
        "audio_format": audio_format,
        "output": str(out_path) if out_path.is_file() else None,
        "prompt": prompt,
        "style_bible": STYLE_BIBLE,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    if skipped:
        row["skipped_existing"] = True
        row["skip_reason"] = skipped
    if failed:
        row["failed"] = True
        row["error"] = failed
    return row


def generate_one_track(
    job: AlbumJob,
    *,
    sample_rate: int,
    bitrate: int,
    audio_format: str,
    prefer_wait: int,
    max_wall_seconds: float | None,
    resume: bool,
    dry_run: bool,
) -> dict[str, Any]:
    ext = audio_format if audio_format != "pcm" else "pcm"
    out_path = job.out_dir / f"{job.track['slug']}.{ext}"
    prompt = full_prompt(job.track)
    ledger_path = ledger_path_for(job.out_dir, job.album_key)
    failed_path = failed_path_for(job.out_dir, job.album_key)
    failed_slugs = load_failed_slugs(failed_path)
    slug = str(job.track["slug"])

    skip = skip_reason(
        slug=slug,
        out_path=out_path,
        resume=resume,
        dry_run=dry_run,
        failed_slugs=failed_slugs,
    )
    if skip:
        print(f"[{slug}] skip: {skip}", file=sys.stderr)
        return manifest_row(
            job=job,
            prompt=prompt,
            out_path=out_path,
            sample_rate=sample_rate,
            bitrate=bitrate,
            audio_format=audio_format,
            skipped=skip,
        )

    preview = prompt.replace("\n", " ")
    if len(preview) > 140:
        preview = preview[:137] + "..."
    print(f"[{slug}] {job.track['title']} — {preview}", file=sys.stderr)

    inp = inst.build_input(
        prompt=prompt,
        sample_rate=sample_rate,
        bitrate=bitrate,
        audio_format=audio_format,
    )
    try:
        written = inst.run_generation(
            inp=inp,
            dry_run=dry_run,
            out_path=out_path,
            job_label=slug,
            prefer_wait=prefer_wait,
            max_wall_seconds=max_wall_seconds,
            ledger_path=ledger_path,
            ledger_key=slug,
        )
    except Exception as exc:
        err = str(exc)
        ledger_has = False
        if ledger_path.is_file():
            try:
                raw = json.loads(ledger_path.read_text(encoding="utf-8"))
                ledger_has = isinstance(raw, dict) and bool(raw.get(slug))
            except json.JSONDecodeError:
                pass
        if not dry_run and not ledger_has:
            record_failed_slug(failed_path, slug, error=err)
        elif ledger_has:
            print(
                f"[{slug}] error after prediction was ledger-pinned ({err!s}); "
                "not marking failed — re-run with --resume to poll the same job.",
                file=sys.stderr,
            )
        else:
            print(
                f"[{slug}] generation failed (not retrying): {err}\n"
                "If Replicate shows a processing/succeeded job, pin with "
                f"--pin-prediction {slug} <id>, remove slug from failed_*.json, then --resume.",
                file=sys.stderr,
            )
        return manifest_row(
            job=job,
            prompt=prompt,
            out_path=out_path,
            sample_rate=sample_rate,
            bitrate=bitrate,
            audio_format=audio_format,
            failed=err,
        )

    if written is not None:
        out_path = written
    return manifest_row(
        job=job,
        prompt=prompt,
        out_path=out_path,
        sample_rate=sample_rate,
        bitrate=bitrate,
        audio_format=audio_format,
    )


def write_manifest(out_dir: Path, album_key: str, rows: list[dict[str, Any]]) -> None:
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
    for row in rows:
        merged_by_slug[str(row["slug"])] = row
    merged = sorted(merged_by_slug.values(), key=lambda r: int(r.get("index", 0)))
    man_path.write_text(json.dumps(merged, indent=2) + "\n", encoding="utf-8")
    print(f"[ok] wrote {man_path}")


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
        "--both-parts",
        action="store_true",
        help="Generate selected tracks from part 1 and part 2 in one parallel batch.",
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
    p.add_argument(
        "--max-workers",
        type=int,
        default=8,
        help="Parallel Replicate jobs when generating multiple tracks (default: 8).",
    )
    p.add_argument("--dry-run", action="store_true")
    p.add_argument(
        "--resume",
        action="store_true",
        help="Skip tracks whose output file already exists (>= 512 bytes) or prior failure.",
    )
    p.add_argument(
        "--pin-prediction",
        nargs=2,
        metavar=("SLUG", "PREDICTION_ID"),
        help=(
            "Pin an in-flight or succeeded Replicate prediction to SLUG in the part ledger "
            "(recovery after create timeout — check dashboard before creating a second job)."
        ),
    )
    return p.parse_args()


def build_jobs(
    parts: tuple[str, ...],
    *,
    all_tracks: bool,
    track_index: int | None,
    out_dir_override: Path | None,
) -> list[AlbumJob]:
    jobs: list[AlbumJob] = []
    for part in parts:
        spec = ALBUM_SPECS[part]
        album_key = spec["key"]
        out_dir = out_dir_for_part(part, out_dir_override if len(parts) == 1 else None)
        album_tracks: tuple[dict[str, Any], ...] = spec["tracks"]
        if all_tracks:
            selected = list(album_tracks)
        elif track_index is not None:
            selected = [t for t in album_tracks if t["index"] == track_index]
        else:
            selected = []
        for t in selected:
            jobs.append(AlbumJob(part=part, album_key=album_key, out_dir=out_dir, track=t))
    return jobs


def main() -> None:
    inst.load_env()
    args = parse_args()
    prefer_wait = max(1, min(60, args.prefer_wait))
    max_workers = max(1, args.max_workers)

    if args.pin_prediction:
        slug, pred_id = args.pin_prediction
        spec = ALBUM_SPECS[args.part]
        album_tracks: tuple[dict[str, Any], ...] = spec["tracks"]
        album_key: str = spec["key"]
        out_dir = out_dir_for_part(args.part, args.out_dir)
        known = {t["slug"] for t in album_tracks}
        if slug not in known:
            print(f"Unknown slug {slug!r} for album {album_key}. Known: {sorted(known)}", file=sys.stderr)
            sys.exit(2)
        path = pin_ledger_prediction(out_dir, album_key, slug, pred_id)
        print(f"[ok] pinned {slug} -> {pred_id} in {path}")
        return

    if args.list:
        parts = ("1", "2") if args.both_parts else (args.part,)
        for part in parts:
            spec = ALBUM_SPECS[part]
            print(f"Album {spec['key']} ({spec['dir_name']}/)")
            for t in spec["tracks"]:
                print(f"{t['index']:02d}  {t['slug']}  —  {t['title']}")
        return

    if args.all and args.track is not None:
        print("Use either --all or --track N, not both.", file=sys.stderr)
        sys.exit(2)

    if not args.all and args.track is None:
        print("Specify --all, --track N, or --list.", file=sys.stderr)
        sys.exit(2)

    parts: tuple[str, ...] = ("1", "2") if args.both_parts else (args.part,)
    jobs = build_jobs(parts, all_tracks=args.all, track_index=args.track, out_dir_override=args.out_dir)
    if not jobs:
        sys.exit(2)

    workers = 1 if len(jobs) == 1 else max_workers
    print(f"[batch] {len(jobs)} track(s), max_workers={workers}", file=sys.stderr)

    rows_by_album: dict[str, list[dict[str, Any]]] = {ALBUM_SPECS[p]["key"]: [] for p in parts}

    def _run(job: AlbumJob) -> dict[str, Any]:
        return generate_one_track(
            job,
            sample_rate=args.sample_rate,
            bitrate=args.bitrate,
            audio_format=args.audio_format,
            prefer_wait=prefer_wait,
            max_wall_seconds=args.max_wall_seconds,
            resume=args.resume,
            dry_run=args.dry_run,
        )

    if workers == 1:
        results = [_run(j) for j in jobs]
    else:
        with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
            results = list(pool.map(_run, jobs))

    for job, row in zip(jobs, results, strict=True):
        rows_by_album[job.album_key].append(row)

    if not args.dry_run:
        for part in parts:
            spec = ALBUM_SPECS[part]
            out_dir = out_dir_for_part(part, args.out_dir if len(parts) == 1 else None)
            write_manifest(out_dir, spec["key"], rows_by_album[spec["key"]])

    failed = sum(1 for r in results if r.get("failed"))
    if failed:
        print(f"[batch] done with {failed} failure(s); failed slugs are not retried.", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
