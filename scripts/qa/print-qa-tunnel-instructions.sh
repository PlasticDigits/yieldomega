#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Reprint SSH tunnel + laptop workflow (same as end of start-qa.sh).
# Run: make qa-tunnel-help  or  ./scripts/qa/print-qa-tunnel-instructions.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

if [[ -t 1 ]] && [[ -z "${NO_COLOR:-}" ]]; then
  _B=$'\033[1m'
  _Y=$'\033[93m'
  _G=$'\033[92m'
  _N=$'\033[0m'
  _SRV=$'\033[1;96m'
  _LAP=$'\033[1;95m'
  _ALERT=$'\033[1;93;41m'
else
  _B='' _Y='' _G='' _N='' _SRV='' _LAP='' _ALERT=''
fi

if [[ -f "$REPO_ROOT/.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$REPO_ROOT/.env"
  set +a
fi
# shellcheck source=/dev/null
source "$REPO_ROOT/scripts/qa/qa-host.env"

if [[ -n "${QA_SSH_HOST:-}" ]]; then
  SSH_DEST="$(whoami)@${QA_SSH_HOST}"
else
  SSH_DEST="$(whoami)@$(hostname -f 2>/dev/null || hostname)"
fi
QA_SSH_PORT="${QA_SSH_PORT:-22}"
SSH_P_ARGS=""
SCP_P_ARGS=""
if [[ "${QA_SSH_PORT}" != "22" ]]; then
  SSH_P_ARGS="-p ${QA_SSH_PORT} "
  SCP_P_ARGS="-P ${QA_SSH_PORT} "
fi

printf '%b\n' "${_SRV}"
cat <<'EOF'
   __SERVER (QA host)__          ssh -L tunnels          __LAPTOP (your machine)__
          | )=============================================( |
          |'   copy-paste blocks below are NOT all on one host — read the tags   `|
EOF
printf '%b\n' "${_N}"

printf '%b\n' "${_SRV}  SERVER${_N} = QA machine (where ${_G}make start-qa${_N} ran).  ${_LAP}LAPTOP${_N} = local dev machine."
printf '%b\n' "${_Y}  Services bind to 127.0.0.1 on the server; only SSH needs to be reachable from the laptop.${_N}"
printf '%b\n' "  Doc: ${_G}scripts/qa/README.md${_N}"
echo ""
printf '%b\n' "  Optional repo-root ${_G}.env${_N}: ${_G}QA_SSH_HOST${_N}, ${_G}QA_SSH_PORT${_N} (if not 22)."
printf '%b\n' "  SSH user below is ${_G}$(whoami)${_N} (who ran start-qa on the server)."
echo ""

printf '%b\n' "${_SRV}${_B}  Step 1 — SERVER ONLY${_N}"
printf '%b\n' "           ${_G}make status${_N}  — expect Postgres, Anvil, indexer healthy."
printf '%b\n' "${_SRV}         Do not run Vite or the SSH tunnel on the server for laptop QA.${_N}"
echo ""

printf '%b\n' "${_LAP}${_B}  Step 2 — LAPTOP ONLY${_N}"
printf '%b\n' "${_LAP}         SSH port forwards (keep this terminal open). Use 127.0.0.1 to avoid IPv6 bind issues.${_N}"
echo ""
printf '%b\n' "${_G}${_B}ssh -4 -N ${SSH_P_ARGS}\\${_N}"
printf '%b\n' "${_G}  -L 127.0.0.1:${ANVIL_PORT}:127.0.0.1:${ANVIL_PORT} \\${_N}"
printf '%b\n' "${_G}  -L 127.0.0.1:${INDEXER_PORT}:127.0.0.1:${INDEXER_PORT} \\${_N}"
printf '%b\n' "${_G}  ${SSH_DEST}${_N}"
echo ""

printf '%b\n' "${_LAP}${_B}  Step 3 — LAPTOP ONLY${_N}"
printf '%b\n' "    ${_G}scp ${SCP_P_ARGS}${SSH_DEST}:${REPO_ROOT}/.deploy/local.env .deploy/local.env${_N}"
echo ""

printf '%b\n' "${_LAP}${_B}  Step 4 — LAPTOP ONLY${_N}"
printf '%b\n' "    ${_G}./scripts/qa/write-frontend-env-local.sh${_N}"
echo ""

printf '%b\n' "${_LAP}${_B}  Step 5 — LAPTOP ONLY${_N}"
printf '%b\n' "    ${_G}cd frontend && npm ci && npm run dev${_N}"
printf '%b\n' "           Open the URL Vite prints (e.g. ${_G}http://127.0.0.1:5173${_N})."
echo ""

printf '%b\n' "${_Y}${_B}"
cat <<'EOF'

      ___    ____  ____
     / _ \  |___ \ |___ \
    | |_| |   __) | __) |   SSH -L  = RPC + indexer on laptop loopback
    |  _  |  |__ < |__ <    Vite     = run locally (do NOT -L the dev server)
    |_| |_|  |___/ |___/
EOF
printf '%b\n' "${_N}"
printf '%b\n' "${_ALERT}  Do not tunnel the Vite dev server.${_N}"
