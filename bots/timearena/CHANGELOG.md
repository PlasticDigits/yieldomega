# Changelog — `bots/timearena`

## 0.1.0 — package rename (GitLab [#323](https://gitlab.com/PlasticDigits/yieldomega/-/issues/323))

- Python package: `timecurve_bot` → **`timearena_bot`** (`bots/timearena/src/timearena_bot/`).
- PyPI / console script: `timecurve-bot` → **`timearena-bot`**.
- CI job: `bots-timecurve-test` → **`bots-timearena-test`**.
- Legacy env alias `YIELDOMEGA_TIMECURVE_ADDRESS` and registry JSON key `timecurve` remain supported for address resolution.

Legacy names (`timecurve_bot`, `timecurve-bot`) are intentionally absent from the codebase except this note.
