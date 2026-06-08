// SPDX-License-Identifier: AGPL-3.0-only

type Role = "host" | "engineer" | "familiar" | "accent";

type Props = {
  src: string;
  width: number;
  height: number;
  role?: Role;
  className?: string;
  style?: React.CSSProperties;
};

/** Selective character placement — low opacity, non-interactive. */
export function CharacterAnchor({
  src,
  width,
  height,
  role = "accent",
  className,
  style,
}: Props) {
  const classes = [
    "yga-character-anchor",
    role === "host" ? "yga-character-anchor--host" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <img
      className={classes}
      src={src}
      alt=""
      width={width}
      height={height}
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      style={style}
    />
  );
}
