// SPDX-License-Identifier: AGPL-3.0-only

import { NavLink } from "react-router-dom";

/**
 * Shared sub-navigation at the top of every TimeCurve view: icon + short label
 * only (BUY · ARENA · AUDIT). Tabs are mutually exclusive; the active tab is
 * decided by `react-router` so deep links land on the right surface.
 *
 * Invariant: this component never owns or mirrors game state. It is purely
 * navigational so the contract remains the single source of truth across
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

export function TimeCurveSubnav({ active }: { active: TimeCurveSubnavTab }) {
  return (
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
  );
}
