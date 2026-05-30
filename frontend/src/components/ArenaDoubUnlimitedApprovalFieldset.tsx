// SPDX-License-Identifier: AGPL-3.0-only
//
// Opt-in unlimited CL8Y allowance for TimeCurve (GitLab #143).

import { useCl8yArenaUnlimitedApproval } from "@/lib/arenaDoubApprovalPreference";

type Props = {
  disabled?: boolean;
  className?: string;
};

export function ArenaDoubUnlimitedApprovalFieldset({ disabled, className }: Props) {
  const [unlimited, setUnlimited] = useCl8yArenaUnlimitedApproval();
  return (
    <div
      className={className ?? "arena-simple__referral muted"}
      data-testid="cl8y-arena-approval-pref"
    >
      <label>
        <input
          type="checkbox"
          checked={unlimited}
          onChange={(e) => setUnlimited(e.target.checked)}
          disabled={disabled}
          aria-describedby="cl8y-arena-unlimited-approval-disclosure"
        />{" "}
        Remember unlimited CL8Y allowance for TimeCurve (optional)
      </label>
      <p id="cl8y-arena-unlimited-approval-disclosure" className="muted" style={{ marginTop: "0.5rem" }}>
        Unlimited approve means you don't have to sign twice for each buy.
      </p>
    </div>
  );
}
