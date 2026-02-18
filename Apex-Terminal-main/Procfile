# Heroku Procfile for autopilot trading service
#
# This runs as a WORKER-ONLY dyno (no web frontend).
# The FastAPI app runs internally for API/webhooks but is not exposed publicly.
#
# Environment Variables Required:
#   PROFILE=prod        - Required: Disables keys.env file loading
#   ALPACA3_KEY         - Required: Alpaca API key
#   ALPACA3_SECRET      - Required: Alpaca API secret
#   ALPACA3_ENDPOINT    - Optional: Defaults to paper trading
#   PORT                - Set by Heroku automatically

worker: cd phase1 && python -m uvicorn services.api.main:app --host 0.0.0.0 --port ${PORT:-8000}
