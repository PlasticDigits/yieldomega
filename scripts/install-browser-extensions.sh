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

if [[ "$(id -u)" -ne 0 ]]; then
  echo "install-browser-extensions.sh: run as root (sudo bash scripts/install-browser-extensions.sh)." >&2
  exit 1
fi

apt_packages_present() {
  dpkg-query -W -f='${Status}' "$1" 2>/dev/null | grep -q "install ok installed"
}

missing_pkgs=()
for pkg in curl unzip ca-certificates; do
  apt_packages_present "${pkg}" || missing_pkgs+=("${pkg}")
done
if [[ ${#missing_pkgs[@]} -gt 0 ]]; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y "${missing_pkgs[@]}"
fi

mkdir -p "${DEST}"
tmp="$(mktemp -d)"
trap 'rm -rf "${tmp}"' EXIT

echo "==> Rabby v${RABBY_VERSION}"
curl -fsSL --retry 3 --retry-delay 2 -o "${tmp}/rabby.zip" "${ZIP_URL}"
rm -rf "${RABBY_DIR}"
unzip -q "${tmp}/rabby.zip" -d "${RABBY_DIR}"

# Some release zips nest manifest.json one level down.
if [[ ! -f "${RABBY_DIR}/manifest.json" ]]; then
  nested="$(find "${RABBY_DIR}" -mindepth 1 -maxdepth 2 -name manifest.json -print -quit || true)"
  if [[ -n "${nested}" ]]; then
    nested_dir="$(dirname "${nested}")"
    if [[ "${nested_dir}" != "${RABBY_DIR}" ]]; then
      shopt -s dotglob
      mv "${nested_dir}"/* "${RABBY_DIR}/"
      shopt -u dotglob
      rmdir "${nested_dir}" 2>/dev/null || true
    fi
  fi
fi

test -f "${RABBY_DIR}/manifest.json"

chmod -R a+rX "${DEST}" 2>/dev/null || true
mkdir -p /opt/cursor/chrome-profile-rabby
chmod 1777 /opt/cursor/chrome-profile-rabby 2>/dev/null || chmod a+rwx /opt/cursor/chrome-profile-rabby 2>/dev/null || true

echo "==> Installed Rabby at ${RABBY_DIR}"
echo "    Launch: bash scripts/launch-chrome-with-rabby.sh http://127.0.0.1:5173/arena"
