# `art/posts/` — numbered social post stills

Static images for **X / Farcaster / Telegram** style posts. Served as `/art/posts/<NNN>.jpg` (no bundler hash). Filenames use **three-digit ids** (`001` … `006`) aligned with the editorial post list in the batch script.

## Generation

From the repo:

```bash
cd scripts/replicate-art
.venv/bin/python -m pip install -r requirements.txt   # once
export REPLICATE_API_TOKEN=r8_…   # or use .env — see script docstring
.venv/bin/python posts_batch.py
```

Same secret locations as other Replicate art tools: repository `.env`, `scripts/replicate-art/.env`, or `frontend/.env` / `frontend/.env.local` (`REPLICATE_API_TOKEN`). See [`scripts/replicate-art/posts_batch.py`](../../../../scripts/replicate-art/posts_batch.py) for flags (`--dry-run`, `--only`, `--skip-existing`).

## Variety when adding posts

Do **not** treat this folder as six copies of the same hero composition. When extending [`posts_batch.py`](../../../../scripts/replicate-art/posts_batch.py), deliberately **mix**:

- **`infographic` jobs:** charts, triptychs, timelines — the script **allows** chunky cartoon headlines, section titles, and short chart callouts (see `post_kind` in the batch).
- **`story` jobs:** character-first scenes — prompts follow the main art pipeline rule: **no** captions, speech bubbles, or slogan type; storytelling is pictorial only.

If Replicate succeeded but files never landed locally (interrupted terminal, etc.), pull by prediction id in **001→006 order**:

```bash
cd scripts/replicate-art
.venv/bin/python posts_batch.py --pull-replicate-predictions 'id001,id002,id003,id004,id005,id006'
```

Alternating “chart post” vs “story post” keeps the feed from looking like one template.

## License

Generated drops follow the repo default (**AGPL-3.0-only** alongside [`LICENSE`](../../../../LICENSE)); see [`docs/licensing.md`](../../../../docs/licensing.md).
