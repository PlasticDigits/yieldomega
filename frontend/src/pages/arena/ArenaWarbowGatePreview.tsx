// SPDX-License-Identifier: AGPL-3.0-only

/** Decorative WarBow skeleton shown behind the level lock overlay. */
export function ArenaWarbowGatePreview() {
  return (
    <section
      className="warbow-hero-actions arena-simple__warbow-gate-preview"
      data-testid="warbow-hero-actions"
      aria-hidden="true"
    >
      <article className="warbow-hero-card warbow-hero-card--viewer-summary">
        <p className="warbow-hero-viewer-summary__line">
          YOUR BP: <strong>1,240</strong>
        </p>
        <p className="warbow-hero-viewer-summary__line">
          GUARD: <strong>04:12</strong>
        </p>
      </article>

      <div className="warbow-hero-actions__grid">
        <article className="warbow-hero-card warbow-hero-card--steal">
          <div className="warbow-hero-card__head">
            <h3>Steal</h3>
            <span className="status-pill status-pill--warning">1.2K DOUB</span>
          </div>
          <div className="warbow-target-list">
            <div className="warbow-target-row">
              <span className="warbow-target-row__main">
                <span className="warbow-target-row__meta">#1 WarBow</span>
              </span>
              <span className="warbow-target-row__bp">8.4K BP</span>
            </div>
            <div className="warbow-target-row">
              <span className="warbow-target-row__main">
                <span className="warbow-target-row__meta">Recent buyer</span>
              </span>
              <span className="warbow-target-row__bp">3.1K BP</span>
            </div>
          </div>
        </article>

        <article className="warbow-hero-card">
          <div className="warbow-hero-card__head">
            <h3>Guard</h3>
            <span className="status-pill">420 DOUB</span>
          </div>
          <p className="muted">Shield your BP from steals.</p>
        </article>

        <article className="warbow-hero-card">
          <div className="warbow-hero-card__head">
            <h3>Revenge</h3>
            <span className="status-pill status-pill--warning">900 DOUB</span>
          </div>
          <p className="muted">Strike back after a steal.</p>
        </article>
      </div>
    </section>
  );
}
