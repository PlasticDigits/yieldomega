---
name: contributor-mobile-album-dock
description: Contributor guardrail for GitLab #103 — mobile INV-AUDIO-103 clearance between the fixed AlbumPlayerBar dock and RootLayout nav chrome. Use when editing frontend layout/audio chrome so `.app-header` mobile margin stays synced with `mobileAlbumDockLayout.ts`.
---

# Contributor — mobile album dock vs nav (GitLab #103)

**Audience:** Agents editing **`frontend/`** layout or audio chrome (not play-skills participants). **Checklist anchor:** use **[manual QA #103](../../docs/testing/manual-qa-checklists.md#manual-qa-issue-103)** for verification; this file is implementation detail only ([GitLab #100](https://gitlab.com/PlasticDigits/yieldomega/-/issues/100) — see [Agents: metadata and skills](../../docs/agents/metadata-and-skills.md#contributor-manual-qa-not-play-skills)).

## Invariant — `INV-AUDIO-103`

The **`AlbumPlayerBar`** wrapper uses **`position: fixed`** (`.album-player-dock`, `z-index: 1050`). On **`max-width: 720px`**, the bordered **`RootLayout`** **`.app-header`** must sit **below** the dock bubble so there is **no visual overlap**.

## Implementation (single source of truth)

| Layer | Location |
|-------|-----------|
| CSS | `frontend/src/index.css` — `@media (max-width: 720px)` **`.app-header`** `margin-top`: `max(0.75rem, calc(env(safe-area-inset-top, 0px) + 4.5rem))` |
| Numeric token | `frontend/src/audio/mobileAlbumDockLayout.ts` — **`MOBILE_HEADER_TOP_CLEARANCE_BELOW_SAFE_AREA_REM`** (**must** equal **`4.5`** and match the **`+ 4.5rem`** term in CSS) |
| Regression test | `frontend/src/audio/mobileAlbumDockLayout.test.ts` |

Do **not** raise **`AlbumPlayerBar`** above dialogs (`z-index` stays below modal overlays). Do **not** change **`min-width: 721px`** header **`margin-top`** rhythm when tuning mobile clearance.

## Doc map

- [Invariants — mobile dock §103](../../docs/testing/invariants-and-business-logic.md#mobile-album-dock-layout-issue-103)
- [Manual QA — #103](../../docs/testing/manual-qa-checklists.md#manual-qa-issue-103)
- [Sound effects §8 — bullet](../../docs/frontend/sound-effects-recommendations.md#8-in-app-implementation-album-1--sfx-bus-issue-68)
- [TimeCurve views — Simple audio](../../docs/frontend/timecurve-views.md#timecurve-simple-audio-issue-68)
- Maintainer guardrails: [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../../.cursor/skills/yieldomega-guardrails/SKILL.md)

## GitLab

[Work item #103 — Mobile music UI overlaps top menu card](https://gitlab.com/PlasticDigits/yieldomega/-/work_items/103)
