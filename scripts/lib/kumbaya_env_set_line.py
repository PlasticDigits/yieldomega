#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""Literal KEY=value merge for frontend/.env.local (GitLab #154).

Replaces every line matching ^KEY= or appends KEY=value after the Kumbaya marker block.
Values are written verbatim — no sed & backreferences, shell-like # comments, or regexp."""

from __future__ import annotations

import sys


def main() -> int:
    if len(sys.argv) != 5:
        print(
            "usage: kumbaya_env_set_line.py <path> <key> <value> <marker_line>",
            file=sys.stderr,
        )
        return 2
    path, key, val, marker = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
    prefix = key + "="
    if "\n" in key or "\n" in val:
        print(
            "kumbaya_env_set_line: newline in key or value is not supported",
            file=sys.stderr,
        )
        return 1
    try:
        with open(path, encoding="utf-8") as f:
            lines = f.readlines()
    except OSError as e:
        print(f"kumbaya_env_set_line: read {path}: {e}", file=sys.stderr)
        return 1

    out: list[str] = []
    replaced = False
    for line in lines:
        if line.startswith(prefix):
            out.append(prefix + val + "\n")
            replaced = True
        else:
            out.append(line)

    if replaced:
        try:
            with open(path, "w", encoding="utf-8") as f:
                f.writelines(out)
        except OSError as e:
            print(f"kumbaya_env_set_line: write {path}: {e}", file=sys.stderr)
            return 1
        return 0

    body = "".join(lines)
    tail = list(lines)
    if marker not in body:
        tail.append("\n")
        tail.append(marker + "\n")
    tail.append(prefix + val + "\n")
    try:
        with open(path, "w", encoding="utf-8") as f:
            f.writelines(tail)
    except OSError as e:
        print(f"kumbaya_env_set_line: write {path}: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
