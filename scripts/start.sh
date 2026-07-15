#!/bin/bash
# start.sh — Run seed + start production server (for non-Docker deployments)
# Usage: ./scripts/start.sh

set -e

echo "=== Help Desk IM — Starting ==="
echo ""

# Run seed (safe to run multiple times — skips existing users)
echo "→ Seeding database..."
npx tsx scripts/seed.ts
echo "✓ Seed complete"
echo ""

# Start production server
echo "→ Starting server on port ${PORT:-3000}..."
exec node server.js
