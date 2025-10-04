#!/bin/sh
set -e

# Move to backend folder containing Alembic config
cd /opt/mtmon/backend

# Ensure data directory exists (works for default sqlite path in container)
mkdir -p /data || true

# Use override if provided, else env.py derives from backend.db
if [ -z "$ALEMBIC_SQLALCHEMY_URL" ]; then
  export ALEMBIC_SQLALCHEMY_URL="sqlite:////data/nodes.db"
fi

# Apply migrations to latest
alembic upgrade head

# Start the application
exec uvicorn backend.main:app --host 0.0.0.0 --port 8000


