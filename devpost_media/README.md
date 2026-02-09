# Devpost Media Generation

This folder contains scripts and assets for generating Devpost-ready submission media for the VWAP Trading System project.

## Contents

```
devpost_media/
├── images/                    # Screenshots (1920x1280, 3:2 ratio)
│   ├── 01_dashboard.png
│   ├── 02_symbol_switching.png
│   ├── 03_autopilot_candidates.png
│   ├── 04_trade_execution.png
│   ├── 05_monitoring_exits.png
│   ├── 06_architecture.svg/png
│   └── 07_n8n_workflow.png (optional)
├── video/                     # Demo video assets
│   ├── demo_raw.webm         # Raw Playwright recording
│   ├── demo.mp4              # Final edited demo (2-3 min)
│   └── thumbnail.png         # 1280x720 video thumbnail
├── scripts/                   # Automation scripts
│   ├── capture_screenshots.ts
│   ├── record_video.ts
│   └── generate_architecture_diagram.py
├── demo_script.md            # Narration script with timestamps
├── demo_runbook.md           # Exact reproduction steps
├── DEVPOST_CHECKLIST.md      # Submission checklist
├── package.json              # npm scripts
└── README.md                 # This file
```

## Quick Start

### 1. Start the Application

```bash
# From project root
cd "/home/aarav/Aarav/Tradingview recreation"
./scripts/run_demo.sh
```

Verify both services are running:
- Backend: http://localhost:8080/health
- Frontend: http://localhost:50001

### 2. Generate Architecture Diagram

```bash
cd devpost_media
npm run generate:diagram

# Outputs: images/06_architecture.svg
```

To convert to PNG (requires cairosvg):
```bash
pip install cairosvg
python3 scripts/generate_architecture_diagram.py
```

Or use online converter: https://cloudconvert.com/svg-to-png

### 3. Capture Screenshots

```bash
cd devpost_media
npm install  # Install dependencies first
npm run capture:screenshots
```

This captures 5 screenshots automatically:
- 01_dashboard.png
- 02_symbol_switching.png
- 03_autopilot_candidates.png
- 04_trade_execution.png
- 05_monitoring_exits.png

### 4. Record Demo Video

```bash
npm run record:video
```

This creates a ~3-minute screen recording following the demo script.

Output: `video/demo_raw.webm`

### 5. Post-Process Video

Convert to MP4:
```bash
ffmpeg -i video/demo_raw.webm \
  -c:v libx264 -preset medium -crf 23 \
  -c:a aac -b:a 128k \
  video/demo.mp4
```

Extract thumbnail:
```bash
ffmpeg -i video/demo.mp4 \
  -ss 00:00:15 \
  -vframes 1 \
  -s 1280x720 \
  video/thumbnail.png
```

### 6. Review Media

Check all files:
```bash
ls -lh images/
ls -lh video/
```

Verify:
- [ ] All screenshots are clear and show meaningful UI states
- [ ] Video plays smoothly (2-3 minutes)
- [ ] Thumbnail is eye-catching
- [ ] All files < 5MB each (except video)

## Manual Steps

### Creating N8N Workflow Screenshot (if applicable)

If you're using N8N for automation:

1. Open N8N workflow editor
2. Zoom to show full workflow
3. Take screenshot (1920x1280 resolution)
4. Save as `images/07_n8n_workflow.png`

### Adding Narration to Video

1. Open `demo.mp4` in video editor (DaVinci Resolve, iMovie, etc.)
2. Follow `demo_script.md` for narration text and timestamps
3. Record voiceover or add text overlays
4. Export final video as `demo_final.mp4`

## Troubleshooting

### Backend Not Responding
```bash
# Check logs
tail -f ../logs/backend_demo.log

# Restart
pkill -f 'uvicorn.*main:app'
./scripts/run_demo.sh
```

### Frontend Not Loading
```bash
# Check logs
tail -f ../logs/frontend_demo.log

# Restart
pkill -f 'vite.*50001'
cd ../frontend && npm run dev -- --port 50001 &
```

### Screenshots Are Blank
- Ensure frontend is fully loaded before capturing
- Increase wait times in `capture_screenshots.ts`
- Check browser console for errors

### Video Recording Fails
- Ensure ffmpeg is installed: `brew install ffmpeg` (Mac) or `apt install ffmpeg` (Linux)
- Check disk space (video files can be large)
- Reduce viewport size if performance issues

## File Size Guidelines

- **Screenshots:** < 1MB each (PNG)
- **Video:** < 100MB (MP4, H.264)
- **Thumbnail:** < 500KB (PNG or JPG, 1280x720)

## Dependencies

### System Requirements
- Node.js 18+
- Python 3.10+
- ffmpeg (for video conversion)

### npm Packages
```bash
npm install
# Installs: @playwright/test, playwright, ts-node, typescript
```

### Python Packages
```bash
pip install cairosvg  # Optional, for SVG → PNG conversion
```

## Next Steps

After generating all media:

1. Review [DEVPOST_CHECKLIST.md](./DEVPOST_CHECKLIST.md)
2. Upload video to YouTube (unlisted) or Vimeo
3. Complete Devpost submission form
4. Upload screenshots to gallery
5. Paste prepared text from checklist
6. Submit! 🚀

## Support

If you encounter issues:
1. Check logs in `../logs/`
2. Verify services are running
3. Review browser developer console
4. Check file permissions

## License

This media generation toolkit is part of the VWAP Trading System project.
All generated media should properly attribute the project and follow the project's license.
