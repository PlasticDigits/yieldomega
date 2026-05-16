// SPDX-License-Identifier: AGPL-3.0-only
//
// Opt-in unlimited CL8Y allowance for TimeCurve (GitLab #143).

import { useCl8yTimeCurveUnlimitedApproval } from "@/lib/cl8yTimeCurveApprovalPreference";

type Props = {
  disabled?: boolean;
  className?: string;
};

export function Cl8yTimeCurveUnlimitedApprovalFieldset({ disabled, className }: Props) {
  const [unlimited, setUnlimited] = useCl8yTimeCurveUnlimitedApproval();
  return (
    <div
      className={className ?? "timecurve-simple__referral muted"}
      data-testid="cl8y-timecurve-approval-pref"
    >
      <label>
        <input
          type="checkbox"
          checked={unlimited}
          onChange={(e) => setUnlimited(e.target.checked)}
          disabled={disabled}
          aria-describedby="cl8y-timecurve-unlimited-approval-disclosure"
        />{" "}
        Remember unlimited CL8Y allowance for TimeCurve (optional)
      </label>
      <p id="cl8y-timecurve-unlimited-approval-disclosure" className="muted" style={{ marginTop: "0.5rem" }}>
        Unlimited approve means you don't have to sign twice for each buy.
      </p>
    </div>
  );
}
