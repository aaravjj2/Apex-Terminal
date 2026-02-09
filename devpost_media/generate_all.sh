#!/bin/bash
# ============================================================================
# DEVPOST MEDIA GENERATION - MASTER SCRIPT
# Automates the entire media capture process
# ============================================================================

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
DEVPOST_DIR="$PROJECT_ROOT/devpost_media"

echo "========================================"
echo "   Devpost Media Generation"
echo "========================================"
echo ""

# Step 1: Start demo environment
echo "Step 1: Starting demo environment..."
if ! lsof -i :8080 > /dev/null 2>&1 || ! lsof -i :50001 > /dev/null 2>&1; then
    echo "  Starting services..."
    "$PROJECT_ROOT/scripts/run_demo.sh"
    sleep 5
else
    echo "  ✓ Services already running"
fi

# Verify backend
echo -n "  Checking backend health..."
for i in {1..10}; do
    if curl -s http://localhost:8080/health > /dev/null 2>&1; then
        echo " ✓ OK"
        break
    fi
    sleep 1
    echo -n "."
done

# Verify frontend
echo -n "  Checking frontend..."
for i in {1..10}; do
    if curl -s http://localhost:50001 > /dev/null 2>&1; then
        echo " ✓ OK"
        break
    fi
    sleep 1
    echo -n "."
done

echo ""

# Step 2: Generate architecture diagram
echo "Step 2: Generating architecture diagram..."
cd "$DEVPOST_DIR"
python3 scripts/generate_architecture_diagram.py
echo "  ✓ Diagram generated"
echo ""

# Step 3: Install npm dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Step 3: Installing npm dependencies..."
    npm install
    echo "  ✓ Dependencies installed"
else
    echo "Step 3: npm dependencies already installed ✓"
fi
echo ""

# Step 4: Capture screenshots
echo "Step 4: Capturing screenshots..."
npx ts-node scripts/capture_screenshots.ts
echo "  ✓ Screenshots captured"
echo ""

# Step 5: Record video (optional - commented out by default)
# Uncomment to auto-record video
# echo "Step 5: Recording demo video..."
# npx ts-node scripts/record_video.ts
# echo "  ✓ Video recorded"
# echo ""

echo "========================================"
echo "   Media Generation Complete!"
echo "========================================"
echo ""
echo "Generated files:"
echo "  Images:  $DEVPOST_DIR/images/"
ls -lh "$DEVPOST_DIR/images/" 2>/dev/null || echo "    (no images yet)"
echo ""
echo "  Video:   $DEVPOST_DIR/video/"
ls -lh "$DEVPOST_DIR/video/" 2>/dev/null || echo "    (no video yet)"
echo ""
echo "Next steps:"
echo "  1. Review screenshots: open devpost_media/images/"
echo "  2. (Optional) Record video: npm run record:video"
echo "  3. Convert video to MP4:"
echo "     ffmpeg -i video/demo_raw.webm -c:v libx264 -crf 23 video/demo.mp4"
echo "  4. Extract thumbnail:"
echo "     ffmpeg -i video/demo.mp4 -ss 00:00:15 -vframes 1 -s 1280x720 video/thumbnail.png"
echo "  5. Review checklist: devpost_media/DEVPOST_CHECKLIST.md"
echo ""
