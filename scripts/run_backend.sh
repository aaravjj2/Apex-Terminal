#!/bin/bash
# Run the backend API server

set -e
cd "$(dirname "$0")/.."

# Check for virtual environment
if [ -d "phase1/venv" ]; then
    source phase1/venv/bin/activate
elif [ -d "venv" ]; then
    source venv/bin/activate
fi

# Load environment variables if keys.env exists
if [ -f "phase1/keys.env" ]; then
    set -a
    source phase1/keys.env
    set +a
fi

cd phase1

# Install dependencies if needed
if [ ! -d "venv" ] && [ ! -d "../venv" ]; then
    echo "Installing Python dependencies..."
    pip install -r requirements.txt
fi

# Use 8001 when 8000 is occupied by another service
BACKEND_PORT="${APEX_BACKEND_PORT:-8000}"
if curl -s --max-time 1 "http://localhost:8000/" 2>/dev/null | grep -qv "Apex Terminal"; then
  if curl -s --max-time 1 "http://localhost:8000/health" >/dev/null 2>&1; then
    BACKEND_PORT="${APEX_BACKEND_PORT:-8001}"
  fi
fi
export APEX_BACKEND_PORT="$BACKEND_PORT"
echo "Starting backend on port $BACKEND_PORT..."
exec "$PWD/venv/bin/python" -m uvicorn services.api.main:app \
  --host 0.0.0.0 --port "$BACKEND_PORT" --reload --app-dir "$PWD"
