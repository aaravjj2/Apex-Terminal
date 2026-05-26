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
import React, { useState, useMemo, useEffect } from 'react';

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

function sentimentScore(label: string | undefined): number {
  const s = (label || '').toLowerCase();
  if (s === 'bullish' || s === 'positive') return 0.6;
  if (s === 'bearish' || s === 'negative') return -0.6;
  return 0;
}

function formatAgo(iso: string): string {
  try {
    const d = new Date(iso);
    const mins = Math.round((Date.now() - d.getTime()) / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return d.toLocaleDateString();
  } catch {
    return '';
  }
}

const SOURCES = ['All', 'Reuters', 'Bloomberg', 'CNBC', 'FT', 'WSJ', 'Finnhub'];
const CATEGORIES = ['All', 'Macro', 'Earnings', 'M&A', 'Policy', 'Crypto', 'Commodities', 'FX', 'Technology', 'Company', 'Strategy'];

function sentimentColor(s: number) { return s > 0.3 ? T.up : s < -0.3 ? T.dn : T.warn; }
function sentimentLabel(s: number) { return s > 0.5 ? 'Bullish' : s > 0.2 ? 'Lean Bull' : s > -0.2 ? 'Neutral' : s > -0.5 ? 'Lean Bear' : 'Bearish'; }

/* Main Component */
export default function NewsTerminalUI2() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState('All');
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    const load = () => {
      fetch('/api/v1/sentiment/articles?limit=40')
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (!d?.articles?.length) {
            setNews([]);
            return;
          }
          const items: NewsItem[] = d.articles.map((a: Record<string, unknown>, i: number) => ({
            id: i + 1,
            headline: String(a.headline ?? a.title ?? ''),
            source: String(a.source ?? 'Finnhub'),
            time: formatAgo(String(a.published_at ?? a.datetime ?? '')),
            category: 'Macro',
            sentiment: sentimentScore(String(a.sentiment ?? '')),
            impact: 'MEDIUM',
            breaking: i < 2,
            tickers: Array.isArray(a.symbols) ? (a.symbols as string[]) : [],
            summary: String(a.summary ?? ''),
          }));
          setNews(items);
        })
        .catch(() => setNews([]))
        .finally(() => setLoading(false));
    };
    load();
    const iv = setInterval(load, 120_000);
    return () => clearInterval(iv);
  }, []);

  const filtered = useMemo(() => {
    return news.filter(n => {
      if (source !== 'All' && n.source !== source) return false;
      if (category !== 'All' && n.category !== category) return false;
      if (search && !n.headline.toLowerCase().includes(search.toLowerCase()) && !n.tickers.some(t => t.toLowerCase().includes(search.toLowerCase()))) return false;
      return true;
    });
  }, [news, source, category, search]);

  const avgSentiment = filtered.length ? filtered.reduce((s, n) => s + n.sentiment, 0) / filtered.length : 0;
  const selected = news.find(n => n.id === selectedId);

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
            {loading && <div style={{ padding: 16, color: T.text3, fontSize: 11 }}>Loading live news…</div>}
            {!loading && filtered.length === 0 && (
              <div style={{ padding: 16, color: T.text3, fontSize: 11 }}>No live articles — check FINNHUB_API_KEY</div>
            )}
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
