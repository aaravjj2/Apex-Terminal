# Autopilot Brain V2 — Diagnosis Report

> Generated: 2026-02-24  
> Environment: Alpaca Paper | AAPL spot ~$272 | SPY spot ~$687

---

## 1. Root Cause: `no_contracts` Rejection

### Exact URLs Used by Current Gateway

```
GET https://data.alpaca.markets/v1beta1/options/contracts?underlying_symbols=AAPL
GET https://data.alpaca.markets/v1beta1/options/chains?underlying_symbols=AAPL
```

### Sample Responses (Live, 2026-02-24)

```json
HTTP 404
{"message":"Not Found"}

HTTP 404
{"message":"Not Found"}
```

**Both endpoints do not exist on Alpaca's Data API.** The gateway receives `raw_data = None` for every symbol, so `contracts = []` for every symbol, which triggers a `no_contracts` rejection.

### Correct Endpoint

```
GET https://data.alpaca.markets/v1beta1/options/snapshots/{underlying_symbol}
```

Query params supported:
| Param | Description |
|-------|-------------|
| `feed` | `indicative` (required for paper account data) |
| `limit` | Max contracts per page (default 100) |
| `type` | `call` or `put` |
| `expiration_date_gte` | ISO date - lower bound on expiry |
| `expiration_date_lte` | ISO date - upper bound on expiry |
| `strike_price_gte` | Lower bound on strike |
| `strike_price_lte` | Upper bound on strike |

### Sample Response (Live, AAPL)

```json
{
  "snapshots": {
    "AAPL260320C00275000": {
      "dailyBar": {"c": 6.04, "h": 6.17, "l": 5.7, "n": 127, "o": 5.89, "v": 5156, "vw": 5.97, "t": "2026-02-24T05:00:00Z"},
      "latestQuote": {"ap": 6.04, "as": 100, "ax": "X", "bp": 6.02, "bs": 100, "bx": "X", "c": "A", "t": "2026-02-24T17:39:35Z"},
      "latestTrade": {"p": 6.04, "s": 10, "t": "2026-02-24T20:25:54Z"},
      "greeks": {"delta": 0.4652, "gamma": 0.0173, "rho": 0.0511, "theta": -0.1234, "vega": 0.2891},
      "impliedVolatility": 0.3721
    }
  },
  "next_page_token": "..."
}
```

### OCC Symbol Parse

`AAPL260320C00275000` = AAPL + 26 03 20 (2026-03-20) + C + 00275000 ($275.000)

Format: `{UNDERLYING}{YYMMDD}{C|P}{00STRIKE000}` (strike × 1000, 8 digits zero-padded)

---

## 2. Why Positions Don't Match Orders

### Evidence

```
Live check 2026-02-24:
  Total positions: 0
  Option orders in Alpaca paper: 6
    GLD260130C00457000: sell filled
    GLD260130C00457000: buy filled
    GLD260130C00457000: sell expired
    GLD260130C00457000: buy filled
    GLD261016C00375000: buy canceled
```

### Analysis

- Positions = 0 because the GLD contracts were **expired** — they reached their expiration date and Alpaca automatically closes them (and removes from positions)
- **No active open option positions exist** — all orders were of an earlier autopilot session when it was accidentally armed
- The UI shows 0 positions correctly — it is NOT a data fetching bug

### Position Fetch Code (Current)

```python
# options_gateway.py line ~440
all_pos = self._trading_client.get_all_positions()
for p in all_pos:
    ac = p.asset_class.value if hasattr(p.asset_class, "value") else str(p.asset_class)
    if ac == "us_option" or len(p.symbol) > 10:
        result.append(...)
```

**This code is correct.** The issue was not a fetch bug but a data reality — no active option positions exist because:
1. Options expire and Alpaca removes them from positions
2. Former positions were GLD expired contracts from a prior autopilot session

---

## 3. Current Decision Schema (v1)

### Inputs

| Field | Source | Gap |
|-------|--------|-----|
| `market_open` | Alpaca clock | ✅ correct |
| `chain` | options_gateway.get_option_chain() | ❌ broken (wrong endpoint) |
| `buying_power` | account_info | ✅ correct |
| `existing_positions` | list_option_positions() | ✅ correct |

### Outputs

| Field | Description | Gap |
|-------|-------------|-----|
| `action` | BUY_CALL / BUY_PUT / REJECT | ✅ schema ok |
| `contract` | symbol, type, strike, expiry, DTE | ✅ schema ok |
| `features.signal_strength` | **Hardcoded 0.65** | ❌ Not from real signal |
| `features.trend_regime` | **Hardcoded "neutral"** | ❌ Not computed |
| `features.volatility_regime` | **Hardcoded "normal"** | ❌ Not computed |
| `contract.bid` | Not included | ❌ Missing |
| `contract.ask` | Not included | ❌ Missing |
| `contract.spread_pct` | Not computed | ❌ Missing |
| `contract.delta` | Not fetched | ❌ Missing |
| `contract.score` | Not computed | ❌ Missing (no scoring) |
| `contract.candidates_count` | Not tracked | ❌ Missing |

### What's Missing for Real Trading Quality

1. **Correct chain data** (critical) — all analysis starts with valid contract data
2. **Real contract scoring** — currently picks highest volume without scoring spread/delta
3. **Strike range filtering** — currently no ATM filter, picks any strike including deep ITM/OTM
4. **Greeks (delta)** — available in snapshots but not extracted
5. **Position exit logic** — no take-profit, stop-loss, or time-stop
6. **Underlying signal** — "signal_strength" is hardcoded 0.65 (lie)
7. **Candidate tracking** — no record of what was considered and rejected at scoring level
8. **Anomaly detection** — no filled-buy-but-no-position detection

---

## 4. Data Quality of Correct Endpoint

As of 2026-02-24 with DTE 14-45, ±15% of spot, call options:

| Symbol | Spot | Contracts (total) | Liquid (spread ≤25%, mid ≥$0.10) |
|--------|------|-------------------|----------------------------------|
| AAPL   | $272 | 100               | 91                               |
| SPY    | $687 | 100               | 93                               |
| MSFT   | $387 | 100               | 92                               |
| NVDA   | $193 | 80                | 78                               |
| AMZN   | $210 | 85                | 81                               |
| GLD    | $474 | 100               | 100                              |

### Top 5 AAPL Calls (DTE 14-45, ±8% of spot)

| Symbol | DTE | Strike | Bid | Ask | Mid | Spread% | Vol | Delta |
|--------|-----|--------|-----|-----|-----|---------|-----|-------|
| AAPL260320C00275000 | 24 | 275 | 6.02 | 6.04 | 6.03 | 0.3% | 5156 | 0.465 |
| AAPL260320C00260000 | 24 | 260 | 16.17 | 16.18 | 16.175 | 0.1% | 597 | 0.747 |
| AAPL260320C00272500 | 24 | 272.5 | 7.37 | 7.40 | 7.385 | 0.4% | 1291 | 0.522 |

---

## 5. Fix Plan Summary

| Phase | Fix | Expected Result |
|-------|-----|-----------------|
| 1 | Replace chain fetch with `/v1beta1/options/snapshots/{sym}` | 80-100 contracts per symbol, no `no_contracts` |
| 1 | Add strike range filter (spot ±15%) | Only ATM-ish contracts |
| 2 | Add contract scorer (spread, delta, DTE, volume) | Top contract selection instead of any-high-volume |
| 3 | Decision engine v2 with feature decomposition | Explainable decisions |
| 4 | Position lifecycle (entry/exit/anomaly detection) | Correct positions shown |
| 5 | LLM as second opinion only | Narrative + risk checklist |

---

*See also: `phase1/services/autopilot/options_data_gateway.py` (new) and `phase1/services/autopilot/brain_v2.py` (new)*
