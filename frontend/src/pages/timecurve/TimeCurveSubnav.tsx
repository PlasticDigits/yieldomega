// SPDX-License-Identifier: AGPL-3.0-only

import { NavLink } from "react-router-dom";

/**
 * Shared sub-navigation at the top of every TimeCurve view: icon + short label
 * (BUY · ARENA · AUDIT) plus a collapsible “ABOUT TIMECURVE” blurb (open by
 * default). Tabs are mutually exclusive; the active tab is decided by
 * `react-router` so deep links land on the right surface.
 *
 * Invariant: tab links never own or mirror game state. Copy in the disclosure is
 * explanatory only — the contract remains the single source of truth across
 * surfaces (see `docs/frontend/timecurve-views.md`).
 */
export type TimeCurveSubnavTab = "simple" | "arena" | "protocol";

const TABS: ReadonlyArray<{
  to: string;
  end?: boolean;
  key: TimeCurveSubnavTab;
  label: string;
  /** Sub-nav pictogram from issue #45. See `frontend/public/art/icons/`. */
  iconSrc: string;
}> = [
  {
    to: "/timecurve",
    end: true,
    key: "simple",
    label: "BUY",
    iconSrc: "/art/icons/nav-simple.png",
  },
  {
    to: "/timecurve/arena",
    key: "arena",
    label: "ARENA",
    iconSrc: "/art/icons/nav-arena.png",
  },
  {
    to: "/timecurve/protocol",
    key: "protocol",
    label: "AUDIT",
    iconSrc: "/art/icons/nav-protocol.png",
  },
];

const ABOUT_COPY: Record<TimeCurveSubnavTab, string> = {
  simple:
    "Get Charm & Win Prizes! Charm converts to $DOUB when the sale ends. Win prizes in CL8Y by timing your buys carefully.",
  arena:
    "Battle other players to climb the WarBow leaderboard. Every buy earns BattlePoints, but you can earn more by planting flags, timing buys, stealing, and revenge!",
  protocol:
    "Check the onchain & indexer data, audit the buy log, and more. Useful for detailed information.",
};

export function TimeCurveSubnav({ active }: { active: TimeCurveSubnavTab }) {
  return (
    <div className="timecurve-subnav-stack">
      <nav
        className="timecurve-subnav"
        aria-label="TimeCurve views"
        data-active={active}
      >
        <ul className="timecurve-subnav__list">
          {TABS.map((tab) => (
            <li key={tab.key} className="timecurve-subnav__item">
              <NavLink
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `timecurve-subnav__link${isActive ? " timecurve-subnav__link--active" : ""}`
                }
                aria-current={tab.key === active ? "page" : undefined}
              >
                <img
                  className="timecurve-subnav__icon"
                  src={tab.iconSrc}
                  alt=""
                  width={28}
                  height={28}
                  loading="lazy"
                  decoding="async"
                  aria-hidden="true"
                />
                <span className="timecurve-subnav__label">{tab.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <details className="timecurve-subnav-about" open>
        <summary className="timecurve-subnav-about__summary">ABOUT TIMECURVE</summary>
        <div className="timecurve-subnav-about__body">
          {TABS.map((tab) => (
            <p key={tab.key} className="timecurve-subnav-about__p">
              <span className="timecurve-subnav-about__lead">
                <img
                  className="timecurve-subnav-about__icon"
                  src={tab.iconSrc}
                  alt=""
                  width={24}
                  height={24}
                  loading="lazy"
                  decoding="async"
                  aria-hidden="true"
                />
                <strong className="timecurve-subnav-about__label">{tab.label}:</strong>
              </span>{" "}
              {ABOUT_COPY[tab.key]}
            </p>
          ))}
        </div>
      </details>
    </div>
  );
}
