#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Gate deployable src/ bytecode against MegaEVM limits (512 KiB runtime, 536 KiB initcode).
# Foundry's `forge build --sizes` still checks Ethereum EIP-170 / EIP-3860 and fails on TimeArena.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS="${ROOT}/contracts"
PROFILE="${FOUNDRY_PROFILE:-ci}"

die() {
  echo "check-megaevm-contract-sizes: $*" >&2
  exit 1
}

log() {
  echo "check-megaevm-contract-sizes: $*"
}

cd "${CONTRACTS}"
log "Building contracts (profile=${PROFILE})..."
FOUNDRY_PROFILE="${PROFILE}" forge build -q

log "Checking src/ artifacts against MegaEVM limits (524288 runtime, 548864 initcode)..."
python3 <<'PY'
import json
import pathlib
import sys

OUT = pathlib.Path("out")
MAX_RUNTIME = 524_288
MAX_INITCODE = 548_864

violations: list[str] = []
checked = 0

for artifact_path in sorted(OUT.glob("*/*.json")):
    if artifact_path.name.endswith(".metadata.json"):
        continue
    try:
        data = json.loads(artifact_path.read_text())
    except json.JSONDecodeError:
        continue

    meta_raw = data.get("metadata")
    if not meta_raw:
        continue
    meta = json.loads(meta_raw) if isinstance(meta_raw, str) else meta_raw
    targets = meta.get("settings", {}).get("compilationTarget", {})
    src_paths = [p for p in targets if p.startswith("src/")]
    if not src_paths:
        continue

    name = data.get("contractName") or artifact_path.stem
    deployed = (data.get("deployedBytecode") or {}).get("object") or "0x"
    bytecode = (data.get("bytecode") or {}).get("object") or "0x"
    runtime = (len(deployed) - 2) // 2 if deployed not in ("0x", "") else 0
    initcode = (len(bytecode) - 2) // 2 if bytecode not in ("0x", "") else 0
    checked += 1

    if runtime > MAX_RUNTIME:
        violations.append(f"{name} runtime {runtime} > {MAX_RUNTIME}")
    if initcode > MAX_INITCODE:
        violations.append(f"{name} initcode {initcode} > {MAX_INITCODE}")

if checked == 0:
    print("check-megaevm-contract-sizes: no src/ artifacts found under out/", file=sys.stderr)
    sys.exit(1)

if violations:
    print("MegaEVM contract size violations:", file=sys.stderr)
    for line in violations:
        print(f"  - {line}", file=sys.stderr)
    sys.exit(1)

print(f"check-megaevm-contract-sizes: OK ({checked} src/ contract(s))")
PY
