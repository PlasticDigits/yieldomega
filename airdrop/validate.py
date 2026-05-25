#!/usr/bin/env python3
"""Validate an airdrop CSV: addresses, amounts, duplicates; print total spend."""

from __future__ import annotations

import argparse
import sys
from collections import Counter
from decimal import Decimal
from pathlib import Path

from csv_recipients import RecipientRow, parse_recipient_csv


def validate_duplicates(
    rows: list[RecipientRow], *, allow_duplicates: bool
) -> list[str]:
    if allow_duplicates:
        return []
    errors: list[str] = []
    counts = Counter(r.address for r in rows)
    for addr, count in sorted(counts.items()):
        if count > 1:
            line_nos = [r.line_no for r in rows if r.address == addr]
            errors.append(f"duplicate address {addr}: {count}x at lines {line_nos}")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "csv",
        type=Path,
        nargs="?",
        default=Path(__file__).resolve().parent / "doub.csv",
        help="CSV path (default: airdrop/doub.csv)",
    )
    parser.add_argument(
        "--allow-duplicates",
        action="store_true",
        help="Do not fail when the same address appears on multiple rows",
    )
    parser.add_argument(
        "--show-duplicates",
        action="store_true",
        help="List duplicate addresses even when validation passes",
    )
    args = parser.parse_args()

    path = args.csv.resolve()
    if not path.is_file():
        print(f"error: file not found: {path}", file=sys.stderr)
        return 1

    rows, parse_errors = parse_recipient_csv(path)
    logic_errors = validate_duplicates(rows, allow_duplicates=args.allow_duplicates)
    all_errors = parse_errors + logic_errors

    if all_errors:
        print(f"FAIL  {path.name}  ({len(all_errors)} issue(s))")
        for err in all_errors[:50]:
            print(f"  {err}")
        if len(all_errors) > 50:
            print(f"  ... and {len(all_errors) - 50} more")
        return 1

    if not rows:
        print(f"FAIL  {path.name}")
        print("  no recipient rows")
        return 1

    total_wei = sum(r.amount_wei for r in rows)
    total_doub = Decimal(total_wei) / Decimal(10**18)
    amounts = [r.amount for r in rows]
    addr_counts = Counter(r.address for r in rows)
    dup_addrs = [a for a, n in addr_counts.items() if n > 1]

    print(f"OK    {path.name}")
    print(f"  rows:           {len(rows)}")
    print(f"  unique wallets: {len(addr_counts)}")
    print(f"  total spend:    {total_doub} DOUB")
    print(f"  total spend:    {total_wei} wei")
    print(f"  min amount:     {min(amounts)} DOUB")
    print(f"  max amount:     {max(amounts)} DOUB")

    if dup_addrs and args.show_duplicates:
        print(f"  duplicate addresses ({len(dup_addrs)}):")
        for addr in sorted(dup_addrs)[:20]:
            print(f"    {addr}  x{addr_counts[addr]}")
        if len(dup_addrs) > 20:
            print(f"    ... and {len(dup_addrs) - 20} more")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
