#!/bin/bash

# Kill any existing processes on ports 8000 (Backend) and 5100 (Frontend)
fuser -k 8000/tcp 2>/dev/null
fuser -k 5100/tcp 2>/dev/null

# Start Backend
echo "Starting Backend..."
cd phase1
source venv/bin/activate
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
cd ..

# Start Frontend
echo "Starting Frontend..."
cd frontend
npm run dev -- --port 5100 &
FRONTEND_PID=$!
cd ..

echo "Services started!"
echo "Backend: http://localhost:8000"
echo "Frontend: http://localhost:5100"
echo "Press Ctrl+C to stop both servers."

# Trap SIGINT to kill both processes
trap "kill $BACKEND_PID $FRONTEND_PID; exit" SIGINT

# Wait for processes
wait $BACKEND_PID $FRONTEND_PID
