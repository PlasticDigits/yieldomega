# SPDX-License-Identifier: AGPL-3.0-only
# Cloud Agent toolchain PATH helpers (Foundry + Rust cargo).
# Source from bootstrap / verify / stack scripts — do not execute directly.
#
# Invariants:
#   INV-DEVOPS-CLOUD-PATH — anvil, forge, cast on PATH after bootstrap-cloud-vm-toolchain.sh
#
# See AGENTS.md § Toolchain expectations on Cloud VMs.

: "${YIELDOMEGA_CLOUD_PATH_SNIPPET:=${HOME}/.config/yieldomega/cloud-agent-path.sh}"

yieldomega_prepend_cloud_toolchain_path() {
  local prepend=""
  if [[ -d "${HOME}/.foundry/bin" ]]; then
    prepend="${HOME}/.foundry/bin:"
  fi
  if [[ -d /usr/local/cargo/bin ]]; then
    prepend="${prepend}/usr/local/cargo/bin:"
  fi
  if [[ -n "${prepend}" ]]; then
    export PATH="${prepend}${PATH}"
  fi
}

# Write ~/.config/yieldomega/cloud-agent-path.sh and hook into login/interactive shells.
yieldomega_persist_cloud_toolchain_path() {
  local rc hook
  mkdir -p "$(dirname "${YIELDOMEGA_CLOUD_PATH_SNIPPET}")"
  cat >"${YIELDOMEGA_CLOUD_PATH_SNIPPET}" <<'EOF'
# yieldomega Cloud Agent toolchain (Foundry + Rust cargo) — do not edit by hand.
export PATH="${HOME}/.foundry/bin:/usr/local/cargo/bin:${PATH}"
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
