#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""Strip emails and the keyword 'author' from commit message bodies.

Used by .githooks/commit-msg. Subject (first line) must not contain an email
or standalone 'author'; offending body lines are removed and inline matches
are stripped from retained body lines.
"""
from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass

EMAIL_RE = re.compile(
    r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",
    re.IGNORECASE,
)
AUTHOR_RE = re.compile(r"\bauthor\b", re.IGNORECASE)
CO_AUTHORED_BY_RE = re.compile(r"^\s*co-authored-by\s*:", re.IGNORECASE)


@dataclass(frozen=True)
class SanitizeResult:
    text: str
    stripped_lines: tuple[str, ...]
    subject_rejected: bool
    subject_reason: str | None


def _has_email(text: str) -> bool:
    return EMAIL_RE.search(text) is not None


def _has_author_keyword(text: str) -> bool:
    return AUTHOR_RE.search(text) is not None


def _strip_inline(text: str) -> str:
    text = EMAIL_RE.sub("", text)
    text = AUTHOR_RE.sub("", text)
    # Collapse whitespace left by removals; keep intentional spacing modest.
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.rstrip()


def sanitize_commit_message(text: str) -> SanitizeResult:
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    if normalized.endswith("\n"):
        body_newline = True
        normalized = normalized[:-1]
    else:
        body_newline = False

    if not normalized.strip():
        return SanitizeResult(
            text="\n" if body_newline else "",
            stripped_lines=(),
            subject_rejected=False,
            subject_reason=None,
        )

    lines = normalized.split("\n")
    subject = lines[0]
    body_lines = lines[1:]

    if _has_email(subject) or _has_author_keyword(subject):
        reason = []
        if _has_email(subject):
            reason.append("email")
        if _has_author_keyword(subject):
            reason.append("keyword 'author'")
        return SanitizeResult(
            text=text,
            stripped_lines=(),
            subject_rejected=True,
            subject_reason=" and ".join(reason),
        )

    kept: list[str] = []
    stripped: list[str] = []
    for line in body_lines:
        if (
            _has_email(line)
            or _has_author_keyword(line)
            or CO_AUTHORED_BY_RE.match(line)
        ):
            stripped.append(line)
            continue
        if not line.strip():
            kept.append(line)
            continue
        cleaned = _strip_inline(line)
        if cleaned:
            kept.append(cleaned)
        else:
            stripped.append(line)

    while kept and not kept[-1].strip():
        kept.pop()

    collapsed: list[str] = []
    prev_blank = False
    for line in kept:
        is_blank = not line.strip()
        if is_blank:
            if prev_blank:
                continue
            prev_blank = True
        else:
            prev_blank = False
        collapsed.append(line)
    kept = collapsed

    out_lines = [subject, *kept]
    out = "\n".join(out_lines)
    if body_newline or kept:
        out += "\n"

    return SanitizeResult(
        text=out,
        stripped_lines=tuple(stripped),
        subject_rejected=False,
        subject_reason=None,
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--file",
        metavar="PATH",
        help="Rewrite commit message file in place (commit-msg hook mode).",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Exit 1 if the message would be rejected or changed.",
    )
    parser.add_argument(
        "message",
        nargs="?",
        help="Message text (stdin if omitted and --file not set).",
    )
    args = parser.parse_args(argv)

    if args.file:
        raw = open(args.file, encoding="utf-8", errors="replace").read()
    elif args.message is not None:
        raw = args.message
    else:
        raw = sys.stdin.read()

    result = sanitize_commit_message(raw)

    if result.subject_rejected:
        print(
            f"commit-msg: subject line must not contain {result.subject_reason}.",
            file=sys.stderr,
        )
        return 1

    changed = result.text != raw.replace("\r\n", "\n").replace("\r", "\n")
    if result.stripped_lines:
        print("commit-msg: stripped from body:", file=sys.stderr)
        for line in result.stripped_lines:
            print(f"  - {line}", file=sys.stderr)

    if args.file and changed:
        with open(args.file, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(result.text)

    if args.check and (changed or result.stripped_lines):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
