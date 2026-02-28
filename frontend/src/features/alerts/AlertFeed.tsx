// â”€â”€â”€ Bloomberg palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BG='#0a0a0a',PANEL='#111111',BORDER='#1e1e1e'
const AMBER='#f5a623',GREEN='#26a69a',RED='#ef5350',BLUE='#42a5f5'
const PURPLE='#ab47bc',ORANGE='#ff8a65',SUBTLE='#555',TEXT='#d1d4dc'
const MONO='"Roboto Mono","Courier New",monospace'

function CondBadge({cond}:{cond:string}){
  const c=cond.includes('above')||cond.includes('breakout')?GREEN:cond.includes('below')||cond.includes('rsi_below')?RED:ORANGE
  return <span style={{fontSize:9,color:c,border:`1px solid ${c}`,padding:'1px 5px',borderRadius:2,
    fontFamily:MONO,textTransform:'uppercase' as const,letterSpacing:'0.07em'}}>{cond.replace(/_/g,' ')}</span>
}
function StatPill({label,n,c}:{label:string,n:number,c:string}){
  return <span style={{fontSize:10,fontFamily:MONO,color:c}}><span style={{color:SUBTLE}}>{label}:</span> {n}</span>
}

import React, { useState, useEffect,useRef } from 'react';

const API_BASE = '/api/v1';

interface AlertTrigger {
    id: string;
    alert_id: string;
    alert_name: string;
    symbol: string;
    condition: string;
    target_value: number;
    triggered_value: number;
    timestamp: string;
    acknowledged: boolean;
}

type AFFilter='ALL'|'UNREAD'|'READ'

export function AlertFeed() {
    const [triggers, setTriggers] = useState<AlertTrigger[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [filter, setFilter] = useState<AFFilter>('ALL');
    const [toast, setToast] = useState<AlertTrigger|null>(null);
    const [selected, setSelected] = useState<AlertTrigger|null>(null);
    const prevLen = useRef(0);

    const fetchTriggers = async () => {
        try {
            const res = await fetch(`${API_BASE}/alerts/triggers`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data:AlertTrigger[] = await res.json();
            if (data.length > prevLen.current) {
                const newest = data[0];
                if (!newest.acknowledged) { setToast(newest); setTimeout(()=>setToast(null),5000); }
            }
            prevLen.current = data.length;
            setTriggers(data);
        } catch (e) {
            console.error('Failed to fetch triggers:', e);
        }
    };

    useEffect(() => {
        fetchTriggers();
        const i = setInterval(fetchTriggers, 5000);
        return () => clearInterval(i);
    }, []);

    const acknowledge = async (id: string) => {
        setTriggers(prev => prev.map(t => t.id===id?{...t,acknowledged:true}:t));
        setSelected(s=>s&&s.id===id?{...s,acknowledged:true}:s);
    };
    const acknowledgeAll = () => setTriggers(prev => prev.map(t=>({...t,acknowledged:true})));
    const clearAll = () => { setTriggers([]); setSelected(null); };

    const unread = triggers.filter(t=>!t.acknowledged).length;
    const display = triggers.filter(t=>filter==='UNREAD'?!t.acknowledged:filter==='READ'?t.acknowledged:true);

    const fmtTime = (iso:string) => {
        const diff=Date.now()-new Date(iso).getTime();
        if(diff<60000) return 'just now';
        if(diff<3600000) return `${Math.floor(diff/60000)}m ago`;
        if(diff<86400000) return `${Math.floor(diff/3600000)}h ago`;
        return new Date(iso).toLocaleDateString();
    };

    // Outer wrapper for the toggle button (embedded usage)
    const S_BTN:React.CSSProperties={position:'relative',display:'inline-flex',alignItems:'center',gap:6,
        padding:'4px 10px',fontSize:10,fontFamily:MONO,background:PANEL,border:`1px solid ${ORANGE}`,
        color:ORANGE,cursor:'pointer',borderRadius:2}
    const S_BADGE:React.CSSProperties={position:'absolute',top:-6,right:-6,width:16,height:16,borderRadius:'50%',
        background:RED,color:BG,fontSize:8,fontFamily:MONO,display:'flex',alignItems:'center',
        justifyContent:'center',fontWeight:700}

    return (
        <>
            {/* Toast */}
            {toast&&(
                <div style={{position:'fixed',top:16,right:16,zIndex:9999,background:PANEL,border:`1px solid ${ORANGE}`,
                    borderRadius:2,padding:'10px 14px',maxWidth:320,fontFamily:MONO,boxShadow:'0 4px 24px #0008'}}>
                    <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
                        <span style={{color:ORANGE,fontSize:14}}>âš </span>
                        <div style={{flex:1}}>
                            <div style={{fontSize:11,color:TEXT,fontWeight:700,marginBottom:2}}>{toast.alert_name}</div>
                            <div style={{fontSize:10,color:SUBTLE}}>{toast.symbol} â€” triggered @ {toast.triggered_value.toFixed(2)}</div>
                        </div>
                        <button onClick={()=>setToast(null)} style={{background:'none',border:'none',color:SUBTLE,cursor:'pointer',fontSize:12}}>âœ•</button>
                    </div>
                </div>
            )}

            {/* Toggle button */}
            <button onClick={()=>setIsOpen(v=>!v)} style={S_BTN}>
                ðŸ”” ALERT FEED
                {unread>0&&<span style={S_BADGE}>{unread}</span>}
            </button>

            {/* Feed Panel */}
            {isOpen&&(
                <div style={{position:'fixed',right:16,top:56,zIndex:900,width:400,maxHeight:560,
                    background:BG,border:`1px solid ${BORDER}`,borderRadius:2,display:'flex',flexDirection:'column',
                    fontFamily:MONO,boxShadow:'0 8px 32px #0009'}}>

                    {/* Header */}
                    <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',
                        borderBottom:`1px solid ${BORDER}`,background:PANEL,flexShrink:0}}>
                        <span style={{fontSize:11,color:ORANGE,letterSpacing:'0.1em'}}>AF</span>
                        <span style={{fontSize:12,color:TEXT,fontWeight:700}}>ALERT FEED</span>
                        <div style={{flex:1}}/>
                        <StatPill label="TOTAL" n={triggers.length} c={TEXT}/>
                        <StatPill label="UNREAD" n={unread} c={unread>0?RED:SUBTLE}/>
                        <button onClick={()=>setIsOpen(false)}
                            style={{background:'none',border:'none',color:SUBTLE,cursor:'pointer',fontSize:13,marginLeft:4}}>âœ•</button>
                    </div>

                    {/* Controls */}
                    <div style={{display:'flex',gap:4,padding:'6px 12px',borderBottom:`1px solid ${BORDER}`,
                        background:PANEL,flexShrink:0,alignItems:'center'}}>
                        {(['ALL','UNREAD','READ'] as AFFilter[]).map(f=>(
                            <button key={f} onClick={()=>setFilter(f)}
                                style={{padding:'3px 8px',fontSize:9,fontFamily:MONO,cursor:'pointer',
                                    border:`1px solid ${filter===f?AMBER:BORDER}`,borderRadius:2,
                                    background:filter===f?`${AMBER}22`:PANEL,
                                    color:filter===f?AMBER:SUBTLE,textTransform:'uppercase' as const}}>
                                {f}
                            </button>
                        ))}
                        <div style={{flex:1}}/>
                        <button onClick={acknowledgeAll}
                            style={{fontSize:9,fontFamily:MONO,background:'none',border:`1px solid ${GREEN}`,color:GREEN,
                                padding:'2px 6px',cursor:'pointer',borderRadius:2}}>ACK ALL</button>
                        <button onClick={clearAll}
                            style={{fontSize:9,fontFamily:MONO,background:'none',border:`1px solid ${RED}`,color:RED,
                                padding:'2px 6px',cursor:'pointer',borderRadius:2}}>CLEAR</button>
                    </div>

                    {/* Trigger list */}
                    <div style={{flex:1,overflowY:'auto'}}>
                        {display.length===0&&(
                            <div style={{padding:30,textAlign:'center',fontSize:11,color:SUBTLE}}>NO ALERTS TRIGGERED</div>
                        )}
                        {display.map(t=>(
                            <div key={t.id}
                                onClick={()=>{ setSelected(t); acknowledge(t.id); }}
                                style={{padding:'8px 12px',borderBottom:`1px solid ${BORDER}`,cursor:'pointer',
                                    background:t.id===selected?.id?`${AMBER}11`:!t.acknowledged?`${ORANGE}0a`:'transparent'}}>
                                <div style={{display:'flex',gap:8,alignItems:'flex-start'}}>
                                    <span style={{fontSize:13,color:t.acknowledged?SUBTLE:ORANGE,marginTop:1,flexShrink:0}}>
                                        {t.acknowledged?'âœ“':'âš '}
                                    </span>
                                    <div style={{flex:1,minWidth:0}}>
                                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
                                            <span style={{fontSize:11,color:t.acknowledged?SUBTLE:TEXT,fontWeight:700}}>{t.alert_name}</span>
                                            <span style={{fontSize:9,color:SUBTLE}}>{fmtTime(t.timestamp)}</span>
                                        </div>
                                        <div style={{display:'flex',gap:8,alignItems:'center'}}>
                                            <span style={{fontSize:10,color:AMBER,fontWeight:700}}>{t.symbol}</span>
                                            <CondBadge cond={t.condition}/>
                                            <span style={{fontSize:10,color:SUBTLE}}>Target: {t.target_value.toFixed(2)}</span>
                                            <span style={{fontSize:10,color:TEXT}}>â†’ {t.triggered_value.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Detail strip */}
                    {selected&&(
                        <div style={{borderTop:`1px solid ${BORDER}`,background:PANEL,padding:'8px 12px',flexShrink:0}}>
                            <div style={{display:'flex',gap:16,alignItems:'center',flexWrap:'wrap'}}>
                                <div><div style={{fontSize:8,color:SUBTLE,textTransform:'uppercase' as const}}>Alert</div>
                                    <div style={{fontSize:10,color:BLUE}}>{selected.alert_name}</div></div>
                                <div><div style={{fontSize:8,color:SUBTLE,textTransform:'uppercase' as const}}>Symbol</div>
                                    <div style={{fontSize:11,color:AMBER,fontWeight:700}}>{selected.symbol}</div></div>
                                <div><div style={{fontSize:8,color:SUBTLE,textTransform:'uppercase' as const}}>Target</div>
                                    <div style={{fontSize:10,color:TEXT}}>{selected.target_value.toFixed(4)}</div></div>
                                <div><div style={{fontSize:8,color:SUBTLE,textTransform:'uppercase' as const}}>Triggered</div>
                                    <div style={{fontSize:10,color:ORANGE}}>{selected.triggered_value.toFixed(4)}</div></div>
                                <div><div style={{fontSize:8,color:SUBTLE,textTransform:'uppercase' as const}}>Time</div>
                                    <div style={{fontSize:9,color:SUBTLE}}>{new Date(selected.timestamp).toLocaleString()}</div></div>
                                <button onClick={()=>setSelected(null)}
                                    style={{marginLeft:'auto',background:'none',border:'none',color:SUBTLE,cursor:'pointer',fontSize:9,fontFamily:MONO}}>CLOSE</button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}

interface AlertTrigger {
    id: string;
    alert_id: string;
    alert_name: string;
    symbol: string;
    condition: string;
    target_value: number;
    triggered_value: number;
    timestamp: string;
    acknowledged: boolean;
}
