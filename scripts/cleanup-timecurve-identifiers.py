#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""Follow-up TimeCurve → TimeArena identifier cleanup (#245)."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Longest-first to avoid partial replacements.
REPLACEMENTS: list[tuple[str, str]] = [
    ("useTimecurveProtocolAccordionTokenDecimals", "useArenaProtocolAccordionTokenDecimals"),
    ("useTimeCurveProtocolData", "useArenaProtocolData"),
    ("UseTimecurveHeroTimerResult", "UseArenaHeroTimerResult"),
    ("TimecurveHeroCountdownInput", "ArenaHeroCountdownInput"),
    ("timecurveHeroDisplaySecondsRemaining", "arenaHeroDisplaySecondsRemaining"),
    ("BuildTimeCurveBuyProjectedEffectLinesArgs", "BuildArenaBuyProjectedEffectLinesArgs"),
    ("DEFAULT_TIMECURVE_BUY_PREVIEW_POLICY", "DEFAULT_ARENA_BUY_PREVIEW_POLICY"),
    ("TimeCurveBuyPreviewPolicy", "ArenaBuyPreviewPolicy"),
    ("UseTimeCurveSaleSession", "UseArenaSaleSession"),
    ("readFreshTimeCurveBuySizing", "readFreshArenaBuySizing"),
    ("resolveTimeCurveBuyRouterForKumbayaSingleTx", "resolveArenaBuyRouterForKumbayaSingleTx"),
    ("TimeCurveBuyRouterForSingleTxResult", "ArenaBuyRouterForSingleTxResult"),
    ("onchainTimeCurveBuyRouter", "onchainArenaBuyRouter"),
    ("isArenaV2TimeCurve", "isTimeArenaV2"),
    ("TIMECURVE_PROTOCOL_PAGE_TC_READS", "ARENA_PROTOCOL_PAGE_READS"),
    ("TIMECURVE_PROTOCOL_EXTRA_TC_READS", "ARENA_PROTOCOL_EXTRA_READS"),
    ("TIMECURVE_SALE_STATE_QUERY_KEY", "ARENA_SALE_STATE_QUERY_KEY"),
    ("TIMECURVE_PODIUMS_QUERY_KEY", "ARENA_PODIUMS_QUERY_KEY"),
    ("TIMECURVE_BUY_HUB_DERIVED_SIGFIGS", "ARENA_BUY_HUB_DERIVED_SIGFIGS"),
    ("TIMECURVE_BUY_CTA_CHARM_SIGFIGS", "ARENA_BUY_CTA_CHARM_SIGFIGS"),
    ("TIMECURVE_HERO_RATE_SIGFIGS", "ARENA_HERO_RATE_SIGFIGS"),
    ("TimecurveSimpleRatePayTokenPicker", "ArenaSimpleRatePayTokenPicker"),
    ("TimecurveSimpleAmountPayTokenSelect", "ArenaSimpleAmountPayTokenSelect"),
    ("collectTimecurveWalletAddressesForDotMega", "collectArenaWalletAddressesForDotMega"),
    ("TimecurveDotMegaSourceInput", "ArenaDotMegaSourceInput"),
    ("fetchTimecurveWarbowLeaderboardAll", "fetchArenaWarbowLeaderboardAll"),
    ("fetchTimecurveWarbowRefreshCandidates", "fetchArenaWarbowRefreshCandidates"),
    ("fetchTimecurveWarbowLeaderboard", "fetchArenaWarbowLeaderboard"),
    ("fetchTimecurveWarbowBattleFeed", "fetchArenaWarbowBattleFeed"),
    ("fetchTimecurvePrizeDistributions", "fetchArenaPrizeDistributions"),
    ("fetchTimecurveCharmRedemptions", "fetchArenaCharmRedemptions"),
    ("fetchTimecurvePrizePayouts", "fetchArenaPrizePayouts"),
    ("timecurvePrizeDistributionsApiPath", "arenaPrizeDistributionsApiPath"),
    ("fetchTimecurvePlatformUsage", "fetchArenaPlatformUsage"),
    ("timecurvePlatformUsageApiPath", "arenaPlatformUsageApiPath"),
    ("fetchTimecurveBuyerStats", "fetchArenaBuyerStats"),
    ("timecurveBuyerStatsApiPath", "arenaBuyerStatsApiPath"),
    ("timecurvePrizePayoutsApiPath", "arenaPrizePayoutsApiPath"),
    ("fetchTimecurveChainTimer", "fetchLegacyArenaChainTimer"),
    ("fetchTimecurveSaleState", "fetchLegacyArenaSaleState"),
    ("fetchTimecurvePodiums", "fetchLegacyArenaPodiums"),
    ("fetchTimecurveBuys", "fetchArenaBuysAsBuyItems"),
    ("TimecurvePlatformUsage", "ArenaPlatformUsage"),
    ("TimecurvePodiumsResponse", "ArenaPodiumsResponse"),
    ("TimecurvePodiumApiRow", "ArenaPodiumApiRow"),
    ("TimecurveBuyerStats", "ArenaBuyerStats"),
    ("TimecurveChainTimer", "ArenaChainTimer"),
    ("TimecurveSaleState", "ArenaSaleState"),
    ("TimecurveBuysPage", "ArenaBuysPageLegacy"),
    ("writeCl8yTimeCurveUnlimitedApproval", "writeCl8yArenaUnlimitedApproval"),
    ("useCl8yTimeCurveUnlimitedApproval", "useCl8yArenaUnlimitedApproval"),
    ("CL8Y_TIMECURVE_UNLIMITED_APPROVAL_STORAGE_KEY", "CL8Y_ARENA_UNLIMITED_APPROVAL_STORAGE_KEY"),
    ("CL8Y_TIMECURVE_APPROVE_INCLUSION_HEADROOM_BPS", "CL8Y_ARENA_APPROVE_INCLUSION_HEADROOM_BPS"),
    ("isReservedUnderTimecurve", "isReservedUnderLegacyArenaPath"),
    ("timeCurveWarbowBpEventAbi", "timeArenaWarbowBpEventAbi"),
    ("timeCurveBuyEventAbi", "timeArenaBuyEventAbi"),
    ("timeCurveBuyRouterAbi", "retiredV1BuyRouterAbi"),
    ("timeCurveWriteAbi", "retiredV1SaleWriteAbi"),
    ("timeCurveReadAbi", "retiredV1SaleReadAbi"),
    ("TIMECURVE_SCRIPTING_SNIPPET", "ARENA_SCRIPTING_SNIPPET"),
    ("PY_DEFAULT_TIMECURVE_ABI_URL", "PY_DEFAULT_TIME_ARENA_ABI_URL"),
    ("DEFAULT_TIMECURVE_ABI_URL", "DEFAULT_TIME_ARENA_ABI_URL"),
    ("load_timecurve_abi", "load_timearena_abi"),
    ("TIME_CURVE_ABI", "TIME_ARENA_ABI"),
    ("TIMECURVE_BUY_ROUTER_ADDR", "TIME_ARENA_BUY_ROUTER_ADDR"),
    ("exec_timecurve_buy", "exec_arena_buy"),
    ("ensure_cl8y_for_timecurve_burn", "ensure_cl8y_for_arena_burn"),
    ("yieldomega-timecurve-sketch", "yieldomega-arena-sketch"),
    ("cl8y-timecurve-approval-pref", "cl8y-arena-approval-pref"),
    ("cl8y-timecurve-unlimited-approval-disclosure", "cl8y-arena-unlimited-approval-disclosure"),
    ("cl8y-timecurve-approve:", "cl8y-arena-approve:"),
    ("VITE_KUMBAYA_TIMECURVE_BUY_ROUTER", "VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER"),
    ("TIMECURVE_ABI_JSON", "TIME_ARENA_ABI_JSON"),
    ("TIMECURVE_ABI_URL", "TIME_ARENA_ABI_URL"),
    ("TIMECURVE_BUY_ROUTER_ABI_JSON", "TIME_ARENA_BUY_ROUTER_ABI_JSON"),
    ("TIMECURVE_BUY_ROUTER_ABI_URL", "TIME_ARENA_BUY_ROUTER_ABI_URL"),
    ("VITE_TIMECURVE_ADDRESS", "VITE_TIME_ARENA_ADDRESS"),
    ("timecurve-views.md", "arena-views.md"),
    ("timecurve-live-buys-modals", "arena-live-buys-modals"),
    ("@container timecurveSimplePage", "@container arenaSimplePage"),
    ("container-name: timecurveSimplePage", "container-name: arenaSimplePage"),
    ("@keyframes timecurve-spot-pulse", "@keyframes arena-spot-pulse"),
    ("@keyframes timecurve-stake-gradient-drift", "@keyframes arena-stake-gradient-drift"),
    ("@keyframes timecurve-stake-particle-float", "@keyframes arena-stake-particle-float"),
    (".page--timecurve", ".page--arena"),
    (".timecurve-buy-projected-effects__title", ".arena-buy-projected-effects__title"),
    (".timecurve-buy-projected-effects__head", ".arena-buy-projected-effects__head"),
    (".timecurve-buy-projected-effects", ".arena-buy-projected-effects"),
    (".timecurve-arena-buy-panel__checkout-head", ".arena-buy-panel__checkout-head"),
    (".timecurve-arena-buy-panel__future-option", ".arena-buy-panel__future-option"),
    (".timecurve-arena-buy-panel__conversion-token", ".arena-buy-panel__conversion-token"),
    (".timecurve-arena-buy-panel__conversion-arrow", ".arena-buy-panel__conversion-arrow"),
    (".timecurve-arena-buy-panel__conversion", ".arena-buy-panel__conversion"),
    (".timecurve-arena-buy-panel__advanced", ".arena-buy-panel__advanced"),
    (".timecurve-arena-buy-panel__checkout", ".arena-buy-panel__checkout"),
    (".timecurve-arena-buy-page", ".arena-buy-page"),
    (".timecurve-arena-buy-panel", ".arena-buy-panel"),
    (".timecurve-cl8y-buy-controls__slider-label--pay-usdm", ".arena-cl8y-buy-controls__slider-label--pay-usdm"),
    (".timecurve-cl8y-buy-controls__slider-label--pay-eth", ".arena-cl8y-buy-controls__slider-label--pay-eth"),
    (".timecurve-cl8y-buy-controls__slider-label--pay-cl8y", ".arena-cl8y-buy-controls__slider-label--pay-cl8y"),
    (".timecurve-cl8y-buy-controls__balance", ".arena-cl8y-buy-controls__balance"),
    (".timecurve-cl8y-buy-controls", ".arena-cl8y-buy-controls"),
    (".timecurve-live-charts__bounds-note", ".arena-live-charts__bounds-note"),
    (".timecurve-live-charts__spot-dot", ".arena-live-charts__spot-dot"),
    (".timecurve-live-charts__muted", ".arena-live-charts__muted"),
    (".timecurve-live-charts__plot", ".arena-live-charts__plot"),
    (".timecurve-live-charts__live-row", ".arena-live-charts__live-row"),
    (".timecurve-live-charts__title", ".arena-live-charts__title"),
    (".timecurve-live-charts__panel", ".arena-live-charts__panel"),
    (".timecurve-live-charts__intro", ".arena-live-charts__intro"),
    (".timecurve-live-charts", ".arena-live-charts"),
    (".timecurve-action-highlights", ".arena-action-highlights"),
    (".timecurve-stats-grid", ".arena-stats-grid"),
    (".timecurve-panel--summary", ".arena-panel--summary"),
    (".timecurve-panel--action", ".arena-panel--action"),
    (".timecurve-panel--status", ".arena-panel--status"),
    (".timecurve-panel--feed", ".arena-panel--feed"),
    (".timecurve-panel", ".arena-panel"),
    (".timecurve-action-row", ".arena-action-row"),
    ("TimeCurve contract", "Time Arena contract"),
    ("Open TimeCurve", "Open Time Arena"),
    ("live TimeCurve surface", "live Time Arena surface"),
    ("TimeCurve remains", "Time Arena remains"),
    ("TimeCurve referral path", "Time Arena referral path"),
    ("TimeCurve goes live", "Time Arena goes live"),
    ("TimeCurve buy", "Time Arena buy"),
    ("TimeCurve buys", "Time Arena buys"),
    ("TimeCurve Simple", "Time Arena Simple"),
    ("TimeCurve Arena", "Time Arena"),
    ("TimeCurve Protocol", "Time Arena Protocol"),
    ("TimeCurve ·", "Time Arena ·"),
    ("TimeCurve lists", "Time Arena lists"),
    ("TimeCurve buy hub", "Time Arena buy hub"),
    ("TimeCurve buy modals", "Time Arena buy modals"),
    ("TimeCurve surfaces", "Time Arena surfaces"),
    ("TimeCurve-shaped", "Arena-shaped"),
    ("TimeCurve page", "Time Arena page"),
    ("TimeCurve routes", "Time Arena routes"),
    ("TimeCurve-simple", "Arena-simple"),
    ("TimeCurve sub-nav", "Time Arena sub-nav"),
    ("TimeCurve stopwatch", "Time Arena stopwatch"),
    ("reads as TimeCurve", "reads as Time Arena"),
    ("TimeCurve live buys", "Time Arena live buys"),
    ("TimeCurve write surfaces", "Time Arena write surfaces"),
    ("TimeCurve phase", "Time Arena phase"),
    ("TimeCurve hero", "Time Arena hero"),
    ("TimeCurve entry", "Time Arena entry"),
    ("TimeCurve multi-asset", "Time Arena multi-asset"),
    ("TimeCurve pay rails", "Time Arena pay rails"),
    ("TimeCurve and Arena", "Time Arena"),
    ("TimeCurve / accepted-asset", "Time Arena / accepted-asset"),
    ("TimeCurve / `buyViaKumbaya`", "Time Arena / `buyViaKumbaya`"),
    ("TimeCurve / vault contracts", "Time Arena / vault contracts"),
    ("TimeCurve forwards", "Time Arena forwards"),
    ("TimeCurve with", "Time Arena with"),
    ("TimeCurve at", "Time Arena at"),
    ("TimeCurve pulls", "Time Arena pulls"),
    ("TimeCurve.buy", "TimeArena.buy"),
    ("TimeCurve.sol", "TimeArena.sol"),
    ("TimeCurveBuyRouter", "TimeArenaBuyRouter"),
    ("TimeCurve.json", "TimeArena.json"),
    ("TimeCurveBuyRouter.json", "TimeArenaBuyRouter.json"),
    ("TimeCurve: ", "TimeArena: "),
    ("TimeCurve:", "TimeArena:"),
    ("useTimeCurveArenaModel", "useArenaModel"),
    ("timeCurveAddress", "timeArenaAddress"),
]

SCAN = [
    ROOT / "frontend",
    ROOT / "docs/frontend",
    ROOT / "docs/testing/invariants-and-business-logic.md",
    ROOT / "bots/timearena/README.md",
    ROOT / "frontend/public/art/README.md",
    ROOT / "frontend/public/art/issue45/README.md",
]


def replace_in_file(path: Path) -> bool:
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return False
    orig = text
    for old, new in REPLACEMENTS:
        text = text.replace(old, new)
    if text != orig:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def main() -> None:
    changed = 0
    for base in SCAN:
        if base.is_file():
            if replace_in_file(base):
                changed += 1
            continue
        for path in base.rglob("*"):
            if not path.is_file():
                continue
            if path.suffix in {".png", ".jpg", ".webp", ".woff", ".woff2", ".ico", ".json"}:
                continue
            if "node_modules" in path.parts or ".venv" in path.parts:
                continue
            if replace_in_file(path):
                changed += 1
    print(f"Updated {changed} files")


if __name__ == "__main__":
    main()
