"""Phase 0 diagnosis script — tests live Alpaca options endpoints."""
import asyncio
import httpx
from pathlib import Path
from datetime import date, timedelta

keys = {}
for line in Path('keys.env').read_text().splitlines():
    if '=' in line and not line.startswith('#'):
        k, v = line.split('=', 1)
        keys[k.strip()] = v.strip()

headers = {
    'APCA-API-KEY-ID': keys.get('APCA_API_KEY_ID', ''),
    'APCA-API-SECRET-KEY': keys.get('APCA_API_SECRET_KEY', ''),
}
DATA = 'https://data.alpaca.markets'
TRADE = 'https://paper-api.alpaca.markets'
TODAY = date.today()
DTE_GTE = (TODAY + timedelta(days=14)).isoformat()
DTE_LTE = (TODAY + timedelta(days=45)).isoformat()


def parse_occ(sym: str):
    """Parse OCC symbol -> (underlying, expiry, type, strike)"""
    import re
    m = re.match(r'^([A-Z]+)(\d{6})([CP])(\d{8})$', sym)
    if not m:
        return None
    und, yymmdd, tp, strike_raw = m.groups()
    expiry = date(2000 + int(yymmdd[:2]), int(yymmdd[2:4]), int(yymmdd[4:6]))
    strike = int(strike_raw) / 1000.0
    dte = max(0, (expiry - TODAY).days)
    return {'underlying': und, 'expiry': expiry.isoformat(), 'type': 'call' if tp == 'C' else 'put', 'strike': strike, 'dte': dte}


async def test():
    async with httpx.AsyncClient(headers=headers, timeout=15) as c:
        # ── Check wrong endpoints (current gateway) ──────────────────────
        print("=== WRONG ENDPOINTS (CURRENT GATEWAY) ===")
        for ep in [
            '/v1beta1/options/contracts?underlying_symbols=AAPL',
            '/v1beta1/options/chains?underlying_symbols=AAPL',
        ]:
            r = await c.get(DATA + ep)
            print(f"  {ep[:50]}: HTTP {r.status_code}")

        # ── Check correct endpoint ────────────────────────────────────────
        print("\n=== CORRECT ENDPOINT: snapshots ===")
        r = await c.get(DATA + '/v1beta1/options/snapshots/AAPL', params={'feed': 'indicative', 'limit': 3})
        print(f"  /snapshots/AAPL (no filter): HTTP {r.status_code}, count={len(r.json().get('snapshots', {}))}")

        # ── Get spot prices ───────────────────────────────────────────────
        print("\n=== SPOT PRICES ===")
        spots = {}
        for sym in ['AAPL', 'SPY', 'MSFT', 'NVDA', 'GLD']:
            r = await c.get(DATA + f'/v2/stocks/{sym}/trades/latest')
            spot = float(r.json().get('trade', {}).get('p', 0))
            spots[sym] = round(spot, 2)
            print(f"  {sym}: ${spot}")

        # ── Test each universe symbol for ATM options ─────────────────────
        print("\n=== ATM OPTIONS BY SYMBOL (DTE 14-45) ===")
        chain_results = {}
        for sym in ['AAPL', 'SPY', 'MSFT', 'NVDA', 'AMZN', 'GLD']:
            spot = spots.get(sym, 0)
            if spot <= 0:
                # Try to get spot
                r = await c.get(DATA + f'/v2/stocks/{sym}/trades/latest')
                spot = float(r.json().get('trade', {}).get('p', 0))
                spots[sym] = round(spot, 2)

            lo = round(spot * 0.85)
            hi = round(spot * 1.15)

            r = await c.get(DATA + f'/v1beta1/options/snapshots/{sym}', params={
                'feed': 'indicative',
                'limit': 100,
                'type': 'call',
                'expiration_date_gte': DTE_GTE,
                'expiration_date_lte': DTE_LTE,
                'strike_price_gte': str(lo),
                'strike_price_lte': str(hi),
            })
            snaps = r.json().get('snapshots', {})
            liquid = 0
            for occ_sym, v in snaps.items():
                q = v.get('latestQuote', {})
                bid = float(q.get('bp', 0) or 0)
                ask = float(q.get('ap', 0) or 0)
                mid = (bid + ask) / 2 if bid and ask else 0
                spread_pct = (ask - bid) / mid * 100 if mid else 999
                vol = int(v.get('dailyBar', {}).get('v', 0) or 0)
                if bid > 0 and ask > 0 and spread_pct <= 25 and mid >= 0.1:
                    liquid += 1
            chain_results[sym] = {'total': len(snaps), 'liquid': liquid, 'spot': spot}
            print(f"  {sym} (spot=${spot}): total={len(snaps)}, liquid={liquid}")

        # ── Deep dive on AAPL top contracts ───────────────────────────────
        print("\n=== AAPL TOP CONTRACTS (SAMPLE) ===")
        aapl_spot = spots.get('AAPL', 272)
        lo = round(aapl_spot * 0.92)
        hi = round(aapl_spot * 1.08)
        r = await c.get(DATA + '/v1beta1/options/snapshots/AAPL', params={
            'feed': 'indicative', 'limit': 100, 'type': 'call',
            'expiration_date_gte': DTE_GTE, 'expiration_date_lte': DTE_LTE,
            'strike_price_gte': str(lo), 'strike_price_lte': str(hi),
        })
        snaps = r.json().get('snapshots', {})
        candidates = []
        for occ_sym, v in snaps.items():
            parsed = parse_occ(occ_sym)
            if not parsed:
                continue
            q = v.get('latestQuote', {})
            bar = v.get('dailyBar', {})
            g = v.get('greeks', {})
            bid = float(q.get('bp', 0) or 0)
            ask = float(q.get('ap', 0) or 0)
            mid = round((bid + ask) / 2, 3) if bid and ask else 0
            spread_pct = round((ask - bid) / mid * 100, 1) if mid else 999
            vol = int(bar.get('v', 0) or 0)
            oi = int(v.get('openInterest', 0) or 0)
            delta = g.get('delta')
            candidates.append({
                'sym': occ_sym, 'dte': parsed['dte'], 'strike': parsed['strike'],
                'bid': bid, 'ask': ask, 'mid': mid, 'spread_pct': spread_pct,
                'vol': vol, 'oi': oi, 'delta': delta,
            })

        candidates.sort(key=lambda x: (x['spread_pct'], -x['vol']))
        for c2 in candidates[:5]:
            print(f"  {c2['sym']}: dte={c2['dte']} strike={c2['strike']} "
                  f"bid={c2['bid']} ask={c2['ask']} mid={c2['mid']} "
                  f"spread%={c2['spread_pct']} vol={c2['vol']} delta={c2['delta']}")

        # ── Check positions ───────────────────────────────────────────────
        print("\n=== POSITIONS ===")
        r = await c.get(TRADE + '/v2/positions')
        positions = r.json()
        if isinstance(positions, list):
            opt_pos = [p for p in positions if p.get('asset_class') == 'us_option' or len(str(p.get('symbol', ''))) > 10]
            print(f"  Total positions: {len(positions)}, Option positions: {len(opt_pos)}")
            for p in opt_pos[:5]:
                print(f"  {p['symbol']}: qty={p['qty']}, avg={p['avg_entry_price']}, current={p['current_price']}, pnl={p['unrealized_pl']}")
        else:
            print(f"  Error: {positions}")

        # ── Check whether greeks come from snapshots ──────────────────────
        print("\n=== GREEKS AVAILABILITY ===")
        r = await c.get(DATA + '/v1beta1/options/snapshots/AAPL', params={
            'feed': 'indicative', 'limit': 3, 'type': 'call',
            'expiration_date_gte': DTE_GTE, 'expiration_date_lte': DTE_LTE,
        })
        snaps = r.json().get('snapshots', {})
        for occ_sym, v in list(snaps.items())[:2]:
            g = v.get('greeks', {})
            iv = v.get('impliedVolatility')
            print(f"  {occ_sym}: greeks={g}, IV={iv}")

        print("\n=== DIAGNOSIS COMPLETE ===")


asyncio.run(test())
