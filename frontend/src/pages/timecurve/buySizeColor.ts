// SPDX-License-Identifier: AGPL-3.0-only

const COLOR_STOPS = [
  { ratio: 0.1, color: [59, 130, 246] },
  { ratio: 0.25, color: [34, 197, 94] },
  { ratio: 0.5, color: [250, 204, 21] },
  { ratio: 0.75, color: [249, 115, 22] },
  { ratio: 1, color: [239, 68, 68] },
] as const;

function mixChannel(start: number, end: number, t: number): number {
  return Math.round(start + (end - start) * t);
}

export function buySizeColor(ratio: number): string {
  const t = Math.max(0, Math.min(1, ratio));
  const firstStop = COLOR_STOPS[0];
  if (t <= firstStop.ratio) {
    return `rgb(${firstStop.color.join(" ")})`;
  }

  for (let i = 1; i < COLOR_STOPS.length; i += 1) {
    const prevStop = COLOR_STOPS[i - 1];
    const nextStop = COLOR_STOPS[i];
    if (t <= nextStop.ratio) {
      const span = nextStop.ratio - prevStop.ratio;
      const progress = span <= 0 ? 0 : (t - prevStop.ratio) / span;
      const [r1, g1, b1] = prevStop.color;
      const [r2, g2, b2] = nextStop.color;
      return `rgb(${mixChannel(r1, r2, progress)} ${mixChannel(g1, g2, progress)} ${mixChannel(b1, b2, progress)})`;
    }
  }

  const lastStop = COLOR_STOPS[COLOR_STOPS.length - 1];
  return `rgb(${lastStop.color.join(" ")})`;
}
