#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""Track Replicate `input_images` files that false-trigger NSFW / moderation checks.

Replicate sometimes logs warnings like:
  NSFW check failed for image N: Unable to infer channel dimension format
often tied to specific reference PNGs/JPEGs. Those paths are recorded in
`replicate_flagged_inputs.json` (paths relative to repo root) and are **omitted**
from `input_images` when running `generate_assets.py` and `issue45_batch.py`.

CLI:
  python flagged_inputs.py list
  python flagged_inputs.py add frontend/public/art/style.png --reason "NSFW false flag (channel fmt)"
  python flagged_inputs.py remove frontend/public/art/style.png
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
STORE = SCRIPT_DIR / "replicate_flagged_inputs.json"


def _store_path() -> Path:
    return STORE


def load_entries() -> list[dict[str, Any]]:
    path = _store_path()
    if not path.is_file():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError(f"{path}: expected JSON array")
    return data


def save_entries(entries: list[dict[str, Any]]) -> None:
    _store_path().write_text(json.dumps(entries, indent=2) + "\n", encoding="utf-8")


def flagged_path_set(repo_root: Path) -> set[Path]:
    """Absolute resolved paths flagged for omission from Replicate input_images."""
    out: set[Path] = set()
    for row in load_entries():
        rel = row.get("path")
        if not isinstance(rel, str) or not rel.strip():
            continue
        out.add((repo_root / rel).resolve())
    return out


def filter_reference_paths(
    refs: list[Path],
    repo_root: Path,
    *,
    job_label: str = "",
) -> list[Path]:
    """Drop refs that appear in the flagged store; warn on stderr."""
    bad = flagged_path_set(repo_root)
    reasons: dict[Path, str] = {}
    for row in load_entries():
        rel = row.get("path")
        if isinstance(rel, str) and rel.strip():
            r = (repo_root / rel).resolve()
            reasons[r] = str(row.get("reason") or "flagged for Replicate input_images")

    kept: list[Path] = []
    prefix = f"[{job_label}] " if job_label else ""
    for p in refs:
        rp = p.resolve()
        if rp in bad:
            msg = reasons.get(rp, "listed in replicate_flagged_inputs.json")
            print(
                f"{prefix}Skipping flagged input image (not sent to Replicate): {p}\n"
                f"  reason: {msg}\n"
                f"  manage: python scripts/replicate-art/flagged_inputs.py list",
                file=sys.stderr,
            )
            continue
        kept.append(p)
    return kept


def cmd_list(_args: argparse.Namespace) -> int:
    entries = load_entries()
    if not entries:
        print("(no flagged input paths)")
        return 0
    for row in entries:
        print(f"{row.get('path')}\n  reason: {row.get('reason', '')}\n  flagged_at: {row.get('flagged_at', '')}\n")
    return 0


def cmd_add(args: argparse.Namespace) -> int:
    rel = _to_repo_rel(Path(args.path))
    entries = load_entries()
    paths = {str(e.get("path")) for e in entries if isinstance(e.get("path"), str)}
    key = rel.as_posix()
    if key in paths:
        print(f"Already flagged: {key}", file=sys.stderr)
        return 1
    entries.append(
        {
            "path": key,
            "reason": args.reason or "Replicate moderation/NSFW false flag on input_images",
            "flagged_at": date.today().isoformat(),
        }
    )
    save_entries(entries)
    print(f"Added flagged input: {key}")
    return 0


def cmd_remove(args: argparse.Namespace) -> int:
    rel = _to_repo_rel(Path(args.path)).as_posix()
    entries = load_entries()
    new = [e for e in entries if str(e.get("path", "")) != rel]
    if len(new) == len(entries):
        print(f"Not in store: {rel}", file=sys.stderr)
        return 1
    save_entries(new)
    print(f"Removed: {rel}")
    return 0


def _to_repo_rel(path: Path) -> Path:
    p = Path(path)
    root = REPO_ROOT.resolve()
    if p.is_absolute():
        abs_p = p.resolve()
    else:
        from_root = (REPO_ROOT / p).resolve()
        from_cwd = (Path.cwd() / p).resolve()
        if from_root.exists():
            abs_p = from_root
        elif from_cwd.exists():
            abs_p = from_cwd
        else:
            abs_p = from_root
    try:
        return abs_p.relative_to(root)
    except ValueError as e:
        raise SystemExit(f"Path must be under repo root {REPO_ROOT}: {abs_p}") from e


def main() -> int:
    parser = argparse.ArgumentParser(description="Manage Replicate input_images blocklist")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_list = sub.add_parser("list", help="Show flagged paths")
    p_list.set_defaults(func=cmd_list)

    p_add = sub.add_parser("add", help="Flag a file so it is not used as Replicate input")
    p_add.add_argument("path", help="File path (relative to cwd or repo)")
    p_add.add_argument("--reason", default="", help="Why it was flagged")
    p_add.set_defaults(func=cmd_add)

    p_rm = sub.add_parser("remove", help="Remove a path from the blocklist")
    p_rm.add_argument("path")
    p_rm.set_defaults(func=cmd_remove)

    args = parser.parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
