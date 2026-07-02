# SPDX-License-Identifier: AGPL-3.0-only
# TimeArena fun-fleet bot for Coolify / Docker (MegaETH mainnet or any RPC).
#
# Build (from repository root):
#   docker build -f bots/timearena/Dockerfile -t yieldomega-fun-fleet .
#
# Run (set env vars — see bots/timearena/README.md § run-fun-x):
#   docker run --rm -e YIELDOMEGA_RPC_URL=… -e KEY_1=… -e MEAN_1=… yieldomega-fun-fleet

FROM python:3.12-slim

WORKDIR /app

COPY bots/timearena/pyproject.toml bots/timearena/README.md /app/bots/timearena/
COPY bots/timearena/src /app/bots/timearena/src

RUN pip install --no-cache-dir /app/bots/timearena

WORKDIR /app/bots/timearena

ENV PYTHONUNBUFFERED=1

CMD ["timearena-bot", "--send", "run-fun-x"]
