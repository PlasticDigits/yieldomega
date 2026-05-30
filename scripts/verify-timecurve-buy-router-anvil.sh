#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# @deprecated — TimeCurve retired ([#243](https://gitlab.com/PlasticDigits/yieldomega/-/issues/243)).
# Use `bash scripts/verify-time-arena-buy-router-anvil.sh` for Arena v2 TimeArenaBuyRouter ([#251](https://gitlab.com/PlasticDigits/yieldomega/-/issues/251)).
echo "verify-timecurve-buy-router-anvil: deprecated — delegating to verify-time-arena-buy-router-anvil.sh" >&2
exec bash "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/verify-time-arena-buy-router-anvil.sh" "$@"
