# Issue #338 — While You Were Away modal screenshots

Cyberminimalist glass modal on play `/` at three viewports.

| Viewport | File |
|----------|------|
| Desktop (1280×900) | [desktop.png](./desktop.png) |
| Tablet (768×1024) | [tablet.png](./tablet.png) |
| Mobile (390×844) | [mobile.png](./mobile.png) |

Regenerate:

```bash
cd frontend
CI=1 npm run test:e2e -- --workers=1 e2e/wywa-modal-screenshots.spec.ts
```

Uses Playwright route mock for `GET /v1/arena/session-summary` and seeded `localStorage` close timestamp.

Map: **`INV-FRONTEND-338-WYWA-MODAL`** · [arena-views §338](../../frontend/arena-views.md#while-you-were-away-modal-gitlab-338)
