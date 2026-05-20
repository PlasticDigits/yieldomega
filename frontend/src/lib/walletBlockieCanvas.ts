// SPDX-License-Identifier: AGPL-3.0-only

import blockies from "ethereum-blockies";

/** 8×8 identicon grid — matches ethereum-blockies default. */
export const WALLET_BLOCKIE_GRID = 8;

/** Fixed source bitmap scale so every surface shares the same pixel data (GitLab #226). */
export const WALLET_BLOCKIE_SOURCE_SCALE = 8;

const canvasCache = new Map<string, HTMLCanvasElement>();

/**
 * Normalize any wallet / contract hex to the seed string ethereum-blockies expects.
 */
export function normalizedBlockieSeed(address: string): string {
  const t = address.trim().toLowerCase();
  if (t.startsWith("0x") && t.length >= 4) return t;
  if (/^[0-9a-f]+$/i.test(t) && t.length >= 4) return `0x${t}`;
  return t;
}

// Isolated PRNG — mirrors ethereum-blockies/blockies.js without touching its module-global state.
const randseed = new Uint32Array(4);

function seedrand(seed: string): void {
  randseed.fill(0);
  for (let i = 0; i < seed.length; i++) {
    const idx = i % 4;
    randseed[idx] = ((randseed[idx] << 5) - randseed[idx] + seed.charCodeAt(i)) >>> 0;
  }
}

function rand(): number {
  const t = randseed[0] ^ (randseed[0] << 11);
  randseed[0] = randseed[1];
  randseed[1] = randseed[2];
  randseed[2] = randseed[3];
  randseed[3] = (randseed[3] ^ (randseed[3] >> 19) ^ t ^ (t >> 8)) >>> 0;
  return randseed[3] / ((1 << 31) >>> 0);
}

function createColor(): string {
  const h = Math.floor(rand() * 360);
  const s = `${rand() * 60 + 40}%`;
  const l = `${(rand() + rand() + rand() + rand()) * 25}%`;
  return `hsl(${h},${s},${l})`;
}

/**
 * Deterministic blockie palette for a seed. Matches ethereum-blockies `create()` after its first
 * internal `buildOpts` has seeded the PRNG (colors no longer depend on render order).
 */
export function blockiePaletteForSeed(seed: string): { color: string; bgcolor: string; spotcolor: string } {
  seedrand(seed);
  return {
    color: createColor(),
    bgcolor: createColor(),
    spotcolor: createColor(),
  };
}

function cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const clone = document.createElement("canvas");
  clone.width = source.width;
  clone.height = source.height;
  const ctx = clone.getContext("2d");
  if (ctx) ctx.drawImage(source, 0, 0);
  return clone;
}

/** Cached 64×64 source canvas for the normalized seed (palette + pattern fixed). */
export function getWalletBlockieSourceCanvas(address: string): HTMLCanvasElement {
  const seed = normalizedBlockieSeed(address);
  let cached = canvasCache.get(seed);
  if (!cached) {
    const palette = blockiePaletteForSeed(seed);
    cached = blockies.create({
      seed,
      size: WALLET_BLOCKIE_GRID,
      scale: WALLET_BLOCKIE_SOURCE_SCALE,
      ...palette,
    });
    canvasCache.set(seed, cached);
  }
  return cloneCanvas(cached);
}

/** Test-only: reset memoized canvases between cases. */
export function clearWalletBlockieCanvasCacheForTests(): void {
  canvasCache.clear();
}
