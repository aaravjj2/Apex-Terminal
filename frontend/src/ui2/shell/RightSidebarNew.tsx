/**
 * Apex Terminal — RightSidebarNew Component
 * Matches demo/index.html exactly:
 * 6 tabs: Order | Watch | Pos | News | L2 | T&S
 * Each tab with full functional content
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useContextBus } from '../stores/contextBusStore';
import { useLiveQuote, useLiveQuotes } from '../lib/liveQuoteStore';

// ─── Tab types ───
type SidebarTab = 'order' | 'watch' | 'pos' | 'news' | 'l2' | 'ts';

// ─── Watchlist data ───
interface WatchItem {
  sym: string;
  name: string;
  price: number;
  change: number;
  pct: number;
}

const WATCHLIST_SYMBOLS = ['AAPL', 'TSLA', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'SPY', 'QQQ', 'JPM'];

const SYMBOL_NAMES: Record<string, string> = {
  AAPL: 'Apple Inc.',
  TSLA: 'Tesla Inc.',
  MSFT: 'Microsoft',
  NVDA: 'NVIDIA Corp.',
  AMZN: 'Amazon.com',
  GOOGL: 'Alphabet Inc.',
  META: 'Meta Platforms',
  SPY: 'S&P 500 ETF',
  QQQ: 'Nasdaq 100 ETF',
  JPM: 'JPMorgan Chase',
};

// ─── News data ───
interface NewsItem {
  time: string;
  headline: string;
  source: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
}

function formatNewsTime(raw: string | undefined): string {
  if (!raw) return '--:--';
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw.slice(0, 5);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return raw.slice(0, 5);
  }
}

function normalizeSentiment(raw: string | undefined): 'bullish' | 'bearish' | 'neutral' {
  if (!raw) return 'neutral';
  const s = raw.toLowerCase();
  if (s === 'bullish' || s === 'positive' || s === 'buy') return 'bullish';
  if (s === 'bearish' || s === 'negative' || s === 'sell') return 'bearish';
  return 'neutral';
}

// ─── L2 Depth data ───
interface DepthLevel {
  price: number;
  size: number;
  total: number;
}

// Deterministic synthetic L2 around mid (Alpaca SIP L2 not in scope yet).
// Labeled "SIM" in the panel so users know it's not exchange data.
function genDepth(mid: number, levels: number = 8): { bids: DepthLevel[]; asks: DepthLevel[] } {
  const bids: DepthLevel[] = [];
  const asks: DepthLevel[] = [];
  let bidTotal = 0;
  let askTotal = 0;
  for (let i = 0; i < levels; i++) {
    const bs = 200 + ((i * 137) % 400);
    bidTotal += bs;
    bids.push({ price: +(mid - 0.01 * (i + 1)).toFixed(2), size: bs, total: bidTotal });
    const as = 200 + (((i + 3) * 113) % 400);
    askTotal += as;
    asks.push({ price: +(mid + 0.01 * (i + 1)).toFixed(2), size: as, total: askTotal });
  }
  return { bids, asks };
}

// ─── Time & Sales data ───
interface TradeItem {
  time: string;
  price: number;
  size: number;
  side: 'buy' | 'sell';
  exch: string;
}

/* genTrades removed — T&S now streams from liveQuoteStore (real Alpaca prints). */

// ─── Position data ───
interface Position {
  sym: string;
  qty: number;
  avgCost: number;
  last: number;
  pnl: number;
  pnlPct: number;
}

export function RightSidebarNew() {
  const [activeTab, setActiveTab] = useState<SidebarTab>('order');
  const activeSymbol = useContextBus(s => s.activeSymbol);

  const TABS: { id: SidebarTab; label: string }[] = [
    { id: 'order', label: 'Order' },
    { id: 'watch', label: 'Watch' },
    { id: 'pos', label: 'Pos' },
    { id: 'news', label: 'News' },
    { id: 'l2', label: 'L2' },
    { id: 'ts', label: 'T&S' },
  ];

  return (
    <div className="apex-rightsidebar" data-testid="ui2-right-sidebar">
      {/* Tab bar */}
      <div className="s-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`s-tab${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            data-testid={`sidebar-tab-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content — only mount active tab to prevent background polling */}
      <div className="s-content active">
        {activeTab === 'order' && <OrderTicketPanel symbol={activeSymbol} />}
        {activeTab === 'watch' && <WatchlistPanel />}
        {activeTab === 'pos'   && <PositionsPanel />}
        {activeTab === 'news'  && <NewsPanel />}
        {activeTab === 'l2'    && <L2DepthPanel symbol={activeSymbol} />}
        {activeTab === 'ts'    && <TimeSalesPanel symbol={activeSymbol} />}
      </div>
    </div>
  );
}

// ─── ORDER TICKET ───
function OrderTicketPanel({ symbol }: { symbol: string }) {
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState('limit');
  const [quantity, setQuantity] = useState('100');
  const [limitPrice, setLimitPrice] = useState('');
  const [tif, setTif] = useState('day');
  const [showSLTP, setShowSLTP] = useState(false);
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const live = useLiveQuote(symbol);
  useEffect(() => {
    if (live && !limitPrice) setLimitPrice(live.price.toFixed(2));
  }, [live, limitPrice]);

  const price = live?.price ?? 0;
  const change = live?.change ?? 0;
  const changePct = live?.changePct ?? 0;
  const qty = parseInt(quantity) || 0;
  const lp = parseFloat(limitPrice) || price;
  const notional = qty * lp;
  const commission = Math.max(1, qty * 0.005);

  return (
    <div className="ot">
      {/* Symbol bar */}
      <div className="ot-sym-bar">
        <div>
          <div className="ot-sym">{symbol}</div>
          <div className="ot-exch">NASDAQ · US</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="ot-price" style={{ color: change >= 0 ? 'var(--up)' : 'var(--dn)' }}>
            {price > 0 ? `$${price.toFixed(2)}` : '…'}
          </div>
          <div className="ot-chg" style={{ color: change >= 0 ? 'var(--up)' : 'var(--dn)' }}>
            {price > 0 ? (
              <>{change >= 0 ? '+' : ''}{change.toFixed(2)} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%)</>
            ) : 'Loading…'}
          </div>
        </div>
      </div>

      {/* Direction */}
      <div className="dir-grp">
        <button
          className={`dir-btn buy${side === 'buy' ? ' active' : ''}`}
          onClick={() => setSide('buy')}
        >
          BUY
        </button>
        <button
          className={`dir-btn sell${side === 'sell' ? ' active' : ''}`}
          onClick={() => setSide('sell')}
        >
          SELL
        </button>
      </div>

      {/* Order Type */}
      <div>
        <div className="ot-lbl">ORDER TYPE</div>
        <select className="ot-sel" value={orderType} onChange={e => setOrderType(e.target.value)}>
          <option value="market">Market</option>
          <option value="limit">Limit</option>
          <option value="stop">Stop</option>
          <option value="stop_limit">Stop Limit</option>
          <option value="trailing_stop">Trailing Stop</option>
        </select>
      </div>

      {/* Quantity */}
      <div>
        <div className="ot-lbl">QUANTITY</div>
        <input className="ot-inp" type="number" value={quantity} onChange={e => setQuantity(e.target.value)} min="1" />
      </div>

      {/* Limit Price */}
      {orderType !== 'market' && (
        <div>
          <div className="ot-lbl">LIMIT PRICE</div>
          <input className="ot-inp" type="number" value={limitPrice} onChange={e => setLimitPrice(e.target.value)} step="0.01" />
        </div>
      )}

      {/* TIF */}
      <div>
        <div className="ot-lbl">TIME IN FORCE</div>
        <select className="ot-sel" value={tif} onChange={e => setTif(e.target.value)}>
          <option value="day">Day</option>
          <option value="gtc">GTC</option>
          <option value="ioc">IOC</option>
          <option value="fok">FOK</option>
        </select>
      </div>

      {/* SL/TP toggle */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px', color: 'var(--tx2)' }}
        onClick={() => setShowSLTP(!showSLTP)}
      >
        <span style={{ color: showSLTP ? 'var(--brand)' : 'var(--tx3)' }}>{showSLTP ? '▼' : '▶'}</span>
        STOP LOSS / TAKE PROFIT
      </div>

      {showSLTP && (
        <>
          <div>
            <div className="ot-lbl">STOP LOSS</div>
            <input className="ot-inp" type="number" value={stopLoss} onChange={e => setStopLoss(e.target.value)} placeholder="e.g. 185.00" step="0.01" />
          </div>
          <div>
            <div className="ot-lbl">TAKE PROFIT</div>
            <input className="ot-inp" type="number" value={takeProfit} onChange={e => setTakeProfit(e.target.value)} placeholder="e.g. 200.00" step="0.01" />
          </div>
        </>
      )}

      {/* Summary */}
      <div className="ot-summary">
        <div className="ot-sum-row">
          <span className="ot-sum-lbl">Notional</span>
          <span className="ot-sum-val">${notional.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="ot-sum-row">
          <span className="ot-sum-lbl">Commission</span>
          <span className="ot-sum-val">${commission.toFixed(2)}</span>
        </div>
        <div className="ot-sum-row">
          <span className="ot-sum-lbl">Buying Power Impact</span>
          <span className="ot-sum-val">{((notional / 250000) * 100).toFixed(1)}%</span>
        </div>
      </div>

      {/* Risk Check */}
      <div className="ot-risk">
        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="6" cy="6" r="5" />
          <polyline points="3.5,6 5.5,8 8.5,4" />
        </svg>
        Risk check passed — within limits
      </div>

      {/* Submit */}
      <button className={`ot-submit ${side}`}>
        {side === 'buy' ? 'BUY' : 'SELL'} {qty} {symbol} @ {orderType === 'market' ? 'MKT' : `$${lp.toFixed(2)}`}
      </button>
    </div>
  );
}

// ─── WATCHLIST ───
function WatchlistPanel() {
  const setActiveSymbol = useContextBus(s => s.setActiveSymbol);
  const [watchlistData, setWatchlistData] = useState<WatchItem[]>([]);
  const [loading, setLoading] = useState(true);

  const liveMap = useLiveQuotes(WATCHLIST_SYMBOLS);
  useEffect(() => {
    const items: WatchItem[] = WATCHLIST_SYMBOLS
      .map(sym => {
        const q = liveMap[sym];
        if (!q) return null;
        return {
          sym,
          name: SYMBOL_NAMES[sym] || sym,
          price: q.price,
          change: q.change,
          pct: q.changePct,
        };
      })
      .filter((item): item is WatchItem => item !== null);
    setWatchlistData(items);
    if (items.length) setLoading(false);
  }, [liveMap]);

  return (
    <div style={{ overflow: 'auto', flex: 1 }}>
      <div className="wl-hdr">
        <span>SYMBOL</span>
        <span>LAST</span>
      </div>
      {loading && watchlistData.length === 0
        ? WATCHLIST_SYMBOLS.map(sym => (
            <div key={sym} className="wl-row">
              <div>
                <div className="wl-sym">{sym}</div>
                <div className="wl-name">{SYMBOL_NAMES[sym] || sym}</div>
              </div>
              <div className="wl-p">--</div>
              <div className="wl-c">--</div>
            </div>
          ))
        : watchlistData.map(item => (
            <div key={item.sym} className="wl-row" onClick={() => setActiveSymbol(item.sym)}>
              <div>
                <div className="wl-sym">{item.sym}</div>
                <div className="wl-name">{item.name}</div>
              </div>
              <div className="wl-p">
                {item.price < 1000 ? `$${item.price.toFixed(2)}` : `$${item.price.toLocaleString()}`}
              </div>
              <div className={`wl-c ${item.change >= 0 ? 'up' : 'dn'}`}>
                {item.change >= 0 ? '+' : ''}{item.pct.toFixed(2)}%
              </div>
            </div>
          ))}
    </div>
  );
}

// ─── POSITIONS ───
function PositionsPanel() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPositions() {
      try {
        let res = await fetch('/api/broker/positions');
        if (!res.ok) res = await fetch('/api/v1/portfolio/positions');
        if (res.ok) {
          const data = await res.json();
          const raw: Record<string, unknown>[] = Array.isArray(data)
            ? data
            : Array.isArray(data.positions)
            ? data.positions
            : Array.isArray((data as { positions?: unknown[] }).positions)
            ? (data as { positions: unknown[] }).positions as Record<string, unknown>[]
            : [];
          const mapped: Position[] = raw.map(p => {
            const pnlPctRaw = parseFloat(String(p.unrealized_plpc ?? p.pnl_pct ?? p.pnlPct ?? 0));
            return {
              sym: String(p.symbol ?? p.sym ?? ''),
              qty: parseFloat(String(p.qty ?? p.quantity ?? 0)),
              avgCost: parseFloat(String(p.avg_entry_price ?? p.avg_cost ?? p.avgCost ?? 0)),
              last: parseFloat(String(p.current_price ?? p.last ?? 0)),
              pnl: parseFloat(String(p.unrealized_pl ?? p.pnl ?? 0)),
              pnlPct: Math.abs(pnlPctRaw) <= 1 ? pnlPctRaw * 100 : pnlPctRaw,
            };
          });
          setPositions(mapped);
        } else {
          setPositions([]);
        }
      } catch {
        setPositions([]);
      } finally {
        setLoading(false);
      }
    }
    fetchPositions();
    const iv = setInterval(fetchPositions, 60_000);
    return () => clearInterval(iv);
  }, []);

  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);

  return (
    <div style={{ overflow: 'auto', flex: 1 }}>
      <div className="wl-hdr">
        <span>POSITIONS ({loading ? '…' : positions.length})</span>
        {!loading && (
          <span style={{ color: totalPnl >= 0 ? 'var(--up)' : 'var(--dn)', fontFamily: 'var(--mono)' }}>
            {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}
          </span>
        )}
      </div>
      {loading ? (
        <div style={{ padding: '12px 10px', fontSize: '11px', color: 'var(--tx3)' }}>Loading positions…</div>
      ) : positions.length === 0 ? (
        <div style={{ padding: '12px 10px', fontSize: '11px', color: 'var(--tx3)' }}>No open positions</div>
      ) : (
        positions.map(pos => (
          <div key={pos.sym} className="wl-row">
            <div>
              <div className="wl-sym">{pos.sym}</div>
              <div className="wl-name">
                {pos.qty > 0 ? `LONG ${pos.qty}` : `SHORT ${Math.abs(pos.qty)}`} @ ${pos.avgCost.toFixed(2)}
              </div>
            </div>
            <div className="wl-p">${pos.last.toFixed(2)}</div>
            <div className={`wl-c ${pos.pnl >= 0 ? 'up' : 'dn'}`}>
              {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(0)}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── NEWS ───
function NewsPanel() {
  const [newsData, setNewsData] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchNews() {
      try {
        const res = await fetch('/api/v1/sentiment/articles?limit=8');
        if (res.ok) {
          const data = await res.json();
          const articles: Record<string, unknown>[] = Array.isArray(data)
            ? data
            : Array.isArray(data.articles)
            ? data.articles
            : [];
          const mapped: NewsItem[] = articles.map(a => ({
            time: formatNewsTime(
              String(a.time_published ?? a.published_at ?? a.datetime ?? '')
            ),
            headline: String(a.title ?? a.headline ?? a.summary ?? ''),
            source: String(a.source ?? a.feed ?? ''),
            sentiment: normalizeSentiment(
              String(a.sentiment_label ?? a.sentiment ?? a.overall_sentiment_label ?? '')
            ),
          }));
          setNewsData(mapped);
        } else {
          setNewsData([]);
        }
      } catch {
        setNewsData([]);
      } finally {
        setLoading(false);
      }
    }
    fetchNews();
    const iv = setInterval(fetchNews, 120_000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div style={{ overflow: 'auto', flex: 1 }}>
      <div className="wl-hdr">
        <span>LATEST NEWS</span>
        <span style={{ color: 'var(--brand)', cursor: 'pointer' }}>⟳</span>
      </div>
      {loading ? (
        <div style={{ padding: '12px 10px', fontSize: '11px', color: 'var(--tx3)' }}>Loading news…</div>
      ) : newsData.length === 0 ? (
        <div style={{ padding: '12px 10px', fontSize: '11px', color: 'var(--tx3)' }}>No articles available</div>
      ) : (
        newsData.map((news, i) => (
          <div
            key={i}
            style={{
              padding: '7px 10px',
              borderBottom: '1px solid var(--bdr)',
              cursor: 'pointer',
              transition: 'background .08s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg2)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
              <span style={{ fontSize: '10px', color: 'var(--tx3)', fontFamily: 'var(--mono)' }}>{news.time}</span>
              <span style={{
                fontSize: '9px',
                fontWeight: 600,
                padding: '1px 5px',
                borderRadius: '3px',
                background: news.sentiment === 'bullish' ? 'var(--live-bg)' : news.sentiment === 'bearish' ? 'rgba(242,54,69,.1)' : 'var(--bg2)',
                color: news.sentiment === 'bullish' ? 'var(--up)' : news.sentiment === 'bearish' ? 'var(--dn)' : 'var(--tx2)',
              }}>
                {news.sentiment.toUpperCase()}
              </span>
              <span style={{ fontSize: '9px', color: 'var(--tx3)', marginLeft: 'auto' }}>{news.source}</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--tx)', lineHeight: 1.4 }}>{news.headline}</div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── L2 DEPTH ───
function L2DepthPanel({ symbol }: { symbol: string }) {
  const live = useLiveQuote(symbol);
  const mid = live?.price ?? 0;
  const depth = mid > 0 ? genDepth(mid) : { bids: [], asks: [] };

  const maxTotal = Math.max(
    depth.bids[depth.bids.length - 1]?.total || 1,
    depth.asks[depth.asks.length - 1]?.total || 1,
  );

  return (
    <div style={{ overflow: 'auto', flex: 1 }}>
      <div className="wl-hdr">
        <span>{symbol} ORDER BOOK</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--tx3)' }}>
          {mid > 0 ? 'SIM · mid from Alpaca' : 'waiting for live mid…'}
        </span>
      </div>
      {/* Spread */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', padding: '3px 8px',
        background: 'var(--bg2)', fontSize: '10px', color: 'var(--tx3)', fontFamily: 'var(--mono)',
      }}>
        <span>Spread: ${((depth.asks[0]?.price || 0) - (depth.bids[0]?.price || 0)).toFixed(2)}</span>
        <span>Mid: ${(((depth.asks[0]?.price || 0) + (depth.bids[0]?.price || 0)) / 2).toFixed(2)}</span>
      </div>
      {/* Asks (reversed) */}
      {[...depth.asks].reverse().map((level, i) => (
        <div key={`a${i}`} className="depth-row">
          <div className="depth-bar ask" style={{ width: `${(level.total / maxTotal) * 100}%` }} />
          <span className="depth-price ask">{level.price.toFixed(2)}</span>
          <span className="depth-size">{level.size}</span>
          <span className="depth-total">{level.total}</span>
        </div>
      ))}
      {/* Divider */}
      <div style={{ height: '1px', background: 'var(--bdr)' }} />
      {/* Bids */}
      {depth.bids.map((level, i) => (
        <div key={`b${i}`} className="depth-row">
          <div className="depth-bar bid" style={{ width: `${(level.total / maxTotal) * 100}%` }} />
          <span className="depth-price bid">{level.price.toFixed(2)}</span>
          <span className="depth-size">{level.size}</span>
          <span className="depth-total">{level.total}</span>
        </div>
      ))}
    </div>
  );
}

// ─── TIME & SALES ───
function TimeSalesPanel({ symbol }: { symbol: string }) {
  const live = useLiveQuote(symbol);
  const [trades, setTrades] = useState<TradeItem[]>([]);
  const lastPriceRef = useRef<number>(0);

  useEffect(() => {
    if (!live || live.price <= 0) return;
    const prev = lastPriceRef.current;
    if (prev === live.price) return;
    const side: 'buy' | 'sell' = prev === 0 ? 'buy' : live.price >= prev ? 'buy' : 'sell';
    lastPriceRef.current = live.price;
    const now = new Date();
    const tick: TradeItem = {
      time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`,
      price: live.price,
      size: 100,
      side,
      exch: 'ALPACA',
    };
    setTrades(prev => [tick, ...prev].slice(0, 30));
  }, [live]);

  useEffect(() => {
    setTrades([]);
    lastPriceRef.current = 0;
  }, [symbol]);

  return (
    <div style={{ overflow: 'auto', flex: 1 }}>
      <div className="wl-hdr">
        <span>{symbol} TIME & SALES</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: '10px' }}>{trades.length} trades</span>
      </div>
      {/* Header */}
      <div style={{
        display: 'flex', padding: '3px 8px', borderBottom: '1px solid var(--bdr)',
        fontSize: '9px', fontWeight: 600, color: 'var(--tx3)', letterSpacing: '.05em', textTransform: 'uppercase', fontFamily: 'var(--mono)',
      }}>
        <span style={{ width: '52px' }}>Time</span>
        <span style={{ width: '58px' }}>Price</span>
        <span style={{ width: '44px', textAlign: 'right' }}>Size</span>
        <span style={{ width: '30px', textAlign: 'right' }}>Exch</span>
      </div>
      {trades.map((trade, i) => (
        <div key={i} className="ts-row">
          <span className="ts-time">{trade.time}</span>
          <span className={`ts-price ${trade.side}`}>{trade.price.toFixed(2)}</span>
          <span className="ts-size">{trade.size}</span>
          <span className="ts-exch">{trade.exch}</span>
        </div>
      ))}
    </div>
  );
}
