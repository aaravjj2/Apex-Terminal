// â”€â”€â”€ Bloomberg palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BG='#0a0a0a',PANEL='#111111',BORDER='#1e1e1e'
const AMBER='#f5a623',GREEN='#26a69a',RED='#ef5350',BLUE='#42a5f5'
const PURPLE='#ab47bc',ORANGE='#ff8a65',SUBTLE='#555',TEXT='#d1d4dc'
const MONO='"Roboto Mono","Courier New",monospace'

const Th=({c,ch}:{c?:React.CSSProperties,ch:React.ReactNode})=>(
  <th style={{padding:'6px 10px',fontSize:10,fontFamily:MONO,color:SUBTLE,textTransform:'uppercase' as const,
    letterSpacing:'0.08em',borderBottom:`1px solid ${BORDER}`,textAlign:'left',...c}}>{ch}</th>
)
const Td=({c,ch}:{c?:React.CSSProperties,ch:React.ReactNode})=>(
  <td style={{padding:'6px 10px',fontSize:11,fontFamily:MONO,borderBottom:`1px solid ${BORDER}`,color:TEXT,...c}}>{ch}</td>
)
function StatCard({label,value,color}:{label:string,value:string,color?:string}){
  return (
    <div style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,padding:'7px 10px',minWidth:90}}>
      <div style={{fontSize:9,fontFamily:MONO,color:SUBTLE,textTransform:'uppercase' as const,letterSpacing:'0.08em',marginBottom:3}}>{label}</div>
      <div style={{fontSize:15,fontFamily:MONO,color:color||AMBER,fontWeight:700}}>{value}</div>
    </div>
  )
}
function EvtBadge({type}:{type:string}){
  const c=type==='error'?RED:type==='warn'?AMBER:BLUE
  return <span style={{fontSize:9,fontFamily:MONO,color:c,border:`1px solid ${c}`,padding:'1px 5px',borderRadius:2,
    textTransform:'uppercase' as const,letterSpacing:'0.06em'}}>{type}</span>
}

import React, { useState, useEffect } from 'react';

const API_BASE = '/api/v1';

interface Incident {
    incident_id: string;
    run_id: string;
    strategy_id: string;
    captured_at: string;
    duration_seconds: number;
    event_count: number;
    content_hash: string;
}
interface IncidentDetail extends Incident {
    events?: Array<{type:string;timestamp:string;payload?:unknown}>
}
interface ReplayResult {
    events_replayed:number;
    errors:string[];
    output_hash:string;
}

const TABS=['INCIDENTS','DETAIL','REPLAY'] as const
type ITab=typeof TABS[number]

export function IncidentViewer() {
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<IncidentDetail|null>(null);
    const [replay, setReplay] = useState<ReplayResult|null>(null);
    const [tab, setTab] = useState<ITab>('INCIDENTS');
    const [replayLoading, setReplayLoading] = useState(false);

    useEffect(() => { fetchIncidents(); }, []);

    const fetchIncidents = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/incidents`);
            if (res.ok) setIncidents(await res.json());
        } catch (e) { console.error('Failed to fetch incidents:', e); }
        finally { setLoading(false); }
    };

    const viewIncident = async (id: string) => {
        try {
            const res = await fetch(`${API_BASE}/incidents/${id}`);
            if (res.ok) {
                setSelected(await res.json());
                setReplay(null);
                setTab('DETAIL');
            }
        } catch (e) { console.error('Failed to fetch incident:', e); }
    };

    const replayIncident = async (id: string) => {
        setReplayLoading(true);
        try {
            const res = await fetch(`${API_BASE}/incidents/${id}/replay`, { method: 'POST' });
            if (res.ok) { setReplay(await res.json()); setTab('REPLAY'); }
        } catch (e) { console.error('Failed to replay:', e); }
        finally { setReplayLoading(false); }
    };

    const fmtDur = (s:number) => {
        const m=Math.floor(s/60), sec=Math.floor(s%60);
        return `${m}m ${sec}s`;
    };
    const fmtTime = (iso:string) => new Date(iso).toLocaleString();

    const S:React.CSSProperties={height:'100%',display:'flex',flexDirection:'column' as const,background:BG,fontFamily:MONO}
    const HDR:React.CSSProperties={display:'flex',alignItems:'center',gap:8,padding:'8px 14px',
        borderBottom:`1px solid ${BORDER}`,background:PANEL,flexShrink:0}
    const TABBAR:React.CSSProperties={display:'flex',gap:2,padding:'0 14px',borderBottom:`1px solid ${BORDER}`,
        background:PANEL,flexShrink:0}
    const tbtn=(a:boolean):React.CSSProperties=>({padding:'7px 12px',fontSize:10,fontFamily:MONO,letterSpacing:'0.08em',
        cursor:'pointer',background:'none',border:'none',borderBottom:a?`2px solid ${AMBER}`:'2px solid transparent',
        color:a?AMBER:SUBTLE,textTransform:'uppercase' as const})

    return (
        <div style={S}>
            <div style={HDR}>
                <span style={{fontSize:11,color:RED,letterSpacing:'0.1em'}}>IV</span>
                <span style={{fontSize:13,color:TEXT,fontWeight:700}}>INCIDENT VIEWER</span>
                <span style={{fontSize:10,color:SUBTLE}}>APEX REPLAY ENGINE</span>
                <div style={{flex:1}}/>
                {loading&&<span style={{fontSize:10,color:AMBER}}>LOADING</span>}
                <button onClick={fetchIncidents} style={{fontSize:10,fontFamily:MONO,background:PANEL,
                    border:`1px solid ${BORDER}`,color:BLUE,padding:'3px 8px',cursor:'pointer',borderRadius:2}}>
                    REFRESH
                </button>
            </div>

            {/* Stats */}
            <div style={{display:'flex',gap:8,padding:'8px 14px',borderBottom:`1px solid ${BORDER}`,
                background:PANEL,flexShrink:0}}>
                <StatCard label="Total" value={String(incidents.length)} color={TEXT}/>
                <StatCard label="Avg Events" value={incidents.length?
                    String(Math.round(incidents.reduce((a,i)=>a+i.event_count,0)/incidents.length)):'â€”'} color={BLUE}/>
                <StatCard label="Avg Duration" value={incidents.length?
                    fmtDur(incidents.reduce((a,i)=>a+i.duration_seconds,0)/incidents.length):'â€”'} color={PURPLE}/>
            </div>

            <div style={TABBAR}>
                {TABS.map(t=><button key={t} style={tbtn(tab===t)} onClick={()=>setTab(t)}>{t}</button>)}
            </div>

            {/* INCIDENTS table */}
            {tab==='INCIDENTS'&&(
                <div style={{flex:1,overflowY:'auto' as const}}>
                    {incidents.length===0&&(
                        <div style={{padding:40,textAlign:'center' as const,fontSize:12,color:SUBTLE}}>
                            {loading?'LOADING...':'NO INCIDENTS CAPTURED'}
                        </div>
                    )}
                    {incidents.length>0&&(
                        <table style={{width:'100%',borderCollapse:'collapse'}}>
                            <thead style={{position:'sticky' as const,top:0,background:PANEL}}>
                                <tr>
                                    <Th ch="Incident ID"/>
                                    <Th ch="Strategy"/>
                                    <Th ch="Run ID"/>
                                    <Th ch="Captured"/>
                                    <Th c={{textAlign:'right'}} ch="Events"/>
                                    <Th c={{textAlign:'right'}} ch="Duration"/>
                                    <Th ch="Hash"/>
                                    <Th ch="Actions"/>
                                </tr>
                            </thead>
                            <tbody>
                                {incidents.map(inc=>(
                                    <tr key={inc.incident_id}
                                        onClick={()=>viewIncident(inc.incident_id)}
                                        style={{cursor:'pointer',background:selected?.incident_id===inc.incident_id?`${AMBER}11`:'transparent'}}>
                                        <Td c={{color:BLUE,fontSize:10}} ch={inc.incident_id.substring(0,18)}/>
                                        <Td c={{color:AMBER,fontSize:10}} ch={inc.strategy_id}/>
                                        <Td c={{fontSize:10,color:SUBTLE}} ch={inc.run_id.substring(0,14)}/>
                                        <Td c={{fontSize:10}} ch={fmtTime(inc.captured_at)}/>
                                        <Td c={{textAlign:'right',color:inc.event_count>100?RED:TEXT}} ch={inc.event_count}/>
                                        <Td c={{textAlign:'right'}} ch={fmtDur(inc.duration_seconds)}/>
                                        <Td c={{fontSize:9,color:SUBTLE}} ch={inc.content_hash.substring(0,12)+'â€¦'}/>
                                        <Td ch={
                                            <div style={{display:'flex',gap:4}} onClick={e=>e.stopPropagation()}>
                                                <button onClick={()=>viewIncident(inc.incident_id)}
                                                    style={{fontSize:9,fontFamily:MONO,background:PANEL,border:`1px solid ${BLUE}`,
                                                        color:BLUE,padding:'2px 6px',cursor:'pointer',borderRadius:2}}>VIEW</button>
                                                <button onClick={()=>replayIncident(inc.incident_id)}
                                                    style={{fontSize:9,fontFamily:MONO,background:PANEL,border:`1px solid ${GREEN}`,
                                                        color:GREEN,padding:'2px 6px',cursor:'pointer',borderRadius:2}}>â–¶ REPLAY</button>
                                                <a href={`${API_BASE}/incidents/${inc.incident_id}/export`} target="_blank"
                                                    style={{fontSize:9,fontFamily:MONO,color:PURPLE,border:`1px solid ${PURPLE}`,
                                                        padding:'2px 5px',borderRadius:2,textDecoration:'none'}}>â¬‡</a>
                                            </div>
                                        }/>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* DETAIL tab */}
            {tab==='DETAIL'&&(
                <div style={{flex:1,overflowY:'auto' as const,padding:14}}>
                    {!selected&&<div style={{padding:40,textAlign:'center' as const,color:SUBTLE,fontSize:12}}>SELECT INCIDENT FROM TABLE</div>}
                    {selected&&(
                        <div style={{display:'flex',flexDirection:'column' as const,gap:14}}>
                            <div style={{display:'flex',alignItems:'center',gap:12}}>
                                <span style={{fontSize:12,color:TEXT,fontWeight:700}}>INCIDENT {selected.incident_id}</span>
                                <div style={{flex:1}}/>
                                <button onClick={()=>replayIncident(selected.incident_id)} disabled={replayLoading}
                                    style={{fontSize:10,fontFamily:MONO,background:GREEN,border:'none',color:BG,
                                        padding:'4px 12px',cursor:'pointer',borderRadius:2,fontWeight:700,opacity:replayLoading?0.6:1}}>
                                    {replayLoading?'REPLAYING...':'â–¶ REPLAY'}
                                </button>
                                <a href={`${API_BASE}/incidents/${selected.incident_id}/export`} target="_blank"
                                    style={{fontSize:10,fontFamily:MONO,color:PURPLE,border:`1px solid ${PURPLE}`,
                                        padding:'4px 10px',borderRadius:2,textDecoration:'none'}}>EXPORT</a>
                            </div>

                            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
                                <StatCard label="Strategy" value={selected.strategy_id} color={AMBER}/>
                                <StatCard label="Events" value={String(selected.event_count)} color={BLUE}/>
                                <StatCard label="Duration" value={fmtDur(selected.duration_seconds)} color={PURPLE}/>
                            </div>

                            <div style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,padding:'10px 12px'}}>
                                <div style={{fontSize:9,color:SUBTLE,textTransform:'uppercase' as const,marginBottom:4}}>Content Hash</div>
                                <div style={{fontSize:11,fontFamily:MONO,color:SUBTLE,wordBreak:'break-all' as const}}>{selected.content_hash}</div>
                            </div>

                            <div>
                                <div style={{fontSize:10,color:SUBTLE,textTransform:'uppercase' as const,marginBottom:6,letterSpacing:'0.08em'}}>
                                    EVENTS TIMELINE ({selected.events?.length||0})
                                </div>
                                <div style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,maxHeight:280,overflowY:'auto' as const}}>
                                    {(selected.events||[]).slice(0,100).map((evt,i)=>(
                                        <div key={i} style={{display:'flex',gap:12,padding:'4px 10px',borderBottom:`1px solid ${BORDER}`,alignItems:'center'}}>
                                            <span style={{fontSize:9,color:SUBTLE,minWidth:80}}>{evt.timestamp?.split('T')[1]?.slice(0,8)||'â€”'}</span>
                                            <EvtBadge type={evt.type}/>
                                            <span style={{fontSize:10,color:SUBTLE,flex:1,overflow:'hidden',textOverflow:'ellipsis' as const,whiteSpace:'nowrap' as const}}>
                                                {evt.payload?JSON.stringify(evt.payload).substring(0,60):''}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* REPLAY tab */}
            {tab==='REPLAY'&&(
                <div style={{flex:1,overflowY:'auto' as const,padding:14}}>
                    {!replay&&<div style={{padding:40,textAlign:'center' as const,color:SUBTLE,fontSize:12}}>
                        {replayLoading?'REPLAYING...':'NO REPLAY RESULT â€” USE â–¶ REPLAY BUTTON'}
                    </div>}
                    {replay&&(
                        <div style={{display:'flex',flexDirection:'column' as const,gap:14,maxWidth:480}}>
                            <div style={{fontSize:12,color:TEXT,fontWeight:700}}>REPLAY RESULT</div>
                            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
                                <StatCard label="Events Replayed" value={String(replay.events_replayed)} color={GREEN}/>
                                <StatCard label="Errors" value={String(replay.errors?.length||0)} color={replay.errors?.length?RED:SUBTLE}/>
                                <StatCard label="Output Hash" value={replay.output_hash?.slice(0,8)+'â€¦'} color={PURPLE}/>
                            </div>
                            {replay.errors?.length>0&&(
                                <div style={{background:PANEL,border:`1px solid ${RED}`,borderRadius:2,padding:'10px 12px'}}>
                                    <div style={{fontSize:9,color:RED,textTransform:'uppercase' as const,marginBottom:6}}>Replay Errors</div>
                                    {replay.errors.map((e,i)=>(
                                        <div key={i} style={{fontSize:11,fontFamily:MONO,color:RED,padding:'2px 0'}}>{e}</div>
                                    ))}
                                </div>
                            )}
                            <div style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,padding:'10px 12px'}}>
                                <div style={{fontSize:9,color:SUBTLE,textTransform:'uppercase' as const,marginBottom:4}}>Full Output Hash</div>
                                <div style={{fontSize:11,fontFamily:MONO,color:SUBTLE,wordBreak:'break-all' as const}}>{replay.output_hash}</div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
