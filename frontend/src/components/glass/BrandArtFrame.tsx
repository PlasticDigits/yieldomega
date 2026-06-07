// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  sceneSrc?: string;
  sceneAlt?: string;
  className?: string;
};

/** Recessed display zone with optional scene backplate. */
export function BrandArtFrame({ children, sceneSrc, sceneAlt = "", className }: Props) {
  const classes = ["yga-brand-art-frame", className].filter(Boolean).join(" ");
  return (
    <div className={classes}>
      {sceneSrc ? (
        <img
          className="yga-brand-art-frame__scene"
          src={sceneSrc}
          alt={sceneAlt}
          aria-hidden={sceneAlt ? undefined : true}
          decoding="async"
        />
      ) : null}
      {children}
    </div>
  );
}
