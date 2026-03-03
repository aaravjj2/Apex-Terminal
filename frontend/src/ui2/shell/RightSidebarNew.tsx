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

const WATCHLIST_DATA: WatchItem[] = [
  { sym: 'AAPL', name: 'Apple Inc', price: 189.84, change: 2.41, pct: 1.29 },
  { sym: 'TSLA', name: 'Tesla Inc', price: 248.42, change: -3.18, pct: -1.26 },
  { sym: 'MSFT', name: 'Microsoft', price: 378.91, change: 4.52, pct: 1.21 },
  { sym: 'NVDA', name: 'NVIDIA Corp', price: 875.28, change: 12.37, pct: 1.43 },
  { sym: 'AMZN', name: 'Amazon', price: 178.25, change: -1.13, pct: -0.63 },
  { sym: 'GOOGL', name: 'Alphabet', price: 141.80, change: 0.95, pct: 0.67 },
  { sym: 'META', name: 'Meta Platforms', price: 485.58, change: 6.72, pct: 1.40 },
  { sym: 'SPY', name: 'S&P 500 ETF', price: 502.12, change: 3.41, pct: 0.68 },
  { sym: 'QQQ', name: 'Nasdaq 100 ETF', price: 437.58, change: 4.28, pct: 0.99 },
  { sym: 'BTC', name: 'Bitcoin', price: 64250.00, change: 1250.00, pct: 1.98 },
  { sym: 'ETH', name: 'Ethereum', price: 3485.50, change: -42.30, pct: -1.20 },
  { sym: 'JPM', name: 'JPMorgan', price: 198.94, change: 1.87, pct: 0.95 },
];

// ─── News data ───
interface NewsItem {
  time: string;
  headline: string;
  source: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
}

const NEWS_DATA: NewsItem[] = [
  { time: '09:32', headline: 'AAPL announces $110B buyback, largest in history', source: 'Reuters', sentiment: 'bullish' },
  { time: '09:28', headline: 'Fed minutes signal patience on rate cuts', source: 'WSJ', sentiment: 'neutral' },
  { time: '09:15', headline: 'NVDA beats Q4 estimates, data center revenue surges 409%', source: 'Bloomberg', sentiment: 'bullish' },
  { time: '09:02', headline: 'China PMI contracts for 5th month — global slowdown fears', source: 'FT', sentiment: 'bearish' },
  { time: '08:45', headline: 'Oil rises 2% on OPEC+ supply cut extension', source: 'CNBC', sentiment: 'bullish' },
  { time: '08:30', headline: 'US jobless claims fall to 215K, labor market remains tight', source: 'DoL', sentiment: 'neutral' },
  { time: '08:15', headline: 'TSLA recalls 2M vehicles over Autopilot safety concerns', source: 'Reuters', sentiment: 'bearish' },
  { time: '07:58', headline: 'EU approves landmark AI regulation framework', source: 'EC', sentiment: 'neutral' },
];

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

const POSITIONS: Position[] = [
  { sym: 'AAPL', qty: 150, avgCost: 185.20, last: 189.84, pnl: 696.00, pnlPct: 2.51 },
  { sym: 'NVDA', qty: 50, avgCost: 845.00, last: 875.28, pnl: 1514.00, pnlPct: 3.58 },
  { sym: 'MSFT', qty: 80, avgCost: 370.50, last: 378.91, pnl: 672.80, pnlPct: 2.27 },
  { sym: 'TSLA', qty: -30, avgCost: 255.00, last: 248.42, pnl: 197.40, pnlPct: 2.58 },
  { sym: 'SPY', qty: 200, avgCost: 498.30, last: 502.12, pnl: 764.00, pnlPct: 0.77 },
];

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

      {/* Tab content */}
      <div className={`s-content${activeTab === 'order' ? ' active' : ''}`}>
        <OrderTicketPanel symbol={activeSymbol} />
      </div>
      <div className={`s-content${activeTab === 'watch' ? ' active' : ''}`}>
        <WatchlistPanel />
      </div>
      <div className={`s-content${activeTab === 'pos' ? ' active' : ''}`}>
        <PositionsPanel />
      </div>
      <div className={`s-content${activeTab === 'news' ? ' active' : ''}`}>
        <NewsPanel />
      </div>
      <div className={`s-content${activeTab === 'l2' ? ' active' : ''}`}>
        <L2DepthPanel symbol={activeSymbol} />
      </div>
      <div className={`s-content${activeTab === 'ts' ? ' active' : ''}`}>
        <TimeSalesPanel symbol={activeSymbol} />
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
  
  return (
    <div style={{ overflow: 'auto', flex: 1 }}>
      <div className="wl-hdr">
        <span>SYMBOL</span>
        <span>LAST</span>
      </div>
      {WATCHLIST_DATA.map(item => (
        <div key={item.sym} className="wl-row" onClick={() => setActiveSymbol(item.sym)}>
          <div>
            <div className="wl-sym">{item.sym}</div>
            <div className="wl-name">{item.name}</div>
          </div>
          <div className="wl-p">{item.price < 1000 ? `$${item.price.toFixed(2)}` : `$${item.price.toLocaleString()}`}</div>
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
  const totalPnl = POSITIONS.reduce((s, p) => s + p.pnl, 0);
  
  return (
    <div style={{ overflow: 'auto', flex: 1 }}>
      <div className="wl-hdr">
        <span>POSITIONS ({POSITIONS.length})</span>
        <span style={{ color: totalPnl >= 0 ? 'var(--up)' : 'var(--dn)', fontFamily: 'var(--mono)' }}>
          {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}
        </span>
      </div>
      {POSITIONS.map(pos => (
        <div key={pos.sym} className="wl-row">
          <div>
            <div className="wl-sym">{pos.sym}</div>
            <div className="wl-name">{pos.qty > 0 ? `LONG ${pos.qty}` : `SHORT ${Math.abs(pos.qty)}`} @ ${pos.avgCost.toFixed(2)}</div>
          </div>
          <div className="wl-p">${pos.last.toFixed(2)}</div>
          <div className={`wl-c ${pos.pnl >= 0 ? 'up' : 'dn'}`}>
            {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(0)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── NEWS ───
function NewsPanel() {
  return (
    <div style={{ overflow: 'auto', flex: 1 }}>
      <div className="wl-hdr">
        <span>LATEST NEWS</span>
        <span style={{ color: 'var(--brand)', cursor: 'pointer' }}>⟳</span>
      </div>
      {NEWS_DATA.map((news, i) => (
        <div key={i} style={{
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
      ))}
    </div>
  );
}

// ─── L2 DEPTH ───
function L2DepthPanel({ symbol }: { symbol: string }) {
  const [depth, setDepth] = useState(() => genDepth(189.84));

  useEffect(() => {
    const iv = setInterval(() => {
      setDepth(genDepth(189.84 + (Math.random() - 0.5) * 0.2));
    }, 2000);
    return () => clearInterval(iv);
  }, []);

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
  const [trades, setTrades] = useState(() => genTrades(189.84));

  useEffect(() => {
    const iv = setInterval(() => {
      setTrades(prev => {
        const side: 'buy' | 'sell' = Math.random() > 0.5 ? 'buy' : 'sell';
        const now = new Date();
        const newTrade: TradeItem = {
          time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`,
          price: 189.84 + (Math.random() - 0.5) * 0.2,
          size: Math.floor(Math.random() * 300 + 10),
          side,
          exch: ['NYSE', 'ARCA', 'BATS', 'IEX'][Math.floor(Math.random() * 4)],
        };
        return [newTrade, ...prev.slice(0, 29)];
      });
    }, 1500);
    return () => clearInterval(iv);
  }, []);

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
