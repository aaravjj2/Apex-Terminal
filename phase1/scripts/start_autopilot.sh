#!/bin/bash
# Startup script for autopilot paper trading system
# Exports all environment variables and starts services

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=== Paper Trading Autopilot Startup ==="
echo "Project root: $PROJECT_ROOT"

# Load environment variables from keys.env
export_env_file() {
    local env_file="$1"
    if [ -f "$env_file" ]; then
        echo "Loading environment from: $env_file"
        while IFS='=' read -r key value; do
            # Skip comments and empty lines
            [[ "$key" =~ ^#.*$ ]] && continue
            [[ -z "$key" ]] && continue
            # Remove leading/trailing whitespace
            key=$(echo "$key" | xargs)
            value=$(echo "$value" | xargs)
            # Skip if still empty
            [[ -z "$key" ]] && continue
            # Handle keys with spaces (convert to underscore)
            key=$(echo "$key" | tr ' ' '_')
            # Export variable
            export "$key=$value"
        done < "$env_file"
    fi
}

# Load from root keys.env
export_env_file "$PROJECT_ROOT/keys.env"

# Also set normalized variable names
export GEMINI_API_KEY="${Gemini_API_Key:-${GEMINI_API_KEY:-}}"
export TRADIER_API_KEY="${Tradier_Brokerage_Key:-${TRADIER_API_KEY:-}}"
export TRADIER_SANDBOX_KEY="${Tradier_Sandbox_key:-}"

# Set LLM mode (default to hybrid for full testing)
export LLM_MODE="${LLM_MODE:-hybrid}"

# Print configured variables
echo ""
echo "=== Environment Configuration ==="
echo "LLM_MODE: $LLM_MODE"
echo "GROQ_API_KEY: ${GROQ_API_KEY:0:10}..."
echo "GEMINI_API_KEY: ${GEMINI_API_KEY:0:10}..."
echo "TRADIER_API_KEY: ${TRADIER_API_KEY:0:10}..."
echo "APCA_API_KEY_ID: ${APCA_API_KEY_ID:0:10}..."
echo ""

# Check required keys
missing=0
if [ -z "$GROQ_API_KEY" ]; then
    echo "WARNING: GROQ_API_KEY not set"
    missing=1
fi
if [ -z "$APCA_API_KEY_ID" ]; then
    echo "WARNING: APCA_API_KEY_ID not set"
    missing=1
fi

if [ $missing -eq 1 ]; then
    echo ""
    echo "Some API keys are missing. System will use fallback modes."
fi

# Start backend
start_backend() {
    echo ""
    echo "=== Starting Backend (FastAPI) ==="
    cd "$PROJECT_ROOT/phase1"
    
    # Check if venv exists
    if [ -d "venv" ]; then
        source venv/bin/activate
    elif [ -d ".venv" ]; then
        source .venv/bin/activate
    fi
    
    # Install dependencies if needed
    if ! python -c "import fastapi" 2>/dev/null; then
        echo "Installing Python dependencies..."
        pip install -r requirements.txt
    fi
    
    # Start uvicorn
    echo "Starting uvicorn on port 8000..."
    python -m uvicorn services.api.main:app --host 0.0.0.0 --port 8000 --reload &
    BACKEND_PID=$!
    echo "Backend PID: $BACKEND_PID"
    
    # Wait for backend to be ready
    echo "Waiting for backend..."
    for i in {1..30}; do
        if curl -s http://localhost:8000/health > /dev/null 2>&1; then
            echo "Backend is ready!"
            break
        fi
        sleep 1
    done
}

# Start frontend
start_frontend() {
    echo ""
    echo "=== Starting Frontend (Vite) ==="
    cd "$PROJECT_ROOT/frontend"
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "Installing npm dependencies..."
        npm install
    fi
    
    # Start Vite dev server
    echo "Starting Vite on port 5173..."
    npm run dev &
    FRONTEND_PID=$!
    echo "Frontend PID: $FRONTEND_PID"
    
    # Wait for frontend
    echo "Waiting for frontend..."
    for i in {1..30}; do
        if curl -s http://localhost:5173 > /dev/null 2>&1; then
            echo "Frontend is ready!"
            break
        fi
        sleep 1
    done
}

# Main
case "${1:-all}" in
    backend)
        start_backend
        wait
        ;;
    frontend)
        start_frontend
        wait
        ;;
    all)
        start_backend
        start_frontend
        echo ""
        echo "=== Services Started ==="
        echo "Backend:  http://localhost:8000"
        echo "API Docs: http://localhost:8000/docs"
        echo "Frontend: http://localhost:5173"
        echo ""
        echo "Press Ctrl+C to stop all services"
        wait
        ;;
    *)
        echo "Usage: $0 [backend|frontend|all]"
        exit 1
        ;;
esac
