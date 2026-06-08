#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Developer bootstrap after clone: initialize git submodules (Foundry libs under
# contracts/lib/, including OpenZeppelin) and install frontend dependencies.
#
# Idempotent — safe to re-run after pulls that change submodule pointers.
#
# Usage (repository root):
#   bash scripts/bootstrap-dev.sh
#
# Prefer cloning with submodules when possible:
#   git clone --recurse-submodules <url>
#
# GitLab #162 — onboarding / QA prerequisites
# See also: contracts/README.md (Setup), bots/timearena/README.md (venv + web3).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "bootstrap-dev.sh: not inside a git repository (submodules require git)." >&2
  exit 1
fi

echo "==> Git submodules (contracts/lib/)"
git submodule update --init --recursive

echo "==> Frontend (npm ci)"
# --no-audit/--no-fund reduce install time and peak memory on Cloud Agent VMs.
# Cap Node heap during install to reduce OOM risk alongside Playwright/Docker bootstrap.
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=3072}"
(cd frontend && npm ci --no-audit --no-fund)

echo "==> Bootstrap finished."
echo "    Optional — bot swarm deps: cd bots/timearena && python3 -m venv .venv && . .venv/bin/activate && pip install -e '.[dev]'"
echo "    Contracts: cd contracts && forge test   (see contracts/README.md)"
