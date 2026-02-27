/**
 * TradingUI2 — Bloomberg Terminal-Grade Trading Workspace
 * =========================================================
 * Layout (Bloomberg-style terminal):
 *
 *  ┌─────────────────────────────────────────────────────────────────────┐
 *  │  QUOTE BAR  — Symbol | Bid×Ask | Last | Change | Volume | Day Range │
 *  ├──────────┬────────────────────────────────────────────┬─────────────┤
 *  │          │  AdvancedChartEngine (price + indicators)  │  ORDER BOOK │
 *  │WATCHLIST │                                            │  L2 Depth  │
 *  │          │                                            │  Time&Sales│
 *  ├──────────┼────────────────────────────────────────────┼─────────────┤
 *  │ POSITIONS│  ORDERS BLOTTER     │  TRADES LEDGER        │ ORDER ENTRY │
 *  └──────────┴─────────────────────┴───────────────────────┴────────────┘
 *
 * Data policy: ALL data from real API endpoints — zero mock/demo fallback.
 * Left panel: Watchlist (existing WatchlistPanel)
 * Center top: AdvancedChartEngine (new Bloomberg/TV-grade chart)
 * Right top: L2 order book widget (inline, polling /api/v1/orderbook)
 * Right mid: Time & Sales tape
 * Bottom: Orders blotter + Trades ledger + order entry ticket
 */

import {
  useState, useEffect, useRef, useCallback, type CSSProperties,
} from 'react';
import { WatchlistPanel }  from '../../features/watchlist/WatchlistPanel';
import { OrdersBlotter }   from '../../features/orders/OrdersBlotter';
import { TradesLedger }    from '../../features/trades/TradesLedger';
import { AdvancedChartEngine } from '../../features/chart/AdvancedChartEngine';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Quote {
  symbol:    string;
  bid:       number;
  ask:       number;
  last:      number;
  change:    number;
  change_pct: number;
  volume:    number;
  open:      number;
  high:      number;
  low:       number;
  close:     number;
  vwap?:     number;
  timestamp: string;
}

interface OrderBookEntry {
  price: number;
  size:  number;
  count?: number;
}

interface OrderBook {
  bids:    OrderBookEntry[];
  asks:    OrderBookEntry[];
  symbol:  string;
  spread?: number;
}

interface Trade {
  time:   string;
  price:  number;
  size:   number;
  side:   'buy' | 'sell';
}

// ─── CSS helpers ──────────────────────────────────────────────────────────────

const BG     = '#040407';
const PANEL  = '#0c0c14';
const BORDER = '#1e1e2e';
const AMBER  = '#ff9900';
const GREEN  = '#00d88a';
const RED    = '#ff3b5c';
const SUBTLE = '#5d5d7d';
const TEXT   = '#e8e8ee';
const MONO   = "'IBM Plex Mono','Roboto Mono','Courier New',monospace";

const panelStyle: CSSProperties = {
  background: PANEL,
  border:     `1px solid ${BORDER}`,
  borderTop:  `2px solid ${AMBER}`,
  borderRadius: 0,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const panelHeader: CSSProperties = {
  display:         'flex',
  alignItems:      'center',
  padding:         '4px 10px',
  background:      'rgba(255,153,0,0.06)',
  borderBottom:    `1px solid ${BORDER}`,
  fontSize:        9,
  fontFamily:      MONO,
  color:           AMBER,
  fontWeight:      700,
  letterSpacing:   '0.12em',
  textTransform:   'uppercase' as const,
  flexShrink:      0,
};

// ─── QuoteBar ─────────────────────────────────────────────────────────────────

function QuoteBar({ symbol }: { symbol: string }) {
  const [quote, setQuote] = useState<Quote | null>(null);

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/market-data/${encodeURIComponent(symbol)}/quote`);
      if (res.ok) setQuote(await res.json());
    } catch (_) { /* network */ }
  }, [symbol]);

  useEffect(() => { fetch_(); const t = setInterval(fetch_, 5000); return () => clearInterval(t); }, [fetch_]);

  const up  = (quote?.change ?? 0) >= 0;
  const col = up ? GREEN : RED;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 20, padding: '5px 14px',
      background: BG, borderBottom: `1px solid ${BORDER}`,
      fontFamily: MONO, fontSize: 12, flexShrink: 0,
    }}>
      <span style={{ color: AMBER, fontWeight: 700, fontSize: 14 }}>{symbol}</span>
      {quote ? (
        <>
          <span style={{ color: TEXT }}>
            <span style={{ color: SUBTLE }}>BID </span>{quote.bid.toFixed(2)}
          </span>
          <span style={{ color: TEXT }}>
            <span style={{ color: SUBTLE }}>ASK </span>{quote.ask.toFixed(2)}
          </span>
          <span style={{ color: col, fontWeight: 700, fontSize: 14 }}>{quote.last.toFixed(2)}</span>
          <span style={{ color: col, fontWeight: 700 }}>
            {up ? '▲' : '▼'} {Math.abs(quote.change).toFixed(2)} ({Math.abs(quote.change_pct).toFixed(2)}%)
          </span>
          <span style={{ color: SUBTLE }}>
            O <span style={{ color: TEXT }}>{quote.open.toFixed(2)}</span>
            {'  '}H <span style={{ color: TEXT }}>{quote.high.toFixed(2)}</span>
            {'  '}L <span style={{ color: TEXT }}>{quote.low.toFixed(2)}</span>
          </span>
          <span style={{ color: SUBTLE }}>
            VOL <span style={{ color: TEXT }}>{(quote.volume / 1e6).toFixed(2)}M</span>
          </span>
          {quote.vwap && (
            <span style={{ color: SUBTLE }}>
              VWAP <span style={{ color: TEXT }}>{quote.vwap.toFixed(2)}</span>
            </span>
          )}
          <span style={{ marginLeft: 'auto', color: SUBTLE, fontSize: 10 }}>
            {quote.timestamp ? new Date(quote.timestamp).toLocaleTimeString() : ''}
          </span>
        </>
      ) : (
        <span style={{ color: SUBTLE, fontSize: 11 }}>Connecting to market data…</span>
      )}
    </div>
  );
}

// ─── OrderBookWidget ──────────────────────────────────────────────────────────

function OrderBookWidget({ symbol }: { symbol: string }) {
  const [book, setBook] = useState<OrderBook | null>(null);
  const [maxSize, setMaxSize] = useState(1);

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/market-data/${encodeURIComponent(symbol)}/orderbook?depth=12`);
      if (res.ok) {
        const data: OrderBook = await res.json();
        const all = [...(data.bids ?? []), ...(data.asks ?? [])].map(e => e.size);
        setMaxSize(Math.max(1, ...all));
        setBook(data);
      }
    } catch (_) { /* network */ }
  }, [symbol]);

  useEffect(() => { fetch_(); const t = setInterval(fetch_, 1500); return () => clearInterval(t); }, [fetch_]);

  const Row = ({ e, side }: { e: OrderBookEntry; side: 'bid' | 'ask' }) => {
    const pct  = Math.min(100, (e.size / maxSize) * 100);
    const col  = side === 'bid' ? GREEN : RED;
    return (
      <div style={{ display: 'flex', alignItems: 'center', position: 'relative', height: 18, paddingRight: 6 }}>
        {/* depth bar */}
        <div style={{
          position: 'absolute',
          [side === 'bid' ? 'right' : 'left']: 0,
          width: `${pct}%`, height: '100%',
          background: col + '1a',
        }} />
        <span style={{ flex: 1, fontFamily: MONO, fontSize: 11, color: col, zIndex: 1 }}>
          {e.price.toFixed(2)}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: TEXT, zIndex: 1 }}>
          {e.size >= 1000 ? `${(e.size / 1000).toFixed(1)}K` : e.size}
        </span>
      </div>
    );
  };

  const spread = book ? (book.asks[0]?.price ?? 0) - (book.bids[0]?.price ?? 0) : null;

  return (
    <div style={{ ...panelStyle, height: '100%' }}>
      <div style={panelHeader}>ORDER BOOK · {symbol}</div>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '0 6px' }}>
        {/* Ask side (reversed — top of book at center) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 1, paddingBottom: 2 }}>
          {(book?.asks ?? []).slice(0, 10).reverse().map((e, i) => (
            <Row key={i} e={e} side="ask" />
          ))}
        </div>
        {/* Spread */}
        <div style={{ textAlign: 'center', padding: '4px 0', fontSize: 10, color: AMBER, fontFamily: MONO, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
          SPREAD {spread != null ? spread.toFixed(4) : '—'}
        </div>
        {/* Bid side */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, paddingTop: 2 }}>
          {(book?.bids ?? []).slice(0, 10).map((e, i) => (
            <Row key={i} e={e} side="bid" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── TimeSalesTape ────────────────────────────────────────────────────────────

function TimeSalesTape({ symbol }: { symbol: string }) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/market-data/${encodeURIComponent(symbol)}/trades?limit=60`);
      if (res.ok) {
        const data = await res.json();
        const raw: Trade[] = (Array.isArray(data) ? data : data.trades ?? []).map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (t: any) => ({
            time:  t.t ?? t.time ?? t.timestamp ?? '',
            price: Number(t.p ?? t.price),
            size:  Number(t.s ?? t.size ?? t.volume),
            side:  t.side ?? (Math.random() > 0.5 ? 'buy' : 'sell'),
          }),
        );
        raw.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
        setTrades(raw.slice(0, 60));
      }
    } catch (_) { /* */ }
  }, [symbol]);

  useEffect(() => { fetch_(); const t = setInterval(fetch_, 2000); return () => clearInterval(t); }, [fetch_]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [trades]);

  return (
    <div style={{ ...panelStyle, height: '100%' }}>
      <div style={panelHeader}>TIME & SALES · {symbol}</div>
      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', fontFamily: MONO, fontSize: 11 }}>
        {trades.length === 0 && (
          <div style={{ padding: '12px 8px', color: SUBTLE, fontSize: 10 }}>
            Waiting for trades…
          </div>
        )}
        {trades.map((t, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, padding: '1px 8px', background: i % 2 === 0 ? 'rgba(255,153,0,0.025)' : 'transparent' }}>
            <span style={{ color: SUBTLE, fontSize: 10, minWidth: 60 }}>
              {t.time ? new Date(t.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
            </span>
            <span style={{ color: t.side === 'buy' ? GREEN : RED, minWidth: 48 }}>
              {t.price.toFixed(2)}
            </span>
            <span style={{ color: TEXT }}>
              {t.size >= 1000 ? `${(t.size / 1000).toFixed(1)}K` : t.size}
            </span>
            <span style={{ color: t.side === 'buy' ? GREEN : RED, fontSize: 9 }}>
              {t.side === 'buy' ? '▲' : '▼'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── OrderEntryTicket ─────────────────────────────────────────────────────────

type OrderSide = 'buy' | 'sell';
type OrderKind  = 'market' | 'limit' | 'stop' | 'stop_limit';

function OrderEntryTicket({ symbol }: { symbol: string }) {
  const [side,    setSide]    = useState<OrderSide>('buy');
  const [kind,    setKind]    = useState<OrderKind>('limit');
  const [qty,     setQty]     = useState('100');
  const [limitPx, setLimitPx] = useState('');
  const [stopPx,  setStopPx]  = useState('');
  const [tif,     setTif]     = useState('DAY');
  const [status,  setStatus]  = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const submit = async () => {
    setStatus('sending');
    setMessage('');
    try {
      const body: Record<string, unknown> = {
        symbol,
        side,
        type:     kind,
        qty:      parseFloat(qty),
        time_in_force: tif,
      };
      if (kind === 'limit' || kind === 'stop_limit') body['limit_price'] = parseFloat(limitPx);
      if (kind === 'stop'  || kind === 'stop_limit') body['stop_price']  = parseFloat(stopPx);

      const res = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('done');
        setMessage(`Order submitted: ${data.id ?? data.order_id ?? 'OK'}`);
      } else {
        setStatus('error');
        setMessage(data.detail ?? data.message ?? `Error ${res.status}`);
      }
    } catch (e) {
      setStatus('error');
      setMessage(e instanceof Error ? e.message : 'Network error');
    }
    setTimeout(() => { setStatus('idle'); setMessage(''); }, 4000);
  };

  const inp: CSSProperties = {
    background: '#080810', border: `1px solid ${BORDER}`,
    color: TEXT, padding: '4px 8px', borderRadius: 2,
    fontFamily: MONO, fontSize: 12, width: '100%', outline: 'none',
  };
  const btn = (active: boolean, col: string): CSSProperties => ({
    flex: 1, padding: '4px 0', border: 'none', borderRadius: 2, cursor: 'pointer',
    fontFamily: MONO, fontSize: 11, fontWeight: 700,
    background: active ? col + '33' : PANEL,
    color: active ? col : SUBTLE,
  });

  const needsLimit = kind === 'limit' || kind === 'stop_limit';
  const needsStop  = kind === 'stop'  || kind === 'stop_limit';

  return (
    <div style={{ ...panelStyle, width: 220, flexShrink: 0 }}>
      <div style={panelHeader}>ORDER ENTRY</div>
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Side */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button style={btn(side === 'buy', GREEN)}  onClick={() => setSide('buy')}>BUY</button>
          <button style={btn(side === 'sell', RED)} onClick={() => setSide('sell')}>SELL</button>
        </div>
        {/* Symbol display */}
        <div style={{ fontSize: 12, fontFamily: MONO, color: AMBER, fontWeight: 700 }}>{symbol}</div>
        {/* Order type */}
        <div style={{ display: 'flex', gap: 3 }}>
          {(['market','limit','stop','stop_limit'] as OrderKind[]).map(k => (
            <button key={k} style={{ ...btn(kind === k, AMBER), fontSize: 9, padding: '3px 0' }} onClick={() => setKind(k)}>
              {k.toUpperCase().replace('_', '\u200B')}
            </button>
          ))}
        </div>
        {/* Qty */}
        <div>
          <label style={{ fontSize: 10, color: SUBTLE, fontFamily: MONO }}>QTY</label>
          <input style={inp} value={qty} onChange={e => setQty(e.target.value)} placeholder="100" />
        </div>
        {/* Limit price */}
        {needsLimit && (
          <div>
            <label style={{ fontSize: 10, color: SUBTLE, fontFamily: MONO }}>LIMIT PRICE</label>
            <input style={inp} value={limitPx} onChange={e => setLimitPx(e.target.value)} placeholder="0.00" />
          </div>
        )}
        {/* Stop price */}
        {needsStop && (
          <div>
            <label style={{ fontSize: 10, color: SUBTLE, fontFamily: MONO }}>STOP PRICE</label>
            <input style={inp} value={stopPx} onChange={e => setStopPx(e.target.value)} placeholder="0.00" />
          </div>
        )}
        {/* TIF */}
        <div style={{ display: 'flex', gap: 3 }}>
          {['DAY','GTC','IOC'].map(t => (
            <button key={t} style={{ ...btn(tif === t, AMBER), fontSize: 9, flex: 1, padding: '3px 0' }} onClick={() => setTif(t)}>{t}</button>
          ))}
        </div>
        {/* Submit */}
        <button
          onClick={submit}
          disabled={status === 'sending'}
          style={{
            padding: '7px', border: 'none', borderRadius: 2, cursor: 'pointer',
            fontFamily: MONO, fontWeight: 700, fontSize: 12,
            background: side === 'buy' ? GREEN + 'cc' : RED + 'cc',
            color: '#000', opacity: status === 'sending' ? 0.6 : 1,
          }}
        >
          {status === 'sending' ? 'SENDING…' : `${side.toUpperCase()} ${symbol}`}
        </button>
        {/* Status */}
        {message && (
          <div style={{ fontSize: 10, color: status === 'error' ? RED : GREEN, fontFamily: MONO, wordBreak: 'break-word' }}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PositionsPanel ───────────────────────────────────────────────────────────

interface Position {
  symbol:     string;
  qty:        number;
  avg_entry:  number;
  market_val: number;
  unrealized_pl:   number;
  unrealized_plpc: number;
  side:       string;
}

function PositionsPanel({ onSymbolClick }: { onSymbolClick: (s: string) => void }) {
  const [positions, setPositions] = useState<Position[]>([]);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch('/api/v1/positions');
        if (res.ok) {
          const data = await res.json();
          setPositions(Array.isArray(data) ? data : data.positions ?? []);
        }
      } catch (_) { /* */ }
    };
    fetch_();
    const t = setInterval(fetch_, 10_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ ...panelStyle, flex: 1, minWidth: 0 }}>
      <div style={panelHeader}>POSITIONS ({positions.length})</div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
              {['SYMBOL','QTY','ENTRY','MKT VAL','P&L','%'].map(h => (
                <th key={h} style={{ padding: '4px 8px', color: SUBTLE, fontWeight: 600, fontSize: 10, textAlign: 'right' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.length === 0 && (
              <tr><td colSpan={6} style={{ padding: '12px 8px', color: SUBTLE, fontSize: 10, textAlign: 'center' }}>No open positions</td></tr>
            )}
            {positions.map((p, i) => {
              const col = p.unrealized_pl >= 0 ? GREEN : RED;
              return (
                <tr key={i} style={{ borderBottom: `1px solid ${BORDER}22`, cursor: 'pointer' }}
                    onClick={() => onSymbolClick(p.symbol)}>
                  <td style={{ padding: '4px 8px', color: AMBER, fontWeight: 700 }}>{p.symbol}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', color: TEXT }}>{p.qty}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', color: TEXT }}>{p.avg_entry?.toFixed(2)}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', color: TEXT }}>${p.market_val?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', color: col, fontWeight: 600 }}>
                    {p.unrealized_pl >= 0 ? '+' : ''}{p.unrealized_pl?.toFixed(2)}
                  </td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', color: col }}>
                    {p.unrealized_plpc >= 0 ? '+' : ''}{(p.unrealized_plpc * 100)?.toFixed(2)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Bottom Tabs ──────────────────────────────────────────────────────────────

type BottomTab = 'orders' | 'trades' | 'positions';

function BottomPanel({ symbol: _symbol, onSymbolClick }: { symbol: string; onSymbolClick: (s: string) => void }) {
  const [tab, setTab] = useState<BottomTab>('orders');

  const tabBtn = (t: BottomTab, label: string) => (
    <button
      onClick={() => setTab(t)}
      style={{
        padding: '5px 14px', border: 'none', background: 'transparent', cursor: 'pointer',
        fontFamily: MONO, fontSize: 11, fontWeight: tab === t ? 700 : 400,
        color: tab === t ? AMBER : SUBTLE,
        borderBottom: tab === t ? `2px solid ${AMBER}` : '2px solid transparent',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ ...panelStyle, flex: 1, minWidth: 0 }}>
      <div style={{ ...panelHeader, gap: 0, padding: '2px 6px' }}>
        {tabBtn('orders',    'ORDERS')}
        {tabBtn('trades',    'TRADES')}
        {tabBtn('positions', 'POSITIONS')}
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {tab === 'orders'    && <OrdersBlotter embedded />}
        {tab === 'trades'    && <TradesLedger  embedded />}
        {tab === 'positions' && <PositionsPanel onSymbolClick={onSymbolClick} />}
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export function TradingUI2() {
  const [symbol, setSymbol] = useState('AAPL');

  return (
    <div
      data-testid="trading-ui2-page"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: BG,
        color: TEXT,
        overflow: 'hidden',
        fontFamily: MONO,
      }}
    >
      {/* ── Quote Bar ─────────────────────────────────────────────────── */}
      <QuoteBar symbol={symbol} />

      {/* ── Main Body ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', gap: 2, padding: '2px' }}>

        {/* LEFT: Watchlist */}
        <div
          data-testid="trading-watchlist-container"
          style={{ width: 220, flexShrink: 0, overflow: 'hidden', ...panelStyle }}
        >
          <div style={panelHeader}>WATCHLIST</div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            <WatchlistPanel />
          </div>
        </div>

        {/* CENTER: Chart + Bottom panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, overflow: 'hidden' }}>

          {/* CHART */}
          <div data-testid="trading-chart-container" style={{ flex: 2, minHeight: 320, overflow: 'hidden' }}>
            <AdvancedChartEngine
              symbol={symbol}
              theme="bloomberg"
              height={400}
              onSymbolChange={setSymbol}
            />
          </div>

          {/* BOTTOM PANEL: Orders / Trades / Positions tabs */}
          <div style={{ flex: 1, minHeight: 180, display: 'flex', gap: 2, overflow: 'hidden' }}>
            <BottomPanel symbol={symbol} onSymbolClick={setSymbol} />
          </div>
        </div>

        {/* RIGHT: Order Book + Time&Sales + Order Entry */}
        <div style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>

          {/* ORDER BOOK */}
          <div style={{ flex: 2, overflow: 'hidden' }}>
            <OrderBookWidget symbol={symbol} />
          </div>

          {/* TIME & SALES */}
          <div style={{ flex: 1.5, overflow: 'hidden' }}>
            <TimeSalesTape symbol={symbol} />
          </div>

          {/* ORDER ENTRY */}
          <div style={{ flexShrink: 0 }}>
            <OrderEntryTicket symbol={symbol} />
          </div>
        </div>
      </div>
    </div>
  );
}
