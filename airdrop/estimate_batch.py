#!/usr/bin/env python3
"""Probe MegaETH batch limits for DoubAirdrop via eth_estimateGas (+ state override)."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

from csv_recipients import load_recipients

DEFAULT_RPC = "https://mainnet.megaeth.com/rpc"
DEFAULT_DOUB = "0xc3654b4f879937b767afbb64b7c230ff436d2342"
DEFAULT_AIRDROP = "0x3CAf127624d8b81F4aa00aD1cCBbc9242B502e5d"
# Synthetic sender for simulation only (balance/allowance injected via state override).
SIM_FROM = "0x000000000000000000000000000000000000dEaD"
MAX_UINT = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"


def format_address_array(addresses: list[str]) -> str:
    return "[" + ",".join(addresses) + "]"


def format_uint_array(values: list[int]) -> str:
    return "[" + ",".join(str(v) for v in values) + "]"


def cast_index_storage(key_type: str, key: str, slot: int) -> str:
    out = subprocess.check_output(
        ["cast", "index", key_type, key, str(slot)],
        text=True,
        stderr=subprocess.DEVNULL,
    ).strip()
    return out if out.startswith("0x") else "0x" + out


def build_state_override(doub: str, owner: str, spender: str) -> dict:
    balance_slot = cast_index_storage("address", owner, 0)
    allowance_outer = cast_index_storage("address", owner, 1)
    allowance_slot = cast_index_storage("address", spender, int(allowance_outer, 16))
    return {
        doub: {
            "stateDiff": {
                balance_slot: MAX_UINT,
                allowance_slot: MAX_UINT,
            }
        }
    }


def encode_calldata(airdrop: str, doub: str, recipients: list[str], amounts_wei: list[int]) -> str:
    out = subprocess.check_output(
        [
            "cast",
            "calldata",
            "disperseToken(address,address[],uint256[])",
            doub,
            format_address_array(recipients),
            format_uint_array(amounts_wei),
        ],
        text=True,
        stderr=subprocess.DEVNULL,
    ).strip()
    return out


def rpc_estimate_gas(
    rpc_url: str,
    *,
    from_addr: str,
    to_addr: str,
    data: str,
    state_override: dict | None = None,
) -> int:
    tx: dict = {"from": from_addr, "to": to_addr, "data": data}
    params: list = [tx]
    if state_override:
        params.append("latest")
        params.append(state_override)
    body = json.dumps(
        {"jsonrpc": "2.0", "id": 1, "method": "eth_estimateGas", "params": params}
    ).encode()
    req = urllib.request.Request(
        rpc_url, data=body, headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        payload = json.loads(resp.read().decode())
    if "error" in payload:
        err = payload["error"]
        msg = err.get("message", err)
        data = err.get("data", "")
        raise RuntimeError(f"{msg} {data}".strip())
    return int(payload["result"], 16)


def cast_call_balance(rpc_url: str, token: str, holder: str) -> int:
    out = subprocess.check_output(
        [
            "cast",
            "call",
            token,
            "balanceOf(address)(uint256)",
            holder,
            "--rpc-url",
            rpc_url,
        ],
        text=True,
        stderr=subprocess.DEVNULL,
    ).strip()
    return int(out.split()[0], 0)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "csv",
        type=Path,
        nargs="?",
        default=Path(__file__).resolve().parent / "doub.csv",
    )
    parser.add_argument("--rpc-url", default=os.environ.get("RPC_URL", DEFAULT_RPC))
    parser.add_argument(
        "--from",
        dest="from_addr",
        default=os.environ.get("AIRDROP_FROM"),
        help="Real sender (optional); default uses state-override simulation wallet",
    )
    parser.add_argument("--doub-token", default=os.environ.get("DOUB_TOKEN", DEFAULT_DOUB))
    parser.add_argument("--airdrop", default=os.environ.get("DOUB_AIRDROP_ADDRESS", DEFAULT_AIRDROP))
    parser.add_argument(
        "--sizes",
        type=int,
        nargs="+",
        default=[100, 500, 800, 1000, 1200, 1500, 2000, 2500, 3000, 3500, 3850],
    )
    parser.add_argument("--balance-sample", type=int, default=25)
    parser.add_argument(
        "--no-state-override",
        action="store_true",
        help="Use real sender balance/allowance only (requires AIRDROP_FROM funded + approved)",
    )
    args = parser.parse_args()

    recipients, amounts_wei = load_recipients(args.csv)
    sim_from = args.from_addr or SIM_FROM
    use_override = not args.no_state_override and args.from_addr is None

    print(f"csv rows:     {len(recipients)}")
    print(f"rpc:          {args.rpc_url}")
    print(f"simulate as:  {sim_from}")
    print(f"state override: {use_override}")
    print(f"doub:         {args.doub_token}")
    print(f"airdrop:      {args.airdrop}")

    if args.balance_sample > 0:
        z = sum(
            1
            for a in recipients[: args.balance_sample]
            if cast_call_balance(args.rpc_url, args.doub_token, a) == 0
        )
        print(f"zero DOUB in first {min(args.balance_sample, len(recipients))} csv wallets: {z}")

    override = build_state_override(args.doub_token, sim_from, args.airdrop) if use_override else None

    print("\neth_estimateGas (MegaETH):")
    print(f"{'n':>6}  {'doub':>12}  {'gas':>14}  {'calldata':>10}  status")
    print("-" * 58)

    last_ok = 0
    for n in args.sizes:
        if n > len(recipients):
            continue
        chunk_r = recipients[:n]
        chunk_a = amounts_wei[:n]
        total_doub = sum(chunk_a) / 10**18
        data = encode_calldata(args.airdrop, args.doub_token, chunk_r, chunk_a)
        calldata_bytes = (len(data) - 2) // 2

        if not use_override and args.from_addr:
            bal = cast_call_balance(args.rpc_url, args.doub_token, args.from_addr)
            if bal < sum(chunk_a):
                print(f"{n:>6}  {total_doub:>12.4g}  {'—':>14}  {calldata_bytes:>10}  SKIP (low balance)")
                continue

        try:
            gas = rpc_estimate_gas(
                args.rpc_url,
                from_addr=sim_from,
                to_addr=args.airdrop,
                data=data,
                state_override=override,
            )
            print(f"{n:>6}  {total_doub:>12.4g}  {gas:>14}  {calldata_bytes:>10}  OK")
            last_ok = n
        except Exception as exc:  # noqa: BLE001 — surface RPC errors to operator
            msg = str(exc).replace("\n", " ")[:100]
            print(f"{n:>6}  {total_doub:>12.4g}  {'—':>14}  {calldata_bytes:>10}  FAIL: {msg}")

    if last_ok:
        batches = (len(recipients) + last_ok - 1) // last_ok
        print(f"\nlast OK batch size: {last_ok}")
        print(f"full csv ({len(recipients)} rows) → ~{batches} transaction(s) at that size")
    else:
        print("\nno successful estimates — try a funded AIRDROP_FROM with --no-state-override")
        return 1
    return 0


if __name__ == "__main__":
    os.environ.setdefault("FOUNDRY_DISABLE_NIGHTLY_WARNING", "1")
    raise SystemExit(main())
