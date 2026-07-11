# TaxReturns

Israeli personal tax-return assistant. See
`docs/superpowers/specs/2026-07-03-tax-returns-app-design.md`.

## Quick start

1. `cp .env.example .env` and fill in `ANTHROPIC_API_KEY`.
2. `docker compose -f infra/docker-compose.yml up -d db`
3. `pnpm install`
4. `pnpm --filter @taxreturns/api db:migrate`
5. `pnpm --filter @taxreturns/api dev` and `pnpm --filter @taxreturns/web dev`

Development is intended to happen inside the dev container (`.devcontainer/`),
which ships Node 22, pnpm, and Claude Code.

## Backups

`scripts/backup.sh [output-root]` writes a dated directory (default
`backups/<timestamp>/`) containing a full `pg_dump` of the database (taken
through the running compose `db` container) and a tar of the uploaded
documents directory. Requires the db container to be running.
