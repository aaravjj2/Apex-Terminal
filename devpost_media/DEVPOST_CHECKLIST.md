# Devpost Submission Checklist

## Basics
- [ ] **Project Name:** Autonomous TradingView Recreation
- [ ] **Tagline:** A self-hosted technical analysis platform with autonomous trading agents.
- [ ] **Repo Link:** [Insert GitHub Link Here]

## Media Uploads
### Image Gallery (Target: 5-7 images)
- [ ] `01_dashboard.png` - Main interface showing charts.
- [ ] `02_symbol_switching.png` - Showing symbol search/switching.
- [ ] `03_autopilot_candidates.png` - The "Autopilot" analysis tab.
- [ ] `04_trade_execution.png` - Validated trade visible in list.
- [ ] `05_monitoring_exits.png` - Portfolio/Positions view.
- [ ] `06_architecture.png` - System diagram.
- [ ] (Optional) `07_n8n_workflow.png` - If showcasing automation.

### Video
- [ ] **Demo Video:** `devpost_media/demo.mp4` (or similar) uploaded to YouTube/Vimeo.
- [ ] **Length:** Check if it's under 3 minutes.
- [ ] **Thumbnail:** Custom thumbnail uploaded.

## Text Fields
### "How we built it"
> We built the backend using Python and FastAPI, implementing a custom Bar Engine that aggregates tick data into OHLCV bars in real-time. The frontend is a high-performance React application using Lightweight Charts for rendering. We used Playwright for end-to-end testing and media generation. The "Autopilot" feature uses a modular logic engine to scan market conditions and execute trades via Alpaca's API.

### "Challenges we ran into"
> Synchronizing the replay engine with the frontend rendering loop was difficult, especially ensuring sub-millisecond latency for tick updates. We solved this by using high-frequency WebSockets and a dual-buffer ingestion system.

### "Accomplishments that we're proud of"
> We successfully recreated the core fluid experience of a professional trading platform while adding agentic capabilities that usually cost thousands of dollars a month.
