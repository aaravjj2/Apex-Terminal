import React, { useState } from 'react';

const BG = '#0a0a0a', PANEL = '#111111', BORDER = '#1e1e1e';
const AMBER = '#f5a623', GREEN = '#26a69a', RED = '#ef5350', CYAN = '#00bcd4';
const DIM = '#555', TEXT = '#ccc', WHITE = '#e0e0e0';

interface Security {
  ticker: string; name: string; isin: string; cusip: string; sedol: string;
  exchange: string; country: string; currency: string; assetClass: string;
  type: string; sector: string; industry: string;
  price: number; change: number; volume: number; marketCap: number;
  pe: number; divYield: number; beta: number;
  status: 'Active' | 'Delisted' | 'Suspended';
}

function genSecurity(ticker: string, name: string, exchange: string, country: string, assetClass: string, type: string, sector: string): Security {
  const r = () => Math.random();
  const price = 10 + r() * 500;
  const isin = country.slice(0, 2).toUpperCase() + Array.from({ length: 10 }, () => '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(r() * 36)]).join('');
  const cusip = Array.from({ length: 9 }, () => '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(r() * 36)]).join('');
  const sedol = Array.from({ length: 7 }, () => '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(r() * 36)]).join('');
  return {
    ticker, name, isin, cusip, sedol, exchange, country, currency: country === 'US' ? 'USD' : country === 'UK' ? 'GBP' : country === 'JP' ? 'JPY' : country === 'DE' ? 'EUR' : 'USD',
    assetClass, type, sector, industry: sector,
    price, change: -5 + r() * 10, volume: Math.floor(r() * 50e6),
    marketCap: price * (1000 + r() * 10000), pe: 5 + r() * 50,
    divYield: r() * 5, beta: 0.3 + r() * 1.8,
    status: r() > 0.05 ? 'Active' : r() > 0.5 ? 'Suspended' : 'Delisted'
  };
}

const SECURITIES: Security[] = [
  // Equities
  genSecurity('AAPL', 'Apple Inc.', 'NASDAQ', 'US', 'Equity', 'Common Stock', 'Technology'),
  genSecurity('MSFT', 'Microsoft Corp.', 'NASDAQ', 'US', 'Equity', 'Common Stock', 'Technology'),
  genSecurity('GOOGL', 'Alphabet Inc.', 'NASDAQ', 'US', 'Equity', 'Common Stock', 'Technology'),
  genSecurity('AMZN', 'Amazon.com Inc.', 'NASDAQ', 'US', 'Equity', 'Common Stock', 'Consumer'),
  genSecurity('NVDA', 'NVIDIA Corp.', 'NASDAQ', 'US', 'Equity', 'Common Stock', 'Technology'),
  genSecurity('JPM', 'JPMorgan Chase', 'NYSE', 'US', 'Equity', 'Common Stock', 'Financial'),
  genSecurity('V', 'Visa Inc.', 'NYSE', 'US', 'Equity', 'Common Stock', 'Financial'),
  genSecurity('JNJ', 'Johnson & Johnson', 'NYSE', 'US', 'Equity', 'Common Stock', 'Healthcare'),
  genSecurity('WMT', 'Walmart Inc.', 'NYSE', 'US', 'Equity', 'Common Stock', 'Consumer'),
  genSecurity('PG', 'Procter & Gamble', 'NYSE', 'US', 'Equity', 'Common Stock', 'Consumer Staples'),
  // International
  genSecurity('SHEL.L', 'Shell PLC', 'LSE', 'UK', 'Equity', 'Common Stock', 'Energy'),
  genSecurity('NESN.SW', 'Nestlé SA', 'SIX', 'CH', 'Equity', 'Common Stock', 'Consumer Staples'),
  genSecurity('7203.T', 'Toyota Motor', 'TSE', 'JP', 'Equity', 'Common Stock', 'Automotive'),
  genSecurity('SAP.DE', 'SAP SE', 'XETRA', 'DE', 'Equity', 'Common Stock', 'Technology'),
  genSecurity('005930.KS', 'Samsung Electronics', 'KRX', 'KR', 'Equity', 'Common Stock', 'Technology'),
  // Fixed Income
  genSecurity('US10Y', 'US Treasury 10Y', 'GOVT', 'US', 'Fixed Income', 'Government Bond', 'Sovereign'),
  genSecurity('US30Y', 'US Treasury 30Y', 'GOVT', 'US', 'Fixed Income', 'Government Bond', 'Sovereign'),
  genSecurity('BUND10Y', 'German Bund 10Y', 'GOVT', 'DE', 'Fixed Income', 'Government Bond', 'Sovereign'),
  genSecurity('GILT10Y', 'UK Gilt 10Y', 'GOVT', 'UK', 'Fixed Income', 'Government Bond', 'Sovereign'),
  genSecurity('AAPL 4.5 2027', 'Apple Inc Bond', 'OTC', 'US', 'Fixed Income', 'Corporate Bond', 'Technology'),
  genSecurity('MSFT 3.125 2028', 'Microsoft Bond', 'OTC', 'US', 'Fixed Income', 'Corporate Bond', 'Technology'),
  // ETFs
  genSecurity('SPY', 'SPDR S&P 500 ETF', 'NYSE', 'US', 'ETF', 'Equity ETF', 'Broad Market'),
  genSecurity('QQQ', 'Invesco QQQ', 'NASDAQ', 'US', 'ETF', 'Equity ETF', 'Technology'),
  genSecurity('IWM', 'iShares Russell 2000', 'NYSE', 'US', 'ETF', 'Equity ETF', 'Small Cap'),
  genSecurity('GLD', 'SPDR Gold Shares', 'NYSE', 'US', 'ETF', 'Commodity ETF', 'Commodities'),
  genSecurity('TLT', 'iShares 20+ Yr Tsy', 'NASDAQ', 'US', 'ETF', 'Bond ETF', 'Fixed Income'),
  // FX
  genSecurity('EURUSD', 'EUR/USD', 'FX', 'GL', 'FX', 'Spot', 'Currency'),
  genSecurity('USDJPY', 'USD/JPY', 'FX', 'GL', 'FX', 'Spot', 'Currency'),
  genSecurity('GBPUSD', 'GBP/USD', 'FX', 'GL', 'FX', 'Spot', 'Currency'),
  // Commodities
  genSecurity('CL1', 'WTI Crude Oil', 'NYMEX', 'US', 'Commodity', 'Future', 'Energy'),
  genSecurity('GC1', 'Gold Futures', 'COMEX', 'US', 'Commodity', 'Future', 'Precious Metals'),
  genSecurity('SI1', 'Silver Futures', 'COMEX', 'US', 'Commodity', 'Future', 'Precious Metals'),
  // Crypto
  genSecurity('BTC-USD', 'Bitcoin', 'Crypto', 'GL', 'Crypto', 'Coin', 'Cryptocurrency'),
  genSecurity('ETH-USD', 'Ethereum', 'Crypto', 'GL', 'Crypto', 'Coin', 'Cryptocurrency'),
  // Options
  genSecurity('AAPL240315C195', 'AAPL Mar 15 C195', 'CBOE', 'US', 'Derivative', 'Call Option', 'Technology'),
  genSecurity('SPY240315P500', 'SPY Mar 15 P500', 'CBOE', 'US', 'Derivative', 'Put Option', 'Broad Market'),
];

const ASSET_CLASSES = ['All', ...new Set(SECURITIES.map(s => s.assetClass))];
const EXCHANGES = ['All', ...new Set(SECURITIES.map(s => s.exchange))];
const COUNTRIES = ['All', ...new Set(SECURITIES.map(s => s.country))];

function fmtVol(v: number): string {
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K';
  return v.toString();
}

function fmtCap(v: number): string {
  if (v >= 1e12) return '$' + (v / 1e12).toFixed(1) + 'T';
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(0) + 'M';
  return '$' + v.toFixed(0);
}

const TABS = ['Search', 'Browse', 'Recent', 'Watchlists'];

interface RecentSearch { query: string; timestamp: number; resultCount: number; }

export default function SecurityFinderUI2() {
  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState('');
  const [assetFilter, setAssetFilter] = useState('All');
  const [exchangeFilter, setExchangeFilter] = useState('All');
  const [countryFilter, setCountryFilter] = useState('All');
  const [selectedSecurity, setSelectedSecurity] = useState<Security | null>(null);
  const [recentSearches] = useState<RecentSearch[]>([
    { query: 'AAPL', timestamp: Date.now() - 300000, resultCount: 3 },
    { query: 'US Treasury', timestamp: Date.now() - 600000, resultCount: 2 },
    { query: 'Gold', timestamp: Date.now() - 1200000, resultCount: 4 },
    { query: 'Japan', timestamp: Date.now() - 3600000, resultCount: 5 },
    { query: 'SPY', timestamp: Date.now() - 7200000, resultCount: 2 },
  ]);

  const filtered = SECURITIES.filter(s => {
    if (assetFilter !== 'All' && s.assetClass !== assetFilter) return false;
    if (exchangeFilter !== 'All' && s.exchange !== exchangeFilter) return false;
    if (countryFilter !== 'All' && s.country !== countryFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      return s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) ||
        s.isin.toLowerCase().includes(q) || s.cusip.toLowerCase().includes(q) ||
        s.sector.toLowerCase().includes(q) || s.exchange.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div style={{ width: '100%', height: '100%', background: BG, color: TEXT, fontFamily: 'monospace', fontSize: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderBottom: `1px solid ${BORDER}`, gap: 12 }}>
        <span style={{ color: AMBER, fontWeight: 'bold', fontSize: 14 }}>🔍 SECURITY FINDER</span>
        <span style={{ color: DIM }}>|</span>
        <span style={{ color: DIM }}>{SECURITIES.length} securities loaded</span>
      </div>

      {/* Search Bar */}
      <div style={{ padding: '8px 16px', borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by ticker, name, ISIN, CUSIP, sector..."
            style={{ flex: 1, padding: '8px 12px', background: '#1a1a1a', border: `1px solid ${query ? AMBER : BORDER}`, color: WHITE, fontFamily: 'monospace', fontSize: 13, outline: 'none' }} />
          <select value={assetFilter} onChange={e => setAssetFilter(e.target.value)} style={{ padding: '6px 8px', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: TEXT, fontFamily: 'monospace', fontSize: 11 }}>
            {ASSET_CLASSES.map(a => <option key={a}>{a}</option>)}
          </select>
          <select value={exchangeFilter} onChange={e => setExchangeFilter(e.target.value)} style={{ padding: '6px 8px', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: TEXT, fontFamily: 'monospace', fontSize: 11 }}>
            {EXCHANGES.map(e => <option key={e}>{e}</option>)}
          </select>
          <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)} style={{ padding: '6px 8px', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: TEXT, fontFamily: 'monospace', fontSize: 11 }}>
            {COUNTRIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 10 }}>
          <span style={{ color: DIM }}>{filtered.length} results</span>
          <span style={{ color: DIM }}>|</span>
          {['Equity', 'Fixed Income', 'ETF', 'FX', 'Commodity', 'Crypto', 'Derivative'].map(cls => {
            const count = SECURITIES.filter(s => s.assetClass === cls).length;
            return <button key={cls} onClick={() => setAssetFilter(cls === assetFilter ? 'All' : cls)} style={{
              padding: '2px 6px', background: assetFilter === cls ? 'rgba(245,166,35,0.15)' : 'transparent',
              border: `1px solid ${assetFilter === cls ? AMBER : BORDER}`, color: assetFilter === cls ? AMBER : DIM,
              cursor: 'pointer', fontFamily: 'monospace', fontSize: 10
            }}>{cls} ({count})</button>;
          })}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}` }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{
            padding: '6px 16px', background: tab === i ? PANEL : 'transparent', color: tab === i ? AMBER : DIM,
            border: 'none', borderBottom: tab === i ? `2px solid ${AMBER}` : '2px solid transparent',
            cursor: 'pointer', fontFamily: 'monospace', fontSize: 11
          }}>{t}</button>
        ))}
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Results */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {tab === 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ position: 'sticky', top: 0, background: '#0d0d0d', zIndex: 1 }}>
                  {['Ticker', 'Name', 'ISIN', 'Exchange', 'Class', 'Type', 'Price', 'Chg %', 'Volume', 'Mkt Cap', 'Status'].map(h => (
                    <th key={h} style={{ padding: '5px 6px', textAlign: h === 'Ticker' || h === 'Name' || h === 'ISIN' ? 'left' : 'right', color: AMBER, fontSize: 10, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.ticker + s.exchange} onClick={() => setSelectedSecurity(s)} style={{
                    borderBottom: `1px solid ${BORDER}`, cursor: 'pointer',
                    background: selectedSecurity?.ticker === s.ticker ? 'rgba(245,166,35,0.08)' : 'transparent'
                  }}>
                    <td style={{ padding: '5px 6px', color: AMBER, fontWeight: 'bold' }}>{s.ticker}</td>
                    <td style={{ padding: '5px 6px', color: WHITE, fontSize: 11, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</td>
                    <td style={{ padding: '5px 6px', color: DIM, fontSize: 10, fontFamily: 'monospace' }}>{s.isin}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', color: TEXT }}>{s.exchange}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right' }}>
                      <span style={{ padding: '1px 4px', background: 'rgba(0,188,212,0.1)', border: `1px solid rgba(0,188,212,0.3)`, color: CYAN, fontSize: 9 }}>{s.assetClass}</span>
                    </td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', color: DIM, fontSize: 10 }}>{s.type}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', color: WHITE }}>{s.currency !== 'USD' ? s.currency + ' ' : '$'}{s.price.toFixed(2)}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', color: s.change >= 0 ? GREEN : RED }}>{s.change >= 0 ? '+' : ''}{s.change.toFixed(2)}%</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', color: DIM }}>{fmtVol(s.volume)}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', color: TEXT }}>{fmtCap(s.marketCap)}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right' }}>
                      <span style={{ padding: '1px 4px', fontSize: 9, background: s.status === 'Active' ? 'rgba(38,166,154,0.1)' : 'rgba(239,83,80,0.1)', color: s.status === 'Active' ? GREEN : RED }}>
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 1 && (
            <div style={{ padding: 16 }}>
              <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 12 }}>BROWSE BY ASSET CLASS</div>
              {['Equity', 'Fixed Income', 'ETF', 'FX', 'Commodity', 'Crypto', 'Derivative'].map(cls => {
                const items = SECURITIES.filter(s => s.assetClass === cls);
                return (
                  <div key={cls} style={{ marginBottom: 16 }}>
                    <div style={{ padding: '6px 8px', background: 'rgba(245,166,35,0.05)', borderLeft: `3px solid ${AMBER}`, marginBottom: 8 }}>
                      <span style={{ color: WHITE, fontWeight: 'bold' }}>{cls}</span>
                      <span style={{ color: DIM, marginLeft: 8 }}>({items.length} securities)</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                      {items.map(s => (
                        <div key={s.ticker} onClick={() => { setSelectedSecurity(s); setTab(0); }} style={{
                          background: PANEL, border: `1px solid ${BORDER}`, padding: 8, cursor: 'pointer'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: AMBER, fontWeight: 'bold' }}>{s.ticker}</span>
                            <span style={{ color: s.change >= 0 ? GREEN : RED, fontSize: 11 }}>{s.change >= 0 ? '+' : ''}{s.change.toFixed(2)}%</span>
                          </div>
                          <div style={{ color: DIM, fontSize: 10, marginTop: 2 }}>{s.name}</div>
                          <div style={{ color: TEXT, marginTop: 4 }}>${s.price.toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 2 && (
            <div style={{ padding: 16 }}>
              <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 12 }}>RECENT SEARCHES</div>
              {recentSearches.map((rs, i) => (
                <div key={i} onClick={() => { setQuery(rs.query); setTab(0); }} style={{
                  display: 'flex', justifyContent: 'space-between', padding: '8px 12px',
                  borderBottom: `1px solid ${BORDER}`, cursor: 'pointer',
                  background: 'transparent'
                }}>
                  <div>
                    <span style={{ color: AMBER, fontWeight: 'bold' }}>{rs.query}</span>
                    <span style={{ color: DIM, marginLeft: 8 }}>{rs.resultCount} results</span>
                  </div>
                  <span style={{ color: DIM, fontSize: 10 }}>{new Date(rs.timestamp).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          )}

          {tab === 3 && (
            <div style={{ padding: 16 }}>
              <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 12 }}>QUICK WATCHLISTS</div>
              {[
                { name: 'Mag 7', tickers: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META'] },
                { name: 'Banks', tickers: ['JPM', 'V'] },
                { name: 'Commodities', tickers: ['CL1', 'GC1', 'SI1'] },
                { name: 'Crypto', tickers: ['BTC-USD', 'ETH-USD'] },
              ].map(wl => (
                <div key={wl.name} style={{ marginBottom: 16 }}>
                  <div style={{ color: WHITE, fontWeight: 'bold', marginBottom: 6, padding: '4px 8px', borderLeft: `3px solid ${CYAN}` }}>{wl.name}</div>
                  {wl.tickers.map(t => {
                    const s = SECURITIES.find(sec => sec.ticker === t);
                    if (!s) return null;
                    return (
                      <div key={t} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 12px', borderBottom: `1px solid ${BORDER}` }}>
                        <span style={{ color: AMBER }}>{s.ticker}</span>
                        <span style={{ color: WHITE }}>${s.price.toFixed(2)}</span>
                        <span style={{ color: s.change >= 0 ? GREEN : RED }}>{s.change >= 0 ? '+' : ''}{s.change.toFixed(2)}%</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedSecurity && (
          <div style={{ width: 320, borderLeft: `1px solid ${BORDER}`, overflow: 'auto', background: '#0d0d0d' }}>
            <div style={{ padding: 12, borderBottom: `1px solid ${BORDER}` }}>
              <div style={{ color: AMBER, fontWeight: 'bold', fontSize: 16 }}>{selectedSecurity.ticker}</div>
              <div style={{ color: WHITE, fontSize: 13 }}>{selectedSecurity.name}</div>
              <div style={{ color: selectedSecurity.change >= 0 ? GREEN : RED, fontSize: 20, fontWeight: 'bold', marginTop: 8 }}>
                ${selectedSecurity.price.toFixed(2)}
                <span style={{ fontSize: 12, marginLeft: 8 }}>{selectedSecurity.change >= 0 ? '+' : ''}{selectedSecurity.change.toFixed(2)}%</span>
              </div>
            </div>
            <div style={{ padding: 12 }}>
              <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 8, fontSize: 10 }}>IDENTIFIERS</div>
              {[
                { label: 'ISIN', value: selectedSecurity.isin },
                { label: 'CUSIP', value: selectedSecurity.cusip },
                { label: 'SEDOL', value: selectedSecurity.sedol },
                { label: 'Exchange', value: selectedSecurity.exchange },
                { label: 'Country', value: selectedSecurity.country },
                { label: 'Currency', value: selectedSecurity.currency },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `1px solid ${BORDER}` }}>
                  <span style={{ color: DIM }}>{row.label}</span>
                  <span style={{ color: TEXT, fontFamily: 'monospace' }}>{row.value}</span>
                </div>
              ))}

              <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 8, marginTop: 12, fontSize: 10 }}>CLASSIFICATION</div>
              {[
                { label: 'Asset Class', value: selectedSecurity.assetClass },
                { label: 'Type', value: selectedSecurity.type },
                { label: 'Sector', value: selectedSecurity.sector },
                { label: 'Industry', value: selectedSecurity.industry },
                { label: 'Status', value: selectedSecurity.status },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `1px solid ${BORDER}` }}>
                  <span style={{ color: DIM }}>{row.label}</span>
                  <span style={{ color: row.label === 'Status' ? (row.value === 'Active' ? GREEN : RED) : TEXT }}>{row.value}</span>
                </div>
              ))}

              <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 8, marginTop: 12, fontSize: 10 }}>KEY METRICS</div>
              {[
                { label: 'Market Cap', value: fmtCap(selectedSecurity.marketCap) },
                { label: 'Volume', value: fmtVol(selectedSecurity.volume) },
                { label: 'P/E', value: selectedSecurity.pe.toFixed(1) + 'x' },
                { label: 'Div Yield', value: selectedSecurity.divYield.toFixed(2) + '%' },
                { label: 'Beta', value: selectedSecurity.beta.toFixed(2) },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `1px solid ${BORDER}` }}>
                  <span style={{ color: DIM }}>{row.label}</span>
                  <span style={{ color: WHITE }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 16px', borderTop: `1px solid ${BORDER}`, background: '#080808', fontSize: 10 }}>
        <span style={{ color: DIM }}>Filters: {assetFilter} | {exchangeFilter} | {countryFilter}</span>
        <span style={{ color: DIM }}>{filtered.length} / {SECURITIES.length} securities</span>
        <span style={{ color: DIM }}>Bloomberg SECF Equivalent</span>
      </div>
    </div>
  );
}
