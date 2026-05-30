// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
  className?: string;
  dataTestId?: string;
};

/** Grouped block inside Platform usage — hierarchy for participation / WarBow / wallets ([GitLab #234](https://gitlab.com/PlasticDigits/yieldomega/-/issues/234)). */
export function PlatformUsageSubsection({ title, children, className, dataTestId }: Props) {
  return (
    <div
      className={["platform-usage-block", className].filter(Boolean).join(" ")}
      data-testid={dataTestId}
    >
      <h3 className="platform-usage-block__title">{title}</h3>
      {children}
    </div>
  );
}
