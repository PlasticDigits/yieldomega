// SPDX-License-Identifier: AGPL-3.0-only

type Props = {
  amount: string;
  token?: string;
  className?: string;
};

/** DOUB / YΩ prize emphasis for podium cards. */
export function PodiumPrize({ amount, token = "DOUB", className }: Props) {
  const classes = ["yga-podium-prize", className].filter(Boolean).join(" ");
  return (
    <div className={classes}>
      <span className="yga-podium-prize__amount">{amount}</span>
      <span className="yga-podium-prize__token">{token}</span>
    </div>
  );
}
