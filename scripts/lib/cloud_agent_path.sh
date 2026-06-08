# SPDX-License-Identifier: AGPL-3.0-only
# Cloud Agent toolchain PATH helpers (Foundry + Rust cargo).
# Source from bootstrap / verify / stack scripts — do not execute directly.
#
# Invariants:
#   INV-DEVOPS-CLOUD-PATH — anvil, forge, cast on PATH after bootstrap-cloud-vm-toolchain.sh
#
# See AGENTS.md § Toolchain expectations on Cloud VMs.

: "${YIELDOMEGA_CLOUD_PATH_SNIPPET:=${HOME}/.config/yieldomega/cloud-agent-path.sh}"

yieldomega_repo_scripts_bin() {
  local root="${YIELDOMEGA_REPO_ROOT:-}"
  if [[ -z "${root}" ]]; then
    if git rev-parse --show-toplevel >/dev/null 2>&1; then
      root="$(git rev-parse --show-toplevel)"
    elif [[ -f "${BASH_SOURCE[0]:-}" ]]; then
      root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
    fi
  fi
  if [[ -n "${root}" && -d "${root}/scripts/bin" ]]; then
    echo "${root}/scripts/bin"
  fi
}

yieldomega_prepend_cloud_toolchain_path() {
  local prepend="" scripts_bin
  scripts_bin="$(yieldomega_repo_scripts_bin 2>/dev/null || true)"
  if [[ -n "${scripts_bin}" ]]; then
    prepend="${scripts_bin}:"
  fi
  if [[ -d "${HOME}/.local/bin" ]]; then
    prepend="${prepend}${HOME}/.local/bin:"
  fi
  if [[ -d "${HOME}/.foundry/bin" ]]; then
    prepend="${prepend}${HOME}/.foundry/bin:"
  fi
  if [[ -d /usr/local/cargo/bin ]]; then
    prepend="${prepend}/usr/local/cargo/bin:"
  fi
  if [[ -n "${prepend}" ]]; then
    export PATH="${prepend}${PATH}"
  fi
  if [[ -f "${HOME}/.config/yieldomega/cloud-agent.env" ]]; then
    # shellcheck source=/dev/null
    source "${HOME}/.config/yieldomega/cloud-agent.env"
  fi
}

# Write ~/.config/yieldomega/cloud-agent-path.sh and hook into login/interactive shells.
yieldomega_persist_cloud_toolchain_path() {
  local rc hook scripts_bin
  scripts_bin="$(yieldomega_repo_scripts_bin 2>/dev/null || true)"
  scripts_bin="${scripts_bin:-/workspace/scripts/bin}"
  mkdir -p "$(dirname "${YIELDOMEGA_CLOUD_PATH_SNIPPET}")"
  cat >"${YIELDOMEGA_CLOUD_PATH_SNIPPET}" <<EOF
# yieldomega Cloud Agent toolchain — do not edit by hand.
export PATH="${scripts_bin}:\${HOME}/.local/bin:\${HOME}/.foundry/bin:/usr/local/cargo/bin:\${PATH}"
[[ -f "\${HOME}/.config/yieldomega/cloud-agent.env" ]] && source "\${HOME}/.config/yieldomega/cloud-agent.env"
EOF
  hook='[[ -f "${HOME}/.config/yieldomega/cloud-agent-path.sh" ]] && source "${HOME}/.config/yieldomega/cloud-agent-path.sh"'
  for rc in "${HOME}/.bashrc" "${HOME}/.profile"; do
    if [[ -f "${rc}" ]] && ! grep -qF 'yieldomega/cloud-agent-path.sh' "${rc}" 2>/dev/null; then
      {
        echo ""
        echo "# yieldomega Cloud Agent toolchain"
        echo "${hook}"
      } >>"${rc}"
    fi
  done
}

yieldomega_cloud_foundry_ready() {
  yieldomega_prepend_cloud_toolchain_path
  command -v anvil >/dev/null 2>&1 \
    && command -v forge >/dev/null 2>&1 \
    && command -v cast >/dev/null 2>&1
}
