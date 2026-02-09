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

echo "Starting backend on port 8000..."
uvicorn services.api.main:app --host 0.0.0.0 --port 8000 --reload
