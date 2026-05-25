#!/usr/bin/env python3
"""Simulate DoubAirdrop batches on MegaETH (cast call + state override)."""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

from csv_recipients import load_recipients

DEFAULT_RPC = "https://mainnet.megaeth.com/rpc"
DEFAULT_DOUB = "0xc3654b4f879937b767afbb64b7c230ff436d2342"
DEFAULT_AIRDROP = "0x3CAf127624d8b81F4aa00aD1cCBbc9242B502e5d"
SIM_FROM = "0x000000000000000000000000000000000000dEaD"
MAX_UINT = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"


def cast_index(key_type: str, key: str, slot: int) -> str:
    out = subprocess.check_output(
        ["cast", "index", key_type, key, str(slot)],
        text=True,
        stderr=subprocess.DEVNULL,
    ).strip()
    return out if out.startswith("0x") else "0x" + out


def override_state_diff(doub: str, owner: str, spender: str) -> str:
    bal = cast_index("address", owner, 0)
    allow = cast_index("address", spender, int(cast_index("address", owner, 1), 16))
    return f"{doub}:{bal}:{MAX_UINT},{doub}:{allow}:{MAX_UINT}"


def encode_calldata(doub: str, recipients: list[str], amounts_wei: list[int]) -> str:
    from eth_abi import encode
    from eth_utils import keccak

    selector = keccak(text="disperseToken(address,address[],uint256[])")[:4]
    body = encode(
        ["address", "address[]", "uint256[]"],
        [
            doub,
            [bytes.fromhex(a[2:]) for a in recipients],
            amounts_wei,
        ],
    )
    return "0x" + (selector + body).hex()


def simulate_batch(
    *,
    rpc_url: str,
    airdrop: str,
    doub: str,
    recipients: list[str],
    amounts_wei: list[int],
    state_override: str,
) -> tuple[bool, str]:
    data = encode_calldata(doub, recipients, amounts_wei)
    cmd = [
        "cast",
        "call",
        airdrop,
        data,
        "--from",
        SIM_FROM,
        "--rpc-url",
        rpc_url,
        "--override-state-diff",
        state_override,
    ]
    try:
        subprocess.check_output(cmd, stderr=subprocess.STDOUT, text=True)
        return True, "OK"
    except subprocess.CalledProcessError as exc:
        msg = (exc.output or str(exc)).strip().replace("\n", " ")
        return False, msg[:160]


def cast_estimate_batch(
    *,
    rpc_url: str,
    airdrop: str,
    data: str,
    state_override: str,
) -> tuple[bool, str]:
    cmd = [
        "cast",
        "estimate",
        airdrop,
        data,
        "--from",
        SIM_FROM,
        "--rpc-url",
        rpc_url,
        "--override-state-diff",
        state_override,
    ]
    try:
        gas = subprocess.check_output(cmd, stderr=subprocess.STDOUT, text=True).strip()
        return True, gas.split()[0]
    except subprocess.CalledProcessError as exc:
        msg = (exc.output or str(exc)).strip().replace("\n", " ")
        return False, msg[:160]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "csv",
        type=Path,
        nargs="?",
        default=Path(__file__).resolve().parent / "doub.csv",
    )
    parser.add_argument("--rpc-url", default=DEFAULT_RPC)
    parser.add_argument("--doub-token", default=DEFAULT_DOUB)
    parser.add_argument("--airdrop", default=DEFAULT_AIRDROP)
    parser.add_argument(
        "--sizes",
        type=int,
        nargs="+",
        default=[50, 100, 500, 800, 1000, 1200, 1500, 1750, 2000, 2250, 2500, 2750, 3000, 3500, 3850],
    )
    parser.add_argument("--estimate-gas", action="store_true", help="Also run cast estimate")
    args = parser.parse_args()

    recipients, amounts_wei = load_recipients(args.csv)
    override = override_state_diff(args.doub_token, SIM_FROM, args.airdrop)

    print(f"csv rows: {len(recipients)}")
    print(f"rpc:      {args.rpc_url}")
    print(f"simulation: cast call + balance/allowance override on MegaETH mainnet")
    print()

    header = f"{'n':>6}  {'doub':>12}  {'calldata':>10}  call"
    if args.estimate_gas:
        header += f"  {'gas':>14}"
    print(header)
    print("-" * (58 + (18 if args.estimate_gas else 0)))

    last_ok = 0
    for n in args.sizes:
        if n > len(recipients):
            continue
        chunk_r = recipients[:n]
        chunk_a = amounts_wei[:n]
        total_doub = sum(chunk_a) / 10**18
        data = encode_calldata(args.doub_token, chunk_r, chunk_a)
        calldata_b = (len(data) - 2) // 2

        ok, msg = simulate_batch(
            rpc_url=args.rpc_url,
            airdrop=args.airdrop,
            doub=args.doub_token,
            recipients=chunk_r,
            amounts_wei=chunk_a,
            state_override=override,
        )
        line = f"{n:>6}  {total_doub:>12.4g}  {calldata_b:>10}  {msg if ok else 'FAIL: ' + msg}"
        if args.estimate_gas and ok:
            gok, gmsg = cast_estimate_batch(
                rpc_url=args.rpc_url,
                airdrop=args.airdrop,
                data=data,
                state_override=override,
            )
            line += f"  {gmsg if gok else 'est FAIL'}"
        print(line)
        if ok:
            last_ok = n

    if last_ok:
        print(f"\nlast simulated OK: {last_ok} recipients / tx")
        print(f"doub.csv ({len(recipients)} rows) → {(len(recipients) + last_ok - 1) // last_ok} tx(s)")
    else:
        return 1
    return 0


if __name__ == "__main__":
    import os

    os.environ.setdefault("FOUNDRY_DISABLE_NIGHTLY_WARNING", "1")
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
