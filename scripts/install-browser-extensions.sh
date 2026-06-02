#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Install unpacked browser extensions under /opt/cursor/browser-extensions/.
# Idempotent — safe to re-run on VM setup or snapshot prep.
#
# Usage (repo root):
#   sudo bash scripts/install-browser-extensions.sh

set -euo pipefail

RABBY_VERSION="${RABBY_VERSION:-0.93.90}"
DEST="/opt/cursor/browser-extensions"
RABBY_DIR="${DEST}/rabby"
ZIP_URL="https://github.com/RabbyHub/Rabby/releases/download/v${RABBY_VERSION}/Rabby_v${RABBY_VERSION}.zip"

mkdir -p "${DEST}"
tmp="$(mktemp -d)"
trap 'rm -rf "${tmp}"' EXIT

echo "==> Rabby v${RABBY_VERSION}"
curl -fsSL -o "${tmp}/rabby.zip" "${ZIP_URL}"
rm -rf "${RABBY_DIR}"
unzip -q "${tmp}/rabby.zip" -d "${RABBY_DIR}"
test -f "${RABBY_DIR}/manifest.json"

chmod -R a+rX "${DEST}" 2>/dev/null || true

echo "==> Installed Rabby at ${RABBY_DIR}"
echo "    Launch: bash scripts/launch-chrome-with-rabby.sh http://127.0.0.1:5173/arena"
