// SPDX-License-Identifier: AGPL-3.0-only

import { BLOCKIE_HILLS_PLAYLIST, type AlbumTrack } from "./albumPlaylist";
import {
  bgmLinearGainFromPermille,
  sfxCurveGainFromPermille,
  type AudioPrefsV1,
} from "./audioPreferences";
import { SFX_FILES, type SfxId } from "./sfxUrls";

export type PlaySfxOptions = { gainMul?: number };

const PEER_BUY_MIN_GAP_MS = 8500;
const TIMER_CALM_MIN_GAP_MS = 48_000;
const TIMER_URGENT_MIN_GAP_MS = 26_000;

/**
 * Web Audio graph: `bgm` and `sfx` buses into `master` → destination.
 * BGM uses one {@link HTMLAudioElement} + {@link MediaElementAudioSourceNode}
 * so MP3s stream without decoding the whole album into RAM.
 */
export class WebAudioMixer {
  private ctx: AudioContext | null = null;

  private masterGain: GainNode | null = null;

  private bgmGain: GainNode | null = null;

  private sfxGain: GainNode | null = null;

  private mediaSource: MediaElementAudioSourceNode | null = null;

  private audioEl: HTMLAudioElement | null = null;

  private bufferCache = new Map<SfxId, AudioBuffer>();

  private prefs: AudioPrefsV1;

  private trackIndex = 0;

  private lastPeerBuySfxAt = 0;

  private lastTimerCalmAt = 0;

  private lastTimerUrgentAt = 0;

  private onTrackChange: ((t: AlbumTrack, index: number) => void) | null = null;

  private onPlayingChange: ((playing: boolean) => void) | null = null;

  private playlist: readonly AlbumTrack[];

  constructor(initialPrefs: AudioPrefsV1, playlist: readonly AlbumTrack[] = BLOCKIE_HILLS_PLAYLIST) {
    this.prefs = { ...initialPrefs };
    this.playlist = playlist;
  }

  setCallbacks(cb: {
    onTrackChange?: (t: AlbumTrack, index: number) => void;
    onPlayingChange?: (playing: boolean) => void;
  }) {
    this.onTrackChange = cb.onTrackChange ?? null;
    this.onPlayingChange = cb.onPlayingChange ?? null;
  }

  getAudioContextState(): AudioContextState | "uncreated" {
    return this.ctx?.state ?? "uncreated";
  }

  isRunning(): boolean {
    return this.ctx?.state === "running";
  }

  applyPrefs(p: AudioPrefsV1) {
    this.prefs = { ...p };
    this.syncGainNodes();
  }

  getTrackIndex(): number {
    return this.trackIndex;
  }

  getCurrentTrack(): AlbumTrack {
    return this.playlist[this.trackIndex] ?? this.playlist[0];
  }

  /** Must run from a user gesture before BGM / SFX are audible. */
  async unlock(): Promise<void> {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      const ctx = this.ctx;
      const masterGain = ctx.createGain();
      const bgmGain = ctx.createGain();
      const sfxGain = ctx.createGain();
      this.masterGain = masterGain;
      this.bgmGain = bgmGain;
      this.sfxGain = sfxGain;
      bgmGain.connect(masterGain);
      sfxGain.connect(masterGain);
      masterGain.connect(ctx.destination);

      const audioEl = new Audio();
      this.audioEl = audioEl;
      audioEl.crossOrigin = "anonymous";
      audioEl.preload = "auto";
      audioEl.addEventListener("ended", () => this.advanceAfterTrackEnded());

      this.mediaSource = ctx.createMediaElementSource(audioEl);
      this.mediaSource.connect(bgmGain);
      this.syncGainNodes();
    }
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
  }

  private syncGainNodes() {
    if (!this.masterGain || !this.bgmGain || !this.sfxGain) return;
    const m = this.prefs.masterMuted ? 0 : 1;
    this.masterGain.gain.value = m;
    const bgm =
      this.prefs.bgmMuted || this.prefs.masterMuted
        ? 0
        : bgmLinearGainFromPermille(this.prefs.bgmPermille);
    this.bgmGain.gain.value = bgm;
    const sfx =
      this.prefs.sfxMuted || this.prefs.masterMuted
        ? 0
        : sfxCurveGainFromPermille(this.prefs.sfxPermille);
    this.sfxGain.gain.value = sfx;
  }

  /** Start or resume BGM from the current playlist index. */
  async playBgm(): Promise<void> {
    await this.unlock();
    if (!this.audioEl || this.playlist.length === 0) return;
    const t = this.getCurrentTrack();
    const resolved = new URL(t.src, window.location.href).href;
    if (this.audioEl.src !== resolved) {
      this.audioEl.src = t.src;
    }
    try {
      await this.audioEl.play();
      this.onPlayingChange?.(true);
    } catch {
      this.onPlayingChange?.(false);
    }
  }

  pauseBgm() {
    this.audioEl?.pause();
    this.onPlayingChange?.(false);
  }

  isBgmPlaying(): boolean {
    return Boolean(this.audioEl && !this.audioEl.paused);
  }

  skipBgmNext() {
    const playing = this.isBgmPlaying();
    this.bumpTrackIndex();
    if (!this.audioEl) return;
    this.audioEl.src = this.getCurrentTrack().src;
    if (playing) {
      void this.audioEl.play().catch(() => this.onPlayingChange?.(false));
    }
  }

  private bumpTrackIndex() {
    const n = this.playlist.length;
    if (n === 0) return;
    this.trackIndex = (this.trackIndex + 1) % n;
    const t = this.getCurrentTrack();
    this.onTrackChange?.(t, this.trackIndex);
  }

  /** Natural end-of-track: always continue the album loop. */
  private advanceAfterTrackEnded() {
    this.bumpTrackIndex();
    if (!this.audioEl) return;
    this.audioEl.src = this.getCurrentTrack().src;
    void this.audioEl.play().catch(() => this.onPlayingChange?.(false));
  }

  async prefetchSfx(ids: readonly SfxId[]): Promise<void> {
    await this.unlock();
    if (!this.ctx) return;
    await Promise.all(ids.map((id) => this.ensureBuffer(id)));
  }

  private async ensureBuffer(id: SfxId): Promise<AudioBuffer | null> {
    if (!this.ctx) return null;
    const hit = this.bufferCache.get(id);
    if (hit) return hit;
    const url = SFX_FILES[id];
    const res = await fetch(url);
    if (!res.ok) return null;
    const arr = await res.arrayBuffer();
    const buf = await this.ctx.decodeAudioData(arr.slice(0));
    this.bufferCache.set(id, buf);
    return buf;
  }

  async playSfx(id: SfxId, opts?: PlaySfxOptions): Promise<void> {
    await this.unlock();
    if (!this.ctx || !this.sfxGain) return;
    if (this.prefs.masterMuted || this.prefs.sfxMuted) return;
    const buf = await this.ensureBuffer(id);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    const mul = opts?.gainMul ?? 1;
    g.gain.value = Math.max(0, Math.min(2, mul));
    src.buffer = buf;
    src.connect(g);
    g.connect(this.sfxGain);
    src.start(0);
  }

  playPeerBuyDistantThrottled(): void {
    const now = performance.now();
    if (now - this.lastPeerBuySfxAt < PEER_BUY_MIN_GAP_MS) return;
    this.lastPeerBuySfxAt = now;
    void this.playSfx("peer_buy_distant", { gainMul: 0.85 });
  }

  playTimerCalmThrottled(): void {
    const now = performance.now();
    if (now - this.lastTimerCalmAt < TIMER_CALM_MIN_GAP_MS) return;
    this.lastTimerCalmAt = now;
    void this.playSfx("timer_heartbeat_calm", { gainMul: 0.9 });
  }

  playTimerUrgentThrottled(): void {
    const now = performance.now();
    if (now - this.lastTimerUrgentAt < TIMER_URGENT_MIN_GAP_MS) return;
    this.lastTimerUrgentAt = now;
    void this.playSfx("timer_heartbeat_urgent", { gainMul: 0.95 });
  }
}
