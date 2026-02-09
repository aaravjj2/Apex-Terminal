#!/bin/bash
# Run the application in DEMO mode (no API keys required)
# Uses mock/fixture data for demonstration purposes

set -e
cd "$(dirname "$0")/.."

export DEMO_MODE=1
export PAPER_TRADING=1
export PROFILE=demo

echo "============================================"
echo "  🚀 Starting in DEMO MODE (no keys needed)"
echo "============================================"
echo ""
echo "Backend will use mock data for Alpaca/Finnhub"
echo "Frontend will connect to http://localhost:8000"
echo ""

# Start backend in background
echo "Starting backend..."
cd phase1
if [ -d "venv" ]; then source venv/bin/activate; fi
if [ -d "../venv" ]; then source ../venv/bin/activate; fi
pip install -r requirements.txt -q 2>/dev/null || true
nohup uvicorn services.api.main:app --host 0.0.0.0 --port 8000 > ../uvicorn.out 2>&1 &
BACKEND_PID=$!
cd ..

echo "Backend started (PID: $BACKEND_PID)"
echo "Waiting for backend to be ready..."
sleep 3

# Start frontend
echo "Starting frontend..."
cd frontend
if [ ! -d "node_modules" ]; then npm install; fi
npm run dev &
FRONTEND_PID=$!

echo ""
echo "============================================"
echo "  ✅ Demo is running!"
echo "============================================"
echo "  Frontend: http://localhost:5100"
echo "  Backend:  http://localhost:8000"
echo "  API Docs: http://localhost:8000/docs"
echo ""
echo "  Press Ctrl+C to stop all services"
echo "============================================"

# Handle cleanup on exit
cleanup() {
    echo ""
    echo "Stopping services..."
    kill $FRONTEND_PID 2>/dev/null || true
    kill $BACKEND_PID 2>/dev/null || true
    echo "Done."
}
trap cleanup EXIT

# Wait for frontend
wait $FRONTEND_PID
