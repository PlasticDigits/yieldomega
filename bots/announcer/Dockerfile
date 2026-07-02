# SPDX-License-Identifier: AGPL-3.0-only
# TimeArena buy-announcement bot for Coolify / Docker (MegaETH mainnet).
#
# Build (from repository root):
#   docker build -f bots/announcer/Dockerfile -t yieldomega-announcer .
#
# Run (set env vars — see bots/announcer/README.md):
#   docker run --rm \
#     -v announcer-data:/data \
#     -e TELEGRAM_BOT_TOKEN=… \
#     -e TELEGRAM_CHAT_ID=… \
#     yieldomega-announcer

FROM python:3.12-slim

WORKDIR /app

COPY bots/announcer/announce.py .

ENV PYTHONUNBUFFERED=1
ENV CURSOR_FILE=/data/announce-cursor.json

CMD ["python3", "announce.py"]
