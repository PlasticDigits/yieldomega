// SPDX-License-Identifier: AGPL-3.0-only
//
// Opt-in unlimited CL8Y allowance for TimeCurve (GitLab #143).

import { useCl8yTimeCurveUnlimitedApproval } from "@/lib/cl8yTimeCurveApprovalPreference";

const DOCS_HREF =
  "https://gitlab.com/PlasticDigits/yieldomega/-/blob/main/docs/frontend/wallet-connection.md#erc20-approval-sizing-h-01-gitlab-143";

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
        By default each buy or WarBow action requests an approval sized to that transaction’s CL8Y pull only
        (you may see an extra approval when the spend changes). Opting in grants a standard ERC-20 unlimited
        allowance to the TimeCurve proxy, which saves gas on repeat plays but raises exposure if the proxy were
        ever maliciously upgraded — see audit <strong>H-01</strong> in{" "}
        <code>audits/audit_smartcontract_1777813071.md</code> and{" "}
        <a href={DOCS_HREF} target="_blank" rel="noreferrer noopener">
          wallet / approval notes
        </a>
        .
      </p>
    </div>
  );
}
