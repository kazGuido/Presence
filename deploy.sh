#!/usr/bin/env bash
# Canonical production deploy: always attaches api to NPM Docker networks.
# Usage: ./deploy.sh   or   bash deploy.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.npm.yml)

echo "==> Building and starting stack (with NPM network overlay)..."
"${COMPOSE[@]}" up -d --build

echo "==> Compose status:"
"${COMPOSE[@]}" ps

NPM_CANDIDATES=(nginx-proxy-manager nginxproxymanager npm-app)
NPM_CONTAINER=""
for name in "${NPM_CANDIDATES[@]}"; do
  if docker ps --format '{{.Names}}' | grep -qx "$name"; then
    NPM_CONTAINER="$name"
    break
  fi
done

if [[ -n "$NPM_CONTAINER" ]]; then
  echo "==> Smoke test from NPM container ($NPM_CONTAINER) -> http://api:8000/health"
  if out=$(docker exec "$NPM_CONTAINER" sh -c 'command -v wget >/dev/null 2>&1 && wget -qO- http://api:8000/health || curl -fsS http://api:8000/health'); then
    echo "$out"
    echo "OK: NPM can reach the API on the shared Docker network."
  else
    echo "WARN: Could not reach api:8000 from $NPM_CONTAINER. Check NPM Proxy Host forwards to hostname api port 8000 (http)."
    exit 1
  fi
else
  echo "NOTE: No NPM container detected — skipped in-container smoke test. Verify manually when NPM is on this host."
fi

echo "==> Host check (published API port):"
PORT=8000
if [[ -f "$ROOT/.env" ]]; then
  P=$(grep -E '^API_PORT=' "$ROOT/.env" 2>/dev/null | head -1 | cut -d= -f2- | tr -d ' \r' || true)
  if [[ -n "$P" ]]; then PORT="$P"; fi
fi
if curl -fsS "http://127.0.0.1:${PORT}/health" 2>/dev/null; then
  echo ""
else
  echo "WARN: curl http://127.0.0.1:${PORT}/health failed (set API_PORT in .env if you use a non-default port)."
fi
