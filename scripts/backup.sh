#!/usr/bin/env bash
# Dated backup of everything that matters: the Postgres database (pg_dump
# through the running compose db container) and the uploaded documents dir.
# Usage: scripts/backup.sh [output-root]   (default: ./backups)
# Run from anywhere; paths resolve relative to the repo root. May need sudo
# where the docker socket isn't group-accessible (e.g. the taxdev container).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_ROOT="${1:-"$REPO_ROOT/backups"}"
STAMP="$(date +%Y-%m-%d_%H%M%S)"
DEST="$OUT_ROOT/$STAMP"
COMPOSE_FILE="$REPO_ROOT/infra/docker-compose.yml"

mkdir -p "$DEST"

echo "==> Dumping Postgres (taxreturns) via the compose db container..."
docker compose -f "$COMPOSE_FILE" exec -T db \
  pg_dump -U tax -d taxreturns >"$DEST/taxreturns.sql"
echo "    $(wc -c <"$DEST/taxreturns.sql") bytes -> $DEST/taxreturns.sql"

# STORAGE_PATH is relative to the process cwd: the api container runs from
# the repo root (/app), local `pnpm --filter` runs from packages/api. Take
# an explicit STORAGE_PATH from packages/api/.env when set and absolute;
# otherwise try both conventional locations.
DOCS_DIR=""
ENV_FILE="$REPO_ROOT/packages/api/.env"
if [[ -f "$ENV_FILE" ]]; then
  CONFIGURED="$(grep -E '^STORAGE_PATH=' "$ENV_FILE" | tail -1 | cut -d= -f2- || true)"
  if [[ -n "${CONFIGURED:-}" && "$CONFIGURED" = /* && -d "$CONFIGURED" ]]; then
    DOCS_DIR="$CONFIGURED"
  fi
fi
if [[ -z "$DOCS_DIR" ]]; then
  for candidate in "$REPO_ROOT/data/documents" "$REPO_ROOT/packages/api/data/documents"; do
    if [[ -d "$candidate" ]]; then
      DOCS_DIR="$candidate"
      break
    fi
  done
fi

if [[ -n "$DOCS_DIR" ]]; then
  echo "==> Archiving documents from $DOCS_DIR ..."
  tar -czf "$DEST/documents.tar.gz" -C "$(dirname "$DOCS_DIR")" "$(basename "$DOCS_DIR")"
  echo "    $(wc -c <"$DEST/documents.tar.gz") bytes -> $DEST/documents.tar.gz"
else
  echo "==> No documents directory found (nothing uploaded yet) — skipping tar."
fi

echo "==> Backup complete: $DEST"
