# SPDX-License-Identifier: AGPL-3.0-only
# Cloud Agent toolchain PATH helpers (Foundry + Rust cargo).
# Source from bootstrap / verify / stack scripts — do not execute directly.
#
# Invariants:
#   INV-DEVOPS-CLOUD-PATH — anvil, forge, cast on PATH after bootstrap-cloud-vm-toolchain.sh
#
# See AGENTS.md § Toolchain expectations on Cloud VMs.

: "${YIELDOMEGA_CLOUD_PATH_SNIPPET:=${HOME}/.config/yieldomega/cloud-agent-path.sh}"
: "${YIELDOMEGA_CLOUD_AGENT_ENV:=${HOME}/.config/yieldomega/cloud-agent.env}"

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

# Source cloud-agent.env without overriding Cursor Cloud secrets already in the shell.
yieldomega_source_cloud_agent_env_preserve_shell() {
  local env_file="${YIELDOMEGA_CLOUD_AGENT_ENV}"
  [[ -f "${env_file}" ]] || return 0
  local _gitlab_token="${GITLAB_TOKEN:-}"
  local _glab_token="${GLAB_TOKEN:-}"
  local _git_username="${GIT_USERNAME:-}"
  local _git_email="${GIT_EMAIL:-}"
  local _gitlab_repo="${GITLAB_REPO:-}"
  local _gitlab_project="${YIELDOMEGA_GITLAB_PROJECT:-}"
  # shellcheck source=/dev/null
  source "${env_file}"
  if [[ -n "${_gitlab_token}" ]]; then export GITLAB_TOKEN="${_gitlab_token}"; fi
  if [[ -n "${_glab_token}" ]]; then export GLAB_TOKEN="${_glab_token}"; fi
  if [[ -n "${_git_username}" ]]; then export GIT_USERNAME="${_git_username}"; fi
  if [[ -n "${_git_email}" ]]; then export GIT_EMAIL="${_git_email}"; fi
  if [[ -n "${_gitlab_repo}" ]]; then export GITLAB_REPO="${_gitlab_repo}"; fi
  if [[ -n "${_gitlab_project}" ]]; then export YIELDOMEGA_GITLAB_PROJECT="${_gitlab_project}"; fi
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
  yieldomega_source_cloud_agent_env_preserve_shell
  if [[ -f "${HOME}/.config/yieldomega/cloud-agent-git.sh" ]]; then
    # shellcheck source=/dev/null
    source "${HOME}/.config/yieldomega/cloud-agent-git.sh"
  fi
}

# Write ~/.config/yieldomega/cloud-agent-path.sh and hook into login/interactive shells.
yieldomega_persist_cloud_toolchain_path() {
  local rc hook
  mkdir -p "$(dirname "${YIELDOMEGA_CLOUD_PATH_SNIPPET}")"
  cat >"${YIELDOMEGA_CLOUD_PATH_SNIPPET}" <<'EOF'
# yieldomega Cloud Agent toolchain — do not edit by hand.
_yieldomega_repo_root="${YIELDOMEGA_REPO_ROOT:-}"
if [[ -z "${_yieldomega_repo_root}" ]] && command -v git >/dev/null 2>&1; then
  _yieldomega_repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
fi
_prepend=""
if [[ -n "${_yieldomega_repo_root}" && -d "${_yieldomega_repo_root}/scripts/bin" ]]; then
  _prepend="${_yieldomega_repo_root}/scripts/bin:"
fi
if [[ -d "${HOME}/.local/bin" ]]; then
  _prepend="${_prepend}${HOME}/.local/bin:"
fi
if [[ -d "${HOME}/.foundry/bin" ]]; then
  _prepend="${_prepend}${HOME}/.foundry/bin:"
fi
if [[ -d /usr/local/cargo/bin ]]; then
  _prepend="${_prepend}/usr/local/cargo/bin:"
fi
if [[ -n "${_prepend}" ]]; then
  export PATH="${_prepend}${PATH}"
fi
if [[ -f "${HOME}/.config/yieldomega/cloud-agent.env" ]]; then
  _gitlab_token="${GITLAB_TOKEN:-}"
  _glab_token="${GLAB_TOKEN:-}"
  _git_username="${GIT_USERNAME:-}"
  _git_email="${GIT_EMAIL:-}"
  _gitlab_repo="${GITLAB_REPO:-}"
  _gitlab_project="${YIELDOMEGA_GITLAB_PROJECT:-}"
  # shellcheck source=/dev/null
  source "${HOME}/.config/yieldomega/cloud-agent.env"
  if [[ -n "${_gitlab_token}" ]]; then export GITLAB_TOKEN="${_gitlab_token}"; fi
  if [[ -n "${_glab_token}" ]]; then export GLAB_TOKEN="${_glab_token}"; fi
  if [[ -n "${_git_username}" ]]; then export GIT_USERNAME="${_git_username}"; fi
  if [[ -n "${_git_email}" ]]; then export GIT_EMAIL="${_git_email}"; fi
  if [[ -n "${_gitlab_repo}" ]]; then export GITLAB_REPO="${_gitlab_repo}"; fi
  if [[ -n "${_gitlab_project}" ]]; then export YIELDOMEGA_GITLAB_PROJECT="${_gitlab_project}"; fi
fi
[[ -f "${HOME}/.config/yieldomega/cloud-agent-git.sh" ]] && source "${HOME}/.config/yieldomega/cloud-agent-git.sh"
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
