#!/usr/bin/env python3
"""Spot-check random recipients per disperse batch against on-chain DOUB balance."""

from __future__ import annotations

import argparse
import random
import subprocess
import sys
from pathlib import Path

from csv_recipients import parse_recipient_csv

DEFAULT_RPC = "https://mainnet.megaeth.com/rpc"
DEFAULT_DOUB = "0xc3654B4f879937B767aFBB64B7C230FF436d2342"
DEFAULT_AIRDROP = "0x3CAf127624d8b81F4aa00aD1cCBbc9242B502e5d"
CHUNK = 505


def balance_of(rpc: str, token: str, addr: str) -> int:
    out = subprocess.check_output(
        ["cast", "call", token, "balanceOf(address)(uint256)", addr, "--rpc-url", rpc],
        stderr=subprocess.DEVNULL,
        text=True,
    ).strip().split()[0]
    return int(out)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("csv", type=Path, nargs="?", default=Path(__file__).parent / "doub.csv")
    parser.add_argument("--rpc-url", default=DEFAULT_RPC)
    parser.add_argument("--doub-token", default=DEFAULT_DOUB)
    parser.add_argument("--samples", type=int, default=3, help="Random rows per batch")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    rows, errs = parse_recipient_csv(args.csv)
    if errs:
        print("CSV errors:", errs[:5], file=sys.stderr)
        return 1
    if not rows:
        print("No rows in CSV", file=sys.stderr)
        return 1

    batches = [rows[i : i + CHUNK] for i in range(0, len(rows), CHUNK)]
    random.seed(args.seed)

    print(f"CSV: {len(rows)} rows, {len(batches)} batches @ {CHUNK} (last={len(batches[-1])})")
    print(f"DOUB: {args.doub_token}")
    print()

    ok = fail = 0
    for bi, batch in enumerate(batches, 1):
        n = min(args.samples, len(batch))
        picks = random.sample(batch, n)
        print(f"=== Batch {bi} ({len(batch)} rows) — {n} samples ===")
        for row in picks:
            bal = balance_of(args.rpc_url, args.doub_token, row.address)
            exp = row.amount_wei
            good = bal >= exp
            status = "OK" if good else "MISMATCH"
            ok += good
            fail += not good
            print(f"  {status}  line {row.line_no}  {row.address}")
            print(f"        csv:      {row.amount} DOUB  ({exp} wei)")
            print(f"        balance:  {bal} wei")
        print()

    print(f"Summary: {ok} OK, {fail} MISMATCH (balance >= csv amount)")
    return 1 if fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
