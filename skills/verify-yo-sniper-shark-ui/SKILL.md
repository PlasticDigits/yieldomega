---
name: verify-yo-sniper-shark-ui
description: Verify the issue #80 sniper-shark UI placement. Use when checking TimeCurve Arena visual QA, sparse mascot placement, decorative accessibility, or shark cutout regressions.
---

# Verify Sniper-Shark UI

## Scope

Use this when visually checking the issue #80 sniper-shark cutout on the
TimeCurve Arena surface. This is a **visual QA** skill: it does not interpret
wallet balances, winners, buy eligibility, or any onchain rule.

## Truth Order

1. Product UI docs: [`docs/frontend/timecurve-views.md`](../../docs/frontend/timecurve-views.md#arena-sniper-shark-cutout-issue-80).
2. Runtime asset map: [`frontend/public/art/README.md`](../../frontend/public/art/README.md).
3. Component code: `TimeCurveArenaView.tsx` and `CutoutDecoration.tsx`.

## Checklist

- [ ] Open `/timecurve/arena` on a desktop-width viewport.
- [ ] Confirm the **only** shark is `sniper-shark-peek-scope.png` on the Arena **Buy CHARM** panel.
- [ ] Confirm the shark is a low-priority accent: it does not cover the buy CTA, pay mode controls, WarBow flag option, rate board, or error text.
- [ ] Confirm Home, `/timecurve` Simple, `/timecurve/protocol`, and global header/footer chrome do **not** gain shark cutouts.
- [ ] Confirm the image is decorative: it has no spoken label, and page headings/buttons remain the accessibility source of truth.
- [ ] Enable reduced motion and confirm the page remains usable without relying on the shark animation.
- [ ] Mobile smoke: at 390×844, confirm mascot cutouts are hidden and the Arena buy panel remains readable.

## Report Format

Return:

```markdown
Sniper-shark UI QA:
- Arena placement:
- No global/simple/protocol shark:
- A11y/decorative behavior:
- Reduced motion/mobile:
- Screenshots or notes:
```
