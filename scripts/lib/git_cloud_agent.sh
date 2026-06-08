# SPDX-License-Identifier: AGPL-3.0-only
# Cloud Agent git identity helpers for PlasticDigits/yieldomega.
# Source from bootstrap / verify scripts — do not execute directly.
#
# Invariant: INV-DEVOPS-CLOUD-GIT-IDENTITY — Cloud Agent commits use PlasticDigits.

: "${YIELDOMEGA_GIT_USER_NAME:=PlasticDigits}"
: "${YIELDOMEGA_GIT_USER_EMAIL:=plasticdigits@protonmail.com}"

yieldomega_configure_git_identity() {
  git config --global user.name "${YIELDOMEGA_GIT_USER_NAME}"
  git config --global user.email "${YIELDOMEGA_GIT_USER_EMAIL}"
  if git rev-parse --git-dir >/dev/null 2>&1; then
    git config --local core.hooksPath .githooks 2>/dev/null || true
  fi
}

yieldomega_git_identity_ok() {
  [[ "$(git config --global user.name 2>/dev/null || true)" == "${YIELDOMEGA_GIT_USER_NAME}" ]] \
    && [[ "$(git config --global user.email 2>/dev/null || true)" == "${YIELDOMEGA_GIT_USER_EMAIL}" ]]
}
