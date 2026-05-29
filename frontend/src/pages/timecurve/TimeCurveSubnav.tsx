// SPDX-License-Identifier: AGPL-3.0-only

import { useLayoutEffect, useState, type SyntheticEvent } from "react";
import { NavLink } from "react-router-dom";

/** Persisted disclosure state across reloads (`localStorage`). */
const ARENA_ABOUT_OPEN_STORAGE_KEY = "yieldomega.arena.aboutOpen.v1";

function readArenaAboutOpenFromStorage(): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ARENA_ABOUT_OPEN_STORAGE_KEY);
    if (raw === "0") return false;
    if (raw === "1") return true;
    return null;
  } catch {
    return null;
  }
}

function writeArenaAboutOpenToStorage(open: boolean): void {
  try {
    window.localStorage.setItem(ARENA_ABOUT_OPEN_STORAGE_KEY, open ? "1" : "0");
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Shared sub-navigation for Time Arena: BUY (play) and AUDIT (protocol).
 * Legacy `/timecurve/*` routes redirect to these paths (GitLab #266).
 */
export type TimeCurveSubnavTab = "simple" | "protocol";

const TABS: ReadonlyArray<{
  to: string;
  end?: boolean;
  key: TimeCurveSubnavTab;
  label: string;
  iconSrc: string;
}> = [
  {
    to: "/arena",
    end: true,
    key: "simple",
    label: "BUY",
    iconSrc: "/art/icons/nav-simple.png",
  },
  {
    to: "/arena/protocol",
    key: "protocol",
    label: "AUDIT",
    iconSrc: "/art/icons/nav-protocol.png",
  },
];

const ABOUT_COPY: Record<TimeCurveSubnavTab, string> = {
  simple:
    "Buy Charm with DOUB on Time Arena. Timer extensions and podium prizes follow onchain rules in Arena v2.",
  protocol:
    "Check onchain reads, indexer tables, and donate-pools activity. Useful for operators and auditors.",
};

export function TimeCurveSubnav({ active }: { active: TimeCurveSubnavTab }) {
  const [aboutOpen, setAboutOpen] = useState(() => readArenaAboutOpenFromStorage() ?? true);

  useLayoutEffect(() => {
    writeArenaAboutOpenToStorage(aboutOpen);
  }, [aboutOpen]);

  const toggleAbout = (e: SyntheticEvent) => {
    e.preventDefault();
    setAboutOpen((v) => !v);
  };

  return (
    <nav className="timecurve-subnav" aria-label="Time Arena views">
      <ul className="timecurve-subnav__tabs">
        {TABS.map((tab) => (
          <li key={tab.key}>
            <NavLink
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `timecurve-subnav__tab${isActive || active === tab.key ? " timecurve-subnav__tab--active" : ""}`
              }
            >
              <img src={tab.iconSrc} alt="" width={28} height={28} decoding="async" />
              <span>{tab.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="timecurve-subnav__about-toggle"
        aria-expanded={aboutOpen}
        onClick={toggleAbout}
      >
        ABOUT TIME ARENA
      </button>
      {aboutOpen ? (
        <p className="timecurve-subnav__about-copy">{ABOUT_COPY[active]}</p>
      ) : null}
    </nav>
  );
}
