---
name: verify-yo-album-bgm-resume
description: Manual QA checklist for Album 1 BGM resume across refresh and autoplay-blocked browsers (GitLab issue #71). Use when verifying localStorage playback state, dock title hydrate, skip/next semantics, and throttle behavior.
---

# Verify Album 1 BGM resume (issue #71)

**Goal:** Confirm **Blockie Hills** BGM **track** and **offset** survive **refresh** and **same-origin** tab reopen, without breaking **autoplay** / **first-gesture** unlock from [issue #68](https://gitlab.com/PlasticDigits/yieldomega/-/issues/68).

**Authority:** UX-only; no onchain actions. Cross-check [sound-effects-recommendations.md §8](../../docs/frontend/sound-effects-recommendations.md#8-in-app-implementation-album-1--sfx-bus-issue-68) and [invariants — Album 1 BGM + resume](../../docs/testing/invariants-and-business-logic.md#timecurve-frontend-album-1-bgm-and-sfx-bus-issue-68).

## Preconditions

- Run the **frontend** locally (or staging) with audio-capable browser (**Chromium** + **Firefox** minimum).
- Open devtools → **Application** → **Local Storage** → key **`yieldomega:audio:v1:playbackState`** (optional: watch writes).

## Checklist

1. **Playing + refresh:** Start BGM, let a track play **30–60s**, hard **refresh**. Expect **same track title** in the dock within the first paint (no long flash of track 1) and audio resumes within **±5s** of the prior position.
2. **Pause + refresh:** Pause mid-track, refresh. Expect **same track** and **paused** state until **Play** or gesture; offset within **±2s** of where you paused.
3. **Autoplay blocked + gesture:** In a profile that **blocks autoplay**, reload mid-track. Dock should show the **restored title** immediately; after **first pointer** unlock, playback should start at the **saved offset**, not 0:00.
4. **Skip then refresh:** Press **next track**, refresh. Expect the **new** track at **0:00** (not the previous track’s offset).
5. **Natural end then refresh:** Let a track play to **end** (album advances automatically), then refresh before the next track advances far. Expect storage reflects the **advanced** track at **0:00** (see acceptance criteria in [issue #71](https://gitlab.com/PlasticDigits/yieldomega/-/issues/71)).
6. **New tab same origin:** With BGM playing, open the same app URL in a **second tab**; **last writer wins** (no cross-tab sync required)—confirm no crashes and behavior matches issue spec.
7. **Throttle (optional):** While playing, confirm **`playbackState`** JSON **`savedAt`** does not update faster than roughly **every 3–5 seconds** unless you pause, skip, hide the tab, or unload.

## Evidence to capture

- Short note of **browser + OS**.
- **Before/after** values of **`playbackState`** (redact nothing; no PII in this blob).
- If something fails: **console** errors (expect **none** for quota / corrupt storage paths).

## Related

- Contributor implementation map: [`frontend/src/audio/audioPlaybackState.ts`](../../frontend/src/audio/audioPlaybackState.ts), [`WebAudioMixer.ts`](../../frontend/src/audio/WebAudioMixer.ts), [`AudioEngineProvider.tsx`](../../frontend/src/audio/AudioEngineProvider.tsx).
- Parent index: [`skills/README.md`](../README.md).
