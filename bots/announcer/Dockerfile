# SPDX-License-Identifier: AGPL-3.0-only
# TimeArena buy-announcement bot for Coolify / Docker (MegaETH mainnet).
#
# Build (from bots/announcer — Coolify default context):
#   docker build -t yieldomega-announcer .
#
# Build (from repository root):
#   docker build -f bots/announcer/Dockerfile -t yieldomega-announcer bots/announcer
#
# Run (set env vars — see bots/announcer/README.md):
#   docker run --rm \
#     -v announcer-data:/data \
#     -e TELEGRAM_BOT_TOKEN=… \
#     -e TELEGRAM_CHAT_ID=… \
#     yieldomega-announcer

FROM python:3.12-slim

WORKDIR /app

COPY announce.py .

ENV PYTHONUNBUFFERED=1
ENV CURSOR_FILE=/data/announce-cursor.json

CMD ["python3", "announce.py"]
