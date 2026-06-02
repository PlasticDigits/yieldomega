#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Launch Google Chrome with the unpacked Rabby extension (manual QA / Desktop pane).
#
# Extension path (install once per VM/snapshot):
#   sudo bash scripts/install-browser-extensions.sh
#
# Usage:
#   bash scripts/launch-chrome-with-rabby.sh [URL]
#   bash scripts/launch-chrome-with-rabby.sh http://127.0.0.1:5173/arena

set -euo pipefail

RABBY_EXT="${RABBY_EXTENSION_PATH:-/opt/cursor/browser-extensions/rabby}"
PROFILE="${CHROME_RABBY_PROFILE:-/opt/cursor/chrome-profile-rabby}"
URL="${1:-about:blank}"

CHROME="${CHROME_BIN:-/usr/local/bin/google-chrome}"
if [[ ! -x "${CHROME}" ]]; then
  CHROME="$(command -v google-chrome || command -v chromium-browser || command -v chromium || true)"
fi

[[ -n "${CHROME}" && -x "${CHROME}" ]] || {
  echo "Chrome/Chromium not found. Set CHROME_BIN." >&2
  exit 1
}

[[ -f "${RABBY_EXT}/manifest.json" ]] || {
  echo "Rabby extension not found at ${RABBY_EXT}. Run: sudo bash scripts/install-browser-extensions.sh" >&2
  exit 1
}

mkdir -p "${PROFILE}"

exec "${CHROME}" \
  --user-data-dir="${PROFILE}" \
  --disable-extensions-except="${RABBY_EXT}" \
  --load-extension="${RABBY_EXT}" \
  "${URL}"
