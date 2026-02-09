# Heroku Deployment Guide

## Overview

This guide covers deploying the autopilot trading service to Heroku as a **worker-only** dyno. The service runs continuously in the cloud but only executes trades during the trading window (9:30am - 2:15pm ET).

## Prerequisites

1. Heroku CLI installed and logged in
2. Alpaca paper trading account with API credentials
3. Git repository set up

## Quick Start

### 1. Create Heroku App

```bash
heroku create your-app-name --stack heroku-22
```

### 2. Set Environment Variables

```bash
# Required - Production mode (env vars only, no files)
heroku config:set PROFILE=prod

# Required - Alpaca credentials
heroku config:set ALPACA3_KEY=your_alpaca_key_here
heroku config:set ALPACA3_SECRET=your_alpaca_secret_here

# Optional - Defaults to paper trading
heroku config:set ALPACA3_ENDPOINT=https://paper-api.alpaca.markets

# Optional - Logging
heroku config:set LOG_LEVEL=INFO
```

### 3. Deploy

```bash
git push heroku main
```

### 4. Scale Worker (Not Web)

```bash
# We use a WORKER dyno, not a web dyno
heroku ps:scale web=0 worker=1
```

### 5. View Logs

```bash
heroku logs --tail
```

## Trading Window Behavior

The service enforces strict trading hours:

| Time (ET)      | Behavior                                    |
|----------------|---------------------------------------------|
| Before 9:30am  | Pre-market: No trading, wait for open       |
| 9:30am - 2:15pm| Trading window: Normal cycle execution      |
| At 2:15pm      | **FLATTEN**: Cancel orders, close positions |
| After 2:15pm   | Locked out: No trading until next day       |
| Weekend/Holiday| Closed: No activity                         |

### Early Close Days

On early close days (e.g., Black Friday, Christmas Eve), the cutoff is:
```
min(2:15pm, market_close - 15 minutes)
```

### Restart Safety

If the dyno restarts after 2:15pm ET:
1. The service detects it's past the cutoff
2. Immediately flattens all positions
3. Stays locked until next trading day

This ensures no positions are held overnight even if Heroku restarts.

## Environment Variables Reference

| Variable          | Required | Default                           | Description                    |
|-------------------|----------|-----------------------------------|--------------------------------|
| `PROFILE`         | Yes      | `dev`                             | Set to `prod` for Heroku       |
| `ALPACA3_KEY`     | Yes      | -                                 | Alpaca API Key ID              |
| `ALPACA3_SECRET`  | Yes      | -                                 | Alpaca API Secret              |
| `ALPACA3_ENDPOINT`| No       | `https://paper-api.alpaca.markets`| Paper or live endpoint         |
| `LOG_LEVEL`       | No       | `INFO`                            | `DEBUG`, `INFO`, `WARNING`     |

## Monitoring

### Check Service Status

The service exposes an internal API for status checks:

```bash
# From Heroku console
heroku run "curl localhost:\$PORT/autopilot/status"
```

### Important Logs to Watch

```
# Trading window gate
Trading BLOCKED: flatten_required - After trading cutoff (14:15:00)

# Flatten triggered
⚠️ FLATTEN triggered by trading window: After trading cutoff

# Restart safety
🚨 RESTART SAFETY: Restart after cutoff

# Cycle execution
Running scheduled autopilot cycle (Unified Engine)...
```

## Troubleshooting

### No Trades Executing

1. Check time is within trading window (9:30am - 2:15pm ET)
2. Verify Alpaca credentials:
   ```bash
   heroku config:get ALPACA3_KEY
   heroku config:get ALPACA3_SECRET
   ```
3. Check logs for errors:
   ```bash
   heroku logs --tail | grep -i error
   ```

### Positions Not Flattening

1. Verify worker is running:
   ```bash
   heroku ps
   ```
2. Check for API errors in logs
3. Manually flatten via Alpaca dashboard if needed

### Wrong Timezone

The service uses `America/New_York` (ET) for all trading decisions. This is hardcoded to match NYSE hours. Do NOT change timezone settings.

## Cost Considerations

- **Basic Dyno**: ~$7/month (suitable for paper trading)
- **Standard Dyno**: ~$25/month (for production/live trading)

The worker dyno runs 24/7 but only trades during market hours. No database is required (uses Alpaca as source of truth).

## Updating the Service

```bash
git push heroku main
```

The service will restart automatically. If restart happens during market hours, the trading window gate handles it gracefully.

## Going Live

⚠️ **WARNING**: Before switching to live trading:

1. Paper trade for at least 2 weeks
2. Review all trade logs
3. Set position limits appropriately
4. Update endpoint:
   ```bash
   heroku config:set ALPACA3_ENDPOINT=https://api.alpaca.markets
   ```

## Support

For issues, check:
1. Heroku logs: `heroku logs --tail`
2. Alpaca dashboard for order history
3. Service status endpoint for trading window state
