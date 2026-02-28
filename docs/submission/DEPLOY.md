# Apex Terminal — Deployment Guide

## Quick Deploy (< 10 minutes)

### Prerequisites
- Python 3.11+ 
- Node.js 18+
- Elasticsearch 8.x (local or Elastic Cloud)

### Option 1: Local Development

```bash
# Clone
git clone https://github.com/aaravjj2/Apex-Terminal.git
cd Apex-Terminal

# Backend
cp keys.env.example keys.env  # Fill in your API keys
pip install -r requirements.txt
cd phase1 && python -m uvicorn services.api.main:app --host 0.0.0.0 --port 8000

# Frontend (new terminal)
cd frontend && npm install && npm run build && npx vite preview --port 5100

# Elasticsearch (Docker)
docker run -d --name es -p 9200:9200 -e discovery.type=single-node -e xpack.security.enabled=false docker.elastic.co/elasticsearch/elasticsearch:8.17.0

# Seed search data
python scripts/generate_real_backtest_data.py
```

### Option 2: Railway Deploy

1. **Backend**: Railway → New Service → GitHub repo → Root: `/`
   - Build: `pip install -r requirements.txt`  
   - Start: `cd phase1 && uvicorn services.api.main:app --port $PORT`
   - Add env vars from `keys.env.example`

2. **Frontend**: Railway → New Service → Root: `/frontend`
   - Build: `npm install && npm run build`
   - Start: `npx vite preview --port $PORT --host`

3. **Elasticsearch**: Use [Elastic Cloud](https://cloud.elastic.co) free trial
   - Set `ELASTICSEARCH_URL` and `ELASTICSEARCH_API_KEY` env vars

### Option 3: Render Deploy

1. Create `render.yaml` in repo root (see below)
2. Push to GitHub
3. Connect Render → Blueprint → Deploy

### Option 4: Vercel (Frontend Only)

```bash
cd frontend
npx vercel --prod
```

## Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ELASTICSEARCH_URL` | Yes | ES cluster URL |
| `APCA_API_KEY_ID` | Recommended | Alpaca paper trading |
| `APCA_API_SECRET_KEY` | Recommended | Alpaca secret |
| `FINNHUB_API_KEY` | Optional | Live market data |
| `DATABASE_URL` | Optional | SQLite default |

## Verification

After deploy, verify:
```bash
curl http://YOUR_URL:8000/health
curl http://YOUR_URL:8000/api/v1/market/quote?symbol=AAPL
curl http://YOUR_URL:5100
```

## DEPLOYMENT STATUS

- Backend URL: `http://localhost:8000` (local) / _TBD for production_
- Frontend URL: `http://localhost:5100` (local) / _TBD for production_  
- ES URL: `http://localhost:9200` (local) / _TBD for Elastic Cloud_
