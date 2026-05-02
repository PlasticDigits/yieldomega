// SPDX-License-Identifier: AGPL-3.0-only

import type { WebAudioMixer, PlaySfxOptions } from "./WebAudioMixer";
import type { SfxId } from "./sfxUrls";

export type { PlaySfxOptions };

let mixer: WebAudioMixer | null = null;

export function registerGameAudioEngine(m: WebAudioMixer | null) {
  mixer = m;
}

export function playGameSfx(id: SfxId, opts?: PlaySfxOptions): void {
  void mixer?.playSfx(id, opts);
}

/** After wallet returns **`tx` hash** for TimeCurve **`buy`** / **`buyViaKumbaya`** (GitLab #68). */
export function playGameSfxCoinHitBuySubmit(): void {
  playGameSfx("coin_hit_shallow", { gainMul: 0.9 });
}

export function playGameSfxWarbowTwangThrottled(): void {
  mixer?.playWarbowTwangThrottled();
}

export function playGameSfxPeerBuyThrottled(): void {
  mixer?.playPeerBuyDistantThrottled();
}

export function playGameSfxTimerCalmThrottled(): void {
  mixer?.playTimerCalmThrottled();
}

export function playGameSfxTimerUrgentThrottled(): void {
  mixer?.playTimerUrgentThrottled();
}
