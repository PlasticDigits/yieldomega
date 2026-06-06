// SPDX-License-Identifier: AGPL-3.0-only

import { NavLink } from "react-router-dom";

/**
 * Shared sub-navigation for Time Arena: BUY (play) and AUDIT (protocol).
 * Legacy `/arena/*` routes redirect to these paths (GitLab #266).
 */
export type ArenaSubnavTab = "simple" | "protocol";

const TABS: ReadonlyArray<{
  to: string;
  end?: boolean;
  key: ArenaSubnavTab;
  label: string;
  iconSrc: string;
  description: string;
}> = [
  {
    to: "/arena",
    end: true,
    key: "simple",
    label: "BUY",
    iconSrc: "/art/icons/nav-simple.png",
    description: "Buy CHARM with DOUB or Play CRED and compete on Time Arena podiums.",
  },
  {
    to: "/arena/protocol",
    key: "protocol",
    label: "AUDIT",
    iconSrc: "/art/icons/nav-protocol.png",
    description: "Inspect Time Arena contract reads, indexer tables, and operator activity.",
  },
];

export function ArenaSubnav({ active }: { active: ArenaSubnavTab }) {
  return (
    <nav className="arena-subnav" aria-label="Time Arena views">
      <ul className="arena-subnav__tabs">
        {TABS.map((tab) => (
          <li key={tab.key}>
            <NavLink
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `arena-subnav__tab${isActive || active === tab.key ? " arena-subnav__tab--active" : ""}`
              }
              aria-label={`${tab.label}: ${tab.description}`}
              title={tab.description}
            >
              <img src={tab.iconSrc} alt="" width={28} height={28} decoding="async" />
              <span>{tab.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
