# Sound effects — recommendations (Yieldomega / TimeCurve)

This document proposes **in-game and UI** sound for the frontend. It is aligned with **`frontend/public/music/albums/blockie_hills`** (full **Blockie Hills** album: sixteen instrumental tracks; see `manifest.json` there) and the onchain game loop (TimeCurve sale, **CHARM** / **DOUB**, **WarBow**, **reserve podiums**).

**Implementation note:** a small **Python + NumPy** synth lives in [`scripts/sound-effects/`](../../scripts/sound-effects) (`sfx_synth.py`, `presets.py`, `generate.py`). Run `python generate.py --out ../../frontend/public/sound-effects` to render reference **`.wav`** files. Treat those as **stems**; production may replace them with foley or higher-fidelity design while keeping the same **emotional and spectral** direction. The procedural presets **avoid “UI beeps”** (no solo high sines or glassy FM bells) in favor of **low-mid weight, detuned partials, and gentle low-passing** so they sit with the music rather than on top of it in a 2 kHz+ band.

**Thematic through-line**

- **Warm, acoustic-adjacent** (wood, felt, bowed metal) rather than cold glassy Material clicks — matches *Moss and Brass* and *Hills at Dawn*.
- **Coin and charm** = **bright but rounded** transients; avoid harsh digital chirps. Think *Coin Path* / *Lucky Run* — a little mythic, not a slot machine.
- **Timer and stakes** = **breathing** pulses and small tension rises — *Jig Generator* and *Starline Overworld* rhythm without turning the UI into a metronome.
- **Kumbaya / route / bridge** = **soft air, filtered noise** — *Kumbaya Campfire* suggests warmth and “travel” without pastiche.

---

## Album anchors (for designers & implementers)

| Album track | SFX mood to borrow | Avoid |
|------------|--------------------|--------|
| *Hills at Dawn* | Calm, wide, “world is opening” — onboarding, first load | Harsh stingers on every hover |
| *Coin Path* | **Primary buy / value** family — two-stage metallic + soft body | Siren-like or alarm tones |
| *Rainbow Switchback* | **Surprise and pivot** — ambush, phase changes, “route updated” | Comedy slide-whistle |
| *Moss and Brass* | **Tactile UI** — mallet-y, round | Plastic tick-tock |
| *Jig Generator* | **Bouncy micro-win** — streak, BP tick, small celebrations | Full Irish reel loops |
| *Starline Overworld* | **Epic but sparse** — sale end approaching, final minutes | Over-scoring every click |
| *Lucky Run* | **Charms, confirms, you’re in** — 5th / rising motifs | Applause beds |
| *Kumbaya Campfire* | **Connection / swap / bridge** — whoosh + warmth | Obvious guitar samples |

---

## 1. Core navigation & chrome

| Moment | Recommendation | Rationale |
|--------|----------------|------------|
| **Primary control click** (Buy, Connect, main CTA) | Short, slightly **wooden / counter** click with a very soft 1–2 kHz edge; **no** 4 kHz digital ping | Matches *Moss and Brass* tactility. Reference: `ui_button_click.wav` |
| **Secondary / text button** | Same family as primary, **−2 to −4 dB** and 10–20 ms shorter | Keeps one instrument metaphor |
| **Icon / ghost button** | HPF click or single soft tick | Low emphasis |
| **Tab or view switch** (e.g. Simple / Arena) | **Soft whoosh 80–200 ms** + 15 ms “latch” click at tail | Suggests *Rainbow Switchback* path change without music |
| **Modal open** | 120–200 ms **rising filtered noise** (bandpass) + very subtle low thump | “Stage lift” for attention |
| **Modal close** | 80–150 ms **downsweep** or short reverse; gentler than open | Avoids dizziness |
| **Back / cancel** | Soft tick + optional **descending 2nd** (very quiet) | Clear without punishing |
| **Toggle (sound on/off, etc.)** | Two clear states: **in** = up-chime; **out** = soft down-pluck | Distinct on/off |
| **Slider drag** (CHARM, spend) | **Continuous at low rate** (max ~4 Hz) or **silent** with tick on release; avoid constant noise | Prevents “mosquito” UX in long sessions |
| **Input focus** | **Optional** 1 kHz, 20 ms blip at low level or **silent** | Reduces sound fatigue for keyboard users |
| **Error / invalid action** | **Short detuned** pair of tones (minor 2nd) 150–250 ms, low-mid, **no** buzzer; respect reduced-motion | Inclusive, not a casino “wrong” |
| **Success (generic)** | **Major 3rd or 5th** arpeggio, 0.2–0.4 s, soft brass or chime | Aligns with *Lucky Run* / charm feeling |
| **Long operation started** (quote fetch, submit) | **Very subtle 2–3 Hz “breath”** or one soft swell at start; pair with on-screen *Refreshing quote…* | Ties to Kumbaya in-flight state ([issue 56](timecurve-views.md#buy-quote-refresh-kumbaya-issue-56)) |
| **Copy to clipboard** | **Single coin-tap** variant, 80 ms | Quick confirmation |
| **External link** | 100 ms whoosh (same as route family, shorter than Kumbaya full whoosh) | “Leaving the tavern for a path” |

---

## 2. TimeCurve — sale, timer, and economy

| Moment | Recommendation | Rationale |
|--------|----------------|------------|
| **Local buy tx submitted** (wallet signed) | **Deeper coin** layer + 30–50 ms **tension** riser; then **charm** confirm on receipt | *Coin Path* value + *Lucky Run* “you’re in” |
| **Local buy confirmed onchain** (your CHARM) | **Two-layer**: metallic strike + **short rising brass/chime** (5th) | Distinguishes “money moved” from “stake registered” — reference: `charmed_confirm.wav` (conceptually) |
| **Peer buy** (other wallets, indexer feed if shown) | **Same family as your buy** but **quieter, shorter, LPF** or **distant reverb**; one variant only | *Coin Path* in the background — not every chain event; reference: `peer_buy_distant.wav` |
| **Quote / route refresh** (Kumbaya) | **1 soft tick** or **extremely subtle filter motion**; **no** beep on every refetch | Quote refresh can be very frequent; respect calm |
| **Kumbaya / swap route active** (ETH↔CL8Y path) | **Gentle whoosh 0.3–0.5 s** + very faint coin tail | *Kumbaya Campfire* + *Coin Path*; reference: `kumbaya_whoosh.wav` |
| **CHARM / spend slider** | **On release** only: soft tick or 40 ms chime; optional tick every **whole CHARM** step, not per fraction | Fidelity to slider use |
| **Per-wallet buy cooldown active** (button disabled) | **Dull, damped mallet thud** or single low tick when user presses disabled control | “Door still locked” without anger |
| **Timer healthy** (> 13 min feel) | **Silent** or an **ultra-rare** ambient (see accessibility) | Default is calm — *Hills at Dawn* energy |
| **Timer “attention”** (e.g. &lt; 13 m to sale dynamics) | **Sporadic 0.1–0.2 s heartbeats** at 30–60 s spacing (user setting) | *Jig* pulse without drumming; reference: `timer_heartbeat_calm.wav` |
| **Timer urgent** (e.g. &lt; 1–2 m or user “stakes high”) | **Faster, brighter** heartbeat, still **round**; optional UI-only toggle | *Starline* / tension; `timer_heartbeat_urgent.wav` |
| **13 m / 15 m hard reset** (onchain) | **Distinct** “**clock latches**” 200–400 ms: short drop + **sweep up**; **separate** from standard buy (community-wide moment) | Major mechanic; deserves *Rainbow Switchback* pivot feel |
| **“Clutch”** buy (&lt; 30 s remaining, BP) | **Tiny** extra **sparkle** or 30 ms high harmonic on your confirm | Ties to WarBow clutch without spoiling *Last buy* suspense |
| **Ambush** (streak break + hard reset) | **Snappy** mid **twang** (not comedy) 150–200 ms, **staccato** | *Jig* accent; PvP bite |
| **Streak break (yours, lost)** | **Sinking** minor 2nd, **120 ms**, no long reverb | Legible without shame |
| **Streak break (caused by you, on you)** | Optional **satisfying** tiny “latch” on **you**; **softer** “hiss down” for victim’s client if we ever do multi-tab | PvP semantics |
| **Sale ended** (timer to zero) | **Single held brass / pad** 1.5–3 s **fading** + very subtle crowd-like bed **optional, off by default** | *Starline* closure without overwhelming |
| **Prize / podium availability** (post-`distributePrizes` messaging) | **Horn stack** or **major chord swell** 0.8–1.2 s, **rare** | *Moss and Brass* hero moment |
| **CHARM → DOUB redeem** (claim) | **Coin pour** 0.3–0.5 s (granular) + **warm** resolve; **separate** from in-sale buy | Post-sale new chapter |

---

## 3. WarBow — ladder and PvP (Battle Points)

| Moment | Recommendation | Rationale |
|--------|----------------|------------|
| **BP from qualifying buy** | **Tight 80 ms** “ladder step” (wood + soft strike) or stack with your buy SFX (duck others by 3 dB) | Reinforces progression |
| **Steal / guard / revenge** (on success) | **One icon each**: steal = **quick downward** scrape; guard = **hollow block**; revenge = **forward stab**-ish transient (all **0.1–0.2 s** max) | Legible PvP alphabet |
| **WarBow podium snapshot thought** (you climb top-3) | **Short plucked 5th** 0.2–0.3 s, **restrained**; reference: `warbow_twang.wav` | *Jig* + bow metaphor without literal SFX |
| **BP rank change in UI** | **1 tick** on panel update; no constant loop | Respects long sessions |
| **Steal or BP denied** (revert / rule) | Use **Error** from §1, slightly shorter | Consistency |

---

## 4. Podiums — the four categories (rhetoric, not SFX tax)

| Category | Emotional job | SFX when highlighted (e.g. explainer) |
|----------|---------------|----------------------------------------|
| **Last buy** | Tension, finale | *Starline*-style **cresc** patch; **one** 1 s swell when “final minutes” is explained, not on every page |
| **WarBow (top BP)** | Prowess | *Jig* / *warbow* twang family; short **fanfare fragment** 0.4 s |
| **Defended streak** | Tenacity, rhythm | **Rhythmic** two-step tap motif (0.1 s, 0.1 s) — “heartbeat of defense” |
| **Time booster** | Weight of time | **Deeper thump** + “clock gear” 100 ms, low-mid; distinct from 13/15m reset (less dramatic) | 

---

## 5. Wallet and chain (EVM)

| Moment | Recommendation |
|--------|-----------------|
| **Connect requested** | Soft *whoosh* + 40 ms *click* (same as modal open) |
| **Connect success** | **Major 3rd** chime, 0.25 s |
| **Connect fail / user reject** | §1 error variant |
| **Sign request shown** (wallet pop) | **Subtle 60 Hz / 1 cycle** “hum” 100 ms (optional) or **silent** |
| **Transaction submitted to RPC** | **Deeper** tick + 100 ms *wait* room (or extend “long op” from §1) |
| **Transaction confirmed** | **Charmed confirm** (same class as onchain buy) **or** lighter 5th if already played for submit |
| **Transaction failed (revert)** | Error from §1 + **no** long tail |

---

## 6. Accessibility, preferences, and safety

- **“Reduce sound”** mode: only **error**, **end sale**, **redeem**, and **(optional) high-stakes** timer cues.
- **Master volume** + sub-mix: **UI**, **game**, **social/peers** (so users can follow or mute the “others buying” bed).
- **Respect** `prefers-reduced-motion` (pair with **no** timer heartbeat, or a **single** visual flash substitute — design detail outside this doc).
- **Cooldown** and **Kumbaya quote** paths can fire **often** — default those to **quiet or silent**.

---

## 7. Mapping: generated reference files (starting point)

| File (in `frontend/public/sound-effects/`) | Suggested use |
|--------------------------------|---------------|
| `ui_button_click.wav` | Primary / secondary **click** (§1) |
| `coin_hit_shallow.wav` | **Value / CL8Y** transients, peer-buys basis |
| `charmed_confirm.wav` | **Buy success**, connect success, “you’re in” (§2, §5) |
| `peer_buy_distant.wav` | **Other users’ buys** in feed (§2) |
| `timer_heartbeat_*.wav` | Timer **attention** states (§2) |
| `warbow_twang.wav` | WarBow **highlight** (§3) |
| `kumbaya_whoosh.wav` | **Route / swap** motion (§2) |

**Agent phase (repo):** this file is product/UX; no onchain rules change. For TimeCurve view contracts and timers, see [timecurve-views.md](timecurve-views.md) and the phase guide in [agent-phases.md](../agent-phases.md).

---

## 8. In-app implementation (Album 1 + SFX bus, issue #68)

**Shipped behavior** (see [GitLab #68](https://gitlab.com/PlasticDigits/yieldomega/-/issues/68), [invariants — frontend audio](../testing/invariants-and-business-logic.md#timecurve-frontend-album-1-bgm-and-sfx-bus-issue-68)):

- **Web Audio graph:** `master` gain → destination; **`bgmGain`** (sequential MP3 **Blockie Hills**, tracks **1–16** from `manifest.json`) and **`sfxGain`** (decoded `.wav` one-shots) are **independent** buses into `master`.
- **Autoplay:** On load, the app **attempts** to start BGM (`playBgm` after implicit `AudioContext` setup). Many browsers **block** audio until a **user gesture**; in that case the **first pointer** interaction unlocks the context, prefetches core SFX, and **starts BGM** if it is not already playing. The floating **AlbumPlayerBar** play/pause control still toggles playback after unlock.
- **Defaults:** BGM fader **25%** of full scale (`localStorage` key namespace `yieldomega:audio:v1:`); SFX use a gentle **square-law** curve from the SFX slider so mid values are not harsh.
- **TimeCurve Simple:** `coin_hit_shallow` after the **`buy`** tx is **submitted**; `charmed_confirm` after **receipt**; `kumbaya_whoosh` when **pay mode** changes across CL8Y / ETH / USDM; **peer** head-of-feed buys (not self) fire **`peer_buy_distant`** with a **minimum gap**; timer **calm** / **urgent** heartbeats align with **≤13m** / **≤2m** remaining while the sale is active, suppressed when **`prefers-reduced-motion`** is set.
- **Wallet:** `charmed_confirm` on **false → true** `isConnected` (no sound on cold load when already connected).
- **Global UI:** delegated **`ui_button_click`** on primary chrome (`button`, `[role="button"]`, main nav links); **disabled** buttons use a **softer** gain; **range inputs** are excluded (slider-drag silence per §1).

**Code map:** `frontend/src/audio/` (`WebAudioMixer`, `AudioEngineProvider`, `AlbumPlayerBar`), `frontend/src/layout/RootLayout.tsx` (player chrome), `useTimeCurveSaleSession.ts` (buy/redeem + pay-mode SFX), `useTimeCurveSimplePageSfx.ts` (peer + timer).
