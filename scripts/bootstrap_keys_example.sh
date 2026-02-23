#!/usr/bin/env bash
# scripts/bootstrap_keys_example.sh
# Creates keys.env from keys.env.example if it doesn't already exist.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
EXAMPLE="$ROOT_DIR/keys.env.example"
TARGET="$ROOT_DIR/keys.env"

if [ ! -f "$EXAMPLE" ]; then
  echo "ERROR: keys.env.example not found at $EXAMPLE" >&2
  exit 1
fi

if [ -f "$TARGET" ]; then
  echo "keys.env already exists — skipping. Edit it to update your keys."
else
  cp "$EXAMPLE" "$TARGET"
  echo "Created keys.env from keys.env.example"
  echo "=> Fill in your real API keys in: $TARGET"
fi
