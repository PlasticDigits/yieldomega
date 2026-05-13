#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""
Patch contracts/broadcast/.../run-latest.json when a tx already mined on-chain
but forge did not persist its hash/receipt (e.g. RPC connection reset mid-broadcast).

Typical use after resume fails with:
  EOA nonce changed unexpectedly ... Expected 26 got 27
  Nonce too low. Expected >= 27, got 26

You need the mined transaction hash (from explorer or wallet history).

  python3 scripts/repair_foundry_broadcast_tx.py \\
    contracts/broadcast/DeployProduction.s.sol/4326/run-latest.json \\
    0xb227f71a6994fe3d5004172bcf116735b59fd011b6bedece2a4650bd4f916ee6 \\
    --rpc-url https://mainnet.megaeth.com/rpc

By default the script binds that hash to transactions[len(receipts)] (first tx without
a stored receipt). Use --tx-index to override if your file order differs.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path


def _cast_json(args: list[str]) -> dict:
    try:
        out = subprocess.check_output(args, text=True)
    except subprocess.CalledProcessError as e:
        print(e.stderr or str(e), file=sys.stderr)
        raise SystemExit(1) from e
    return json.loads(out)


def _nonce_hex(blob: dict) -> str:
    n = blob.get("nonce", "0x0")
    if isinstance(n, int):
        return hex(n)
    s = str(n).strip().lower()
    if not s.startswith("0x"):
        s = "0x" + s
    return s


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("broadcast_json", type=Path, help="Path to run-latest.json")
    p.add_argument("tx_hash", help="Mined transaction hash (0x…)")
    p.add_argument("--rpc-url", required=True, help="Same chain as the broadcast file")
    p.add_argument(
        "--tx-index",
        type=int,
        default=None,
        help="0-based index into transactions[] (default: len(receipts))",
    )
    p.add_argument("--dry-run", action="store_true", help="Print diff summary only; do not write")
    args = p.parse_args()

    path: Path = args.broadcast_json
    if not path.is_file():
        print(f"Not a file: {path}", file=sys.stderr)
        raise SystemExit(1)

    want = args.tx_hash.strip().lower()
    if not want.startswith("0x") or len(want) != 66:
        print("tx_hash must be 0x + 64 hex chars", file=sys.stderr)
        raise SystemExit(1)

    rpc = ["--rpc-url", args.rpc_url]
    tx = _cast_json(["cast", "tx", args.tx_hash, *rpc, "--json"])
    receipt = _cast_json(["cast", "receipt", args.tx_hash, *rpc, "--json"])

    with path.open(encoding="utf-8") as fh:
        data = json.load(fh)

    txs = data.get("transactions")
    if not isinstance(txs, list):
        print("run-latest.json: missing or invalid `transactions` array", file=sys.stderr)
        raise SystemExit(1)
    recs = data.get("receipts")
    if recs is None:
        data["receipts"] = []
        recs = data["receipts"]
    if not isinstance(recs, list):
        print("run-latest.json: invalid `receipts`", file=sys.stderr)
        raise SystemExit(1)

    for r in recs:
        th = str(r.get("transactionHash", "")).strip().lower()
        if th == want:
            print(f"Receipt for {want} already present in run-latest.json; nothing to do.")
            return

    idx = args.tx_index if args.tx_index is not None else len(recs)
    if idx < 0 or idx >= len(txs):
        print(f"tx index {idx} out of range (transactions={len(txs)}, receipts={len(recs)})", file=sys.stderr)
        raise SystemExit(1)

    entry = txs[idx]
    inner = entry.get("transaction")
    if not isinstance(inner, dict):
        print(f"transactions[{idx}] has no nested `transaction` object; cannot verify nonce/from", file=sys.stderr)
        raise SystemExit(1)

    file_nonce = _nonce_hex(inner)
    chain_nonce = str(tx.get("nonce", "0x0")).strip().lower()
    if not chain_nonce.startswith("0x"):
        chain_nonce = "0x" + chain_nonce
    if file_nonce.lower() != chain_nonce.lower():
        print(
            f"Nonce mismatch: on-chain tx has {chain_nonce}, "
            f"transactions[{idx}].transaction.nonce is {file_nonce}. "
            f"Pass --tx-index to pick another row.",
            file=sys.stderr,
        )
        raise SystemExit(1)

    f_from = str(inner.get("from", "")).lower()
    c_from = str(tx.get("from", "")).lower()
    if f_from != c_from:
        print(f"`from` mismatch: file {f_from} vs chain {c_from}", file=sys.stderr)
        raise SystemExit(1)

    old_hash = entry.get("hash")
    print(f"transactions[{idx}]: hash {old_hash!r} -> {want!r}")
    print(f"receipts: len {len(recs)} -> {len(recs) + 1}")

    if args.dry_run:
        print("Dry run: no changes written.")
        return

    bak = path.with_suffix(path.suffix + ".bak")
    shutil.copy2(path, bak)
    print(f"Backup: {bak}")

    entry["hash"] = tx.get("hash", args.tx_hash)
    recs.append(receipt)

    with path.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2)
        fh.write("\n")

    print(f"Updated {path}. Re-run: forge script ... --broadcast --resume (or scripts/deploy-megaeth-contracts.sh --resume)")


if __name__ == "__main__":
    main()
