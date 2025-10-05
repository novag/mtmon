#!/bin/sh
set -e

# Move to backend folder containing Alembic config
cd /opt/mtmon/backend

# Ensure database directory exists, based on DB_PATH (default: data/nodes.db)
DB_PATH_EFFECTIVE="${DB_PATH:-data/nodes.db}"
DB_DIR="$(dirname "$DB_PATH_EFFECTIVE")"
mkdir -p "$DB_DIR" || true

# Move to project root
cd /opt/mtmon/

# Apply migrations to latest
alembic upgrade head

# Move to backend folder
cd backend/

# Start the application
exec uvicorn backend.main:app --host 0.0.0.0 --port 8000


