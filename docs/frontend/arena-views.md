# Arena frontend (`/` play · `/arena/protocol` AUDIT)

Primary participant surface: [`TimeArenaPage.tsx`](../../frontend/src/pages/TimeArenaPage.tsx) at route **`/`** (index — [#256](https://gitlab.com/PlasticDigits/yieldomega/-/issues/256), [#291](https://gitlab.com/PlasticDigits/yieldomega/-/issues/291), [#320](https://gitlab.com/PlasticDigits/yieldomega/-/issues/320)). AUDIT console: [`ArenaProtocolPage.tsx`](../../frontend/src/pages/arena/ArenaProtocolPage.tsx) at **`/arena/protocol`**. Legacy **`/arena`** (no segment) and **`/timecurve`** redirect to **`/`**; **`/timecurve/protocol`** → **`/arena/protocol`** ([#266](https://gitlab.com/PlasticDigits/yieldomega/-/issues/266)). Routes: [`LaunchGate.tsx`](../../frontend/src/app/LaunchGate.tsx). Arena DOM/CSS and public art paths use **`arena-*`** naming ([#280](https://gitlab.com/PlasticDigits/yieldomega/-/issues/280)) — **`INV-FRONTEND-280-ARENA-CSS-NAMING`**, `bash scripts/check-arena-naming.sh`.

<a id="arena-css-naming-gitlab-280"></a>

## Arena CSS & public art naming (GitLab [#280](https://gitlab.com/PlasticDigits/yieldomega/-/issues/280))

| Area | Convention | Examples |
|------|------------|----------|
| Simple agent footer | `arena-simple-agent-card` · `data-testid="arena-simple-agent-card"` | [`ArenaSimpleAgentCard.tsx`](../../frontend/src/pages/arena/ArenaSimpleAgentCard.tsx) |
| Protocol AUDIT | `arena-protocol-page`, `arena-protocol-raise-card` | [`ArenaProtocolPage.tsx`](../../frontend/src/pages/arena/ArenaProtocolPage.tsx) · scene `/art/scenes/arena-protocol-command-console.svg` |
| Buy projected effects | `arena-buy-projected-effects*` | [`ArenaBuyProjectedEffects.tsx`](../../frontend/src/pages/arena/ArenaBuyProjectedEffects.tsx) |
| Podium pictograms | `/art/icons/arena-podium-*.png` | [`ArenaSimplePodiumSection.tsx`](../../frontend/src/pages/arena/ArenaSimplePodiumSection.tsx), [`arenaUi.tsx`](../../frontend/src/pages/arena/arenaUi.tsx) |
| Scenes | `arena-simple-command-console.svg`, `arena-arena-command-console.svg`, `arena-protocol-command-console.svg` | [`ArenaTimerHero.tsx`](../../frontend/src/pages/arena/ArenaTimerHero.tsx), `index.css` buy-panel backplate, [`ArenaProtocolPage.tsx`](../../frontend/src/pages/arena/ArenaProtocolPage.tsx) |

**Redirects:** bare **`/arena`** and **`/timecurve`** → **`/`**; **`/timecurve/protocol`** → **`/arena/protocol`**; referral segments **`/arena/:code`** preserved — [`LaunchGate.tsx`](../../frontend/src/app/LaunchGate.tsx). **Do not** rename onchain revert substrings in [`revertMessage.ts`](../../frontend/src/lib/revertMessage.ts).

<a id="unified-arena-page-gitlab-256"></a>

<a id="indexer-first-display-gitlab-301"></a>

## Indexer-first display reads (GitLab [#301](https://gitlab.com/PlasticDigits/yieldomega/-/issues/301))

Production Arena surfaces treat the indexer as the **only** source for recurring **display** head state. Browser JSON-RPC must **not** mirror podiums, podium deadlines, hero timer, or core sale head fields when `VITE_INDEXER_URL` is set — and must **not** silently poll those reads when the URL is unset.

| Data | Source | Browser RPC |
|------|--------|-------------|
| Podium leaders + epochs | `GET /v1/arena/podiums` | **Never** (no `podium` / `podiumEpoch` multicall) |
| Last Buy + secondary podium deadlines | `GET /v1/arena/timers` | **Never** (no `podiumDeadline` / `deadline` poll) |
| Buy hub head (price, bounds, paused, raised, timers) | `GET /v1/arena/timers` (schema ≥ 2.6.0 sale-head fields) | **Never** for display refresh |
| Activity / buys / wallet stats | `GET /v1/arena/*` | **Never** for lists |
| WarBow live refresh | Indexer poll + query invalidation | **Never** (`useWatchContractEvent` disabled) |
| Tx submit (`buy`, `claimCred`, WarBow writes, donate) | Wallet RPC | **Required** |
| Submit-time preflight (allowance, `balanceOf`, `nextBuyAllowedAt`, simulate) | Wallet RPC at click | **Allowed exception** |
| Wagmi transport URL fallbacks | Config only | **Keep** for write reliability ([#221](https://gitlab.com/PlasticDigits/yieldomega/-/issues/221)) |

**Production:** `VITE_INDEXER_URL` is **required** for live Arena data. When unset, [`IndexerStatusBar`](../../frontend/src/components/IndexerStatusBar.tsx) shows a dev/degraded banner and display hooks return empty/stale placeholders — not hidden RPC backfill.

**Indexer outage:** stale cached React Query data + status bar (`INDEXER · offline · retrying`); UI must **not** repopulate via browser RPC.

Hooks: [`usePodiumReads`](../../frontend/src/pages/arena/usePodiumReads.ts), [`useArenaHeroTimer`](../../frontend/src/pages/arena/useArenaHeroTimer.ts), [`ArenaTimerChips`](../../frontend/src/pages/arena/ArenaTimerChips.tsx), [`useArenaSaleSession`](../../frontend/src/pages/arena/useArenaSaleSession.ts) (Arena v2 uses [`coreReadRowsFromArenaTimers`](../../frontend/src/pages/arena/arenaV2SaleSessionBridge.ts)).

Invariant: **`INV-FRONTEND-301-INDEXER-FIRST-DISPLAY`** · static gate `indexerFirstDisplay.test.ts` · [indexer design §301](../indexer/design.md#indexer-first-api-guidelines-gitlab-301) · [e2e-anvil §301](../testing/e2e-anvil.md#indexer-first-vs-minimal-e2e-gitlab-301).

## Unified arena page (GitLab [#256](https://gitlab.com/PlasticDigits/yieldomega/-/issues/256))

| Surface | Component | Notes |
|---------|-----------|--------|
| Last Buy countdown | [`ArenaTimerHero`](../../frontend/src/pages/arena/ArenaTimerHero.tsx) inside [`ArenaSimplePage`](../../frontend/src/pages/arena/ArenaSimplePage.tsx) | Primary timer; indexer `GET /v1/arena/timers` only ([#301](https://gitlab.com/PlasticDigits/yieldomega/-/issues/301)) |
| Podium timer carousel | [`ArenaTimerPodiumCarousel`](../../frontend/src/pages/arena/ArenaTimerPodiumCarousel.tsx) | One podium at a time on play surface; four-podium **grid** only on **`/arena/protocol`** |
| Secondary podium timers | [`ArenaTimerChips`](../../frontend/src/pages/arena/ArenaTimerChips.tsx) | Time Booster · Defended Streak · WarBow — indexer `podium_deadlines_sec` ([#301](https://gitlab.com/PlasticDigits/yieldomega/-/issues/301)) |
| Buy hub | [`ArenaSimplePage`](../../frontend/src/pages/arena/ArenaSimplePage.tsx) buy panel | DOUB-primary toggle (`arena-paywith-cl8y` → **DOUB** label on v2); ETH / USDM / CRED ([#269](https://gitlab.com/PlasticDigits/yieldomega/-/issues/269)); sale head from indexer timers ([#301](https://gitlab.com/PlasticDigits/yieldomega/-/issues/301)) |
| Play timer podiums | [`ArenaTimerPodiumCarousel`](../../frontend/src/pages/arena/ArenaTimerPodiumCarousel.tsx) | Four podium timer slides in the primary column; live head via `GET /v1/arena/podiums` ([#273](https://gitlab.com/PlasticDigits/yieldomega/-/issues/273), [#301](https://gitlab.com/PlasticDigits/yieldomega/-/issues/301)) |
| AUDIT four-podium grid | [`ArenaSimplePodiumSection`](../../frontend/src/pages/arena/ArenaSimplePodiumSection.tsx) on **`/arena/protocol`** | Epoch id + live rankings + DOUB prize preview + USD equiv from **`prize_places_doub_wad`** when indexer schema ≥ 2.8.0 ([#302](https://gitlab.com/PlasticDigits/yieldomega/-/issues/302)) |
| CHARM + Play CRED | [`ArenaCharmCredCard`](../../frontend/src/pages/arena/ArenaCharmCredCard.tsx) | Current Last Buy epoch, epoch CHARM, accruing + claimable CRED; **`claimCred(endedEpoch)`** ([#257](https://gitlab.com/PlasticDigits/yieldomega/-/issues/257)) |
| WarBow PvP | [`ArenaWarbowHeroPanel`](../../frontend/src/pages/arena/ArenaWarbowHeroPanel.tsx) | Steal / guard / revenge with **`WARBOW_*_DOUB`** cost pills ([#252](https://gitlab.com/PlasticDigits/yieldomega/-/issues/252)) |
| AUDIT | [`ArenaProtocolPage`](../../frontend/src/pages/arena/ArenaProtocolPage.tsx) at **`/arena/protocol`** | Operator reads plus the gated donate-pools sponsorship action — no separate “Arena advanced” route |

Global shell/design direction: [frontend design §290](./design.md#cyberminimalist-glass-app-shell-gitlab-290). Header nav: brand **`/`** · **AUDIT** (`/arena/protocol`) · **Referrals** — no in-page `ArenaSubnav` BUY/AUDIT row on the play surface ([#320](https://gitlab.com/PlasticDigits/yieldomega/-/issues/320)). Mechanics live in tooltips, timer carousel, and action-adjacent feedback rather than default explanatory paragraphs.

<a id="arena-command-console-gitlab-291"></a>

### Production command console (GitLab [#291](https://gitlab.com/PlasticDigits/yieldomega/-/issues/291))

**`/`** (play) renders a single production **`arena-command-console`** surface. `TimeArenaPage` must not mount the old static [`ArenaThemeConcepts`](../../frontend/src/pages/arena/ArenaThemeConcepts.tsx) mock above the live Arena stack.

Layout priorities:

- **Last Buy primary:** `ArenaTimerHero` sits in the primary console column with the largest timer treatment.
- **Podium carousel:** `ArenaTimerPodiumCarousel` cycles one podium timer/scoring view at a time on the play surface (four-card grid lives on **`/arena/protocol`** only).
- **Inline CHARM buy:** the buy panel remains visible in the primary column with text entry, slider, min/max controls, pay picker, and direct **Buy CHARM** CTA; no modal-first buy flow.
- **Post-buy effect toasts:** after a successful buy on **`/`**, [`ArenaEffectToastStack`](../../frontend/src/pages/arena/ArenaEffectToastStack.tsx) overlays one glass toast per effect line (timer, XP, level, WarBow, flag, Last Buyer); copy reuses [`buildArenaBuyProjectedEffectLines`](../../frontend/src/pages/arena/arenaBuyProjectedEffects.ts) / [`buildArenaBuyActualEffectLines`](../../frontend/src/pages/arena/arenaBuyProjectedEffects.ts) ([#337](https://gitlab.com/PlasticDigits/yieldomega/-/issues/337)).
- **Buy hub metrics:** CHARM price (DOUB), **0.99–10 CHARM** range, and DOUB-buy **CRED yield** appear in the buy panel and projected-effects pills — **no** separate `arena-command-console__decision-row` strip or in-page **`ArenaSubnav`** ([#320](https://gitlab.com/PlasticDigits/yieldomega/-/issues/320); see `arenaCommandConsoleStatic.test.ts`).
- **Secondary operations:** `ArenaCharmCredCard`, `ArenaTimerChips` (Time Booster · Defended Streak · WarBow), and `ArenaWarbowHeroPanel` sit in the secondary operations rail.
- **Removed chrome (do not document as shipped):** `ArenaSubnav`, `arena-command-console__decision-row` tiles ([#320](https://gitlab.com/PlasticDigits/yieldomega/-/issues/320)).
- **Characters and art:** existing bunny + sniper-shark assets remain recognizable but render as low-opacity cyberminimalist console accents; consumed Arena scene backplates use the dark command-console SVGs from #297, not the older bright arcade JPG pack.

Invariant: **`INV-FRONTEND-291-ARENA-COMMAND-CONSOLE`** in [invariants §291](../testing/invariants-and-business-logic.md#frontend-arena-command-console-gitlab-291) · **`INV-FRONTEND-297-ART-MOTION-AUDIO`** in [invariants §297](../testing/invariants-and-business-logic.md#frontend-art-motion-audio-gitlab-297) · **`INV-FRONTEND-337-BUY-EFFECT-TOASTS`** in [invariants §337](../testing/invariants-and-business-logic.md#frontend-post-buy-effect-toasts-gitlab-337). QA: [manual checklist §291](../testing/manual-qa-checklists.md#manual-qa-issue-291) · [manual checklist §297](../testing/manual-qa-checklists.md#manual-qa-issue-297) · [manual checklist §337](../testing/manual-qa-checklists.md#manual-qa-issue-337).

<a id="post-buy-effect-toasts-gitlab-337"></a>

### Post-buy effect toasts (GitLab [#337](https://gitlab.com/PlasticDigits/yieldomega/-/issues/337))

After a successful CHARM buy on the play route, the UI shows a compact glass toast stack (`data-testid="arena-buy-effect-toast"`) anchored inside **`arena-command-console`** — no layout shift on the timer or buy panel.

| Concern | Behavior |
|---------|----------|
| Copy source | Indexer buy row via **`buildArenaBuyActualEffectLines`** when the viewer’s buy is indexed head; otherwise latched checkout preview via **`buildArenaBuyProjectedEffectLines`** |
| Stack cap | 4 visible toasts; oldest dropped on overflow |
| Dismiss | Auto (~4s), independent per toast; **`prefers-reduced-motion`** skips enter animation |
| SFX | Optional subdued **`charmed_confirm`** on first toast only (sparse policy [#297](https://gitlab.com/PlasticDigits/yieldomega/-/issues/297)) |
| Scope | **`/`** play route only (`ArenaSimplePage`); AUDIT optional/out-of-scope |

Components: [`ArenaEffectToastStack.tsx`](../../frontend/src/pages/arena/ArenaEffectToastStack.tsx) · [`useArenaBuyEffectToasts.ts`](../../frontend/src/pages/arena/useArenaBuyEffectToasts.ts) · CSS in [`yieldomega-glass-arena.css`](../../frontend/src/styles/yieldomega-glass-arena.css).

Invariants: **`INV-FRONTEND-256-UNIFIED-ARENA`** · **`INV-FRONTEND-291-ARENA-COMMAND-CONSOLE`** · **`INV-FRONTEND-297-ART-MOTION-AUDIO`** · **`INV-FRONTEND-337-BUY-EFFECT-TOASTS`** · play skills [`skills/play-active-time-arena`](../../skills/play-active-time-arena/SKILL.md), [`skills/play-time-arena-warbow`](../../skills/play-time-arena-warbow/SKILL.md), [`skills/play-time-arena-doub`](../../skills/play-time-arena-doub/SKILL.md).

<a id="arena-production-components-gitlab-292"></a>

### Production component mechanics (GitLab [#292](https://gitlab.com/PlasticDigits/yieldomega/-/issues/292))

The live production components must stay mechanics-first, not reskins of retired sale/leaderboard copy:

- Podium cards on **`/arena/protocol`** (`ArenaSimplePodiumSection`) show all four independent podiums, each current epoch, and 1st/2nd/3rd prize rows in **DOUB** with USD equivalent (indexer **`prize_places_doub_wad`** at head block — preview only, not guaranteed payout ([#302](https://gitlab.com/PlasticDigits/yieldomega/-/issues/302))). Play **`/`** uses **`ArenaTimerPodiumCarousel`** for timer-linked podium slides instead of the four-card grid.
- Participant addresses use [`AddressInline`](../../frontend/src/components/AddressInline.tsx): blockie + last six hex digits by default; profile modal remains the primary in-app action.
- `/arena/protocol` activity uses **`GET /v1/arena/activity`** for recent **buy / steal / guard / revenge** actions and explicit deltas (DOUB, BP, seconds, guard expiry). Older indexers fall back to `GET /v1/arena/buys`.
- [`ArenaCharmCredCard`](../../frontend/src/pages/arena/ArenaCharmCredCard.tsx) presents epoch CHARM/CRED yield state only; it is not a leaderboard.
- [`ArenaWarbowHeroPanel`](../../frontend/src/pages/arena/ArenaWarbowHeroPanel.tsx) groups **Steal**, **Guard**, **Revenge**, and **Flag** as one PvP action cluster.

Invariant: **`INV-FRONTEND-292-ARENA-PRODUCTION-COMPONENTS`** in [invariants](../testing/invariants-and-business-logic.md#frontend-arena-production-components-gitlab-292). Manual QA: [manual checklist §292](../testing/manual-qa-checklists.md#manual-qa-issue-292).

<a id="arena-audit-protocol-surfaces-gitlab-293"></a>

### AUDIT protocol surfaces (GitLab [#293](https://gitlab.com/PlasticDigits/yieldomega/-/issues/293))

`/arena/protocol` is the production **AUDIT** console for operators and third-party verifiers:

- Primary decisions are **VERIFY** state, **TRACE** vault routing, and **WATCH** indexed activity.
- Visible copy stays compact; mechanics live in `title` / `aria-label` tooltips, state cards, and action-adjacent status.
- Copy must reflect Arena v2: always-live when unpaused, flat DOUB CHARM buys, **100%** DOUB buy routing to four podium tracks (**25%** per category · **70/20/10** epoch tranches; [#300](https://gitlab.com/PlasticDigits/yieldomega/-/issues/300)), 100%-to-prizes donate top-up, and WarBow action activity. Do not reintroduce TimeCurve sale-end, redemption, or legacy fee-sink framing.
- Participant rows use [`AddressInline`](../../frontend/src/components/AddressInline.tsx) to open [`WalletProfileModal`](../../frontend/src/components/WalletProfileModal.tsx). Contract/vault rows use the same blockie + last-six address treatment and keep explorer links.
- Donate pools remains a sponsorship action with the required no-benefit disclosure and `ChainMismatchWriteBarrier`; the write path still calls `topUpPodiumPools`.

Invariant: **`INV-FRONTEND-293-ARENA-AUDIT-SURFACES`** in [invariants](../testing/invariants-and-business-logic.md#frontend-arena-audit-surfaces-gitlab-293). Manual QA: [manual checklist §293](../testing/manual-qa-checklists.md#manual-qa-issue-293). Product rules: [Arena v2](../product/arena-v2.md#manual-podium-pool-top-up-gitlab-261) · play guidance: [`play-time-arena-doub`](../../skills/play-time-arena-doub/SKILL.md#donate-to-pools-optional-sponsorship).

<a id="shared-frontend-primitives-gitlab-294"></a>

### Shared UX primitives (GitLab [#294](https://gitlab.com/PlasticDigits/yieldomega/-/issues/294))

The shared primitives used by **`/`** (play), **`/arena/protocol`**, and **`/referrals`**
must look native to the cyberminimalist glass system while preserving current
behavior:

- Modals: `WalletProfileModal`, `FeatureMechanicModal`, `WhileYouWereAwayModal`, and other `Modal` users
  share dark tactical surfaces, compact headings, and secondary explorer links.
  Live activity on `/arena/protocol` uses the inline `arena-live-buys-activity`
  feed (not the legacy hero-strip `ArenaBuyModals` list/detail stack retired in
  #291).
- Address rows: use `AddressInline` blockie + last-six hex labels. Participant
  rows open wallet profiles where wired; contract/vault rows go to the explorer.
- Chain gates: `ChainMismatchWriteBarrier` stays visually dominant over write
  panels and keeps the `switch-to-target-chain` action reachable.
- Status/empty/amount/indexer primitives: show concise state, no raw wei/WAD
  values, no fake zeros when the indexer is unset/offline, and no stale
  TimeCurve/sale-end framing.

Invariant: **`INV-FRONTEND-294-SHARED-PRIMITIVES`** in [invariants](../testing/invariants-and-business-logic.md#frontend-shared-primitives-gitlab-294). Manual QA: [manual checklist §294](../testing/manual-qa-checklists.md#manual-qa-issue-294). Design source: [frontend design §294](./design.md#shared-frontend-primitives-gitlab-294). Wallet gate source: [wallet connection §95](./wallet-connection.md#wrong-network-write-gating-issue-95).

<a id="charm-cred-card-gitlab-257"></a>

## CHARM & Play CRED card (GitLab [#257](https://gitlab.com/PlasticDigits/yieldomega/-/issues/257))

Component: [`ArenaCharmCredCard.tsx`](../../frontend/src/pages/arena/ArenaCharmCredCard.tsx) · **`data-testid="arena-charm-cred-card"`**.

| Read / write | Onchain | UI |
|--------------|---------|-----|
| Last Buy epoch | `lastBuyEpoch()` | Current epoch id |
| Epoch CHARM | `epochCharmWad[lastBuyEpoch, wallet]` | Accruing weight this epoch |
| Pending CRED (active) | `pendingCred(wallet, lastBuyEpoch)` | Pro-rata preview while epoch is live |
| Claimable CRED | `pendingCred(wallet, lastBuyEpoch - 1)` when `lastBuyEpoch > 0` | Shown after hard reset; **Claim CRED** enabled when &gt; 0 |
| Claim | `claimCred(endedEpoch)` | **`data-testid="arena-charm-cred-claim"`**; requires `endedEpoch < lastBuyEpoch` ([#248](https://gitlab.com/PlasticDigits/yieldomega/-/issues/248)) |

Claim helper: [`arenaCharmCredClaim.ts`](../../frontend/src/lib/arenaCharmCredClaim.ts). Empty / loading copy uses **`EmptyDataPlaceholder`** ([#200](https://gitlab.com/PlasticDigits/yieldomega/-/issues/200)). Invariant: **`INV-FRONTEND-257-CHARM-CRED-CARD`**. Play skill: [play-time-arena-doub § CRED claim](../../skills/play-time-arena-doub/SKILL.md).

<a id="arena-player-progression-gitlab-299"></a>

## Arena player progression (GitLab [#299](https://gitlab.com/PlasticDigits/yieldomega/-/issues/299))

| Surface | Component / module | Notes |
|---------|-------------------|--------|
| XP hero | [`ArenaXpHero.tsx`](../../frontend/src/components/ArenaXpHero.tsx) · **`data-testid="arena-xp-hero"`** | On play **`/`** timer panel; reads `level` + `xpTowardNext` |
| Lock overlays | [`ArenaLevelGate.tsx`](../../frontend/src/components/ArenaLevelGate.tsx) | `Locked until Level N` + lock icon on Time Booster / Streak / WarBow sections |
| Mechanic modal | [`FeatureMechanicModal.tsx`](../../frontend/src/components/FeatureMechanicModal.tsx) | Explicit `?` help; long-form copy from [`podiumCopy.tsx`](../../frontend/src/pages/arena/podiumCopy.tsx) |
| Level-up celebration | [`LevelUpCelebrationPopover.tsx`](../../frontend/src/components/LevelUpCelebrationPopover.tsx) · **`data-testid="level-up-celebration"`** | Auto-trigger on **L2+** first unlock; glass popover + subtle confetti; tutorial seen in `localStorage` via [`arenaProgression.ts`](../../frontend/src/lib/arenaProgression.ts) ([#335](https://gitlab.com/PlasticDigits/yieldomega/-/issues/335)) |
| Buy preview | [`arenaBuyProjectedEffects.ts`](../../frontend/src/pages/arena/arenaBuyProjectedEffects.ts) | Filters streak/BP/flag chips by onchain `level` |

Invariants: **`INV-ARENA-PROGRESSION-*`** · **`INV-FRONTEND-335-LEVEL-UP-CELEBRATION`** in [invariants §299](../testing/invariants-and-business-logic.md#arena-player-progression-gitlab-299) · [invariants §335](../testing/invariants-and-business-logic.md#frontend-level-up-celebration-gitlab-335). Product: [arena-v2 § XP](../product/arena-v2.md#xp).

<a id="level-up-celebration-gitlab-335"></a>

## Level-up celebration popover (GitLab [#335](https://gitlab.com/PlasticDigits/yieldomega/-/issues/335))

When a connected wallet crosses **Level 2+** on play **`/`**, [`ArenaSimplePage.tsx`](../../frontend/src/pages/arena/ArenaSimplePage.tsx) mounts [`LevelUpCelebrationPopover`](../../frontend/src/components/LevelUpCelebrationPopover.tsx) once per unseen unlock tier. Level 1 / first wallet connect does **not** celebrate. `prefers-reduced-motion` keeps the glass popover but disables confetti. Full mechanic education remains on explicit help (`FeatureMechanicModal`).

## Env

| Variable | Role |
|----------|------|
| `VITE_TIME_ARENA_ADDRESS` | `TimeArena` proxy |
| `VITE_PODIUM_VAULTS_ADDRESS` | Podium vaults |
| `VITE_ADMIN_SELL_VAULT_ADDRESS` | Admin sell vault |
| `VITE_INDEXER_URL` | Optional Arena v2 reads: `GET /v1/arena/*` ([#254](https://gitlab.com/PlasticDigits/yieldomega/-/issues/254)); not legacy `/v1/timecurve/*` ([#266](https://gitlab.com/PlasticDigits/yieldomega/-/issues/266)) |
| `VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER` | Optional — must match `TimeArena.timeArenaBuyRouter()` when set ([#264](https://gitlab.com/PlasticDigits/yieldomega/-/issues/264)); legacy alias `VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER` |
| `VITE_PLAY_CRED_ADDRESS` | Optional PlayCred override when `TimeArena.playCred()` read fails ([#269](https://gitlab.com/PlasticDigits/yieldomega/-/issues/269)) |
| `VITE_CHAIN_ID` / `VITE_RPC_URL` | Wagmi target chain |

## Indexer reads

- `GET /v1/arena/timers` — Last Buy deadline + four podium deadlines + epoch ([#254](https://gitlab.com/PlasticDigits/yieldomega/-/issues/254))
- `GET /v1/arena/podiums` — head `podium()` rows + indexed `epoch` per category; **`prize_places_doub_wad`** + **`active_pool_balance_doub_wad`** (schema ≥ 2.8.0, [#302](https://gitlab.com/PlasticDigits/yieldomega/-/issues/302))
- `GET /v1/arena/buys` — recent buys
- `GET /v1/arena/activity` — recent buy / WarBow steal / guard / revenge actions for AUDIT activity ([#292](#arena-production-components-gitlab-292))
- `GET /v1/arena/wallet/{address}/stats` — participant profile aggregates (XP, buy count, WarBow steals; [#255](https://gitlab.com/PlasticDigits/yieldomega/-/issues/255); schema **≥ 2.4.0**)
- `GET /v1/arena/session-summary` — absent-session recap for play modal ([#338](https://gitlab.com/PlasticDigits/yieldomega/-/issues/338); schema **≥ 2.18.0**)
- `GET /v1/arena/podium-pool-donations` — donate-pools AUDIT card ([#262](https://gitlab.com/PlasticDigits/yieldomega/-/issues/262))

<a id="while-you-were-away-modal-gitlab-338"></a>

## While You Were Away modal (GitLab [#338](https://gitlab.com/PlasticDigits/yieldomega/-/issues/338))

On play **`/`**, when the browser has a prior close timestamp (`yieldomega.arena.lastClosedAt.v1` in **`localStorage`**) and the indexer reports arena activity since that time, **`WhileYouWereAwayModal`** opens once per page load. **`visibilitychange`** / **`pagehide`** persist the close time (per-browser, not per-wallet). First visit (no timestamp) and indexer-offline states skip the modal. Connected wallets see congratulations when they placed on ended podium epochs.

| Piece | Path |
|-------|------|
| Modal UI | [`WhileYouWereAwayModal.tsx`](../../frontend/src/components/WhileYouWereAwayModal.tsx) |
| Lifecycle + storage | [`arenaSessionClose.ts`](../../frontend/src/lib/arenaSessionClose.ts), [`useWhileYouWereAway.ts`](../../frontend/src/hooks/useWhileYouWereAway.ts) |
| Play mount | [`TimeArenaPage.tsx`](../../frontend/src/pages/TimeArenaPage.tsx) |
| Indexer client | [`indexerApi.ts`](../../frontend/src/lib/indexerApi.ts) (`fetchArenaSessionSummary`) |

Invariant: **`INV-FRONTEND-338-WYWA-MODAL`** · **`INV-INDEXER-338-SESSION-SUMMARY`** in [invariants](../testing/invariants-and-business-logic.md#while-you-were-away-gitlab-338). Tests: `WhileYouWereAwayModal.test.tsx`, `arenaSessionClose.test.ts`, `indexerApi.test.ts`, `integration_stage2.rs::arena_session_summary_fixture_since_activity`. Visuals: cyberminimalist glass (**`INV-FRONTEND-294`**) — screenshots in [issue #338 screenshots](../testing/screenshots/issue-338/README.md).

<a id="wallet-profile-modal-gitlab-258"></a>

## Wallet profile modal (GitLab [#258](https://gitlab.com/PlasticDigits/yieldomega/-/issues/258))

Participant addresses on **play `/`** and **`/arena/protocol`** open **`WalletProfileModal`** via **`AddressInline` `onOpenProfile`** (not block explorer). Stats: **`GET /v1/arena/wallet/{address}/stats`**. Modal includes **View on explorer** as a secondary link.

Modal sections (from indexer aggregates): **Overview**, **Podium wins**, **Spending**, **XP / Level**, **Level history** ([#336](https://gitlab.com/PlasticDigits/yieldomega/-/issues/336)), **WarBow**, **Referrals**, **Fun facts**. Loading / error / indexer-unset states use shared placeholders ([#96](https://gitlab.com/PlasticDigits/yieldomega/-/issues/96)). Layout: [`WalletProfileModal.tsx`](../../frontend/src/components/WalletProfileModal.tsx), [`WalletProfileModalSections.tsx`](../../frontend/src/components/WalletProfileModalSections.tsx), [`walletProfileFormat.ts`](../../frontend/src/lib/walletProfileFormat.ts).

**Level history:** `GET /v1/arena/wallet/{address}/stats` field **`level_history`** (schema **≥ 2.18.0**) — five rows (`level` `"1"`…`"5"`, **`reached_at`** UTC ISO-8601 or `null`). Level 1 = first indexed buy; levels 2–5 = earliest **`ArenaLevelUp`** per tier. Frontend renders local time via **`formatWalletProfileIso8601`**; missing milestones show em dash (**`—`**). Progression tier short labels reuse [`arenaProgression.ts`](../../frontend/src/lib/arenaProgression.ts).

| Surface | Component |
|---------|-----------|
| Play — podium winners, last timer extension, WarBow steal targets | [`TimeArenaPage.tsx`](../../frontend/src/pages/TimeArenaPage.tsx) → [`ArenaSimplePage.tsx`](../../frontend/src/pages/arena/ArenaSimplePage.tsx), [`ArenaWarbowHeroPanel.tsx`](../../frontend/src/pages/arena/ArenaWarbowHeroPanel.tsx) |
| AUDIT — live buy ticker, donate-pools recent donors | [`ArenaProtocolPage.tsx`](../../frontend/src/pages/arena/ArenaProtocolPage.tsx) → [`ArenaLiveBuysActivitySection.tsx`](../../frontend/src/pages/arena/ArenaLiveBuysActivitySection.tsx), [`ArenaProtocolDonatePoolsSection.tsx`](../../frontend/src/pages/arena/ArenaProtocolDonatePoolsSection.tsx) |
| Live-buy row primitives (hero strip + all-buys modal) | [`LiveBuyRow.tsx`](../../frontend/src/pages/arena/LiveBuyRow.tsx) |

Invariants: **`INV-FRONTEND-258-WALLET-PROFILE`** · **`INV-INDEXER-282-ARENA-BUYS-SECONDS`** · **`INV-INDEXER-283-ARENA-BUYS-PARITY`** in [invariants](../testing/invariants-and-business-logic.md#wallet-profile-modal-gitlab-258). Tests: `WalletProfileModalSections.test.tsx`, `walletProfileFormat.test.ts`, `indexerApi.test.ts` (buy row mapping including `log_index` / `new_deadline`). Hermetic smoke: `bash scripts/verify-wallet-profile-anvil.sh` ([#282](https://gitlab.com/PlasticDigits/yieldomega/-/issues/282), [#283](https://gitlab.com/PlasticDigits/yieldomega/-/issues/283)). Contracts-only explorer links remain on [`MegaScannerAddressLink.tsx`](../../frontend/src/components/MegaScannerAddressLink.tsx).

<a id="protocol-donate-pools-gitlab-262"></a>

## Protocol — donate pools (AUDIT)

Route: **`/arena/protocol`** (AUDIT sub-nav; legacy **`/arena/protocol`** redirects — [#266](https://gitlab.com/PlasticDigits/yieldomega/-/issues/266)). Component: [`ArenaProtocolDonatePoolsSection.tsx`](../../frontend/src/pages/arena/ArenaProtocolDonatePoolsSection.tsx) · **`data-testid="arena-protocol-donate-pools"`**.

- Required disclosure (always visible, non-dismissible): donating boosts prizes but **does not** benefit the donor.
- Write path: DOUB **`approve`** + **`topUpPodiumPools(amount)`** on `TimeArena` ([#261](https://gitlab.com/PlasticDigits/yieldomega/-/issues/261)), gated by **`ChainMismatchWriteBarrier`**.
- Read path: indexer totals, per-wallet summary when connected, recent donations list (wallet profile modal [#258](https://gitlab.com/PlasticDigits/yieldomega/-/issues/258)).
- Indexer unset/offline: **`EmptyDataPlaceholder`** — no fake zeros ([#200](https://gitlab.com/PlasticDigits/yieldomega/-/issues/200)).

Invariants: **`INV-FRONTEND-262-DONATE-POOLS`** · **`INV-INDEXER-262-DONATE-POOLS`** in [invariants](../testing/invariants-and-business-logic.md#arena-podium-pool-donations-gitlab-262).

<a id="pay-modes"></a>

## Pay modes

Toggle buttons: **`data-testid="arena-paywith-cl8y"`** (DOUB), **`arena-paywith-cred`** (Play CRED burn — [#269](https://gitlab.com/PlasticDigits/yieldomega/-/issues/269)), **`arena-paywith-eth`**, **`arena-paywith-usdm`**. CRED: read **`playCred()`** + **`CRED_PER_CHARM_WAD`** ([#268](https://gitlab.com/PlasticDigits/yieldomega/-/issues/268)), wallet **`balanceOf`**, submit **`buyWithCred(charmWad)`** — burn helper [`arenaCredBurn.ts`](../../frontend/src/lib/arenaCredBurn.ts). ETH/USDM single-tx **`buyViaKumbaya`** when **`timeArenaBuyRouter`** is non-zero ([#251](https://gitlab.com/PlasticDigits/yieldomega/-/issues/251), [#264](https://gitlab.com/PlasticDigits/yieldomega/-/issues/264)). Operator pause: **`TimeArena.paused`** only — **`INV-FRONTEND-264-ARENA-PAY-PAUSE`** · [invariants §264](../testing/invariants-and-business-logic.md#arena-frontend-pay-pause-gitlab-264).

## Wallet / chain

Wrong-network write gating: [wallet-connection.md](wallet-connection.md). Session drift on multi-step buys: [invariants §144](../testing/invariants-and-business-logic.md#arena-buy-wallet-session-drift-gitlab-144).

## E2E

`bash scripts/e2e-anvil.sh` — `e2e/anvil-arena-*.spec.ts`, **`ANVIL_E2E=1`**, single worker ([#87](https://gitlab.com/PlasticDigits/yieldomega/-/issues/87)).

Non-Anvil UI smoke (5 workers): `cd frontend && CI=1 npm run test:e2e -- --workers=5 e2e/arena.spec.ts e2e/home.spec.ts e2e/navigation.spec.ts e2e/referrals-surface.spec.ts e2e/footer-site-links.spec.ts e2e/launch-countdown.spec.ts e2e/surface-shells.spec.ts e2e/referral-path.spec.ts` ([#298](https://gitlab.com/PlasticDigits/yieldomega/-/issues/298)).

<a id="frontend-ux-docs-e2e-gitlab-298"></a>

### Frontend UX docs + E2E gate (GitLab [#298](https://gitlab.com/PlasticDigits/yieldomega/-/issues/298))

Consolidates layout documentation ([#291](https://gitlab.com/PlasticDigits/yieldomega/-/issues/291)–[#296](https://gitlab.com/PlasticDigits/yieldomega/-/issues/296)) with a **page-by-page content audit** against canonical TimeArena mechanics. UI copy must not redefine onchain rules.

| Artifact | Role |
|----------|------|
| [frontend-content-audit.md](../testing/frontend-content-audit.md) | Route-by-route visible copy + layout checklist |
| [manual QA §298](../testing/manual-qa-checklists.md#manual-qa-issue-298) | Visual + mechanics smoke for reviewers |
| Playwright `e2e/arena*.spec.ts`, `e2e/home.spec.ts`, `e2e/navigation.spec.ts`, … | Selector + **Yield Omega** branding expectations |
| `bash scripts/check-arena-naming.sh` | `arena-*` CSS naming ([#280](https://gitlab.com/PlasticDigits/yieldomega/-/issues/280)) |

Invariant: **`INV-FRONTEND-298-UX-DOCS-E2E`** in [invariants](../testing/invariants-and-business-logic.md#frontend-ux-docs-e2e-gitlab-298). Play skills: [`skills/README.md`](../../skills/README.md).

**Product rules:** [arena-v2.md](../product/arena-v2.md) · **Invariants:** [invariants-and-business-logic.md](../testing/invariants-and-business-logic.md#timearena-v2-gitlab-260)
