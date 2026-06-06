#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Create a GitLab merge request for PlasticDigits/yieldomega via GITLAB_TOKEN.
#
# Cloud agents must use this (or yieldomega_glab_mr_create) — not the Cursor GitHub PR tool.
# Cursor clones use x-access-token remotes; `glab mr create` 404s with PlasticDigits/yieldomega.git
# even when `-R PlasticDigits/yieldomega` is passed. This script uses the GitLab REST API.
#
# Usage (repo root):
#   bash scripts/glab-mr-create.sh --title "My MR" --description "Details" [--draft]
#   bash scripts/glab-mr-create.sh --title "Fix" --fill   # use commit messages for description
#   bash scripts/glab-mr-create.sh --title "Fix" --template Default  # .gitlab/merge_request_templates/Default.md
#
# Env: GITLAB_TOKEN (Cursor secret), GITLAB_REPO (default PlasticDigits/yieldomega),
#      MR_TARGET_BRANCH (default main).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

# shellcheck source=scripts/lib/glab_cloud_agent.sh
source "${ROOT}/scripts/lib/glab_cloud_agent.sh"

TARGET="${MR_TARGET_BRANCH:-main}"
TITLE=""
DESCRIPTION=""
DRAFT_FLAG=()
FILL=0
TEMPLATE_NAME=""
EXTRA=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --title|-t)
      TITLE="${2:-}"
      shift 2
      ;;
    --description|-d|--body|-b)
      DESCRIPTION="${2:-}"
      shift 2
      ;;
    --target-branch)
      TARGET="${2:-}"
      shift 2
      ;;
    --draft)
      DRAFT_FLAG=(--draft)
      shift
      ;;
    --fill)
      FILL=1
      shift
      ;;
    --template)
      TEMPLATE_NAME="${2:-Default}"
      shift 2
      ;;
    --help|-h)
      sed -n '1,22p' "$0" | tail -n +2
      exit 0
      ;;
    *)
      EXTRA+=("$1")
      shift
      ;;
  esac
done

token="$(yieldomega_glab_token)"
if [[ -z "${token}" ]]; then
  echo "glab-mr-create.sh: GITLAB_TOKEN unset (Cursor Cloud secret)." >&2
  exit 1
fi

branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "${branch}" == "HEAD" || "${branch}" == "${TARGET}" ]]; then
  echo "glab-mr-create.sh: push a feature branch first (current: ${branch})." >&2
  exit 1
fi

if ! git rev-parse "@{u}" >/dev/null 2>&1; then
  echo "glab-mr-create.sh: no upstream — run: git push -u origin ${branch}" >&2
  exit 1
fi

if [[ -z "${TITLE}" ]]; then
  TITLE="$(git log -1 --pretty=%s)"
fi

repo="$(yieldomega_glab_repo)"
draft_flag=0
[[ ${#DRAFT_FLAG[@]} -gt 0 ]] && draft_flag=1

if [[ "${FILL}" -eq 1 ]]; then
  DESCRIPTION="$(git log --pretty=format:'%s' "origin/${TARGET}..HEAD" 2>/dev/null | paste -sd '\n' - || git log -5 --pretty=format:'%s')"
elif [[ -n "${TEMPLATE_NAME}" ]]; then
  tmpl="${ROOT}/.gitlab/merge_request_templates/${TEMPLATE_NAME}.md"
  if [[ ! -f "${tmpl}" ]]; then
    echo "glab-mr-create.sh: template not found: ${tmpl}" >&2
    exit 1
  fi
  DESCRIPTION="$(cat "${tmpl}")"
fi

if [[ ${#EXTRA[@]} -gt 0 ]]; then
  echo "glab-mr-create.sh: ignoring unsupported extra args: ${EXTRA[*]}" >&2
fi

echo "==> GitLab API merge request (${repo}: ${branch} → ${TARGET})"
url="$(yieldomega_glab_mr_create "${branch}" "${TARGET}" "${TITLE}" "${DESCRIPTION}" "${draft_flag}")" || {
  echo "glab-mr-create.sh: merge request creation failed." >&2
  exit 1
}
echo "${url}"
