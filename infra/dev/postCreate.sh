#!/usr/bin/env bash
set -euo pipefail

# the named volume mounts root-owned on first run
sudo chown -R ubuntu:ubuntu ~/.claude

pnpm install

claude plugin install superpowers@claude-plugins-official || true

echo "Dev container ready. Run 'claude' to start."
