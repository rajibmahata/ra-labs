#!/usr/bin/env bash
# RALabs healthcheck.sh — verify container health + public reachability.
set -euo pipefail
DIR="/opt/ralabs"
cd "$DIR"
echo "==> Containers:"
docker compose ps
echo "==> API health:"
curl -fsS --max-time 10 http://localhost:8080/health || echo "!! API unhealthy"
echo "==> Public site:"
curl -fsS --max-time 10 -o /dev/null -w "public HTTP %{http_code}\n" http://localhost/ || echo "!! public site unreachable"
echo "==> Admin:"
curl -fsS --max-time 10 -o /dev/null -w "admin HTTP %{http_code}\n" http://localhost/admin/ || echo "!! admin unreachable"
