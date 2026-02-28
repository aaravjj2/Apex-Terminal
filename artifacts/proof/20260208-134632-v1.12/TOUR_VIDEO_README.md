# APEX Terminal Tour Video - v1.12

**Status**: Documentation Complete, Video Recording Pending

**Planned Filename**: `APEX_TERMINAL_TOUR_v1_12.webm`  
**Duration**: ~7 minutes  
**Format**: WebM (H.264 video, Opus audio)

## Recording Approach

The tour video can be generated using one of two methods:

### Option 1: Playwright Video Capture (Recommended for Determinism)
1. Run comprehensive E2E test suite with video recording enabled:
   ```bash
   cd frontend
   VITE_DEMO_MODE=1 npx playwright test dashboard-tour-v1-9.spec.ts --headed
   ```

2. Extract video from `test-results/` directory
3. Concatenate relevant test videos into single continuous flow
4. Add chapter markers in post-production

**Advantages**:
- Automatically deterministic (DEMO mode)
- Reproducible
- No manual interaction needed
- Already configured (video=on in playwright.config.ts)

### Option 2: Manual Screen Recording
1. Start backend in DEMO mode:
   ```bash
   cd phase1
   source ../keys.env
   DEMO_MODE=1 uvicorn services.api.main:app --host 0.0.0.0 --port 8000
   ```

2. Build and start frontend:
   ```bash
   cd frontend
   npm run build
   npm run preview -- --port 5100
   ```

3. Use screen recording software (OBS Studio, SimpleScreenRecorder, etc.)
4. Follow TOUR.md script exactly
5. Export as WebM

## Tour Script

See [TOUR.md](../TOUR.md) for complete timestamped script covering:
- Dashboard & navigation (0:00-0:30)
- Data provider toggle (0:30-0:45)
- **NEW**: Lexicon disambiguation modal (0:45-1:15)
- Options → Risk Desk (1:15-2:30)
- Options → Strategy Lab (2:30-3:30)
- **Backtest (top-level, v1.12)** (3:30-6:00)
- Reporting & offline viewing (6:00-6:30)
- Market data caching (6:30-7:00)
- Recap (7:00-7:30)

## v1.12 Feature Highlights to Demonstrate

1. **Finance Lexicon Disambiguation**:
   - Enter "A" → modal appears
   - Choose "Ticker Symbol" → chart loads
   - Enter "A" again → no modal (session persistence)
   - Enter "ON" → modal appears for different ambiguous ticker

2. **Backtest Module Independence**:
   - Navigate to Backtest from top nav (not Options submenu)
   - Show it's a standalone tool

3. **Determinism Verification**:
   - Run backtest twice with same inputs
   - Show exported JSON files
   - Display hash comparison proof

4. **Selector Policy Compliance**:
   - (Background) All interactions use data-testid selectors
   - No role/text selectors in any automation

## Deliverable Location

Once recorded, place video in:
```
artifacts/proof/20260208-134632-v1.12/APEX_TERMINAL_TOUR_v1_12.webm
```

## Current Status

- [x] TOUR.md updated with v1.12 features
- [x] Recording script documented
- [x] Chapter timestamps defined
- [ ] Video recording (pending final system validation)
- [ ] Video placement in proof pack

## Notes for Recorder

- Resolution: 1440×900 (matches E2E viewport)
- Browser: Chrome, clean profile, no dev tools
- Mouse movements: Smooth, deliberate
- Pause briefly (1-2 seconds) at each milestone
- Use OBS or Playwright video capture
- Ensure DEMO_MODE=1 throughout

## Alternative: Stub for Demonstration

If video recording is not feasible in current environment, the TOUR.md script itself serves as a comprehensive demonstration guide that can be executed manually to verify all features.
