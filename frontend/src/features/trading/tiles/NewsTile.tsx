// Bloomberg NW — News Terminal Tile
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const SUBTLE = '#555';
const TEXT = '#d1d4dc';
const MONO = '"Roboto Mono","Courier New",monospace';

import { useState } from 'react';
import React from 'react';

interface TileProps {
    tileId: string;
    onClose: () => void;
    onMaximize: () => void;
    isMaximized: boolean;
}

type Sentiment = 'bullish' | 'bearish' | 'neutral';
type Category = 'all' | 'earnings' | 'macro' | 'sector' | 'analyst';

interface NewsItem {
    id: string;
    headline: string;
    source: string;
    time: string;
    symbols: string[];
    sentiment: Sentiment;
    category: Category;
    subhead: string;
    impact: 'high' | 'medium' | 'low';
}

const SENTIMENT_COLOR: Record<Sentiment, string> = { bullish: GREEN, bearish: RED, neutral: SUBTLE };
const SENTIMENT_LABEL: Record<Sentiment, string> = { bullish: '▲', bearish: '▼', neutral: '—' };
const IMPACT_COLOR = { high: RED, medium: AMBER, low: SUBTLE };

const MOCK_NEWS: NewsItem[] = [
    { id:'1',  headline:'Apple Reports Record Q4 Earnings, Beats Revenue Expectations by 8%',   source:'Reuters',      time:'2m',  symbols:['AAPL'],        sentiment:'bullish', category:'earnings', subhead:'EPS $2.18 vs $2.10 est; Services revenue +16% YoY',         impact:'high'   },
    { id:'2',  headline:'Fed Signals Potential Rate Cuts in 2024 as Inflation Cools',            source:'Bloomberg',    time:'15m', symbols:['SPY','QQQ'],    sentiment:'bullish', category:'macro',    subhead:'FOMC minutes reveal three members supported cutting '
                                                                                                                                                                                                                         + 'rates at last meeting',                                    impact:'high'   },
    { id:'3',  headline:'NVIDIA Faces Supply Chain Constraints for Next-Gen AI Chips',           source:'WSJ',          time:'32m', symbols:['NVDA'],         sentiment:'bearish', category:'sector',   subhead:'CoWoS packaging bottleneck could limit H200 shipments Q1 \'24', impact:'medium' },
    { id:'4',  headline:'Tesla Cuts Prices in Europe Amid Intensifying EV Competition',          source:'CNBC',         time:'1h',  symbols:['TSLA'],         sentiment:'bearish', category:'sector',   subhead:'Model 3 and Y reduced 5-10% in Germany, France, UK',         impact:'medium' },
    { id:'5',  headline:'Microsoft Azure Cloud Revenue Accelerates 28% in Strong Quarter',       source:'TechCrunch',   time:'2h',  symbols:['MSFT'],         sentiment:'bullish', category:'earnings', subhead:'Copilot adoption cited as key driver; FY24 guidance raised',  impact:'high'   },
    { id:'6',  headline:'Meta Expands AI Features Across All Core Platforms Globally',           source:'The Verge',    time:'3h',  symbols:['META'],         sentiment:'neutral', category:'sector',   subhead:'Llama 3 integration rolling out to WhatsApp, Instagram, FB',  impact:'low'    },
    { id:'7',  headline:'Goldman Sachs Upgrades S&P 500 Target to 5,200 for Year-End',          source:'GS Research',  time:'4h',  symbols:['SPY','GS'],     sentiment:'bullish', category:'analyst',  subhead:'Earnings resilience and AI productivity cited as catalysts',  impact:'medium' },
    { id:'8',  headline:'JPMorgan Downgrades Intel on PC Market Weakness Concerns',              source:'JP Morgan',    time:'5h',  symbols:['INTC','JPM'],   sentiment:'bearish', category:'analyst',  subhead:'Cuts PT to $36 from $45; PC TAM shrinking faster than model', impact:'medium' },
    { id:'9',  headline:'CPI Data Shows Inflation at 3.2%, In Line With Forecasts',             source:'BLS',          time:'8h',  symbols:['SPY','TLT'],    sentiment:'neutral', category:'macro',    subhead:'Core CPI ex food/energy +3.8% YoY; shelter remains sticky',  impact:'high'   },
    { id:'10', headline:'Amazon Web Services Wins $1.2B Pentagon Multi-Cloud Contract',          source:'Reuters',      time:'12h', symbols:['AMZN'],         sentiment:'bullish', category:'sector',   subhead:'Joint Warfighter Cloud Capability award extends DoD relationship',impact:'medium'},
];

const CATEGORIES: { key: Category | 'all'; label: string }[] = [
    { key:'all',      label:'ALL'      },
    { key:'earnings', label:'EARNINGS' },
    { key:'macro',    label:'MACRO'    },
    { key:'sector',   label:'SECTOR'   },
    { key:'analyst',  label:'ANALYST'  },
];

export function NewsTile({ tileId: _tileId, isMaximized: _isMaximized }: TileProps) {
    const [filter, setFilter] = useState<'all' | Sentiment | Category>('all');
    const [sentFilter, setSentFilter] = useState<'all' | Sentiment>('all');
    const [selected, setSelected] = useState<NewsItem | null>(null);
    const [hovered, setHovered] = useState<string | null>(null);

    const filtered = MOCK_NEWS.filter(item => {
        const catOk = filter === 'all' || item.category === filter || item.sentiment === filter;
        const sentOk = sentFilter === 'all' || item.sentiment === sentFilter;
        return catOk && sentOk;
    });

    return (
        <div style={{ height:'100%', display:'flex', flexDirection:'column', background:BG, fontFamily:MONO, fontSize:12, color:TEXT }}>
            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 8px', background:PANEL, borderBottom:`1px solid ${BORDER}`, flexShrink:0 }}>
                <span style={{ color:AMBER, fontWeight:700, fontSize:11, letterSpacing:2 }}>NW — NEWS FEED</span>
                <div style={{ display:'flex', gap:4 }}>
                    {(['all','bullish','bearish','neutral'] as const).map(s => (
                        <button key={s} onClick={() => setSentFilter(s)}
                            style={{
                                background: sentFilter === s ? SENTIMENT_COLOR[s as Sentiment] ?? AMBER : 'transparent',
                                border:`1px solid ${sentFilter === s ? SENTIMENT_COLOR[s as Sentiment] ?? AMBER : BORDER}`,
                                color: sentFilter === s ? BG : s === 'all' ? SUBTLE : SENTIMENT_COLOR[s as Sentiment],
                                fontFamily:MONO, fontSize:8, padding:'1px 5px', cursor:'pointer', borderRadius:2,
                            }}>
                            {s === 'all' ? 'ALL' : SENTIMENT_LABEL[s as Sentiment]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Category filter */}
            <div style={{ display:'flex', gap:2, padding:'3px 8px', borderBottom:`1px solid ${BORDER}`, background:'#0d0d0d', flexShrink:0, overflowX:'auto' }}>
                {CATEGORIES.map(c => (
                    <button key={c.key} onClick={() => setFilter(c.key)}
                        style={{
                            background: filter === c.key ? AMBER : 'transparent',
                            border:`1px solid ${filter === c.key ? AMBER : BORDER}`,
                            color: filter === c.key ? BG : SUBTLE,
                            fontFamily:MONO, fontSize:8, padding:'1px 6px', cursor:'pointer', borderRadius:2, whiteSpace:'nowrap',
                        }}>
                        {c.label}
                    </button>
                ))}
                <span style={{ marginLeft:'auto', color:SUBTLE, fontSize:9, alignSelf:'center' }}>{filtered.length} STORIES</span>
            </div>

            {/* News list */}
            <div style={{ flex:1, overflowY:'auto' }}>
                {filtered.map(item => {
                    const isSel = selected?.id === item.id;
                    const isHov = hovered === item.id;
                    return (
                        <div key={item.id}
                            onClick={() => setSelected(isSel ? null : item)}
                            onMouseEnter={() => setHovered(item.id)}
                            onMouseLeave={() => setHovered(null)}
                            style={{
                                padding:'6px 8px', cursor:'pointer',
                                background: isSel ? '#1a1200' : isHov ? '#141414' : 'transparent',
                                borderBottom:`1px solid ${BORDER}`,
                                borderLeft:`3px solid ${SENTIMENT_COLOR[item.sentiment]}`,
                            }}
                        >
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:2, gap:6 }}>
                                <div style={{ flex:1, color: isHov || isSel ? AMBER : TEXT, fontSize:11, lineHeight:1.4 }}>
                                    {item.headline}
                                </div>
                                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2, flexShrink:0 }}>
                                    <span style={{ color: IMPACT_COLOR[item.impact], fontSize:8, border:`1px solid ${IMPACT_COLOR[item.impact]}`, padding:'0 3px', borderRadius:1 }}>
                                        {item.impact.toUpperCase()}
                                    </span>
                                </div>
                            </div>
                            <div style={{ color:SUBTLE, fontSize:10 }}>{item.subhead}</div>
                            <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:3 }}>
                                <span style={{ color:BLUE, fontSize:9 }}>{item.source}</span>
                                <span style={{ color:SUBTLE, fontSize:9 }}>{item.time} ago</span>
                                <div style={{ display:'flex', gap:3 }}>
                                    {item.symbols.map(s => (
                                        <span key={s} style={{ color:AMBER, fontSize:9, border:`1px solid ${BORDER}`, padding:'0 3px', borderRadius:1 }}>{s}</span>
                                    ))}
                                </div>
                                <span style={{ marginLeft:'auto', color:SENTIMENT_COLOR[item.sentiment], fontSize:9 }}>
                                    {SENTIMENT_LABEL[item.sentiment]} {item.sentiment.toUpperCase()}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer counts */}
            <div style={{ padding:'3px 8px', background:'#0d0d0d', borderTop:`1px solid ${BORDER}`, display:'flex', gap:12, flexShrink:0 }}>
                {(['bullish','bearish','neutral'] as Sentiment[]).map(s => (
                    <span key={s} style={{ color:SENTIMENT_COLOR[s], fontSize:9 }}>
                        {SENTIMENT_LABEL[s]} {MOCK_NEWS.filter(n => n.sentiment === s).length}
                    </span>
                ))}
                <span style={{ marginLeft:'auto', color:SUBTLE, fontSize:9 }}>MOCK DATA</span>
            </div>
        </div>
    );
}
