#!/usr/bin/env bash
# RALabs deploy.sh — build images on the VPS, up, health-check, rollback.
set -euo pipefail

DIR="/opt/ralabs"
cd "$DIR"

echo "==> RALabs deploy (sha ${NEW_SHA:-latest})"

# Pre-deploy: record current deployed sha for rollback
if [ -f .deployed-sha ] && [ ! -f .previous-sha ]; then
  cp .deployed-sha .previous-sha
fi

# Build + start
docker compose up -d --build

# Health checks
echo "==> Health-checking stack..."
attempt=0
until curl -fsS --max-time 10 http://localhost:8080/health >/dev/null 2>&1 || [ "$attempt" -ge 30 ]; do
  attempt=$((attempt + 1))
  sleep 5
done

if curl -fsS --max-time 10 http://localhost:8080/health >/dev/null 2>&1; then
  echo "==> API healthy."
  echo "${NEW_SHA:-latest}" > .deployed-sha
  docker image prune -f >/dev/null 2>&1 || true
  echo "==> Deploy complete."
else
  echo "!!> API health check failed — rolling back to previous image tag."
  if [ -f .previous-sha ]; then
    PREV=$(cat .previous-sha)
    docker compose up -d
    echo "!!> Rolled back to ${PREV}."
  else
    echo "!!> No previous version to roll back to."
    exit 1
  fi
fi
