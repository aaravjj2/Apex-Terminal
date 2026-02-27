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
function RunStatusBadge({status}:{status:string}){
  const m:Record<string,string>={running:GREEN,paused:AMBER,stopped:SUBTLE,error:RED,
    completed:BLUE,pending:ORANGE}
  const c=m[status]||SUBTLE
  return <span style={{fontSize:9,fontFamily:MONO,color:c,border:`1px solid ${c}`,
    padding:'2px 6px',borderRadius:2,textTransform:'uppercase' as const,letterSpacing:'0.08em'}}>{status}</span>
}
function TypeBadge({t}:{t:string}){
  const c=t==='backtest'?PURPLE:ORANGE
  return <span style={{fontSize:9,fontFamily:MONO,color:c,padding:'2px 6px',borderRadius:2,
    textTransform:'uppercase' as const}}>{t}</span>
}
function StatCard({label,value,color}:{label:string,value:string,color?:string}){
  return (
    <div style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,padding:'7px 10px',minWidth:90}}>
      <div style={{fontSize:9,fontFamily:MONO,color:SUBTLE,textTransform:'uppercase' as const,letterSpacing:'0.08em',marginBottom:3}}>{label}</div>
      <div style={{fontSize:15,fontFamily:MONO,color:color||AMBER,fontWeight:700}}>{value}</div>
    </div>
  )
}

import { useState, useEffect } from 'react';

const API_BASE = '/api/v1';

interface Run {
    run_id: string;
    strategy_id: string;
    run_type: string;
    status: string;
    created_at: string;
    started_at: string | null;
    stopped_at: string | null;
    last_heartbeat: string | null;
    last_error: string | null;
    error_count: number;
    restart_count: number;
}

interface LogEntry {level:string;timestamp:string;message:string}

const TABS=['ALL RUNS','RUNNING','HISTORY','LOGS'] as const
type RTab=typeof TABS[number]

export function RunsDashboard() {
    const [runs, setRuns] = useState<Run[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedRun, setSelectedRun] = useState<string | null>(null);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [tab, setTab] = useState<RTab>('ALL RUNS');

    useEffect(() => {
        fetchRuns();
        const interval = setInterval(fetchRuns, 5000);
        return () => clearInterval(interval);
    }, []);

    const fetchRuns = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/runs`);
            if (res.ok) setRuns(await res.json());
        } catch (e) {
            console.error('Failed to fetch runs:', e);
        } finally {
            setLoading(false);
        }
    };

    const fetchLogs = async (runId: string) => {
        try {
            const res = await fetch(`${API_BASE}/runs/${runId}/logs`);
            if (res.ok) setLogs(await res.json());
        } catch (e) {
            console.error('Failed to fetch logs:', e);
        }
    };

    const handleAction = async (runId: string, action: 'start' | 'pause' | 'resume' | 'stop') => {
        try {
            await fetch(`${API_BASE}/runs/${runId}/${action}`, { method: 'POST' });
            fetchRuns();
        } catch (e) {
            console.error(`Failed to ${action} run:`, e);
        }
    };

    const fmtTime=(iso:string|null)=>iso?new Date(iso).toLocaleTimeString():'â€”';
    const fmtDuration=(r:Run)=>{
        if(!r.started_at) return 'â€”';
        const end=r.stopped_at?new Date(r.stopped_at):new Date();
        const secs=Math.round((end.getTime()-new Date(r.started_at).getTime())/1000);
        if(secs<60) return `${secs}s`;
        if(secs<3600) return `${Math.floor(secs/60)}m ${secs%60}s`;
        return `${Math.floor(secs/3600)}h ${Math.floor((secs%3600)/60)}m`;
    };

    const running=runs.filter(r=>r.status==='running');
    const errored=runs.filter(r=>r.status==='error');
    const displayRuns=tab==='RUNNING'?running:tab==='HISTORY'?runs.filter(r=>['completed','stopped'].includes(r.status)):runs;

    const S:React.CSSProperties={height:'100%',display:'flex',flexDirection:'column' as const,background:BG,fontFamily:MONO}
    const HDR:React.CSSProperties={display:'flex',alignItems:'center',gap:8,padding:'8px 14px',
        borderBottom:`1px solid ${BORDER}`,background:PANEL,flexShrink:0}
    const TABBAR:React.CSSProperties={display:'flex',gap:2,padding:'0 14px',borderBottom:`1px solid ${BORDER}`,
        background:PANEL,flexShrink:0}
    const tbtn=(a:boolean):React.CSSProperties=>({padding:'7px 12px',fontSize:10,fontFamily:MONO,
        letterSpacing:'0.08em',cursor:'pointer',background:'none',border:'none',
        borderBottom:a?`2px solid ${AMBER}`:'2px solid transparent',
        color:a?AMBER:SUBTLE,textTransform:'uppercase' as const})
    const actBtn=(c:string):React.CSSProperties=>({padding:'2px 6px',fontSize:9,fontFamily:MONO,
        background:PANEL,border:`1px solid ${c}`,color:c,cursor:'pointer',borderRadius:2})

    return (
        <div style={S}>
            <div style={HDR}>
                <span style={{fontSize:11,color:GREEN,letterSpacing:'0.1em'}}>RD</span>
                <span style={{fontSize:13,color:TEXT,fontWeight:700}}>RUNS DASHBOARD</span>
                <span style={{fontSize:10,color:SUBTLE}}>APEX STRATEGY ENGINE</span>
                <div style={{flex:1}}/>
                {loading&&<span style={{fontSize:10,color:AMBER}}>POLLING</span>}
                <button onClick={fetchRuns} style={{fontSize:10,fontFamily:MONO,background:PANEL,
                    border:`1px solid ${BORDER}`,color:BLUE,padding:'3px 8px',cursor:'pointer',borderRadius:2}}>
                    REFRESH
                </button>
            </div>

            {/* Stats strip */}
            <div style={{display:'flex',gap:8,padding:'8px 14px',borderBottom:`1px solid ${BORDER}`,
                background:PANEL,flexShrink:0}}>
                <StatCard label="Total Runs" value={String(runs.length)} color={TEXT}/>
                <StatCard label="Running" value={String(running.length)} color={running.length>0?GREEN:TEXT}/>
                <StatCard label="Errors" value={String(errored.length)} color={errored.length>0?RED:TEXT}/>
                <StatCard label="Backtests" value={String(runs.filter(r=>r.run_type==='backtest').length)} color={PURPLE}/>
                <StatCard label="Paper" value={String(runs.filter(r=>r.run_type==='paper').length)} color={ORANGE}/>
            </div>

            <div style={TABBAR}>
                {TABS.map(t=><button key={t} style={tbtn(tab===t)} onClick={()=>setTab(t)}>{t}</button>)}
            </div>

            {/* LOGS tab */}
            {tab==='LOGS'&&(
                <div style={{flex:1,display:'flex',flexDirection:'column' as const}}>
                    <div style={{padding:'4px 14px',borderBottom:`1px solid ${BORDER}`,background:PANEL,
                        fontSize:10,color:SUBTLE,display:'flex',alignItems:'center',gap:8}}>
                        <span>LOG STREAM</span>
                        {selectedRun&&<span style={{color:BLUE}}>{selectedRun}</span>}
                        <button onClick={()=>{setSelectedRun(null);setLogs([]);}}
                            style={{marginLeft:'auto',background:'none',border:'none',color:SUBTLE,cursor:'pointer',fontFamily:MONO,fontSize:9}}>
                            CLEAR
                        </button>
                    </div>
                    <div style={{flex:1,overflowY:'auto' as const,padding:'8px 14px',fontSize:11,fontFamily:MONO,lineHeight:1.5}}>
                        {logs.length===0&&<span style={{color:SUBTLE}}>SELECT A RUN FROM THE TABLE THEN CLICK THIS TAB</span>}
                        {logs.map((l,i)=>(
                            <div key={i} style={{color:l.level==='error'?RED:l.level==='warning'?AMBER:TEXT,padding:'1px 0'}}>
                                [{l.timestamp}] [{l.level?.toUpperCase().padEnd(5)}] {l.message}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Table tabs */}
            {tab!=='LOGS'&&(
                <div style={{flex:1,overflowY:'auto' as const}}>
                    {displayRuns.length===0&&(
                        <div style={{padding:40,textAlign:'center' as const,fontSize:12,color:SUBTLE}}>
                            {loading?'LOADING...':'NO RUNS FOUND'}
                        </div>
                    )}
                    {displayRuns.length>0&&(
                        <table style={{width:'100%',borderCollapse:'collapse'}}>
                            <thead style={{position:'sticky' as const,top:0,background:PANEL}}>
                                <tr>
                                    <Th ch="Status"/>
                                    <Th ch="Run ID"/>
                                    <Th ch="Strategy"/>
                                    <Th ch="Type"/>
                                    <Th ch="Started"/>
                                    <Th ch="Duration"/>
                                    <Th ch="Heartbeat"/>
                                    <Th c={{textAlign:'right'}} ch="Errors"/>
                                    <Th c={{textAlign:'right'}} ch="Restarts"/>
                                    <Th ch="Actions"/>
                                </tr>
                            </thead>
                            <tbody>
                                {displayRuns.map(run=>(
                                    <tr key={run.run_id}
                                        onClick={()=>{setSelectedRun(run.run_id);fetchLogs(run.run_id);setTab('LOGS');}}
                                        style={{cursor:'pointer',background:selectedRun===run.run_id?`${AMBER}11`:'transparent'}}>
                                        <Td ch={<RunStatusBadge status={run.status}/>}/>
                                        <Td c={{color:BLUE,fontSize:10}} ch={run.run_id.substring(0,20)}/>
                                        <Td c={{fontSize:10}} ch={run.strategy_id}/>
                                        <Td ch={<TypeBadge t={run.run_type}/>}/>
                                        <Td c={{fontSize:10,color:SUBTLE}} ch={fmtTime(run.started_at)}/>
                                        <Td c={{color:run.status==='running'?GREEN:TEXT}} ch={fmtDuration(run)}/>
                                        <Td c={{fontSize:10,color:SUBTLE}} ch={fmtTime(run.last_heartbeat)}/>
                                        <Td c={{textAlign:'right',color:run.error_count>0?RED:SUBTLE}} ch={run.error_count||'â€”'}/>
                                        <Td c={{textAlign:'right',color:run.restart_count>0?AMBER:SUBTLE}} ch={run.restart_count||'â€”'}/>
                                        <Td ch={
                                            <div style={{display:'flex',gap:4}} onClick={e=>e.stopPropagation()}>
                                                {run.status==='pending'&&(
                                                    <button onClick={()=>handleAction(run.run_id,'start')} style={actBtn(GREEN)}>â–¶</button>
                                                )}
                                                {run.status==='running'&&(
                                                    <>
                                                        <button onClick={()=>handleAction(run.run_id,'pause')} style={actBtn(AMBER)}>â¸</button>
                                                        <button onClick={()=>handleAction(run.run_id,'stop')} style={actBtn(RED)}>â– </button>
                                                    </>
                                                )}
                                                {run.status==='paused'&&(
                                                    <>
                                                        <button onClick={()=>handleAction(run.run_id,'resume')} style={actBtn(GREEN)}>â–¶</button>
                                                        <button onClick={()=>handleAction(run.run_id,'stop')} style={actBtn(RED)}>â– </button>
                                                    </>
                                                )}
                                            </div>
                                        }/>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
}
