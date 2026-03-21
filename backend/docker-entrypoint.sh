#!/bin/sh
# docker-entrypoint.sh
#
# Runs database migrations (idempotent) before starting the main process.
# Using `migrate deploy` (not `migrate dev`) — safe for production: only
# applies pending migrations, never auto-generates new ones.
#
# The worker service also uses this image; we skip migrations there by
# checking SKIP_MIGRATE=true in the worker's docker-compose environment block.

set -e

if [ "${SKIP_MIGRATE}" != "true" ]; then
  echo "[entrypoint] Running database migrations..."
  npx prisma migrate deploy
  echo "[entrypoint] Migrations complete."
fi

exec "$@"
