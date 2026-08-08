#!/usr/bin/env bash
# RALabs rollback.sh — redeploy previous image tag.
set -euo pipefail
cd /opt/ralabs
if [ -f .previous-sha ]; then
  PREV=$(cat .previous-sha)
  echo "==> Rolling back to ${PREV}"
  docker compose up -d
  echo "$PREV" > .deployed-sha
  echo "==> Rolled back."
else
  echo "!! No previous sha recorded."
  exit 1
fi
