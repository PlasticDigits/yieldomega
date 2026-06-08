# SPDX-License-Identifier: AGPL-3.0-only
# Cloud Agent git identity helpers for PlasticDigits/yieldomega.
# Source from bootstrap / verify scripts — do not execute directly.
#
# Invariant: INV-DEVOPS-CLOUD-GIT-IDENTITY — Cloud Agent commits use GIT_USERNAME / GIT_EMAIL.

: "${YIELDOMEGA_CLOUD_AGENT_ENV:=${HOME}/.config/yieldomega/cloud-agent.env}"

yieldomega_load_git_identity_env() {
  if [[ -f "${YIELDOMEGA_CLOUD_AGENT_ENV}" ]]; then
    # shellcheck source=/dev/null
    source "${YIELDOMEGA_CLOUD_AGENT_ENV}"
  fi
}

yieldomega_git_identity_env_ok() {
  yieldomega_load_git_identity_env
  [[ -n "${GIT_USERNAME:-}" && -n "${GIT_EMAIL:-}" ]]
}

yieldomega_configure_git_identity() {
  if ! yieldomega_git_identity_env_ok; then
    echo "yieldomega_configure_git_identity: GIT_USERNAME and GIT_EMAIL must be set (Cursor Cloud secrets)." >&2
    return 1
  fi
  git config --global user.name "${GIT_USERNAME}"
  git config --global user.email "${GIT_EMAIL}"
  yieldomega_persist_git_identity_hook
  yieldomega_persist_git_identity_env
  if git rev-parse --git-dir >/dev/null 2>&1; then
    git config --local core.hooksPath .githooks 2>/dev/null || true
  fi
}

yieldomega_git_identity_ok() {
  yieldomega_git_identity_env_ok || return 1
  [[ "$(git config --global user.name 2>/dev/null || true)" == "${GIT_USERNAME}" ]] \
    && [[ "$(git config --global user.email 2>/dev/null || true)" == "${GIT_EMAIL}" ]]
}

# Persist git identity hook for interactive shells (Cursor clone may set project bot identity).
yieldomega_persist_git_identity_hook() {
  local hook_file="${HOME}/.config/yieldomega/cloud-agent-git.sh"
  mkdir -p "$(dirname "${hook_file}")"
  cat >"${hook_file}" <<'EOF'
# yieldomega Cloud Agent git identity — do not edit by hand.
if [[ -n "${GIT_USERNAME:-}" && -n "${GIT_EMAIL:-}" ]]; then
  git config --global user.name "${GIT_USERNAME}" 2>/dev/null || true
  git config --global user.email "${GIT_EMAIL}" 2>/dev/null || true
fi
EOF
}

# Merge GIT_USERNAME / GIT_EMAIL into cloud-agent.env when present.
yieldomega_persist_git_identity_env() {
  local env_file="${YIELDOMEGA_CLOUD_AGENT_ENV}"
  local repo token glab_repo
  # shellcheck source=scripts/lib/glab_cloud_agent.sh
  if [[ -f "$(dirname "${BASH_SOURCE[0]}")/glab_cloud_agent.sh" ]]; then
    # shellcheck source=scripts/lib/glab_cloud_agent.sh
    source "$(dirname "${BASH_SOURCE[0]}")/glab_cloud_agent.sh"
    repo="$(yieldomega_glab_repo)"
    token="$(yieldomega_glab_token)"
  else
    repo="${GITLAB_REPO:-PlasticDigits/yieldomega}"
    token="${GITLAB_TOKEN:-${GLAB_TOKEN:-}}"
  fi
  [[ -n "${GIT_USERNAME:-}" && -n "${GIT_EMAIL:-}" ]] || return 0
  mkdir -p "$(dirname "${env_file}")"
  {
    echo "# Yieldomega Cloud Agent — sourced by bootstrap-cloud-vm-toolchain.sh"
    echo "export GITLAB_REPO='${repo}'"
    echo "export YIELDOMEGA_GITLAB_PROJECT='${repo}'"
    if [[ -n "${token}" ]]; then
      echo "export GITLAB_TOKEN='${token}'"
      echo "export GLAB_TOKEN='${token}'"
    fi
    echo "export GIT_USERNAME='${GIT_USERNAME}'"
    echo "export GIT_EMAIL='${GIT_EMAIL}'"
  } >"${env_file}.tmp"
  if [[ ! -f "${env_file}" ]] || ! cmp -s "${env_file}" "${env_file}.tmp"; then
    mv "${env_file}.tmp" "${env_file}"
  else
    rm -f "${env_file}.tmp"
  fi
}
