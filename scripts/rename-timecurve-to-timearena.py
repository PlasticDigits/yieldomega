#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""One-shot TimeCurve → TimeArena rename for frontend + skills (GitLab #245)."""

from __future__ import annotations

import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# git mv: old relative to ROOT -> new relative to ROOT
FILE_RENAMES: list[tuple[str, str]] = [
    ("frontend/src/pages/ArenaSimplePage.tsx", "frontend/src/pages/arena/ArenaSimplePage.tsx"),
    ("frontend/src/pages/ArenaProtocolPage.tsx", "frontend/src/pages/arena/ArenaProtocolPage.tsx"),
    ("frontend/src/components/ArenaBuySpendRangeInput.tsx", "frontend/src/components/ArenaBuySpendRangeInput.tsx"),
    (
        "frontend/src/components/ArenaDoubUnlimitedApprovalFieldset.tsx",
        "frontend/src/components/ArenaDoubUnlimitedApprovalFieldset.tsx",
    ),
    ("frontend/src/lib/timeArenaMath.ts", "frontend/src/lib/timeArenaMath.ts"),
    ("frontend/src/lib/timeArenaMath.test.ts", "frontend/src/lib/timeArenaMath.test.ts"),
    ("frontend/src/lib/timeArenaBuyHubFormat.ts", "frontend/src/lib/timeArenaBuyHubFormat.ts"),
    ("frontend/src/lib/timeArenaBuyHubFormat.test.ts", "frontend/src/lib/timeArenaBuyHubFormat.test.ts"),
    ("frontend/src/lib/timeArenaBuyPreview.ts", "frontend/src/lib/timeArenaBuyPreview.ts"),
    ("frontend/src/lib/timeArenaBuyPreview.test.ts", "frontend/src/lib/timeArenaBuyPreview.test.ts"),
    ("frontend/src/lib/timeArenaBuyReceipt.ts", "frontend/src/lib/timeArenaBuyReceipt.ts"),
    ("frontend/src/lib/timeArenaBuySubmitSizing.ts", "frontend/src/lib/timeArenaBuySubmitSizing.ts"),
    ("frontend/src/lib/timeArenaKumbayaSingleTx.ts", "frontend/src/lib/timeArenaKumbayaSingleTx.ts"),
    ("frontend/src/lib/timeArenaPodiumMath.ts", "frontend/src/lib/timeArenaPodiumMath.ts"),
    ("frontend/src/lib/timeArenaUx.ts", "frontend/src/lib/timeArenaUx.ts"),
    ("frontend/src/lib/timeArenaWarbowSnapshotClaim.ts", "frontend/src/lib/timeArenaWarbowSnapshotClaim.ts"),
    (
        "frontend/src/lib/timeArenaResponsiveLayoutCss.test.ts",
        "frontend/src/lib/timeArenaResponsiveLayoutCss.test.ts",
    ),
    ("frontend/src/lib/arenaDoubApprovalPreference.ts", "frontend/src/lib/arenaDoubApprovalPreference.ts"),
    (
        "frontend/src/lib/arenaDoubApprovalPreference.test.ts",
        "frontend/src/lib/arenaDoubApprovalPreference.test.ts",
    ),
    ("frontend/src/lib/ensureCl8yKumbayaAllowance.ts", "frontend/src/lib/ensureCl8yKumbayaAllowance.ts"),
    (
        "frontend/src/lib/ensureCl8yKumbayaAllowance.test.ts",
        "frontend/src/lib/ensureCl8yKumbayaAllowance.test.ts",
    ),
    ("frontend/e2e/arena.spec.ts", "frontend/e2e/arena.spec.ts"),
    ("frontend/e2e/arena-live-buys-modals.spec.ts", "frontend/e2e/arena-live-buys-modals.spec.ts"),
    ("frontend/playwright.arena-ui.config.ts", "frontend/playwright.arena-ui.config.ts"),
    ("skills/script-with-timearena-local", "skills/script-with-timearena-local"),
]

TIMECURVE_DIR_RENAMES: list[tuple[str, str]] = [
    ("ArenaBuyProjectedEffects.tsx", "ArenaBuyProjectedEffects.tsx"),
    ("ArenaLiveBuysActivitySection.tsx", "ArenaLiveBuysActivitySection.tsx"),
    ("ArenaLiveCharts.tsx", "ArenaLiveCharts.tsx"),
    ("ArenaProtocolDataContext.tsx", "ArenaProtocolDataContext.tsx"),
    ("ArenaProtocolDonatePoolsSection.test.tsx", "ArenaProtocolDonatePoolsSection.test.tsx"),
    ("ArenaProtocolDonatePoolsSection.tsx", "ArenaProtocolDonatePoolsSection.tsx"),
    ("ArenaProtocolDoubProjectionSection.tsx", "ArenaProtocolDoubProjectionSection.tsx"),
    ("ArenaSections.tsx", "ArenaSections.tsx"),
    ("ArenaSimpleAgentCard.tsx", "ArenaSimpleAgentCard.tsx"),
    ("ArenaSimplePodiumSection.test.tsx", "ArenaSimplePodiumSection.test.tsx"),
    ("ArenaSimplePodiumSection.tsx", "ArenaSimplePodiumSection.tsx"),
    ("ArenaSubnav.test.tsx", "ArenaSubnav.test.tsx"),
    ("ArenaSubnav.tsx", "ArenaSubnav.tsx"),
    ("ArenaTimerHero.tsx", "ArenaTimerHero.tsx"),
    ("ArenaBuyModals.tsx", "ArenaBuyModals.tsx"),
    ("arenaUi.tsx", "arenaUi.tsx"),
    ("arenaBuyProjectedEffects.test.ts", "arenaBuyProjectedEffects.test.ts"),
    ("arenaBuyProjectedEffects.ts", "arenaBuyProjectedEffects.ts"),
    ("arenaSaleWindow.test.ts", "arenaSaleWindow.test.ts"),
    ("arenaSaleWindow.ts", "arenaSaleWindow.ts"),
    ("arenaSimplePhase.test.ts", "arenaSimplePhase.test.ts"),
    ("arenaSimplePhase.ts", "arenaSimplePhase.ts"),
    ("arenaSimplePodiumScore.test.ts", "arenaSimplePodiumScore.test.ts"),
    ("arenaSimplePodiumScore.ts", "arenaSimplePodiumScore.ts"),
    ("useArenaSaleSession.ts", "useArenaSaleSession.ts"),
    ("useArenaSimplePageSfx.ts", "useArenaSimplePageSfx.ts"),
    ("useArenaHeroTimer.ts", "useArenaHeroTimer.ts"),
    ("useArenaProtocolDonatePools.ts", "useArenaProtocolDonatePools.ts"),
    ("useArenaProtocolLiveBuys.ts", "useArenaProtocolLiveBuys.ts"),
    ("useArenaProtocolRawAccordion.ts", "useArenaProtocolRawAccordion.ts"),
    ("useArenaSaleState.test.ts", "useArenaSaleState.test.ts"),
    ("useArenaSaleState.ts", "useArenaSaleState.ts"),
]

TEXT_REPLACEMENTS: list[tuple[str, str]] = [
    ("@/pages/arena/", "@/pages/arena/"),
    ("@/pages/arena/ArenaSimplePage", "@/pages/arena/ArenaSimplePage"),
    ("@/pages/arena/ArenaProtocolPage", "@/pages/arena/ArenaProtocolPage"),
    ("ArenaProtocolDataProvider", "ArenaProtocolDataProvider"),
    ("ArenaProtocolDataContext", "ArenaProtocolDataContext"),
    ("ArenaSimplePage", "ArenaSimplePage"),
    ("ArenaProtocolPage", "ArenaProtocolPage"),
    ("ArenaBuyProjectedEffects", "ArenaBuyProjectedEffects"),
    ("ArenaLiveBuysActivitySection", "ArenaLiveBuysActivitySection"),
    ("ArenaLiveCharts", "ArenaLiveCharts"),
    ("ArenaProtocolDonatePoolsSection", "ArenaProtocolDonatePoolsSection"),
    ("ArenaProtocolDoubProjectionSection", "ArenaProtocolDoubProjectionSection"),
    ("ArenaSections", "ArenaSections"),
    ("ArenaSimpleAgentCard", "ArenaSimpleAgentCard"),
    ("ArenaSimplePodiumSection", "ArenaSimplePodiumSection"),
    ("ArenaSubnav", "ArenaSubnav"),
    ("ArenaTimerHero", "ArenaTimerHero"),
    ("ArenaBuyModals", "ArenaBuyModals"),
    ("ArenaBuySpendRangeInput", "ArenaBuySpendRangeInput"),
    ("ArenaDoubUnlimitedApprovalFieldset", "ArenaDoubUnlimitedApprovalFieldset"),
    ("useArenaSaleSession", "useArenaSaleSession"),
    ("useArenaSimplePageSfx", "useArenaSimplePageSfx"),
    ("useArenaHeroTimer", "useArenaHeroTimer"),
    ("useArenaProtocolDonatePools", "useArenaProtocolDonatePools"),
    ("useArenaProtocolLiveBuys", "useArenaProtocolLiveBuys"),
    ("useArenaProtocolRawAccordion", "useArenaProtocolRawAccordion"),
    ("useArenaSaleState", "useArenaSaleState"),
    ("buildArenaBuyProjectedEffectLines", "buildArenaBuyProjectedEffectLines"),
    ("arenaBuyProjectedEffects", "arenaBuyProjectedEffects"),
    ("arenaSimplePhase", "arenaSimplePhase"),
    ("arenaSaleWindow", "arenaSaleWindow"),
    ("arenaSimplePodiumScore", "arenaSimplePodiumScore"),
    ("arenaUi", "arenaUi"),
    ("timeArenaMath", "timeArenaMath"),
    ("timeArenaBuyHubFormat", "timeArenaBuyHubFormat"),
    ("timeArenaBuyPreview", "timeArenaBuyPreview"),
    ("timeArenaBuyReceipt", "timeArenaBuyReceipt"),
    ("timeArenaBuySubmitSizing", "timeArenaBuySubmitSizing"),
    ("timeArenaKumbayaSingleTx", "timeArenaKumbayaSingleTx"),
    ("timeArenaPodiumMath", "timeArenaPodiumMath"),
    ("timeArenaUx", "timeArenaUx"),
    ("timeArenaWarbowSnapshotClaim", "timeArenaWarbowSnapshotClaim"),
    ("timeArenaResponsiveLayoutCss", "timeArenaResponsiveLayoutCss"),
    ("arenaDoubApprovalPreference", "arenaDoubApprovalPreference"),
    ("arenaDoubApprovalAmountWei", "arenaDoubApprovalAmountWei"),
    ("readArenaDoubUnlimitedApproval", "readArenaDoubUnlimitedApproval"),
    ("planCl8yKumbayaApprove", "planCl8yKumbayaApprove"),
    ("ensureCl8yKumbayaAllowance", "ensureCl8yKumbayaAllowance"),
    ("Cl8yKumbayaApprovePlan", "Cl8yKumbayaApprovePlan"),
    ("fetchArenaBuys", "fetchArenaBuys"),
    ("script-with-timearena-local", "script-with-timearena-local"),
    ("playwright.arena-ui.config.ts", "playwright.arena-ui.config.ts"),
    ("arena.spec.ts", "arena.spec.ts"),
    ("arena-live-buys-modals.spec.ts", "arena-live-buys-modals.spec.ts"),
    ("app-shell--arena", "app-shell--arena"),
    ("app-main--arena", "app-main--arena"),
    ("isArenaPlayRoute", "isArenaPlayRoute"),
    ("arena-simple", "arena-simple"),
    ("arena-protocol", "arena-protocol"),
    ("arena-simple-agent-card", "arena-simple-agent-card"),
    ('data-testid="arena-', 'data-testid="arena-'),
    ('to="/arena"', 'to="/arena"'),
    ('"/arena"', '"/arena"'),
    ("'/arena'", "'/arena'"),
    ("/arena/", "/arena/"),
    ("HEADER_ICONS.arena", "HEADER_ICONS.arena"),
    ('aria-label="Time Arena"', 'aria-label="Time Arena"'),
    ('title="Time Arena"', 'title="Time Arena"'),
    ("Primary nav currently exposes Time Arena", "Primary nav currently exposes Time Arena"),
    ('name: "TimeCurve"', 'name: "Time Arena"'),
    ("LegacyArenaSegmentRedirect", "LegacyArenaSegmentRedirect"),
    ("arenaLegacySegment", "arenaLegacySegment"),
]

SCAN_DIRS = [
    ROOT / "frontend",
    ROOT / "skills",
    ROOT / "docs/frontend",
    ROOT / "docs/testing",
    ROOT / ".cursor/skills",
    ROOT / "bots/timearena",
    ROOT / "scripts",
    ROOT / "README.md",
]


def git_mv(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if not src.exists():
        if dst.exists():
            return
        raise FileNotFoundError(src)
    subprocess.run(["git", "mv", str(src), str(dst)], cwd=ROOT, check=True)


def apply_renames() -> None:
    tc_dir = ROOT / "frontend/src/pages/timecurve"
    arena_dir = ROOT / "frontend/src/pages/arena"
    arena_dir.mkdir(parents=True, exist_ok=True)

    if tc_dir.is_dir():
        for name in sorted(tc_dir.iterdir()):
            if name.name in dict(TIMECURVE_DIR_RENAMES):
                new_name = dict(TIMECURVE_DIR_RENAMES)[name.name]
            else:
                new_name = name.name
            git_mv(name, arena_dir / new_name)
        tc_dir.rmdir()

    for old, new in FILE_RENAMES:
        git_mv(ROOT / old, ROOT / new)


def replace_in_file(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    orig = text
    for old, new in TEXT_REPLACEMENTS:
        text = text.replace(old, new)
    if text != orig:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def walk_and_replace() -> int:
    changed = 0
    for base in SCAN_DIRS:
        if base.is_file():
            if replace_in_file(base):
                changed += 1
            continue
        if not base.is_dir():
            continue
        for path in base.rglob("*"):
            if not path.is_file():
                continue
            if path.suffix in {".png", ".jpg", ".webp", ".woff", ".woff2", ".ico"}:
                continue
            if "node_modules" in path.parts or ".venv" in path.parts:
                continue
            if replace_in_file(path):
                changed += 1
    return changed


def main() -> None:
    os.chdir(ROOT)
    apply_renames()
    n = walk_and_replace()
    print(f"Updated {n} files with text replacements")


if __name__ == "__main__":
    main()
