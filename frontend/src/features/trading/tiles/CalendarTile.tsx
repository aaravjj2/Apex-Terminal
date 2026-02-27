// Bloomberg CAL — Economic/Earnings Calendar Terminal Tile
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const PURPLE = '#ab47bc';
const ORANGE = '#ff8a65';
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

type EventType = 'earnings' | 'economic' | 'dividend' | 'conference' | 'fed' | 'ipo';

interface CalendarEvent {
    id: string;
    date: string;
    time: string;
    title: string;
    type: EventType;
    importance: 'high' | 'medium' | 'low';
    symbol?: string;
    details?: string;
    est?: string;
    prev?: string;
}

const TYPE_COLOR: Record<EventType, string> = {
    earnings:   BLUE,
    economic:   AMBER,
    dividend:   GREEN,
    conference: PURPLE,
    fed:        RED,
    ipo:        ORANGE,
};
const TYPE_LABEL: Record<EventType, string> = {
    earnings:   'EARN',
    economic:   'ECON',
    dividend:   'DIV',
    conference: 'CONF',
    fed:        'FED',
    ipo:        'IPO',
};
const IMP_COLOR = { high: RED, medium: AMBER, low: SUBTLE };

const MOCK_EVENTS: CalendarEvent[] = [
    { id:'1',  date:'TODAY',    time:'08:30', title:'CPI YoY',              type:'economic',   importance:'high',   details:'Consumer Price Index YoY', est:'3.2%',  prev:'3.4%'    },
    { id:'2',  date:'TODAY',    time:'10:00', title:'FOMC Minutes',         type:'fed',        importance:'high',   details:'Federal Reserve minutes release'                       },
    { id:'3',  date:'TODAY',    time:'16:15', title:'AAPL Earnings',        type:'earnings',   importance:'high',   symbol:'AAPL', est:'$2.10 EPS',   prev:'$1.97 EPS'              },
    { id:'4',  date:'TOMORROW', time:'09:30', title:'MSFT Earnings',        type:'earnings',   importance:'high',   symbol:'MSFT', est:'$2.78 EPS',   prev:'$2.69 EPS'              },
    { id:'5',  date:'TOMORROW', time:'10:00', title:'Powell Speaks — Jackson Hole', type:'conference', importance:'high', details:'Annual Economic Symposium address'              },
    { id:'6',  date:'TOMORROW', time:'08:30', title:'Initial Jobless Claims', type:'economic', importance:'medium', details:'Weekly filings', est:'220K',  prev:'218K'              },
    { id:'7',  date:'JAN 18',   time:'08:30', title:'PPI MoM',              type:'economic',   importance:'medium', details:'Producer Price Index',  est:'0.1%',  prev:'0.0%'      },
    { id:'8',  date:'JAN 18',   time:'16:00', title:'NVDA Earnings',        type:'earnings',   importance:'high',   symbol:'NVDA', est:'$5.16 EPS',   prev:'$4.02 EPS'              },
    { id:'9',  date:'JAN 19',   time:'—',     title:'JPM Dividend',         type:'dividend',   importance:'low',    symbol:'JPM',  details:'$1.05/share ex-dividend'               },
    { id:'10', date:'JAN 22',   time:'—',     title:'RDDT IPO Pricing',     type:'ipo',        importance:'medium', symbol:'RDDT', details:'Expected range $31–$34'                },
    { id:'11', date:'JAN 22',   time:'09:30', title:'Retail Sales MoM',     type:'economic',   importance:'high',   details:'December retail sales',  est:'0.4%', prev:'-0.1%'      },
    { id:'12', date:'JAN 24',   time:'16:30', title:'META Earnings',        type:'earnings',   importance:'high',   symbol:'META', est:'$4.85 EPS',   prev:'$4.39 EPS'              },
];

const FILTER_KEYS: Array<'all' | EventType> = ['all','earnings','economic','fed','conference','dividend','ipo'];

export function CalendarTile({ tileId: _tileId, isMaximized: _isMaximized }: TileProps) {
    const [filter, setFilter] = useState<'all' | EventType>('all');
    const [impFilter, setImpFilter] = useState<'all' | 'high' | 'medium'>('all');
    const [selected, setSelected] = useState<CalendarEvent | null>(null);
    const [hovered, setHovered] = useState<string | null>(null);

    const filtered = MOCK_EVENTS.filter(e => {
        const typeOk = filter === 'all' || e.type === filter;
        const impOk = impFilter === 'all' || e.importance === impFilter;
        return typeOk && impOk;
    });

    const grouped: Record<string, CalendarEvent[]> = {};
    filtered.forEach(e => {
        if (!grouped[e.date]) grouped[e.date] = [];
        grouped[e.date].push(e);
    });

    return (
        <div style={{ height:'100%', display:'flex', flexDirection:'column', background:BG, fontFamily:MONO, fontSize:12, color:TEXT }}>
            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 8px', background:PANEL, borderBottom:`1px solid ${BORDER}`, flexShrink:0 }}>
                <span style={{ color:AMBER, fontWeight:700, fontSize:11, letterSpacing:2 }}>CAL — CALENDAR</span>
                <div style={{ display:'flex', gap:3 }}>
                    {(['all','high','medium'] as const).map(imp => (
                        <button key={imp} onClick={() => setImpFilter(imp)}
                            style={{
                                background: impFilter === imp ? IMP_COLOR[imp] ?? AMBER : 'transparent',
                                border:`1px solid ${impFilter === imp ? IMP_COLOR[imp] ?? AMBER : BORDER}`,
                                color: impFilter === imp ? BG : SUBTLE,
                                fontFamily:MONO, fontSize:8, padding:'1px 5px', cursor:'pointer', borderRadius:2,
                            }}>
                            {imp === 'all' ? 'ALL' : imp.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* Type filter */}
            <div style={{ display:'flex', gap:2, padding:'3px 8px', borderBottom:`1px solid ${BORDER}`, background:'#0d0d0d', flexShrink:0, overflowX:'auto' }}>
                {FILTER_KEYS.map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                        style={{
                            background: filter === f ? (f === 'all' ? AMBER : TYPE_COLOR[f as EventType]) : 'transparent',
                            border:`1px solid ${filter === f ? (f === 'all' ? AMBER : TYPE_COLOR[f as EventType]) : BORDER}`,
                            color: filter === f ? BG : SUBTLE,
                            fontFamily:MONO, fontSize:8, padding:'1px 5px', cursor:'pointer', borderRadius:2, whiteSpace:'nowrap',
                        }}>
                        {f === 'all' ? 'ALL' : TYPE_LABEL[f as EventType]}
                    </button>
                ))}
                <span style={{ marginLeft:'auto', color:SUBTLE, fontSize:9, alignSelf:'center' }}>{filtered.length} EVENTS</span>
            </div>

            {/* Events grouped by date */}
            <div style={{ flex:1, overflowY:'auto' }}>
                {Object.entries(grouped).map(([date, events]) => (
                    <div key={date}>
                        <div style={{ padding:'3px 8px', background:'#0d0d0d', color:AMBER, fontSize:9, fontWeight:700, borderBottom:`1px solid ${BORDER}`, position:'sticky', top:0 }}>
                            {date}
                        </div>
                        {events.map(event => {
                            const isSel = selected?.id === event.id;
                            const isHov = hovered === event.id;
                            return (
                                <div key={event.id}
                                    onClick={() => setSelected(isSel ? null : event)}
                                    onMouseEnter={() => setHovered(event.id)}
                                    onMouseLeave={() => setHovered(null)}
                                    style={{
                                        display:'flex', alignItems:'flex-start', gap:8, padding:'5px 8px', cursor:'pointer',
                                        background: isSel ? '#1a1200' : isHov ? '#141414' : 'transparent',
                                        borderBottom:`1px solid ${BORDER}`,
                                        borderLeft:`3px solid ${TYPE_COLOR[event.type]}`,
                                    }}
                                >
                                    <div style={{ flexShrink:0, width:35, textAlign:'right' }}>
                                        <div style={{ color:SUBTLE, fontSize:9 }}>{event.time}</div>
                                    </div>
                                    <div style={{ flex:1 }}>
                                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:1 }}>
                                            <span style={{ color: isHov || isSel ? AMBER : TEXT, fontSize:11 }}>{event.title}</span>
                                            <span style={{ color: IMP_COLOR[event.importance], fontSize:8, border:`1px solid ${IMP_COLOR[event.importance]}`, padding:'0 2px', borderRadius:1 }}>
                                                {event.importance.toUpperCase()}
                                            </span>
                                            {event.symbol && <span style={{ color:BLUE, fontSize:9, border:`1px solid ${BORDER}`, padding:'0 3px', borderRadius:1 }}>{event.symbol}</span>}
                                        </div>
                                        {event.details && <div style={{ color:SUBTLE, fontSize:9 }}>{event.details}</div>}
                                        {(event.est || event.prev) && (
                                            <div style={{ display:'flex', gap:10, marginTop:1 }}>
                                                {event.est  && <span style={{ color:AMBER, fontSize:9 }}>EST: {event.est}</span>}
                                                {event.prev && <span style={{ color:SUBTLE, fontSize:9 }}>PREV: {event.prev}</span>}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ flexShrink:0 }}>
                                        <span style={{ color:TYPE_COLOR[event.type], fontSize:8, border:`1px solid ${TYPE_COLOR[event.type]}`, padding:'1px 3px', borderRadius:1 }}>
                                            {TYPE_LABEL[event.type]}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div style={{ padding:'3px 8px', background:'#0d0d0d', borderTop:`1px solid ${BORDER}`, display:'flex', gap:10, flexShrink:0 }}>
                {(['earnings','economic','fed'] as EventType[]).map(t => (
                    <span key={t} style={{ color:TYPE_COLOR[t], fontSize:9 }}>
                        {TYPE_LABEL[t]} {MOCK_EVENTS.filter(e => e.type === t).length}
                    </span>
                ))}
                <span style={{ marginLeft:'auto', color:SUBTLE, fontSize:9 }}>MOCK DATA</span>
            </div>
        </div>
    );
}
