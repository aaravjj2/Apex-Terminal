#!/bin/bash
# Run the frontend development server

set -e
cd "$(dirname "$0")/../frontend"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing npm dependencies..."
    npm install
fi

echo "Starting frontend on port 5100..."
npm run dev
