# Minimax Music 2.6 (Replicate) — instrumental only

This folder contains scripts to generate **instrumental** background music via Replicate (`minimax/music-2.6`). **Vocal tracks are intentionally not supported here** — every run sets `is_instrumental: true` and does not send `lyrics`.

## Setup

```bash
cd scripts/replicate-music
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

Authentication: set `REPLICATE_API_TOKEN` in the environment or in (first match wins; later files fill unset keys):

- Repository root: `<repo>/.env`
- This directory: `<repo>/scripts/replicate-music/.env`
- Optional: `<repo>/frontend/.env` / `frontend/.env.local`

Long generations: if predictions hit the wall-clock cap, raise `REPLICATE_MAX_GENERATION_SECONDS` (default `600`). Music can approach several minutes plus queue time.

### Why Replicate shows the “same” prompt several times

`--all-concepts` runs **concept 1, then 2, then 3** in order. If the process is **stopped or retried** before concepts 2–3 start, the next run **starts concept 1 again**, so the dashboard can show **multiple `concept-01` jobs** (same first prompt). That is not one Python loop firing the same prompt three times in parallel; it is **several separate runs** each beginning at concept 1. Cancel stray jobs you do not need in the Replicate UI.

After concept 1 finishes and is saved under `output/`, use **`--resume`** so a retry skips files that already exist and continues with concepts 2–3:

```bash
python generate_instrumental.py --all-concepts --resume
```

### Full album (8 tracks per part; unified style bible)

`generate_album.py` runs **album part 1** or **part 2**: the same **style bible** on every track (cheerful fantasy arcade + hills / hat-coin energy), with **unique** BPM, key, and arrangement per song. Part 2 uses **new titles and scenes** in the same world.

| Part | Output dir | Manifest |
|------|------------|----------|
| 1 (default) | `output/album_part_1/` | `manifest_album_part_1.json` |
| 2 | `output/album_part_2/` | `manifest_album_part_2.json` |

```bash
python generate_album.py --list                 # part 1 track list (default)
python generate_album.py --part 2 --list        # part 2 track list
python generate_album.py --all                  # part 1: generate 01–08
python generate_album.py --part 2 --all         # part 2: generate 01–08
python generate_album.py --part 2 --track 5     # one part-2 track only
python generate_album.py --part 2 --all --resume
python generate_album.py --all --dry-run
```

### Download a succeeded prediction (missing local file)

If Replicate shows **Succeeded** but the MP3 never landed locally (network drop, etc.):

```bash
python download_replicate_prediction.py 166sxmx1hhrmr0cxs2ft1bs0dr \\
  --out output/album_part_1/06-starline-overworld.mp3
```

Use the id from `https://replicate.com/p/<id>`. If the file already exists and is ≥512 bytes, the script skips.

### Trim lead-in clicks / HF squeak (ffmpeg)

Many generative MP3s have a short ugly transient at **t = 0**. Trimming **~0.12–0.20 s** with **ffmpeg** (re-encode) fixes most of it without a DAW:

```bash
python trim_lead_in.py --dir output/album_part_1 --skip 0.15
# writes sibling files like 01-hills-dawn_leadtrim.mp3
```

Tune `--skip` (seconds) until the scratch is gone; if you cut into music, reduce it. Alternatives: **SoX** `sox in.mp3 out.mp3 trim 0.15`, or **Audacity** “Truncate Silence” / select start + delete.

## Usage

Generate the three **album concept** instrumentals (writes under `output/`):

```bash
python generate_instrumental.py --all-concepts
```

Single concept (`1`, `2`, or `3`):

```bash
python generate_instrumental.py --concept 1
```

Custom prompt (still **instrumental only**):

```bash
python generate_instrumental.py --prompt "D minor, 92 BPM, solo piano, intimate, no vocals" --out output/custom.mp3
```

Smaller files (still usually acceptable on laptop speakers):

```bash
python generate_instrumental.py --all-concepts --sample-rate 32000 --bitrate 128000 --audio-format mp3
```

Even smaller (thinner but compact):

```bash
python generate_instrumental.py --concept 2 --sample-rate 24000 --bitrate 64000
```

Dry run (print inputs only):

```bash
python generate_instrumental.py --all-concepts --dry-run
```

---

## Model reference: `minimax/music-2.6` (from Replicate / MiniMax docs)

### Inputs

| Field | Description |
|--------|-------------|
| **lyrics** | Up to 3,500 characters. **Required for vocal tracks** (unless `lyrics_optimizer` is enabled). Use structure tags for arrangement: `[Intro]`, `[Verse]`, `[Pre Chorus]`, `[Chorus]`, `[Hook]`, `[Drop]`, `[Bridge]`, `[Solo]`, `[Build Up]`, `[Inst]`, `[Interlude]`, `[Break]`, `[Transition]`, `[Outro]`. Use `\n` between lines and `\n\n` for pauses between sections. |
| **prompt** | Style, mood, scenario (up to 2,000 characters). **Required for instrumental mode.** |
| **is_instrumental** | `true` = instrumental, no vocals. When enabled, **prompt is required** and **lyrics is not needed**. Default: `false`. **This repo’s scripts always set `true`.** |
| **lyrics_optimizer** | `true` = auto-generate lyrics from prompt when lyrics empty. Default: `false`. Not used for instrumental-only runs here. |
| **sample_rate** | `16000`, `24000`, `32000`, `44100` (default). |
| **bitrate** | `32000`, `64000`, `128000`, `256000` (default). |
| **audio_format** | `mp3` (default), `wav`, or `pcm`. |

### Quick start examples (from docs)

Song with lyrics and BPM/key control:

```json
{
  "prompt": "E minor, 90 BPM, acoustic guitar ballad, male vocal, emotional",
  "lyrics": "[Verse]\nWalking through the rain...\n[Chorus]\nBut I still remember you"
}
```

**Instrumental track** (what we use):

```json
{
  "prompt": "Cinematic orchestral, epic and dramatic, full symphony",
  "is_instrumental": true
}
```

Auto-generated lyrics (not used in this folder):

```json
{
  "prompt": "Upbeat pop, summer vibes, feel-good, catchy melody",
  "lyrics_optimizer": true
}
```

### Prompt guide

Good prompts often follow:

**[Key], [BPM], [Genre], [Mood/Emotion], [Vocal description], [Key instruments], [Production style]**

Not every element is required. Music 2.6 is strong at **exact BPM and key** when specified.

| Element | Role | Examples |
|--------|------|----------|
| Key | Musical key | E minor, C major, Bb minor |
| BPM | Tempo | 75, 90, 120, 140 BPM |
| Genre | Foundation | Pop, Jazz, EDM, Classical, Lo-fi |
| Mood | Emotional tone | Melancholic, uplifting, dreamy |
| Vocal style | (Skip for instrumental — we still avoid “choir” / “vocals” in prompts) | — |
| Instruments | Specific sounds | Piano, synth bass, strings |
| Production | Sonic character | Lo-fi, wide soundstage, warm reverb |

### Structure tags (for vocal arrangements; optional if you ever fork lyrics mode)

`[Intro]`, `[Verse]`, `[Pre Chorus]`, `[Chorus]`, `[Post Chorus]`, `[Hook]`, `[Drop]`, `[Bridge]`, `[Solo]`, `[Inst]`, `[Build Up]`, `[Interlude]`, `[Break]`, `[Transition]`, `[Outro]`

### Good to know

- Max song length: up to **~6 minutes**; many outputs land **2–4 minutes**.
- BPM/key: specify in prompt for high accuracy.
- Strongest language support: English and Mandarin; others may be less consistent for any future vocal use.
- Each generation is **unique**; MiniMax docs mention a **`seed`** (`0`–`1_000_000`) for reproducibility, but the Replicate **`minimax/music-2.6`** API currently rejects that field, so this script does not send it.
- Higher quality: `44100` sample rate, `256000` bitrate, `wav` for production mastering.

### Python example (Replicate client)

```python
import replicate

output = replicate.run(
    "minimax/music-2.6",
    input={
        "lyrics": "[Verse]\nWalking through the rain tonight\n...",
        "prompt": "E minor, 90 BPM, acoustic guitar ballad, male vocal, emotional, intimate studio feel"
    }
)

print(output.url)
with open("track.mp3", "wb") as file:
    file.write(output.read())
```

Our script uses the **bounded** client helper from `scripts/replicate-art/replicate_bounded_run.py` for a wall-clock cap and cancellation behavior consistent with other Replicate jobs in this repo.
