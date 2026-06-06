# SPDX-License-Identifier: AGPL-3.0-only
# Cloud Agent Rabby extension helpers.
# Source from bootstrap / verify scripts — do not execute directly.
#
# Invariants:
#   INV-DEVOPS-RABBY-EXT — unpacked Rabby at /opt/cursor/browser-extensions/rabby/manifest.json
#
# See AGENTS.md § Cloud agent bootstrap (Playwright + Rabby).

: "${YIELDOMEGA_RABBY_EXT_DIR:=/opt/cursor/browser-extensions/rabby}"
: "${YIELDOMEGA_RABBY_PROFILE:=/opt/cursor/chrome-profile-rabby}"
: "${YIELDOMEGA_RABBY_MARKER:=${YIELDOMEGA_RABBY_PROFILE}/.yieldomega-rabby-dev-wallets-ready}"

yieldomega_rabby_manifest() {
  echo "${YIELDOMEGA_RABBY_EXT_DIR}/manifest.json"
}

yieldomega_rabby_installed() {
  [[ -f "$(yieldomega_rabby_manifest)" ]]
}

yieldomega_rabby_run_as_root() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    return 1
  fi
}

yieldomega_rabby_agent_user() {
  if [[ -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
    echo "${SUDO_USER}"
  elif [[ -n "${USER:-}" && "${USER}" != "root" ]]; then
    echo "${USER}"
  else
    echo "ubuntu"
  fi
}

# Ensure chrome-profile-rabby exists and is writable by the agent user (not root-only).
yieldomega_ensure_rabby_profile_dir() {
  local agent_user
  agent_user="$(yieldomega_rabby_agent_user)"
  if yieldomega_rabby_run_as_root mkdir -p "${YIELDOMEGA_RABBY_PROFILE}"; then
    yieldomega_rabby_run_as_root chown -R "${agent_user}:${agent_user}" "${YIELDOMEGA_RABBY_PROFILE}" 2>/dev/null \
      || yieldomega_rabby_run_as_root chmod -R a+rwx "${YIELDOMEGA_RABBY_PROFILE}" 2>/dev/null \
      || true
  fi
}

# Idempotent install of unpacked Rabby under /opt/cursor/browser-extensions/rabby.
# Usage: yieldomega_ensure_rabby_extension [REPO_ROOT]
yieldomega_ensure_rabby_extension() {
  local root="${1:-}"
  if [[ -z "${root}" ]]; then
  # shellcheck disable=SC2164
    root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  fi

  if yieldomega_rabby_installed; then
    yieldomega_ensure_rabby_profile_dir
    return 0
  fi

  local install_script="${root}/scripts/install-browser-extensions.sh"
  if [[ ! -x "${install_script}" && ! -f "${install_script}" ]]; then
    echo "rabby-cloud-agent: install script missing at ${install_script}" >&2
    return 1
  fi

  echo "rabby-cloud-agent: installing Rabby extension (install-browser-extensions.sh)"
  if ! yieldomega_rabby_run_as_root bash "${install_script}"; then
    echo "rabby-cloud-agent: Rabby install failed — need root/sudo for ${YIELDOMEGA_RABBY_EXT_DIR}" >&2
    return 1
  fi

  if ! yieldomega_rabby_installed; then
    echo "rabby-cloud-agent: Rabby install finished but manifest missing at $(yieldomega_rabby_manifest)" >&2
    return 1
  fi

  yieldomega_ensure_rabby_profile_dir
  return 0
}
