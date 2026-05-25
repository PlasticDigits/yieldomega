#!/usr/bin/env python3
"""Parse airdrop CSV and call DoubAirdrop.disperseToken via cast."""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

from csv_recipients import load_recipients


def format_address_array(addresses: list[str]) -> str:
    return "[" + ",".join(addresses) + "]"


def format_uint_array(values: list[int]) -> str:
    return "[" + ",".join(str(v) for v in values) + "]"


def _display_cmd(args: list[str]) -> str:
    out: list[str] = []
    skip_next = False
    for arg in args:
        if skip_next:
            out.append("<redacted>")
            skip_next = False
            continue
        if arg == "--private-key":
            skip_next = True
            continue
        out.append(arg)
    return " ".join(out)


def run_cast(args: list[str], *, dry_run: bool, private_key: str | None = None) -> None:
    cmd = ["cast", *args]
    if private_key:
        cmd.extend(["--private-key", private_key])
    print("$", _display_cmd(cmd))
    if dry_run:
        return
    subprocess.run(cmd, check=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", type=Path, help="CSV file: address,amount per line")
    parser.add_argument("--dry-run", action="store_true", help="Print cast command only")
    parser.add_argument("--broadcast", action="store_true", help="Send transaction")
    parser.add_argument(
        "--max-rows",
        type=int,
        default=505,
        help="Max recipients per tx (default 505 for MegaETH; use 0 for no chunking)",
    )
    parser.add_argument("--rpc-url", default=os.environ.get("RPC_URL"))
    parser.add_argument("--private-key", default=os.environ.get("PRIVATE_KEY"))
    parser.add_argument("--doub-token", default=os.environ.get("DOUB_TOKEN"))
    parser.add_argument(
        "--airdrop",
        default=os.environ.get(
            "DOUB_AIRDROP_ADDRESS", "0x3CAf127624d8b81F4aa00aD1cCBbc9242B502e5d"
        ),
        help="DoubAirdrop contract (default: MegaETH mainnet deployment)",
    )
    args = parser.parse_args()

    if not args.broadcast and not args.dry_run:
        parser.error("pass --dry-run and/or --broadcast")

    if args.broadcast:
        missing = [
            name
            for name, val in (
                ("RPC_URL/--rpc-url", args.rpc_url),
                ("PRIVATE_KEY/--private-key", args.private_key),
                ("DOUB_TOKEN/--doub-token", args.doub_token),
            )
            if not val
        ]
        if missing:
            parser.error("broadcast requires: " + ", ".join(missing))

    recipients, amounts_wei = load_recipients(args.csv)
    total_wei = sum(amounts_wei)
    print(f"recipients: {len(recipients)}  total: {total_wei / 10**18:.18g} DOUB ({total_wei} wei)")

    chunk_size = args.max_rows if args.max_rows > 0 else len(recipients)
    for start in range(0, len(recipients), chunk_size):
        chunk_r = recipients[start : start + chunk_size]
        chunk_a = amounts_wei[start : start + chunk_size]
        chunk_total = sum(chunk_a)
        label = f"batch {start // chunk_size + 1}"
        print(f"{label}: {len(chunk_r)} rows, {chunk_total / 10**18:.18g} DOUB")

        cast_args = [
            "send",
            args.airdrop,
            "disperseToken(address,address[],uint256[])",
            args.doub_token or "0x0000000000000000000000000000000000000000",
            format_address_array(chunk_r),
            format_uint_array(chunk_a),
        ]
        if args.rpc_url:
            cast_args.extend(["--rpc-url", args.rpc_url])

        run_cast(
            cast_args,
            dry_run=args.dry_run and not args.broadcast,
            private_key=args.private_key if args.broadcast else None,
        )

    if args.dry_run:
        print("dry-run: approve DOUB to the airdrop contract before broadcast, e.g.")
        print(
            "  cast send $DOUB_TOKEN 'approve(address,uint256)' $DOUB_AIRDROP_ADDRESS "
            f"{total_wei} --rpc-url $RPC_URL  # plus --private-key <redacted>"
        )

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, subprocess.CalledProcessError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
