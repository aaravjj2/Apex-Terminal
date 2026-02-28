// Bloomberg AL — Alerts Terminal Tile
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

type AlertCondition = 'above' | 'below' | 'crosses' | 'pct_up' | 'pct_down';
type AlertPriority = 'high' | 'medium' | 'low';

interface Alert {
    id: string;
    symbol: string;
    condition: AlertCondition;
    price: number;
    currentPrice: number;
    enabled: boolean;
    triggered: boolean;
    priority: AlertPriority;
    note: string;
}

const SEED_PRICES: Record<string, number> = { SPY: 547.23, AAPL: 182.41, TSLA: 218.77, NVDA: 789.55, MSFT: 412.33, AMZN: 178.92 };

const MOCK_ALERTS: Alert[] = [
    { id:'1', symbol:'AAPL', condition:'above',   price:185.00, currentPrice:SEED_PRICES['AAPL'], enabled:true,  triggered:false, priority:'high',   note:'Earnings resistance' },
    { id:'2', symbol:'MSFT', condition:'below',   price:375.00, currentPrice:SEED_PRICES['MSFT'], enabled:true,  triggered:false, priority:'medium', note:'Support level' },
    { id:'3', symbol:'NVDA', condition:'crosses', price:900.00, currentPrice:SEED_PRICES['NVDA'], enabled:false, triggered:true,  priority:'high',   note:'ATH breakout watch' },
    { id:'4', symbol:'TSLA', condition:'below',   price:200.00, currentPrice:SEED_PRICES['TSLA'], enabled:true,  triggered:true,  priority:'low',    note:'Stop loss area' },
    { id:'5', symbol:'SPY',  condition:'pct_up',  price:550.00, currentPrice:SEED_PRICES['SPY'],  enabled:true,  triggered:false, priority:'medium', note:'+0.5% from open' },
    { id:'6', symbol:'AMZN', condition:'above',   price:180.00, currentPrice:SEED_PRICES['AMZN'], enabled:true,  triggered:false, priority:'low',    note:'Monthly high' },
];

const COND_LABEL: Record<AlertCondition, string> = {
    above: '▲ ABOVE', below: '▼ BELOW', crosses: '✕ CROSS', pct_up: '△ %UP', pct_down: '▽ %DN',
};
const COND_COLOR: Record<AlertCondition, string> = {
    above: GREEN, below: RED, crosses: AMBER, pct_up: GREEN, pct_down: RED,
};
const PRIORITY_COLOR: Record<AlertPriority, string> = { high: RED, medium: AMBER, low: SUBTLE };

export function AlertsTile({ tileId: _tileId, isMaximized: _isMaximized }: TileProps) {
    const [alerts, setAlerts] = useState<Alert[]>(MOCK_ALERTS);
    const [filterEnabled, setFilterEnabled] = useState<'all' | 'active' | 'triggered'>('all');
    const [hovered, setHovered] = useState<string | null>(null);
    const [newMode, setNewMode] = useState(false);
    const [newSym, setNewSym] = useState('');
    const [newPrice, setNewPrice] = useState('');

    const toggleAlert = (id: string) => setAlerts(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
    const deleteAlert = (id: string) => setAlerts(prev => prev.filter(a => a.id !== id));
    const clearTriggered = () => setAlerts(prev => prev.map(a => ({ ...a, triggered: false })));

    const filtered = alerts.filter(a => {
        if (filterEnabled === 'active') return a.enabled && !a.triggered;
        if (filterEnabled === 'triggered') return a.triggered;
        return true;
    });

    const activeCount = alerts.filter(a => a.enabled && !a.triggered).length;
    const triggeredCount = alerts.filter(a => a.triggered).length;

    return (
        <div style={{ height:'100%', display:'flex', flexDirection:'column', background:BG, fontFamily:MONO, fontSize:12, color:TEXT }}>
            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 8px', background:PANEL, borderBottom:`1px solid ${BORDER}`, flexShrink:0 }}>
                <span style={{ color:AMBER, fontWeight:700, fontSize:11, letterSpacing:2 }}>AL — ALERTS</span>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <span style={{ color:GREEN, fontSize:10 }}>◉ {activeCount} ACTIVE</span>
                    {triggeredCount > 0 && <span style={{ color:RED, fontSize:10 }}>⚑ {triggeredCount} TRIG</span>}
                    <button onClick={clearTriggered} style={{ background:'transparent', border:`1px solid ${BORDER}`, color:SUBTLE, fontFamily:MONO, fontSize:9, padding:'1px 5px', cursor:'pointer', borderRadius:2 }}>CLR</button>
                </div>
            </div>

            {/* Filter + Add */}
            <div style={{ display:'flex', gap:4, padding:'3px 8px', borderBottom:`1px solid ${BORDER}`, background:'#0d0d0d', flexShrink:0 }}>
                {(['all','active','triggered'] as const).map(f => (
                    <button key={f} onClick={() => setFilterEnabled(f)}
                        style={{ background: filterEnabled === f ? AMBER : 'transparent', border:`1px solid ${filterEnabled === f ? AMBER : BORDER}`, color: filterEnabled === f ? BG : SUBTLE, fontFamily:MONO, fontSize:9, padding:'1px 6px', cursor:'pointer', borderRadius:2, textTransform:'uppercase' }}>
                        {f}
                    </button>
                ))}
                <div style={{ flex:1 }} />
                <button onClick={() => setNewMode(m => !m)}
                    style={{ background: newMode ? AMBER : '#1a1a1a', border:`1px solid ${newMode ? AMBER : BORDER}`, color: newMode ? BG : TEXT, fontFamily:MONO, fontSize:10, padding:'1px 8px', cursor:'pointer', borderRadius:2 }}>
                    + NEW
                </button>
            </div>

            {newMode && (
                <div style={{ display:'flex', gap:4, padding:'4px 8px', borderBottom:`1px solid ${BORDER}`, background:'#0d0d00', flexShrink:0,alignItems:'center' }}>
                    <input value={newSym} onChange={e => setNewSym(e.target.value.toUpperCase())} placeholder="SYM"
                        style={{ width:60, background:BG, border:`1px solid ${AMBER}`, color:AMBER, fontFamily:MONO, fontSize:11, padding:'2px 4px', outline:'none', borderRadius:2 }} />
                    <input value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="PRICE"
                        style={{ width:70, background:BG, border:`1px solid ${BORDER}`, color:TEXT, fontFamily:MONO, fontSize:11, padding:'2px 4px', outline:'none', borderRadius:2 }} />
                    <button onClick={() => {
                        if (newSym && newPrice) {
                            const id = Date.now().toString();
                            setAlerts(prev => [...prev, { id, symbol:newSym, condition:'above', price:parseFloat(newPrice), currentPrice:SEED_PRICES[newSym] ?? parseFloat(newPrice), enabled:true, triggered:false, priority:'medium', note:'' }]);
                            setNewSym(''); setNewPrice(''); setNewMode(false);
                        }
                    }} style={{ background:GREEN, border:'none', color:BG, fontFamily:MONO, fontSize:10, padding:'2px 8px', cursor:'pointer', borderRadius:2 }}>ADD</button>
                </div>
            )}

            {/* Alert list */}
            <div style={{ flex:1, overflowY:'auto' }}>
                {filtered.map(alert => {
                    const dist = alert.currentPrice - alert.price;
                    const distPct = alert.price ? (dist / alert.price) * 100 : 0;
                    const isHov = hovered === alert.id;
                    return (
                        <div
                            key={alert.id}
                            onMouseEnter={() => setHovered(alert.id)}
                            onMouseLeave={() => setHovered(null)}
                            style={{
                                padding:'5px 8px', borderBottom:`1px solid ${BORDER}`,
                                background: alert.triggered ? '#140a00' : isHov ? '#141414' : 'transparent',
                                borderLeft: `2px solid ${alert.triggered ? AMBER : alert.enabled ? PRIORITY_COLOR[alert.priority] : BORDER}`,
                                opacity: alert.enabled ? 1 : 0.5,
                            }}
                        >
                            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                    <button onClick={() => toggleAlert(alert.id)}
                                        style={{ background:'none', border:'none', color: alert.enabled ? (alert.triggered ? AMBER : GREEN) : SUBTLE, cursor:'pointer', fontSize:14, padding:0, lineHeight:1 }}>
                                        {alert.enabled ? '◉' : '◎'}
                                    </button>
                                    <span style={{ color: alert.triggered ? AMBER : TEXT, fontWeight: alert.triggered ? 700 : 400 }}>{alert.symbol}</span>
                                    <span style={{ color: COND_COLOR[alert.condition], fontSize:9 }}>{COND_LABEL[alert.condition]}</span>
                                    <span style={{ color:TEXT, fontFamily:MONO }}>${alert.price.toFixed(2)}</span>
                                    {alert.triggered && <span style={{ color:AMBER, fontSize:9, fontWeight:700 }}>⚑ TRIGGERED</span>}
                                </div>
                                <button onClick={() => deleteAlert(alert.id)}
                                    style={{ background:'none', border:'none', color:SUBTLE, cursor:'pointer', fontSize:12, padding:'0 2px' }}>✕</button>
                            </div>
                            <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:2 }}>
                                <span style={{ color:SUBTLE, fontSize:9 }}>CUR: ${alert.currentPrice.toFixed(2)}</span>
                                <span style={{ color: dist >= 0 ? GREEN : RED, fontSize:9 }}>DIST: {dist >= 0 ? '+' : ''}{distPct.toFixed(2)}%</span>
                                {alert.note && <span style={{ color:SUBTLE, fontSize:9, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:100 }}>{alert.note}</span>}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer */}
            <div style={{ padding:'3px 8px', background:'#0d0d0d', borderTop:`1px solid ${BORDER}`, display:'flex', justifyContent:'space-between', flexShrink:0 }}>
                <span style={{ color:SUBTLE, fontSize:9 }}>{filtered.length}/{alerts.length} ALERTS</span>
                <span style={{ color:SUBTLE, fontSize:9 }}>MOCK DATA</span>
            </div>
        </div>
    );
}
