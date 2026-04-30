---
name: verify-yo-indexer-offline-ux
description: Verify indexer disconnect handling on TimeCurve Simple and global footer (GitLab #96) — offline banner, poll backoff, and Recent buys empty-state copy.
---

# Verify — indexer offline UX (issue #96)

Use after code or infra changes to **`VITE_INDEXER_URL`** polling, **`IndexerStatusBar`**, **`useTimecurveHeroTimer`**, or **`fetchTimecurveBuys`** on Simple / Arena.

**Product intent:** When the indexer HTTP API is unreachable, participants see **Indexer offline · retrying**, pollers slow to **30s → 60s → 120s** waves, and **Recent buys** does not claim **Waiting for the first buy** while the feed is down.

## Preconditions

- Local (or remote) stack with **Vite** frontend, **Anvil** (or RPC), and **indexer** on the URL in **`VITE_INDEXER_URL`** (default dev: `http://127.0.0.1:3100`).
- Wallet on the same chain as the app; **`/timecurve`** loads with indexer status **live** initially.

## Checklist

1. **Baseline:** Open **`/timecurve`**. Confirm a pill above **Recent buys** shows **`Indexer v… · latest indexed block … · live`** (same component as the global footer on other routes).
2. **Drop indexer only:** Stop the indexer or block **`127.0.0.1:3100`** (e.g. kill port forward). Wait **~3–5 seconds** (three failure buckets for the shared streak).
3. **Option A — banner:** Pill turns **Indexer offline · retrying** (warning/error styling), on Simple **and** on a route with footer (e.g. **`/timecurve/arena`**).
4. **Option C — backoff:** In DevTools **Network**, confirm requests to **`/v1/timecurve/chain-timer`**, **`/v1/timecurve/buys`**, **`/v1/status`** (or fallback) are **not** hammering at 1s / 3s / 5s indefinitely — after offline, gaps should grow toward **30s+** cycles.
5. **Option D — empty copy:** With indexer down and **no** cached buy rows, **Recent buys** shows **Cannot reach indexer · cached data may be stale**, not **Waiting for the first buy of this round**. If rows were visible before the drop, list may remain with a **cached data may be stale** hint.
6. **Recovery:** Restore indexer. After the next successful poll, pill returns to **live**; backoff resets to normal cadence.

## Evidence to capture

- One screenshot of **offline** pill on **`/timecurve`**.
- Short **Network** waterfall or HAR notes showing **reduced** request rate while offline.

## References

- [timecurve-views — issue #96](../docs/frontend/timecurve-views.md#indexer-offline-ux-issue-96)
- [invariants — #96](../docs/testing/invariants-and-business-logic.md#indexer-offline-ux-and-backoff-gitlab-96)
- [GitLab #96](https://gitlab.com/PlasticDigits/yieldomega/-/issues/96)
