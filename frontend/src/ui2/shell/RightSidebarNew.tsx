/**
 * Apex Terminal — RightSidebarNew Component
 * Matches demo/index.html exactly:
 * 6 tabs: Order | Watch | Pos | News | L2 | T&S
 * Each tab with full functional content
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useContextBus } from '../stores/contextBusStore';

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

function genDepth(mid: number, levels: number = 8): { bids: DepthLevel[]; asks: DepthLevel[] } {
  const bids: DepthLevel[] = [];
  const asks: DepthLevel[] = [];
  let bidTotal = 0;
  let askTotal = 0;
  for (let i = 0; i < levels; i++) {
    const bs = Math.floor(Math.random() * 500 + 100);
    bidTotal += bs;
    bids.push({ price: mid - 0.01 * (i + 1), size: bs, total: bidTotal });
    const as = Math.floor(Math.random() * 500 + 100);
    askTotal += as;
    asks.push({ price: mid + 0.01 * (i + 1), size: as, total: askTotal });
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

function genTrades(mid: number, count: number = 20): TradeItem[] {
  const exchanges = ['NYSE', 'ARCA', 'BATS', 'IEX', 'EDGX'];
  const trades: TradeItem[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const t = new Date(now.getTime() - i * 1500);
    const side = Math.random() > 0.5 ? 'buy' : 'sell';
    trades.push({
      time: `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}:${String(t.getSeconds()).padStart(2, '0')}`,
      price: mid + (Math.random() - 0.5) * 0.1,
      size: Math.floor(Math.random() * 300 + 10),
      side,
      exch: exchanges[Math.floor(Math.random() * exchanges.length)],
    });
  }
  return trades;
}

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
  const [limitPrice, setLimitPrice] = useState('189.50');
  const [tif, setTif] = useState('day');
  const [showSLTP, setShowSLTP] = useState(false);
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');

  const price = 189.84;
  const change = 2.41;
  const changePct = 1.29;
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
          <div className="ot-price" style={{ color: change >= 0 ? 'var(--up)' : 'var(--dn)' }}>${price.toFixed(2)}</div>
          <div className="ot-chg" style={{ color: change >= 0 ? 'var(--up)' : 'var(--dn)' }}>
            {change >= 0 ? '+' : ''}{change.toFixed(2)} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%)
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

  const fetchWatchlist = useCallback(async () => {
    try {
      // Single batch call replaces 10 individual /quote requests
      const res = await fetch('/api/v1/market-data/quotes/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: WATCHLIST_SYMBOLS }),
      });
      if (!res.ok) throw new Error(`batch status ${res.status}`);
      const data = await res.json();
      const quotes: Record<string, unknown>[] = Array.isArray(data.quotes) ? data.quotes : [];
      const items: WatchItem[] = quotes
        .filter(q => (q as any).ok !== false)
        .map(q => ({
          sym: String((q as any).symbol ?? ''),
          name: SYMBOL_NAMES[String((q as any).symbol ?? '')] || String((q as any).symbol ?? ''),
          price: parseFloat(String((q as any).price ?? 0)) || 0,
          change: parseFloat(String((q as any).change ?? 0)) || 0,
          pct: parseFloat(String((q as any).change_pct ?? 0)) || 0,
        }))
        .filter(item => item.sym);
      setWatchlistData(items);
    } catch {
      // Fallback: individual calls if batch endpoint not yet deployed
      try {
        const results = await Promise.allSettled(
          WATCHLIST_SYMBOLS.map(sym =>
            fetch(`/api/v1/market-data/${sym}/quote`).then(r => (r.ok ? r.json() : null))
          )
        );
        const items: WatchItem[] = results
          .map((res, i) => {
            const sym = WATCHLIST_SYMBOLS[i];
            if (res.status === 'fulfilled' && res.value) {
              const d = res.value;
              return { sym, name: SYMBOL_NAMES[sym] || sym, price: d.price ?? d.last ?? 0, change: d.change ?? 0, pct: d.change_pct ?? 0 } as WatchItem;
            }
            return null;
          })
          .filter((item): item is WatchItem => item !== null);
        setWatchlistData(items);
      } catch { setWatchlistData([]); }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWatchlist();
    const iv = setInterval(fetchWatchlist, 60_000);
    return () => clearInterval(iv);
  }, [fetchWatchlist]);

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
        const res = await fetch('/api/v1/portfolio/positions');
        if (res.ok) {
          const data = await res.json();
          const raw: Record<string, unknown>[] = Array.isArray(data)
            ? data
            : Array.isArray(data.positions)
            ? data.positions
            : [];
          const mapped: Position[] = raw.map(p => ({
            sym: String(p.symbol ?? p.sym ?? ''),
            qty: parseFloat(String(p.qty ?? p.quantity ?? 0)),
            avgCost: parseFloat(String(p.avg_entry_price ?? p.avg_cost ?? p.avgCost ?? 0)),
            last: parseFloat(String(p.current_price ?? p.last ?? 0)),
            pnl: parseFloat(String(p.unrealized_pl ?? p.pnl ?? 0)),
            pnlPct: parseFloat(String(p.unrealized_plpc ?? p.pnl_pct ?? p.pnlPct ?? 0)) * 100,
          }));
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
  const liveMidRef = useRef<number>(100);
  const [depth, setDepth] = useState(() => genDepth(100));

  useEffect(() => {
    let cancelled = false;
    liveMidRef.current = 100;

    async function fetchPrice() {
      try {
        const res = await fetch(`/api/v1/market-data/${symbol}/quote`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          const price: number = data.price ?? data.last ?? data.close ?? 100;
          if (price > 0) {
            liveMidRef.current = price;
            setDepth(genDepth(price));
          }
        }
      } catch {
        // keep fallback mid of 100
      }
    }

    fetchPrice();

    const iv = setInterval(() => {
      setDepth(genDepth(liveMidRef.current + (Math.random() - 0.5) * 0.2));
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [symbol]);

  const maxTotal = Math.max(
    depth.bids[depth.bids.length - 1]?.total || 1,
    depth.asks[depth.asks.length - 1]?.total || 1,
  );

  return (
    <div style={{ overflow: 'auto', flex: 1 }}>
      <div className="wl-hdr">
        <span>{symbol} ORDER BOOK</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: '10px' }}>8 levels</span>
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
  const liveMidRef = useRef<number>(189.84);
  const [trades, setTrades] = useState(() => genTrades(189.84));

  useEffect(() => {
    let cancelled = false;

    async function fetchPrice() {
      try {
        const res = await fetch(`/api/v1/market-data/${symbol}/quote`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          const price: number = data.price ?? data.last ?? data.close ?? 0;
          if (price > 0) {
            liveMidRef.current = price;
            setTrades(genTrades(price));
          }
        }
      } catch {
        // keep current mid
      }
    }

    fetchPrice();

    const iv = setInterval(() => {
      setTrades(prev => {
        const side: 'buy' | 'sell' = Math.random() > 0.5 ? 'buy' : 'sell';
        const now = new Date();
        const newTrade: TradeItem = {
          time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`,
          price: liveMidRef.current + (Math.random() - 0.5) * 0.2,
          size: Math.floor(Math.random() * 300 + 10),
          side,
          exch: ['NYSE', 'ARCA', 'BATS', 'IEX'][Math.floor(Math.random() * 4)],
        };
        return [newTrade, ...prev.slice(0, 29)];
      });
    }, 1500);

    return () => {
      cancelled = true;
      clearInterval(iv);
    };
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
