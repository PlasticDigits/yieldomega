# SPDX-License-Identifier: AGPL-3.0-only
# Cloud Agent GitLab (glab) helpers for PlasticDigits/yieldomega.
# Source from bootstrap / verify scripts — do not execute directly.
#
# Cursor Cloud clones use x-access-token HTTPS remotes; glab repo detection from
# `origin` alone often 404s (path includes `.git`). Always pass -R PlasticDigits/yieldomega
# (or GITLAB_REPO). `glab mr create` still resolves PlasticDigits/yieldomega.git from the
# remote on Cloud VMs — use yieldomega_glab_mr_create (API fallback).
#
# See AGENTS.md § glab / merge requests.

: "${YIELDOMEGA_GITLAB_HOST:=gitlab.com}"
: "${YIELDOMEGA_GITLAB_PROJECT:=PlasticDigits/yieldomega}"
: "${YIELDOMEGA_GITLAB_REMOTE:=origin}"

# Strip trailing slashes and a .git suffix (x-access-token remotes confuse glab mr create).
yieldomega_glab_normalize_repo() {
  local repo="${1:-}"
  repo="${repo%/}"
  repo="${repo%.git}"
  echo "${repo}"
}

yieldomega_glab_repo() {
  yieldomega_glab_normalize_repo "${GITLAB_REPO:-${YIELDOMEGA_GITLAB_PROJECT}}"
}

yieldomega_glab_token() {
  echo "${GITLAB_TOKEN:-${GLAB_TOKEN:-}}"
}

# Export token + repo env and invoke glab with explicit -R (PlasticDigits account).
yieldomega_glab() {
  local token repo
  token="$(yieldomega_glab_token)"
  repo="$(yieldomega_glab_repo)"
  if [[ -n "${token}" ]]; then
    export GITLAB_TOKEN="${token}"
    export GLAB_TOKEN="${token}"
  fi
  export GITLAB_REPO="${repo}"
  glab -R "${repo}" "$@"
}

yieldomega_configure_glab_auth() {
  local token repo
  token="$(yieldomega_glab_token)"
  repo="$(yieldomega_glab_repo)"
  command -v glab >/dev/null 2>&1 || return 0
  glab config set --global host "${YIELDOMEGA_GITLAB_HOST}" 2>/dev/null || true
  glab config set --global git_protocol https 2>/dev/null || true
  glab config set --global remote_alias "${YIELDOMEGA_GITLAB_REMOTE}" 2>/dev/null \
    || glab config set remote_alias "${YIELDOMEGA_GITLAB_REMOTE}" 2>/dev/null \
    || true
  if [[ -n "${token}" ]]; then
    glab config set --host "${YIELDOMEGA_GITLAB_HOST}" token "${token}" 2>/dev/null \
      || glab config set token "${token}" 2>/dev/null \
      || true
    glab auth login --hostname "${YIELDOMEGA_GITLAB_HOST}" --token "${token}" 2>/dev/null \
      || glab auth status 2>/dev/null || true
  fi
  if git rev-parse --git-dir >/dev/null 2>&1; then
    git config --local "remote.${YIELDOMEGA_GITLAB_REMOTE}.glab-resolved" base 2>/dev/null || true
    git config --local glab.resolvedProject "${repo}" 2>/dev/null || true
  fi
}

# Persist GITLAB_REPO for interactive shells (idempotent).
yieldomega_persist_glab_env() {
  local env_file="${HOME}/.config/yieldomega/cloud-agent.env"
  local repo token
  repo="$(yieldomega_glab_repo)"
  token="$(yieldomega_glab_token)"
  mkdir -p "$(dirname "${env_file}")"
  {
    echo "# Yieldomega Cloud Agent — sourced by bootstrap-cloud-vm-toolchain.sh"
    echo "export GITLAB_REPO='${repo}'"
    echo "export YIELDOMEGA_GITLAB_PROJECT='${repo}'"
    [[ -n "${token}" ]] && echo "export GITLAB_TOKEN='${token}'"
  } >"${env_file}.tmp"
  if [[ ! -f "${env_file}" ]] || ! cmp -s "${env_file}" "${env_file}.tmp"; then
    mv "${env_file}.tmp" "${env_file}"
  else
    rm -f "${env_file}.tmp"
  fi
  local marker='# yieldomega-cloud-agent-env'
  if [[ -f "${HOME}/.bashrc" ]] && ! grep -qF "${marker}" "${HOME}/.bashrc" 2>/dev/null; then
    {
      echo ""
      echo "${marker}"
      echo "[[ -f ${env_file} ]] && source ${env_file}"
    } >>"${HOME}/.bashrc"
  fi
}

yieldomega_glab_api_ok() {
  local token repo encoded
  token="$(yieldomega_glab_token)"
  repo="$(yieldomega_glab_repo)"
  [[ -n "${token}" ]] || return 1
  encoded="${repo//\//%2F}"
  curl -fsS -H "PRIVATE-TOKEN: ${token}" \
    "https://${YIELDOMEGA_GITLAB_HOST}/api/v4/projects/${encoded}" >/dev/null 2>&1
}

yieldomega_glab_project_id() {
  local token repo encoded
  token="$(yieldomega_glab_token)"
  repo="$(yieldomega_glab_repo)"
  [[ -n "${token}" ]] || return 1
  encoded="${repo//\//%2F}"
  curl -fsS -H "PRIVATE-TOKEN: ${token}" \
    "https://${YIELDOMEGA_GITLAB_HOST}/api/v4/projects/${encoded}" \
    | jq -r '.id // empty'
}

yieldomega_glab_repo_context_ok() {
  yieldomega_glab mr list --per-page 1 >/dev/null 2>&1
}

# Create an MR via GitLab REST API (avoids glab mr create + x-access-token .git 404).
yieldomega_glab_mr_create_api() {
  local source_branch="$1"
  local target_branch="$2"
  local title="$3"
  local description="${4:-}"
  local draft="${5:-0}"
  local token project_id args=() response http_code body

  token="$(yieldomega_glab_token)"
  project_id="$(yieldomega_glab_project_id)"
  [[ -n "${token}" && -n "${project_id}" ]] || return 1

  args=(
    -sS -w "\n%{http_code}"
    -X POST
    -H "PRIVATE-TOKEN: ${token}"
    --data-urlencode "source_branch=${source_branch}"
    --data-urlencode "target_branch=${target_branch}"
    --data-urlencode "title=${title}"
  )
  [[ -n "${description}" ]] && args+=(--data-urlencode "description=${description}")
  [[ "${draft}" == "1" ]] && args+=(--data-urlencode "draft=yes")

  response="$(curl "${args[@]}" \
    "https://${YIELDOMEGA_GITLAB_HOST}/api/v4/projects/${project_id}/merge_requests" 2>&1)" || return 1
  http_code="${response##*$'\n'}"
  body="${response%$'\n'*}"

  if [[ "${http_code}" =~ ^2 ]]; then
    echo "${body}" | jq -r '.web_url // empty'
    return 0
  fi

  echo "yieldomega_glab_mr_create_api: HTTP ${http_code}: ${body}" >&2
  return 1
}

# Prefer GitLab API for MR create (glab mr create 404s on Cursor x-access-token remotes).
yieldomega_glab_mr_create() {
  local source_branch="$1"
  local target_branch="$2"
  local title="$3"
  local description="${4:-}"
  local draft="${5:-0}"

  yieldomega_glab_mr_create_api "${source_branch}" "${target_branch}" "${title}" "${description}" "${draft}"
}
