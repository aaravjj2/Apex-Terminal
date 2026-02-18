# n8n Workflows for AI Options Autopilot

This directory contains example n8n workflows for automating the AI Options Autopilot system.

## Workflows

### 1. `autopilot_scheduled_run.json`
**Purpose:** Schedule automated autopilot runs during market hours.

**Features:**
- Runs at 9 AM, 12 PM, and 3 PM EST on weekdays
- Checks kill switch status before running
- Optional Slack notifications for run results

**Setup:**
1. Import into n8n via Settings → Workflows → Import
2. Configure Slack credentials if using notifications
3. Activate the workflow

### 2. `daily_report_generator.json`
**Purpose:** Generate and distribute daily trading reports.

**Features:**
- Runs at market close (5 PM EST) on weekdays
- Fetches comprehensive daily report from API
- Sends formatted summary to Slack
- Handles days with no trading activity

**Setup:**
1. Import into n8n
2. Configure Slack channel for reports
3. Activate the workflow

### 3. `regime_change_handler.json`
**Purpose:** Automatically adjust risk settings based on market regime changes.

**Features:**
- Webhook-triggered (call from backend when regime changes)
- Automatically reduces risk limits during high volatility
- Restores normal settings when volatility subsides
- Sends alerts on regime transitions

**Setup:**
1. Import into n8n
2. Note the webhook URL after activation
3. Configure backend to call webhook on regime detection
4. Configure Slack credentials

## Configuration

### Backend Endpoints Used
- `GET /api/v1/autopilot/status` - Check current state
- `POST /api/v1/autopilot/run` - Trigger autopilot cycle
- `GET /api/v1/autopilot/report` - Fetch daily report
- `POST /api/v1/autopilot/config` - Update configuration

### Environment Variables
Ensure your n8n instance can reach the backend:
```
BACKEND_URL=http://localhost:8000
```

### Slack Integration (Optional)
1. Create a Slack App in your workspace
2. Add OAuth scopes: `chat:write`, `channels:read`
3. Install to workspace and copy Bot Token
4. Add credentials in n8n

## Customization

### Adjusting Schedule
Edit the cron expression in the Schedule Trigger node:
- `0 9,12,15 * * 1-5` = 9 AM, 12 PM, 3 PM on weekdays
- `0 */2 9-16 * * 1-5` = Every 2 hours during market hours

### Risk Thresholds
Modify the JSON body in config POST requests to adjust:
- `max_risk_per_trade`
- `max_total_risk`
- `allowed_templates`

## Troubleshooting

### Workflow Not Triggering
1. Check workflow is active (toggle in n8n)
2. Verify backend is running and accessible
3. Check n8n logs for connection errors

### Slack Not Working
1. Verify Slack credentials are configured
2. Check bot is invited to target channel
3. Enable the Slack nodes (they're disabled by default)

### API Errors
1. Check backend logs for error details
2. Verify API endpoint paths match your setup
3. Test endpoints manually with curl first
