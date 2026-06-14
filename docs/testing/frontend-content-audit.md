# Frontend page-by-page content audit (cyberminimalist redesign)

Canonical **product mechanics** live in [`time-arena.md`](../product/time-arena.md) and [`arena-v2.md`](../product/arena-v2.md). This checklist audits **visible UI copy, layout IA, and branding** against those rules after the cyberminimalist PvP command-console redesign ([#290](https://gitlab.com/PlasticDigits/yieldomega/-/issues/290)–[#296](https://gitlab.com/PlasticDigits/yieldomega/-/issues/296)). Consolidated verification gate: GitLab [#298](https://gitlab.com/PlasticDigits/yieldomega/-/issues/298) · **`INV-FRONTEND-298-UX-DOCS-E2E`**.

**Branding:** user-facing strings use **Yield Omega** (with space), not `YieldOmega` or `yieldomega` in product copy.

**Forbidden framing (all routes):** `TimeCurve`, sale-end, redemption, launchpad, PvE, worldbuilding, legacy fee-sink / Rabbit Treasury cross-sell.

**Layout docs:** [arena-views.md](../frontend/arena-views.md) · [design.md](../frontend/design.md#cyberminimalist-glass-app-shell-gitlab-290)

**Automated smoke:** `cd frontend && npm run typecheck && npm run lint && npm test` · `bash scripts/check-arena-naming.sh` · Playwright `--workers=5`: see [manual QA §298](manual-qa-checklists.md#manual-qa-issue-298).

---

## Global shell (`RootLayout`)

| Check | Pass criteria | Canonical source |
|-------|---------------|------------------|
| Brand | Nav/home title reads **Yield Omega**; `title="Yield Omega home"` on brand link | — |
| Primary nav | **Time Arena**, **Referrals**; wallet + network + music chrome | [design §290](../frontend/design.md#cyberminimalist-glass-app-shell-gitlab-290) |
| Glass tokens | Dark tactical surfaces use `--yo-*` semantic tokens | `frontend/src/index.css` |
| Footer agent card | Machine-readable orientation mentions **Yield Omega** + Time Arena / Arena v2 DOUB buys | `AgentFooterCard.tsx` |
| Site links ribbon | X, contact, Agent SKILL.md, CL8Y Bridge on footer-enabled routes | `e2e/footer-site-links.spec.ts` |

---

## `/` and `/home` — Home hub

| Check | Pass criteria | Canonical source |
|-------|---------------|------------------|
| Hero | **Yield Omega** H1; **PLAY TIME ARENA** primary; **AUDIT** verification action | [design §295](../frontend/design.md#cyberminimalist-glass-app-shell-gitlab-290) |
| Tagline | Current PvP mechanics only (CHARM, timers, podiums, WarBow) | `surfaceContent.ts` |
| Cards | Time Arena → `/`; Arena AUDIT → `/arena/protocol`; Referrals; Kumbaya; Sir | `HOME_SURFACE_CARDS` |
| Mechanics chips | BUY CHARM · 4 PODIUMS · WARBOW · AUDIT tooltips match TimeArena | `HOME_HERO_SIGNALS` |
| Forbidden copy | No TimeCurve / sale / PvE / redemption / launchpad / worldbuilding | `surfaceContent.test.ts` |

**E2E:** `e2e/home.spec.ts` · **Manual:** [manual QA §295](manual-qa-checklists.md#manual-qa-issue-295)

---

## Launch countdown (build-time gate)

| Check | Pass criteria | Canonical source |
|-------|---------------|------------------|
| Wordmark | **Yield Omega** H1 | `LaunchCountdownPage.tsx` |
| Headline | **Time Arena opens in** (access gate, not DOUB sale launch) | [design §295](../frontend/design.md#cyberminimalist-glass-app-shell-gitlab-290) |
| Chips | PLAY · CRED · PVP · AUDIT compact signals | `LAUNCH_COUNTDOWN_SIGNALS` |
| Handoff links | `/` play + `/arena/protocol` audit | `LAUNCH_COUNTDOWN_LINKS` (external only; play via countdown CTA) |

**E2E:** `e2e/launch-countdown.spec.ts` · **Manual:** [manual QA §295](manual-qa-checklists.md#manual-qa-issue-295)

---

## `/` — Time Arena play surface

| Check | Pass criteria | Canonical source |
|-------|---------------|------------------|
| Layout | Single **`arena-command-console`** at index **`/`**; no `.arena-final-concept` mock | [arena-views §291](../frontend/arena-views.md#arena-command-console-gitlab-291) |
| Header nav | **AUDIT** → `/arena/protocol` and **Referrals** only (no BUY/AUDIT sub-nav) | `RootLayout.tsx` |
| Last Buy | Largest primary countdown in main column | `ArenaTimerHero.tsx` |
| Inline buy | Text field, slider, min/max, pay picker, **Buy CHARM** without modal-first flow | `ArenaSimplePage.tsx` |
| Buy hub metrics | CHARM price, 0.99–10 CHARM range, and CRED yield surfaced in the buy panel / projected-effects pills (no separate decision-row strip) | `ArenaSimplePage.tsx` · `arenaCommandConsoleStatic.test.ts` |
| Podium UX | **Carousel** + timer chips on play; **no** four-card `arena-simple-podiums` grid | `ArenaTimerPodiumCarousel.tsx`, `e2e/arena.spec.ts` |
| Secondary rail | CHARM/CRED card, secondary timer chips (Time Booster · Defended Streak · WarBow), WarBow PvP panel | [arena-views § unified](../frontend/arena-views.md#unified-arena-page-gitlab-256) |
| Removed chrome | **No** `ArenaSubnav`; **no** `arena-command-console__decision-row` tiles | `arenaCommandConsoleStatic.test.ts` |
| Branding | Visible **Yield Omega** in console chrome; low-opacity bunny/shark accents | `ArenaSimplePage.tsx` |
| Pay modes | DOUB-primary; ETH / USDM / Play CRED when configured | [arena-views pay modes](../frontend/arena-views.md#pay-modes) |
| CSS naming | `arena-*` classes and testids only (no `timecurve-*`) | `bash scripts/check-arena-naming.sh` |
| Forbidden copy | No `\bsale\b` on play console (pre-launch + live); pre-open uses **Arena Opens In** / arena-live framing ([#318](https://gitlab.com/PlasticDigits/yieldomega/-/issues/318)) | `arenaSimplePlaySurface.test.ts`, `arenaSimplePhase.ts` |
| Wallet profile | WarBow steal-target rival rows open **`WalletProfileModal`** via `onOpenWalletProfile` ([#318](https://gitlab.com/PlasticDigits/yieldomega/-/issues/318)) | `ArenaWarbowHeroPanel.tsx`, `arenaSimplePlaySurface.test.ts` |

**E2E:** `e2e/arena.spec.ts`, `e2e/anvil-arena-*.spec.ts` · **Unit:** `ArenaSimplePage.test.tsx`, `ArenaWarbowHeroPanel.test.tsx`, `ArenaCharmCredCard.test.tsx`, `arenaSaleSessionBuyPreflight.test.ts` ([#321](https://gitlab.com/PlasticDigits/yieldomega/-/issues/321)) · **Manual:** [manual QA §291](manual-qa-checklists.md#manual-qa-issue-291), [§292](manual-qa-checklists.md#manual-qa-issue-292)

---

## `/arena/protocol` — AUDIT console

| Check | Pass criteria | Canonical source |
|-------|---------------|------------------|
| Heading | **AUDIT** H1; compact VERIFY / TRACE / WATCH hierarchy | [arena-views §293](../frontend/arena-views.md#arena-audit-protocol-surfaces-gitlab-293) |
| Four-podium grid | **`ArenaSimplePodiumSection`** shows all four podiums with epoch + DOUB prizes + USD equivalent | [arena-views §292](../frontend/arena-views.md#arena-production-components-gitlab-292) |
| Mechanics copy | Always-live when unpaused; flat DOUB CHARM buys; **100%** podium routing (**25%** per track · **70/20/10** epochs; [#300](../product/arena-v2.md#doub-prize-routing-per-buy--300)); 100% donate top-up; WarBow activity | [arena-v2.md](../product/arena-v2.md) |
| Podiums | Four-card **`arena-simple-podiums`** grid; epoch + DOUB prizes + USD equivalent; blockie + last-six addresses | [arena-views §292](../frontend/arena-views.md#arena-production-components-gitlab-292) |
| Activity feed | `GET /v1/arena/activity` buy / steal / guard / revenge with explicit deltas | [arena-views §292](../frontend/arena-views.md#arena-production-components-gitlab-292) |
| Donate pools | Required no-benefit disclosure; `topUpPodiumPools` write gated | [arena-views donate](../frontend/arena-views.md#protocol-donate-pools-gitlab-262) |
| Addresses | Participant rows → wallet profile; contract/vault rows → explorer | [arena-views §294](../frontend/arena-views.md#shared-frontend-primitives-gitlab-294) |
| Forbidden copy | No TimeCurve sale-end / redemption / legacy fee-sink framing | [manual QA §293](manual-qa-checklists.md#manual-qa-issue-293) |

**E2E:** `e2e/arena.spec.ts` · **Manual:** [manual QA §293](manual-qa-checklists.md#manual-qa-issue-293)

---

## `/arena/:code` — referral path capture

| Check | Pass criteria | Canonical source |
|-------|---------------|------------------|
| Route | Valid referral segment loads play surface via `ArenaBranchPage` (not 404) | `LaunchGate.tsx` |
| Capture | Pending key `yieldomega.ref.v1` on `?ref=` or path segment | [referrals.md](../product/referrals.md) |
| Legacy redirect | `/timecurve/:code` → `/arena/:code` | [#266](https://gitlab.com/PlasticDigits/yieldomega/-/issues/266) |

**E2E:** `e2e/referral-path.spec.ts`, `e2e/navigation.spec.ts` · **Manual:** [manual QA §64](manual-qa-checklists.md#manual-qa-issue-64)

---

## `/referrals` — CRED network dashboard

| Check | Pass criteria | Canonical source |
|-------|---------------|------------------|
| Hero | **CRED Network**; **Register. Share. Track CRED.** | [design §296](../frontend/design.md#secondary-product-surfaces-gitlab-296) |
| Mechanics | Flat **5 CRED + 5 CRED** on referred **DOUB** buys; **1 CL8Y** registration burn; one code per wallet | [referrals.md](../product/referrals.md#referral-flat-cred-gitlab-272) |
| Share links | Canonical **`/arena/{code}`** and **`?ref=`**; no **TimeCurve path** label | `ReferralRegisterSection.tsx` |
| Leaderboard | Blockie + last-six `AddressInline`; Guide CRED / Buyer CRED / Total CRED | `e2e/referrals-surface.spec.ts` |
| Forbidden copy | No sale-end / CHARM-referral-boost / legacy BPS framing | [manual QA §296](manual-qa-checklists.md#manual-qa-issue-296) |

**E2E:** `e2e/referrals-surface.spec.ts`, `e2e/anvil-referrals.spec.ts` · **Manual:** [manual QA §296](manual-qa-checklists.md#manual-qa-issue-296)

---

## `/kumbaya` and `/sir` — third-party venues

| Check | Pass criteria | Canonical source |
|-------|---------------|------------------|
| Hero lede | **Third-party venue. Verify off-site.** | `ThirdPartyDexPage.tsx` |
| Badge | **External venue** | `PageHero` |
| Venue snapshot | Read-only framing; external custody boundary | [design §296](../frontend/design.md#secondary-product-surfaces-gitlab-296) |
| Recovery | **Time Arena** + **AUDIT** secondary actions | `ThirdPartyDexPage.tsx` |
| Arena handoff | Canonical **DOUB arena surface** at **`/`** (not launchpad framing) | `ThirdPartyDexPage.tsx` |
| Env hint | When outbound URL unset: `Set VITE_*_DEX_URL at build time…` | `e2e/surface-shells.spec.ts` |

**E2E:** `e2e/surface-shells.spec.ts`, `e2e/navigation.spec.ts` · **Manual:** [manual QA §296](manual-qa-checklists.md#manual-qa-issue-296)

---

## 404 and under-construction fallbacks

| Check | Pass criteria | Canonical source |
|-------|---------------|------------------|
| 404 | `data-testid="not-found-page"`; **404** H1; **No surface at this route.** | `NotFoundPage.tsx` |
| Recovery | Immediate **Time Arena** + **AUDIT** links inside `RootLayout` | `e2e/navigation.spec.ts` |
| Brand | Document title includes **Yield Omega** | `NotFoundPage.tsx` |
| Under construction | Compact dark glass; same recovery actions | `UnderConstruction.tsx` |

**E2E:** `e2e/navigation.spec.ts` · **Manual:** [manual QA §296](manual-qa-checklists.md#manual-qa-issue-296)

---

## Legacy route redirects

| Route | Expected |
|-------|----------|
| `/arena` | → `/` |
| `/timecurve` | → `/` |
| `/timecurve/arena` | → `/` |
| `/timecurve/protocol` | → `/arena/protocol` |
| `/timecurve/:segment` | → `/arena/:segment` |

**E2E:** `e2e/arena.spec.ts`, `e2e/navigation.spec.ts`, `e2e/referral-path.spec.ts`

---

## Shared primitives (cross-route)

| Check | Pass criteria | Doc |
|-------|---------------|-----|
| Modals | Dark glass; compact headings; explorer links secondary; `WalletProfileModal.test.tsx` covers close label + escaped addresses ([#321](https://gitlab.com/PlasticDigits/yieldomega/-/issues/321)) | [design §294](../frontend/design.md#shared-frontend-primitives-gitlab-294) |
| Wallet profile | Participant `AddressInline` → `WalletProfileModal` | [arena-views §258](../frontend/arena-views.md#wallet-profile-modal-gitlab-258) |
| Chain gate | `ChainMismatchWriteBarrier` blocks writes; switch-chain reachable | [wallet-connection §95](../frontend/wallet-connection.md#wrong-network-write-gating-issue-95) |
| Amounts | Human-readable only; no raw wei/WAD in product UI | [design amount display](../frontend/design.md#amount-display-amountdisplay) |

**Manual:** [manual QA §294](manual-qa-checklists.md#manual-qa-issue-294)

---

## Play skills (3rd-party agents)

Participant agents should read product rules in [`skills/play-active-time-arena/SKILL.md`](../../skills/play-active-time-arena/SKILL.md) and [`skills/play-time-arena-doub/SKILL.md`](../../skills/play-time-arena-doub/SKILL.md) — UI copy must not contradict those playbooks. Index: [`skills/README.md`](../../skills/README.md).
