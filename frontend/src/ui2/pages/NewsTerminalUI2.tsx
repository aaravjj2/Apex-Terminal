/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │ APEX TERMINAL — NEWS TERMINAL (UI2)                                  │
 * │                                                                       │
 * │ Real-time news feed with sentiment — tasks.md §11                   │
 * │                                                                       │
 * │ Features:                                                             │
 * │ • Live news feed with sentiment scoring                              │
 * │ • Source filtering (Reuters, Bloomberg, CNBC, FT, WSJ)              │
 * │ • Category tags (Macro, Earnings, M&A, Policy, Crypto, Commodities) │
 * │ • Sentiment gauge + trend                                            │
 * │ • Top headlines strip                                                │
 * │ • Breaking news alerts                                               │
 * │ • Market impact assessment                                           │
 * └───────────────────────────────────────────────────────────────────────┘
 */
import React, { useState, useMemo } from 'react';
import { useSocial } from '@/ui2/hooks';

const T = {
  brand: '#2962FF', bg0: '#0C0E12', bg1: '#131722', bg2: '#1E222D', bg3: '#2A2E39',
  border0: '#1E222D', border1: '#2A2E39', text0: '#FFF', text1: '#D1D4DC', text2: '#787B86', text3: '#50535E',
  up: '#26A69A', dn: '#EF5350', warn: '#FF9800', info: '#42A5F5', purple: '#AB47BC',
  fontSans: "'Inter','Segoe UI',system-ui,sans-serif", fontMono: "'JetBrains Mono','Fira Code',monospace", radius: '4px',
};
const panelStyle: React.CSSProperties = { background: T.bg1, border: `1px solid ${T.border0}`, borderRadius: T.radius, overflow: 'hidden', display: 'flex', flexDirection: 'column' };
const panelHdr: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderBottom: `1px solid ${T.border0}`, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: T.text2, fontFamily: T.fontSans };

interface NewsItem {
  id: number; headline: string; source: string; time: string;
  category: string; sentiment: number; impact: string; breaking: boolean;
  tickers: string[]; summary: string;
}

const NEWS_DATA: NewsItem[] = [
  { id: 1, headline: 'Fed Holds Rates Steady, Signals September Cut Possible', source: 'Reuters', time: '2m ago', category: 'Macro', sentiment: 0.35, impact: 'HIGH', breaking: true, tickers: ['SPY', 'QQQ', 'TLT'], summary: 'The Federal Reserve kept its benchmark rate at 5.25-5.50% but opened the door to rate cuts as early as September, citing progress on inflation.' },
  { id: 2, headline: 'NVIDIA Surpasses Apple as World\'s Most Valuable Company', source: 'Bloomberg', time: '8m ago', category: 'Earnings', sentiment: 0.85, impact: 'HIGH', breaking: true, tickers: ['NVDA', 'AAPL', 'MSFT'], summary: 'NVIDIA market cap briefly exceeded $3.2T as AI demand continues to drive record revenue growth.' },
  { id: 3, headline: 'ECB Cuts Rates for First Time Since 2019, Euro Weakens', source: 'FT', time: '15m ago', category: 'Policy', sentiment: -0.15, impact: 'HIGH', breaking: false, tickers: ['EUR/USD', 'EWQ', 'VGK'], summary: 'The ECB reduced its deposit rate by 25bps to 3.75%, with Lagarde signaling a data-dependent approach.' },
  { id: 4, headline: 'Bitcoin ETFs See Record $1.2B Daily Inflow', source: 'CNBC', time: '22m ago', category: 'Crypto', sentiment: 0.72, impact: 'MEDIUM', breaking: false, tickers: ['BTC', 'IBIT', 'FBTC'], summary: 'Spot Bitcoin ETFs attracted unprecedented daily inflows, led by BlackRock\'s IBIT fund.' },
  { id: 5, headline: 'Oil Rises on OPEC+ Production Cut Extension', source: 'Reuters', time: '35m ago', category: 'Commodities', sentiment: 0.25, impact: 'MEDIUM', breaking: false, tickers: ['CL', 'XLE', 'USO'], summary: 'OPEC+ agreed to extend voluntary production cuts through Q3 2024, keeping 2.2M bpd off market.' },
  { id: 6, headline: 'Tesla Recalls 1.8M Vehicles Over Hood Latch Issue', source: 'WSJ', time: '42m ago', category: 'Company', sentiment: -0.65, impact: 'MEDIUM', breaking: false, tickers: ['TSLA'], summary: 'NHTSA mandated recall affects Model 3, Y, S, X vehicles manufactured between 2021-2024.' },
  { id: 7, headline: 'Microsoft-Activision Deal Clears Final EU Hurdle', source: 'Bloomberg', time: '55m ago', category: 'M&A', sentiment: 0.55, impact: 'MEDIUM', breaking: false, tickers: ['MSFT', 'ATVI'], summary: 'EU commission approved the $69B acquisition after Microsoft offered cloud gaming concessions.' },
  { id: 8, headline: 'China PMI Falls Below 50, Manufacturing Contraction Deepens', source: 'FT', time: '1h ago', category: 'Macro', sentiment: -0.45, impact: 'HIGH', breaking: false, tickers: ['FXI', 'EEM', 'KWEB'], summary: 'Official manufacturing PMI dropped to 48.8 in June, worse than expected, raising stimulus expectations.' },
  { id: 9, headline: 'Goldman Sachs Raises S&P 500 Year-End Target to 5,600', source: 'CNBC', time: '1h ago', category: 'Strategy', sentiment: 0.40, impact: 'LOW', breaking: false, tickers: ['SPY', 'SPX'], summary: 'GS chief equity strategist raised forecast citing AI-driven earnings growth and soft landing probability.' },
  { id: 10, headline: 'US Jobless Claims Rise to 229K, Above Expectations', source: 'Reuters', time: '2h ago', category: 'Macro', sentiment: -0.30, impact: 'MEDIUM', breaking: false, tickers: ['SPY', 'TLT'], summary: 'Initial weekly jobless claims came in above the 218K consensus, suggesting gradual labor market cooling.' },
  { id: 11, headline: 'Apple Announces AI-Powered Siri Overhaul at WWDC', source: 'Bloomberg', time: '2h ago', category: 'Technology', sentiment: 0.60, impact: 'MEDIUM', breaking: false, tickers: ['AAPL'], summary: 'Apple Intelligence features include context-aware Siri, AI writing tools, and ChatGPT integration.' },
  { id: 12, headline: 'Copper Hits Record High on Green Energy Demand', source: 'FT', time: '3h ago', category: 'Commodities', sentiment: 0.35, impact: 'MEDIUM', breaking: false, tickers: ['HG', 'COPX', 'FCX'], summary: 'LME copper surged past $11,000/mt driven by EV demand growth and constrained mine supply.' },
  { id: 13, headline: 'Japan Yen Slides Past 160 as BOJ Delays Tightening', source: 'Reuters', time: '3h ago', category: 'FX', sentiment: -0.50, impact: 'HIGH', breaking: false, tickers: ['USD/JPY', 'FXY', 'EWJ'], summary: 'USD/JPY broke through the psychological 160 level, raising intervention speculation from the MOF.' },
  { id: 14, headline: 'CrowdStrike Q1 Revenue Beats, Raises Full-Year Guidance', source: 'CNBC', time: '4h ago', category: 'Earnings', sentiment: 0.75, impact: 'MEDIUM', breaking: false, tickers: ['CRWD', 'HACK'], summary: 'Cybersecurity firm reported $921M revenue (+33% YoY), guided FY25 revenue to $3.98-4.01B.' },
  { id: 15, headline: 'UK Inflation Falls to Bank of England 2% Target', source: 'FT', time: '5h ago', category: 'Macro', sentiment: 0.25, impact: 'MEDIUM', breaking: false, tickers: ['GBP/USD', 'EWU'], summary: 'CPI dropped to 2.0% in May, down from 2.3% in April, boosting expectations for an August rate cut.' },
  { id: 16, headline: 'Broadcom Stock Splits 10-for-1 After AI Revenue Doubles', source: 'Bloomberg', time: '5h ago', category: 'Earnings', sentiment: 0.80, impact: 'MEDIUM', breaking: false, tickers: ['AVGO'], summary: 'Broadcom announced a 10-for-1 stock split after reporting AI revenue doubled to $3.1B in Q2.' },
  { id: 17, headline: 'US-China Trade Tensions Escalate Over EV Tariffs', source: 'WSJ', time: '6h ago', category: 'Policy', sentiment: -0.55, impact: 'HIGH', breaking: false, tickers: ['FXI', 'NIO', 'XPEV'], summary: 'Biden administration finalizes 100% tariffs on Chinese EVs, 50% on semiconductors, solar cells.' },
  { id: 18, headline: 'GameStop Completes $933M Share Offering, Stock Drops 12%', source: 'CNBC', time: '7h ago', category: 'Company', sentiment: -0.70, impact: 'LOW', breaking: false, tickers: ['GME', 'AMC'], summary: 'Meme stock darling completed at-the-market offering of 75M shares, diluting existing shareholders.' },
  { id: 19, headline: 'Saudi Aramco IPO: Secondary Offering Raises $11.2B', source: 'Reuters', time: '8h ago', category: 'M&A', sentiment: 0.15, impact: 'MEDIUM', breaking: false, tickers: ['2222.SR'], summary: 'Saudi Arabia sold 1.545B shares at 27.25 SAR each in world\'s largest offering since its 2019 IPO.' },
  { id: 20, headline: 'Palantir Added to S&P 500, Shares Surge 14%', source: 'Bloomberg', time: '9h ago', category: 'Company', sentiment: 0.65, impact: 'MEDIUM', breaking: false, tickers: ['PLTR'], summary: 'S&P Dow Jones Indices announced Palantir will replace American Airlines in the benchmark index.' },
];

const SOURCES = ['All', 'Reuters', 'Bloomberg', 'CNBC', 'FT', 'WSJ'];
const CATEGORIES = ['All', 'Macro', 'Earnings', 'M&A', 'Policy', 'Crypto', 'Commodities', 'FX', 'Technology', 'Company', 'Strategy'];

function sentimentColor(s: number) { return s > 0.3 ? T.up : s < -0.3 ? T.dn : T.warn; }
function sentimentLabel(s: number) { return s > 0.5 ? 'Bullish' : s > 0.2 ? 'Lean Bull' : s > -0.2 ? 'Neutral' : s > -0.5 ? 'Lean Bear' : 'Bearish'; }

/* Main Component */
export default function NewsTerminalUI2() {
  // ── Hook integration ──
  const [socialState, socialActions] = useSocial();

  const [source, setSource] = useState('All');
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    return NEWS_DATA.filter(n => {
      if (source !== 'All' && n.source !== source) return false;
      if (category !== 'All' && n.category !== category) return false;
      if (search && !n.headline.toLowerCase().includes(search.toLowerCase()) && !n.tickers.some(t => t.toLowerCase().includes(search.toLowerCase()))) return false;
      return true;
    });
  }, [source, category, search]);

  const avgSentiment = filtered.length ? filtered.reduce((s, n) => s + n.sentiment, 0) / filtered.length : 0;
  const selected = NEWS_DATA.find(n => n.id === selectedId);

  return (
    <div data-testid="news-terminal-page" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '6px', height: '100%', padding: '6px', background: T.bg0, color: T.text1, fontFamily: T.fontSans, overflow: 'hidden' }}>
      {/* Left — Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minHeight: 0 }}>
        {/* Toolbar */}
        <div style={{ ...panelStyle, flexDirection: 'row', padding: '4px 8px', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search news / tickers…" style={{ background: T.bg2, border: `1px solid ${T.border0}`, color: T.text0, padding: '3px 8px', borderRadius: T.radius, fontSize: '10px', fontFamily: T.fontSans, width: '150px', outline: 'none' }} />
          <div style={{ display: 'flex', gap: '2px' }}>
            {SOURCES.map(s => <button key={s} onClick={() => setSource(s)} style={{ background: source === s ? T.brand : 'transparent', color: source === s ? '#FFF' : T.text3, border: 'none', padding: '2px 5px', borderRadius: '2px', fontSize: '8px', cursor: 'pointer', fontWeight: 600, fontFamily: T.fontSans }}>{s}</button>)}
          </div>
          <div style={{ height: '12px', width: '1px', background: T.border1 }} />
          <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
            {CATEGORIES.slice(0, 7).map(c => <button key={c} onClick={() => setCategory(c)} style={{ background: category === c ? T.brand : 'transparent', color: category === c ? '#FFF' : T.text3, border: 'none', padding: '2px 5px', borderRadius: '2px', fontSize: '8px', cursor: 'pointer', fontWeight: 600, fontFamily: T.fontSans }}>{c}</button>)}
          </div>
        </div>

        {/* Feed */}
        <div style={{ ...panelStyle, flex: 1 }}>
          <div style={panelHdr}><span>NEWS FEED ({filtered.length})</span><span style={{ color: sentimentColor(avgSentiment), fontSize: '9px' }}>Avg Sentiment: {sentimentLabel(avgSentiment)}</span></div>
          <div style={{ flex: 1, overflow: 'auto', scrollbarWidth: 'thin' }}>
            {filtered.map(n => (
              <div key={n.id} onClick={() => setSelectedId(n.id)} style={{ padding: '6px 10px', borderBottom: `1px solid ${T.border0}`, cursor: 'pointer', background: selectedId === n.id ? T.bg2 : 'transparent', transition: 'background 0.15s' }} onMouseEnter={e => { if (selectedId !== n.id) e.currentTarget.style.background = T.bg2; }} onMouseLeave={e => { if (selectedId !== n.id) e.currentTarget.style.background = ''; }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  {n.breaking && <span style={{ background: T.dn, color: '#FFF', fontSize: '7px', fontWeight: 800, padding: '1px 4px', borderRadius: '2px', flexShrink: 0, marginTop: '1px' }}>BREAKING</span>}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: T.text0, lineHeight: '1.35', marginBottom: '3px' }}>{n.headline}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '9px', color: T.text3 }}>{n.source}</span>
                      <span style={{ fontSize: '9px', color: T.text3 }}>·</span>
                      <span style={{ fontSize: '9px', color: T.text3 }}>{n.time}</span>
                      <span style={{ background: T.bg3, color: T.info, fontSize: '8px', padding: '1px 4px', borderRadius: '2px', fontWeight: 600 }}>{n.category}</span>
                      <span style={{ fontSize: '8px', color: n.impact === 'HIGH' ? T.dn : n.impact === 'MEDIUM' ? T.warn : T.text3, fontWeight: 700 }}>{n.impact}</span>
                      <div style={{ display: 'flex', gap: '3px' }}>
                        {n.tickers.slice(0, 3).map(t => <span key={t} style={{ fontSize: '8px', color: T.brand, fontFamily: T.fontMono, fontWeight: 600 }}>{t}</span>)}
                      </div>
                    </div>
                  </div>
                  {/* Sentiment bar */}
                  <div style={{ width: '40px', textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: sentimentColor(n.sentiment), fontFamily: T.fontMono }}>{n.sentiment > 0 ? '+' : ''}{n.sentiment.toFixed(2)}</div>
                    <div style={{ height: '3px', background: T.bg3, borderRadius: '2px', marginTop: '2px' }}>
                      <div style={{ width: `${Math.abs(n.sentiment) * 100}%`, height: '100%', background: sentimentColor(n.sentiment), borderRadius: '2px', marginLeft: n.sentiment < 0 ? 'auto' : undefined }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — Detail + Sentiment */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minHeight: 0 }}>
        {/* Sentiment Gauge */}
        <div style={{ ...panelStyle, flexShrink: 0 }}>
          <div style={panelHdr}><span>MARKET SENTIMENT</span></div>
          <div style={{ padding: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', fontWeight: 800, color: sentimentColor(avgSentiment), fontFamily: T.fontMono }}>{avgSentiment > 0 ? '+' : ''}{avgSentiment.toFixed(2)}</div>
            <div style={{ fontSize: '11px', color: sentimentColor(avgSentiment), fontWeight: 700 }}>{sentimentLabel(avgSentiment)}</div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '8px' }}>
              {[{ label: 'Bullish', count: filtered.filter(n => n.sentiment > 0.2).length, color: T.up }, { label: 'Neutral', count: filtered.filter(n => n.sentiment >= -0.2 && n.sentiment <= 0.2).length, color: T.warn }, { label: 'Bearish', count: filtered.filter(n => n.sentiment < -0.2).length, color: T.dn }].map(b => (
                <div key={b.label}><div style={{ fontSize: '16px', fontWeight: 800, color: b.color, fontFamily: T.fontMono }}>{b.count}</div><div style={{ fontSize: '8px', color: T.text3 }}>{b.label}</div></div>
              ))}
            </div>
          </div>
        </div>

        {/* Detail */}
        <div style={{ ...panelStyle, flex: 1 }}>
          <div style={panelHdr}><span>ARTICLE DETAIL</span></div>
          {selected ? (
            <div style={{ padding: '10px', flex: 1, overflow: 'auto', scrollbarWidth: 'thin' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: T.text0, lineHeight: '1.4', marginBottom: '8px' }}>{selected.headline}</div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '9px', color: T.text2 }}>{selected.source}</span>
                <span style={{ fontSize: '9px', color: T.text3 }}>{selected.time}</span>
                <span style={{ background: T.bg3, color: T.info, fontSize: '8px', padding: '1px 5px', borderRadius: '2px', fontWeight: 600 }}>{selected.category}</span>
                <span style={{ fontSize: '8px', fontWeight: 700, color: selected.impact === 'HIGH' ? T.dn : selected.impact === 'MEDIUM' ? T.warn : T.text3 }}>{selected.impact} IMPACT</span>
              </div>
              <div style={{ fontSize: '11px', color: T.text1, lineHeight: '1.6', marginBottom: '12px' }}>{selected.summary}</div>
              <div style={{ borderTop: `1px solid ${T.border0}`, paddingTop: '8px' }}>
                <div style={{ fontSize: '9px', color: T.text3, marginBottom: '4px' }}>RELATED TICKERS</div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {selected.tickers.map(t => <span key={t} style={{ background: T.bg3, color: T.brand, padding: '2px 6px', borderRadius: '2px', fontSize: '10px', fontFamily: T.fontMono, fontWeight: 700 }}>{t}</span>)}
                </div>
              </div>
              <div style={{ borderTop: `1px solid ${T.border0}`, paddingTop: '8px', marginTop: '8px' }}>
                <div style={{ fontSize: '9px', color: T.text3, marginBottom: '4px' }}>SENTIMENT ANALYSIS</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: sentimentColor(selected.sentiment), fontFamily: T.fontMono }}>{selected.sentiment > 0 ? '+' : ''}{selected.sentiment.toFixed(2)}</div>
                  <div style={{ fontSize: '10px', color: sentimentColor(selected.sentiment), fontWeight: 600 }}>{sentimentLabel(selected.sentiment)}</div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.text3, fontSize: '11px' }}>Click a headline to view details</div>
          )}
        </div>

        {/* Breaking Alerts */}
        <div style={{ ...panelStyle, flexShrink: 0, maxHeight: '120px' }}>
          <div style={panelHdr}><span style={{ color: T.dn }}>⚡ BREAKING</span></div>
          <div style={{ overflow: 'auto', scrollbarWidth: 'thin' }}>
            {NEWS_DATA.filter(n => n.breaking).map(n => (
              <div key={n.id} style={{ padding: '4px 10px', borderBottom: `1px solid ${T.border0}`, cursor: 'pointer' }} onClick={() => setSelectedId(n.id)}>
                <div style={{ fontSize: '10px', fontWeight: 600, color: T.text0 }}>{n.headline}</div>
                <div style={{ fontSize: '8px', color: T.text3 }}>{n.source} · {n.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
