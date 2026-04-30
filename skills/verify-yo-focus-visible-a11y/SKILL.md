---
name: verify-yo-focus-visible-a11y
description: Verify keyboard focus indicators (WCAG 2.4.7) across the app and RainbowKit wallet UI (GitLab #97).
---

# Verify — keyboard focus visible (issue #97)

Use after changes to global styles, RainbowKit integration, or interactive components where **`outline`** / **`:focus-visible`** might regress.

**Product intent:** Tab order moves focus correctly, and users **see** a **`:focus-visible`** ring on interactive controls. RainbowKit ships **`outline: none`** inside **`[data-rk]`** with specificity that can hide rings unless styles repeat the same selectors under **`[data-rk]`** — see [`docs/frontend/wallet-connection.md`](../../docs/frontend/wallet-connection.md).

## Preconditions

- Dev server (e.g. `npm run dev` in `frontend/`, port **5173**).
- **Chrome** or **Firefox**; click the page background so focus is in the document (not the address bar).

## Checklist

1. **`/timecurve`:** Press **Tab** repeatedly through header links, sub-nav, pay-mode toggles, **Buy** CTA, and range slider. Confirm a **visible** outline or ring (gold via **`--yo-focus-ring`**) on the focused control. Pointer-click a button: ring should **not** persist as a default mouse-focus artifact (**:focus-visible** semantics).
2. **Connect modal:** Open the wallet connect flow. Tab through modal buttons and list items. Each focused control must show the **same** family of visible focus styling as the rest of the app (scoped **`[data-rk]`** rules).
3. **Contrast sanity:** Ring remains visible on both light panels and green page chrome; if a host overrides **`--yo-focus-ring`**, ensure it still contrasts with adjacent backgrounds.
4. **Optional — DevTools:** `document.activeElement` updates each tab stop; the active element should match the control showing the ring.

## Evidence to capture

- Short screen recording or **2–3 screenshots** of Tab focus on **TimeCurve** and **inside** the wallet modal.

## References

- [design.md — Accessibility and UX](../../docs/frontend/design.md#accessibility-and-ux)
- [invariants — #97](../../docs/testing/invariants-and-business-logic.md#keyboard-focus-visible-wcag-247-gitlab-97)
- [GitLab #97](https://gitlab.com/PlasticDigits/yieldomega/-/issues/97)
