// SPDX-License-Identifier: AGPL-3.0-only

type Props = {
  className?: string;
  src: string;
  width: number;
  height: number;
  alt?: string;
  loading?: "eager" | "lazy";
};

export function CutoutDecoration({
  className = "",
  src,
  width,
  height,
  alt = "",
  loading = "lazy",
}: Props) {
  return (
    <img
      className={className ? `cutout-decoration ${className}` : "cutout-decoration"}
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={loading}
      decoding="async"
      aria-hidden={alt ? undefined : true}
    />
  );
}
