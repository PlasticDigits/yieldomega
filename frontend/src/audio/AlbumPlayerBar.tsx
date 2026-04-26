// SPDX-License-Identifier: AGPL-3.0-only

import { useAudioEngine } from "./useAudioEngine";

/**
 * Compact BGM chrome for the app header (GitLab #68): play/pause, skip,
 * track title, BGM mute, master mute, BGM + SFX volume.
 */
export function AlbumPlayerBar() {
  const a = useAudioEngine();

  return (
    <div className="album-player" data-sfx-ignore="true" aria-label="Background music">
      <span className="album-player__title" title={a.currentTrack.title}>
        {a.unlocked ? a.currentTrack.title : "Interact to enable audio — then Play for BGM"}
      </span>
      <div className="album-player__transport">
        <button
          type="button"
          className="album-player__btn"
          onClick={() => void a.toggleBgm()}
          aria-pressed={a.bgmPlaying}
          aria-label={a.bgmPlaying ? "Pause music" : "Play music"}
        >
          {a.bgmPlaying ? "Pause" : "Play"}
        </button>
        <button type="button" className="album-player__btn" onClick={() => a.skipBgm()} aria-label="Next track">
          Skip
        </button>
      </div>
      <label className="album-player__vol">
        <span className="album-player__vol-label">BGM</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(a.bgmPermille / 10)}
          onChange={(e) => a.setBgmPermille(Number(e.target.value) * 10)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(a.bgmPermille / 10)}
          aria-label="Background music volume percent"
        />
      </label>
      <label className="album-player__vol">
        <span className="album-player__vol-label">SFX</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(a.sfxPermille / 10)}
          onChange={(e) => a.setSfxPermille(Number(e.target.value) * 10)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(a.sfxPermille / 10)}
          aria-label="Sound effects volume percent"
        />
      </label>
      <div className="album-player__mutes">
        <button
          type="button"
          className={`album-player__pill${a.bgmMuted ? " album-player__pill--active" : ""}`}
          onClick={() => a.setBgmMuted(!a.bgmMuted)}
          aria-pressed={a.bgmMuted}
        >
          BGM mute
        </button>
        <button
          type="button"
          className={`album-player__pill${a.sfxMuted ? " album-player__pill--active" : ""}`}
          onClick={() => a.setSfxMuted(!a.sfxMuted)}
          aria-pressed={a.sfxMuted}
        >
          SFX mute
        </button>
        <button
          type="button"
          className={`album-player__pill${a.masterMuted ? " album-player__pill--active" : ""}`}
          onClick={() => a.setMasterMuted(!a.masterMuted)}
          aria-pressed={a.masterMuted}
        >
          All mute
        </button>
      </div>
    </div>
  );
}
