# Quick Reference Card

## 🚀 Start Commands

```bash
# Backend (Terminal 1)
cd phase1 && source venv/bin/activate
python -m uvicorn services.api.main:app --host 0.0.0.0 --port 8000 --reload

# Frontend (Terminal 2)
cd frontend && npm run dev

# Ingestion (Terminal 3, optional)
cd phase1 && source venv/bin/activate
python -m services.ingestion.main --mode live --symbols AAPL,MSFT,TSLA
```

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + 1` | Chart Workspace |
| `Ctrl/Cmd + 2` | Dashboard Workspace |
| `Ctrl/Cmd + 3` | Replay Mode |
| `Ctrl/Cmd + K` | Command Palette |
| `1/2/3/4/5` | Switch Timeframe (1m/5m/15m/1H/1D) |
| `Space` | Play/Pause Replay |
| `→` | Step Forward (Replay) |
| `←` | Step Backward (Replay) |
| `Ctrl/Cmd + Z` | Undo Drawing |
| `Ctrl/Cmd + Y` | Redo Drawing |

## 🌐 URLs

- **Frontend**: http://localhost:5100
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **WebSocket**: ws://localhost:8000/ws

## 📡 Common API Calls

```bash
# Get bars
curl http://localhost:8000/api/v1/bars/AAPL/1m

# Get bars with date range
curl "http://localhost:8000/api/v1/bars/AAPL/1m?from=2025-01-01&to=2025-01-02"

# Get clock status
curl http://localhost:8000/api/v1/clock

# Get portfolio
curl http://localhost:8000/api/v1/portfolio
```

## 🧪 Test Commands

```bash
# Backend tests
cd phase1 && pytest -v

# Frontend tests
cd frontend && npm run test:unit

# Mock data replay
cd phase1 && python scripts/run_mock.py --csv fixtures/aapl_test_ticks.csv --symbols AAPL
```

## 🔧 Configuration Files

- **Backend Config**: `phase1/keys.env`
- **Frontend Config**: `frontend/src/data/APIClient.ts`
- **Database**: `phase1/phase1.db` (SQLite)

## 🐛 Quick Fixes

**Backend not starting?**
- Check Python version: `python --version` (need 3.11+)
- Activate venv: `source venv/bin/activate`
- Check port 8000 is free

**Frontend not connecting?**
- Verify backend running: http://localhost:8000/docs
- Check browser console for errors
- Verify API URL in `APIClient.ts`

**No data showing?**
- Check ingestion service is running
- Verify API keys in `keys.env` (for live mode)
- Check backend logs for errors
