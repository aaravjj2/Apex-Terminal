/**
 * BloombergTerminalUI2 — Bloomberg-style Command Line Interface
 * Command-line with autocomplete, function search, security finder,
 * launchpad mini panels, BQL query editor, function key shortcuts.
 */
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';

const BG = '#0a0a0a', PANEL = '#111111', BORDER = '#1e1e1e';
const AMBER = '#f5a623', GREEN = '#26a69a', RED = '#ef5350', MUTED = '#888';
const BLUE = '#3b82f6';

/* ─── Types ──────────────────────────────────────────────────────────── */
interface BloombergFunc { code: string; name: string; category: string; description: string; keys: string[] }
interface Security { ticker: string; name: string; type: string; exchange: string; country: string; ccy: string }
interface CommandHistory { cmd: string; result: string; ts: string }
interface LaunchpadPanel { id: string; title: string; type: 'quote' | 'chart' | 'news' | 'monitor' | 'calendar' | 'custom'; symbol?: string }

/* ─── Bloomberg Functions ────────────────────────────────────────────── */
const FUNCTIONS: BloombergFunc[] = [
  { code: 'DES', name: 'Description', category: 'Equity', description: 'Company description, financials, key stats', keys: ['description', 'company', 'overview'] },
  { code: 'GP', name: 'Price Graph', category: 'Equity', description: 'Interactive price chart with technicals', keys: ['chart', 'graph', 'price'] },
  { code: 'GIP', name: 'Intraday Graph', category: 'Equity', description: 'Intraday tick-by-tick price chart', keys: ['intraday', 'tick'] },
  { code: 'FA', name: 'Financial Analysis', category: 'Equity', description: 'Income statement, balance sheet, cash flow', keys: ['financial', 'analysis', 'income'] },
  { code: 'ANR', name: 'Analyst Recommendations', category: 'Equity', description: 'Buy/sell/hold ratings from analysts', keys: ['analyst', 'rating', 'recommendation'] },
  { code: 'ERN', name: 'Earnings', category: 'Equity', description: 'Earnings history, estimates, surprises', keys: ['earnings', 'eps', 'estimates'] },
  { code: 'BQ', name: 'Bloomberg Quote', category: 'Equity', description: 'Real-time quote with market depth', keys: ['quote', 'price', 'bid', 'ask'] },
  { code: 'DVD', name: 'Dividends', category: 'Equity', description: 'Dividend history and projections', keys: ['dividend', 'yield', 'payout'] },
  { code: 'OMON', name: 'Option Monitor', category: 'Derivatives', description: 'Options chain with Greeks', keys: ['options', 'calls', 'puts', 'greeks'] },
  { code: 'OV', name: 'Option Valuation', category: 'Derivatives', description: 'Option pricing and scenario analysis', keys: ['option', 'pricing', 'black-scholes'] },
  { code: 'OVDV', name: 'Vol Surface', category: 'Derivatives', description: 'Implied volatility surface', keys: ['volatility', 'surface', 'skew'] },
  { code: 'FXFM', name: 'FX Forward Monitor', category: 'FX', description: 'FX forward rates and implied yields', keys: ['fx', 'forward', 'currency'] },
  { code: 'WCR', name: 'Currency Rates', category: 'FX', description: 'World currency cross rates matrix', keys: ['currency', 'cross', 'rates'] },
  { code: 'GC', name: 'Govt Bond Curve', category: 'Fixed Income', description: 'Government yield curve', keys: ['yield', 'curve', 'government', 'bond'] },
  { code: 'CSDR', name: 'CDS Rates', category: 'Fixed Income', description: 'Credit default swap spreads', keys: ['cds', 'credit', 'default', 'spread'] },
  { code: 'SECF', name: 'Security Finder', category: 'Search', description: 'Search all asset classes by criteria', keys: ['search', 'find', 'security'] },
  { code: 'NEWS', name: 'News', category: 'News', description: 'Real-time news feed with filters', keys: ['news', 'headline', 'article'] },
  { code: 'TOP', name: 'Top News', category: 'News', description: 'Top market-moving headlines', keys: ['top', 'breaking', 'major'] },
  { code: 'PORT', name: 'Portfolio', category: 'Portfolio', description: 'Portfolio analytics and attribution', keys: ['portfolio', 'positions', 'pnl'] },
  { code: 'MARS', name: 'Risk Analytics', category: 'Risk', description: 'Multi-asset risk system', keys: ['risk', 'var', 'stress'] },
  { code: 'ECO', name: 'Economic Calendar', category: 'Economics', description: 'Economic releases and forecasts', keys: ['economic', 'calendar', 'gdp', 'nfp'] },
  { code: 'ECST', name: 'Economic Stats', category: 'Economics', description: 'Economic statistics database', keys: ['statistics', 'data', 'macro'] },
  { code: 'CACT', name: 'Corporate Actions', category: 'Corporate', description: 'Mergers, splits, dividends calendar', keys: ['corporate', 'action', 'merger', 'split'] },
  { code: 'CAST', name: 'Earnings Calendar', category: 'Corporate', description: 'Upcoming earnings releases', keys: ['earnings', 'calendar', 'report'] },
  { code: 'EQS', name: 'Equity Screening', category: 'Screening', description: 'Screen stocks by fundamentals/technicals', keys: ['screen', 'filter', 'scan'] },
  { code: 'BI', name: 'Bloomberg Intelligence', category: 'Research', description: 'Sector/industry research reports', keys: ['intelligence', 'research', 'report'] },
  { code: 'MOST', name: 'Most Active', category: 'Market', description: 'Most active stocks by volume', keys: ['active', 'volume', 'movers'] },
  { code: 'IMAP', name: 'Industry Map', category: 'Market', description: 'Sector performance heatmap', keys: ['sector', 'industry', 'heatmap'] },
  { code: 'WEI', name: 'World Equity Indices', category: 'Market', description: 'Global equity indices overview', keys: ['indices', 'global', 'world'] },
  { code: 'CBLF', name: 'Central Bank', category: 'Economics', description: 'Central bank rate decisions history', keys: ['central', 'bank', 'rate', 'fed'] },
];

/* ─── Mock Securities ────────────────────────────────────────────────── */
const SECURITIES: Security[] = [
  { ticker: 'AAPL US', name: 'Apple Inc', type: 'Equity', exchange: 'NASDAQ', country: 'US', ccy: 'USD' },
  { ticker: 'MSFT US', name: 'Microsoft Corp', type: 'Equity', exchange: 'NASDAQ', country: 'US', ccy: 'USD' },
  { ticker: 'GOOGL US', name: 'Alphabet Inc', type: 'Equity', exchange: 'NASDAQ', country: 'US', ccy: 'USD' },
  { ticker: 'AMZN US', name: 'Amazon.com Inc', type: 'Equity', exchange: 'NASDAQ', country: 'US', ccy: 'USD' },
  { ticker: 'TSLA US', name: 'Tesla Inc', type: 'Equity', exchange: 'NASDAQ', country: 'US', ccy: 'USD' },
  { ticker: 'JPM US', name: 'JPMorgan Chase', type: 'Equity', exchange: 'NYSE', country: 'US', ccy: 'USD' },
  { ticker: 'NVDA US', name: 'NVIDIA Corp', type: 'Equity', exchange: 'NASDAQ', country: 'US', ccy: 'USD' },
  { ticker: 'META US', name: 'Meta Platforms', type: 'Equity', exchange: 'NASDAQ', country: 'US', ccy: 'USD' },
  { ticker: 'SPY US', name: 'SPDR S&P 500 ETF', type: 'ETF', exchange: 'ARCA', country: 'US', ccy: 'USD' },
  { ticker: 'QQQ US', name: 'Invesco QQQ', type: 'ETF', exchange: 'NASDAQ', country: 'US', ccy: 'USD' },
  { ticker: 'EURUSD', name: 'Euro/US Dollar', type: 'FX', exchange: 'OTC', country: 'GL', ccy: 'USD' },
  { ticker: 'USDJPY', name: 'US Dollar/Yen', type: 'FX', exchange: 'OTC', country: 'GL', ccy: 'JPY' },
  { ticker: 'CL1', name: 'WTI Crude Oil', type: 'Commodity', exchange: 'NYMEX', country: 'US', ccy: 'USD' },
  { ticker: 'GC1', name: 'Gold Futures', type: 'Commodity', exchange: 'COMEX', country: 'US', ccy: 'USD' },
  { ticker: 'US10YT', name: 'US 10Y Treasury', type: 'Govt Bond', exchange: 'OTC', country: 'US', ccy: 'USD' },
  { ticker: 'DE10YT', name: 'German 10Y Bund', type: 'Govt Bond', exchange: 'OTC', country: 'DE', ccy: 'EUR' },
  { ticker: 'BTC', name: 'Bitcoin', type: 'Crypto', exchange: 'CME', country: 'GL', ccy: 'USD' },
  { ticker: 'ETH', name: 'Ethereum', type: 'Crypto', exchange: 'CME', country: 'GL', ccy: 'USD' },
  { ticker: 'VOD LN', name: 'Vodafone Group', type: 'Equity', exchange: 'LSE', country: 'GB', ccy: 'GBP' },
  { ticker: '7203 JP', name: 'Toyota Motor Corp', type: 'Equity', exchange: 'TSE', country: 'JP', ccy: 'JPY' },
];

/* ─── Canvas: Sparkline Widget ───────────────────────────────────────── */
function SparklineWidget({ color = GREEN }: { color?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = c.width = c.offsetWidth * 2, H = c.height = c.offsetHeight * 2;
    ctx.scale(2, 2); const w = W / 2, h = H / 2;
    const pts = Array.from({ length: 30 }, () => Math.random());
    const max = Math.max(...pts), min = Math.min(...pts);
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = (i / (pts.length - 1)) * w;
      const y = 2 + ((max - p) / (max - min)) * (h - 4);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [color]);
  return <canvas ref={ref} style={{ width: '100%', height: 24 }} />;
}

/* ─── Default Launchpad ──────────────────────────────────────────────── */
const DEFAULT_PANELS: LaunchpadPanel[] = [
  { id: 'p1', title: 'AAPL Quote', type: 'quote', symbol: 'AAPL' },
  { id: 'p2', title: 'SPY Chart', type: 'chart', symbol: 'SPY' },
  { id: 'p3', title: 'Top News', type: 'news' },
  { id: 'p4', title: 'MSFT Quote', type: 'quote', symbol: 'MSFT' },
  { id: 'p5', title: 'FX Monitor', type: 'monitor' },
  { id: 'p6', title: 'Econ Calendar', type: 'calendar' },
];

/* ─── Tabs ───────────────────────────────────────────────────────────── */
const TABS = ['COMMAND LINE', 'FUNCTIONS', 'SECURITY FINDER', 'LAUNCHPAD'] as const;
type Tab = typeof TABS[number];

export default function BloombergTerminalUI2() {
  const [tab, setTab] = useState<Tab>('COMMAND LINE');
  const [cmdInput, setCmdInput] = useState('');
  const [history, setHistory] = useState<CommandHistory[]>([
    { cmd: 'AAPL US <Equity> GP', result: 'Opening Price Graph for AAPL US Equity...', ts: '10:32:15' },
    { cmd: 'MSFT US <Equity> FA', result: 'Financial Analysis loaded — Rev: $211.9B, Net Income: $72.4B', ts: '10:31:42' },
    { cmd: 'ECO', result: 'Economic Calendar — Next: US NFP Jan 10 08:30 (Est: 150K)', ts: '10:30:18' },
    { cmd: 'TOP', result: 'Top News loaded — 42 articles, 3 breaking alerts', ts: '10:29:55' },
    { cmd: 'SPY US <Equity> BQ', result: 'SPY 587.42 +1.24 (+0.21%) | Bid: 587.40 x 1200 | Ask: 587.44 x 800', ts: '10:28:30' },
  ]);
  const [suggestions, setSuggestions] = useState<BloombergFunc[]>([]);
  const [funcFilter, setFuncFilter] = useState('');
  const [funcCategory, setFuncCategory] = useState<string>('All');
  const [secSearch, setSecSearch] = useState('');
  const [secType, setSecType] = useState<string>('All');
  const inputRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => ['All', ...new Set(FUNCTIONS.map(f => f.category))], []);
  const secTypes = useMemo(() => ['All', ...new Set(SECURITIES.map(s => s.type))], []);

  const filteredFuncs = useMemo(() => {
    let fns = FUNCTIONS;
    if (funcCategory !== 'All') fns = fns.filter(f => f.category === funcCategory);
    if (funcFilter) {
      const q = funcFilter.toLowerCase();
      fns = fns.filter(f => f.code.toLowerCase().includes(q) || f.name.toLowerCase().includes(q) || f.keys.some(k => k.includes(q)));
    }
    return fns;
  }, [funcFilter, funcCategory]);

  const filteredSecs = useMemo(() => {
    let secs = SECURITIES;
    if (secType !== 'All') secs = secs.filter(s => s.type === secType);
    if (secSearch) {
      const q = secSearch.toLowerCase();
      secs = secs.filter(s => s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
    }
    return secs;
  }, [secSearch, secType]);

  const handleCommand = useCallback(() => {
    if (!cmdInput.trim()) return;
    const parts = cmdInput.trim().toUpperCase().split(' ');
    const funcCode = parts[parts.length - 1];
    const func = FUNCTIONS.find(f => f.code === funcCode);
    const sec = SECURITIES.find(s => cmdInput.toUpperCase().includes(s.ticker.toUpperCase().split(' ')[0]));

    let result = `Unknown command: ${cmdInput}`;
    if (func) {
      result = `Opening ${func.name} (${func.code})${sec ? ` for ${sec.ticker}` : ''}... ${func.description}`;
    } else if (sec) {
      result = `${sec.ticker} — ${sec.name} | ${sec.type} | ${sec.exchange} | ${sec.ccy}`;
    } else if (cmdInput.toUpperCase() === 'HELP') {
      result = `Available commands: ${FUNCTIONS.map(f => f.code).join(', ')} | Type <ticker> <function> or use SECF to search`;
    }

    setHistory(prev => [{ cmd: cmdInput, result, ts: new Date().toLocaleTimeString('en-US', { hour12: false }) }, ...prev]);
    setCmdInput('');
    setSuggestions([]);
  }, [cmdInput]);

  const handleInputChange = useCallback((val: string) => {
    setCmdInput(val);
    if (val.length >= 2) {
      const q = val.toUpperCase();
      const matches = FUNCTIONS.filter(f => f.code.startsWith(q) || f.name.toUpperCase().includes(q));
      setSuggestions(matches.slice(0, 8));
    } else {
      setSuggestions([]);
    }
  }, []);

  const ps: React.CSSProperties = { background: BG, color: '#eee', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: "'Inter','SF Mono',monospace", fontSize: 12 };
  const panelStyle: React.CSSProperties = { background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 6, padding: 12 };

  // Function keys bar
  const FKEYS = [
    { key: 'F1', label: 'HELP' }, { key: 'F2', label: 'NEWS' },
    { key: 'F3', label: 'QUOTE' }, { key: 'F4', label: 'PORTFL' },
    { key: 'F5', label: 'CHART' }, { key: 'F6', label: 'TRADE' },
    { key: 'F7', label: 'ANLYS' }, { key: 'F8', label: 'SCREEN' },
    { key: 'F9', label: 'ALERT' }, { key: 'F10', label: 'SEARCH' },
    { key: 'F11', label: 'OPTS' }, { key: 'F12', label: 'RISK' },
  ];

  return (
    <div style={ps}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 16px', borderBottom: `1px solid ${BORDER}`, background: '#050505' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: AMBER }}>BLOOMBERG TERMINAL</span>
          <span style={{ fontSize: 10, color: MUTED }}>|</span>
          <span style={{ fontSize: 10, color: GREEN }}>● CONNECTED</span>
        </div>
        <div style={{ display: 'flex', gap: 8, fontSize: 10 }}>
          <span style={{ color: MUTED }}>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          <span style={{ color: AMBER, fontWeight: 600 }}>{new Date().toLocaleTimeString('en-US', { hour12: false })}</span>
        </div>
      </div>

      {/* Function Keys Bar */}
      <div style={{ display: 'flex', gap: 2, padding: '4px 8px', background: '#080808', borderBottom: `1px solid ${BORDER}` }}>
        {FKEYS.map(fk => (
          <button key={fk.key} style={{
            flex: 1, padding: '3px 2px', background: '#1a1a1a', border: `1px solid ${BORDER}`,
            borderRadius: 3, cursor: 'pointer', textAlign: 'center'
          }}>
            <div style={{ color: AMBER, fontSize: 8, fontWeight: 700 }}>{fk.key}</div>
            <div style={{ color: MUTED, fontSize: 7 }}>{fk.label}</div>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${BORDER}` }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 16px', background: 'transparent', border: 'none',
            color: tab === t ? AMBER : MUTED, fontWeight: tab === t ? 700 : 400,
            borderBottom: tab === t ? `2px solid ${AMBER}` : '2px solid transparent',
            cursor: 'pointer', fontSize: 11, letterSpacing: 0.5
          }}>{t}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {tab === 'COMMAND LINE' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Command Input */}
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#050505', border: `2px solid ${AMBER}`, borderRadius: 6, padding: '8px 12px' }}>
                <span style={{ color: AMBER, fontWeight: 700, fontSize: 14 }}>▸</span>
                <input ref={inputRef} value={cmdInput} onChange={e => handleInputChange(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCommand(); }}
                  placeholder="Type command... (e.g., AAPL US <Equity> GP)"
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 14, fontFamily: 'monospace', fontWeight: 600, caretColor: AMBER }}
                />
                <button onClick={handleCommand} style={{
                  background: AMBER, color: '#000', border: 'none', borderRadius: 4,
                  padding: '4px 16px', fontWeight: 700, fontSize: 11, cursor: 'pointer'
                }}>GO</button>
              </div>

              {/* Autocomplete dropdown */}
              {suggestions.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1a1a', border: `1px solid ${BORDER}`, borderRadius: '0 0 6px 6px', zIndex: 10, maxHeight: 200, overflow: 'auto' }}>
                  {suggestions.map(s => (
                    <div key={s.code} onClick={() => { setCmdInput(prev => prev.replace(/\S+$/, '') + s.code); setSuggestions([]); inputRef.current?.focus(); }}
                      style={{ padding: '6px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${BORDER}` }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#222')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <div>
                        <span style={{ color: AMBER, fontWeight: 700, marginRight: 8 }}>{s.code}</span>
                        <span style={{ color: '#ccc' }}>{s.name}</span>
                      </div>
                      <span style={{ color: MUTED, fontSize: 10 }}>{s.category}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* History */}
            <div style={{ ...panelStyle, flex: 1, overflow: 'auto' }}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>COMMAND HISTORY</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                {history.map((h, i) => (
                  <div key={i} style={{ background: '#0a0a0a', borderRadius: 4, padding: 8, borderLeft: `3px solid ${AMBER}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: AMBER, fontFamily: 'monospace', fontWeight: 700, fontSize: 12 }}>{h.cmd}</span>
                      <span style={{ color: '#555', fontSize: 9 }}>{h.ts}</span>
                    </div>
                    <div style={{ color: '#aaa', fontSize: 11 }}>{h.result}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick access */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, marginTop: 8 }}>
              {['TOP', 'ECO', 'MOST', 'WEI', 'EQS', 'PORT'].map(code => {
                const fn = FUNCTIONS.find(f => f.code === code);
                return (
                  <button key={code} onClick={() => { setCmdInput(code); setTimeout(handleCommand, 0); }}
                    style={{ background: '#1a1a1a', border: `1px solid ${BORDER}`, borderRadius: 4, padding: '8px 4px', cursor: 'pointer', textAlign: 'center' }}>
                    <div style={{ color: AMBER, fontWeight: 700, fontSize: 12 }}>{code}</div>
                    <div style={{ color: MUTED, fontSize: 8 }}>{fn?.name || code}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'FUNCTIONS' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input value={funcFilter} onChange={e => setFuncFilter(e.target.value)} placeholder="Search functions..."
                style={{ flex: 1, background: '#1a1a1a', border: `1px solid ${BORDER}`, borderRadius: 4, color: '#eee', padding: '6px 12px', fontSize: 12 }} />
              <select value={funcCategory} onChange={e => setFuncCategory(e.target.value)}
                style={{ background: '#1a1a1a', border: `1px solid ${BORDER}`, borderRadius: 4, color: '#eee', padding: '6px 8px', fontSize: 11 }}>
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {filteredFuncs.map(f => (
                <div key={f.code} onClick={() => { setCmdInput(f.code); setTab('COMMAND LINE'); }}
                  style={{ ...panelStyle, cursor: 'pointer', transition: 'border-color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = AMBER)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: AMBER, fontWeight: 700, fontSize: 14 }}>{f.code}</span>
                    <span style={{ padding: '1px 6px', borderRadius: 3, fontSize: 9, background: '#1a1a1a', color: MUTED }}>{f.category}</span>
                  </div>
                  <div style={{ color: '#eee', fontWeight: 600, fontSize: 12, marginBottom: 4 }}>{f.name}</div>
                  <div style={{ color: MUTED, fontSize: 10, lineHeight: 1.4 }}>{f.description}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'SECURITY FINDER' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input value={secSearch} onChange={e => setSecSearch(e.target.value)} placeholder="Search ticker or name..."
                style={{ flex: 1, background: '#1a1a1a', border: `1px solid ${BORDER}`, borderRadius: 4, color: '#eee', padding: '6px 12px', fontSize: 12 }} />
              <select value={secType} onChange={e => setSecType(e.target.value)}
                style={{ background: '#1a1a1a', border: `1px solid ${BORDER}`, borderRadius: 4, color: '#eee', padding: '6px 8px', fontSize: 11 }}>
                {secTypes.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>

            <div style={panelStyle}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: '#0a0a0a' }}>
                    {['TICKER', 'NAME', 'TYPE', 'EXCHANGE', 'COUNTRY', 'CCY', 'CHART', 'ACTION'].map(h => (
                      <th key={h} style={{ padding: '6px 8px', color: MUTED, textAlign: 'left', fontSize: 10, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSecs.map(s => (
                    <tr key={s.ticker} style={{ borderBottom: `1px solid ${BORDER}22`, cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#1a1a1a')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '6px 8px', color: AMBER, fontWeight: 700, fontFamily: 'monospace' }}>{s.ticker}</td>
                      <td style={{ padding: '6px 8px', color: '#eee' }}>{s.name}</td>
                      <td style={{ padding: '6px 8px' }}>
                        <span style={{
                          padding: '1px 6px', borderRadius: 3, fontSize: 9, fontWeight: 600,
                          background: s.type === 'Equity' ? 'rgba(38,166,154,0.15)' : s.type === 'FX' ? 'rgba(99,102,241,0.15)' : s.type === 'Commodity' ? 'rgba(245,166,35,0.15)' : 'rgba(239,83,80,0.15)',
                          color: s.type === 'Equity' ? GREEN : s.type === 'FX' ? '#6366f1' : s.type === 'Commodity' ? AMBER : RED,
                        }}>{s.type}</span>
                      </td>
                      <td style={{ padding: '6px 8px', color: MUTED }}>{s.exchange}</td>
                      <td style={{ padding: '6px 8px', color: MUTED }}>{s.country}</td>
                      <td style={{ padding: '6px 8px', color: MUTED }}>{s.ccy}</td>
                      <td style={{ padding: '6px 8px', width: 80 }}>
                        <SparklineWidget color={Math.random() > 0.4 ? GREEN : RED} />
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <button onClick={() => { setCmdInput(`${s.ticker.split(' ')[0]} DES`); setTab('COMMAND LINE'); }}
                          style={{ background: AMBER, color: '#000', border: 'none', borderRadius: 3, padding: '2px 8px', fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>GO</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'LAUNCHPAD' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>LAUNCHPAD — MINI PANELS</span>
              <button style={{ background: '#1a1a1a', border: `1px solid ${BORDER}`, borderRadius: 4, color: AMBER, padding: '4px 12px', fontSize: 10, cursor: 'pointer' }}>+ ADD PANEL</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {DEFAULT_PANELS.map(p => (
                <div key={p.id} style={{ ...panelStyle, minHeight: 140 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ color: AMBER, fontWeight: 600, fontSize: 10 }}>{p.title.toUpperCase()}</span>
                    <span style={{ color: MUTED, fontSize: 9 }}>{p.type.toUpperCase()}</span>
                  </div>
                  {p.type === 'quote' && (
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>${(180 + Math.random() * 40).toFixed(2)}</div>
                      <div style={{ color: GREEN, fontSize: 11 }}>+{(Math.random() * 3).toFixed(2)} (+{(Math.random() * 2).toFixed(2)}%)</div>
                      <SparklineWidget color={GREEN} />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 8, fontSize: 9 }}>
                        <div><span style={{ color: MUTED }}>Vol </span><span>{(Math.random() * 50 + 10).toFixed(1)}M</span></div>
                        <div><span style={{ color: MUTED }}>MCap </span><span>{(Math.random() * 2 + 0.5).toFixed(1)}T</span></div>
                        <div><span style={{ color: GREEN }}>Bid </span><span>${(180 + Math.random() * 40).toFixed(2)}</span></div>
                        <div><span style={{ color: RED }}>Ask </span><span>${(180 + Math.random() * 40).toFixed(2)}</span></div>
                      </div>
                    </div>
                  )}
                  {p.type === 'chart' && (
                    <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <SparklineWidget color={AMBER} />
                    </div>
                  )}
                  {p.type === 'news' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {['Fed signals rate hold through Q1 2025', 'AAPL beats earnings, up 3% AH', 'Oil rises on supply concerns'].map((headline, i) => (
                        <div key={i} style={{ fontSize: 10, color: i === 0 ? '#fff' : '#aaa', borderLeft: `2px solid ${i === 0 ? RED : BORDER}`, paddingLeft: 6 }}>
                          {headline}
                        </div>
                      ))}
                    </div>
                  )}
                  {p.type === 'monitor' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {[{ p: 'EURUSD', v: '1.0842', c: GREEN }, { p: 'USDJPY', v: '149.23', c: RED }, { p: 'GBPUSD', v: '1.2714', c: GREEN }, { p: 'USDCHF', v: '0.8647', c: RED }].map(fx => (
                        <div key={fx.p} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                          <span style={{ color: MUTED }}>{fx.p}</span>
                          <span style={{ color: fx.c, fontFamily: 'monospace' }}>{fx.v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {p.type === 'calendar' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {[{ ev: 'US NFP', t: '08:30', imp: 'HIGH' }, { ev: 'ECB Rate', t: '13:45', imp: 'HIGH' }, { ev: 'US CPI', t: '08:30', imp: 'MED' }].map(ev => (
                        <div key={ev.ev} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                          <span style={{ color: '#ccc' }}>{ev.ev}</span>
                          <div>
                            <span style={{ color: MUTED, marginRight: 6 }}>{ev.t}</span>
                            <span style={{ padding: '0 4px', borderRadius: 2, fontSize: 8, background: ev.imp === 'HIGH' ? 'rgba(239,83,80,0.2)' : 'rgba(245,166,35,0.2)', color: ev.imp === 'HIGH' ? RED : AMBER }}>{ev.imp}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Speed Dial */}
            <div style={{ ...panelStyle, marginTop: 12 }}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>SPEED DIAL — FAVORITES</span>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA', 'SPY', 'QQQ', 'EURUSD', 'CL1', 'GC1'].map(sym => (
                  <button key={sym} onClick={() => { setCmdInput(`${sym} BQ`); setTab('COMMAND LINE'); }}
                    style={{ background: '#1a1a1a', border: `1px solid ${BORDER}`, borderRadius: 4, padding: '6px 12px', cursor: 'pointer', color: '#eee', fontSize: 11, fontWeight: 600 }}>
                    {sym}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
