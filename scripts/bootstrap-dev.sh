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
# See also: contracts/README.md (Setup), bots/timecurve/README.md (venv + web3).

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
(cd frontend && npm ci)

echo "==> Bootstrap finished."
echo "    Optional — bot swarm deps: cd bots/timecurve && python3 -m venv .venv && . .venv/bin/activate && pip install -e '.[dev]'"
echo "    Contracts: cd contracts && forge test   (see contracts/README.md)"
