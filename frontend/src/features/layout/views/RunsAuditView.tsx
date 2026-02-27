// â”€â”€â”€ Bloomberg palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BG='#0a0a0a',PANEL='#111111',BORDER='#1e1e1e'
const AMBER='#f5a623',GREEN='#26a69a',RED='#ef5350',BLUE='#42a5f5'
const PURPLE='#ab47bc',SUBTLE='#555',TEXT='#d1d4dc'
const MONO='"Roboto Mono","Courier New",monospace'

// â”€â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const Th=({c}:{c:string})=><th style={{padding:'5px 10px',fontSize:9,letterSpacing:'0.1em',color:SUBTLE,
  textAlign:'left' as const,borderBottom:`1px solid ${BORDER}`,background:PANEL,fontFamily:MONO,whiteSpace:'nowrap' as const}}>{c}</th>
const Td=({children,mono,color}:{children:React.ReactNode,mono?:boolean,color?:string})=>(
  <td style={{padding:'6px 10px',fontSize:11,color:color||TEXT,fontFamily:mono?MONO:'inherit',
    borderBottom:`1px solid ${BORDER}33`,whiteSpace:'nowrap' as const}}>{children}</td>
)
const StatusBadge=({s}:{s:string})=>{
  const c=s==='success'?GREEN:s==='running'?BLUE:s==='warning'?AMBER:s==='failed'?RED:SUBTLE;
  return<span style={{fontSize:9,padding:'2px 6px',border:`1px solid ${c}`,color:c,borderRadius:2,letterSpacing:'0.07em'}}>{s.toUpperCase()}</span>
}
const SevBadge=({s}:{s:string})=>{
  const c=s==='critical'?RED:s==='error'?RED:s==='warning'?AMBER:SUBTLE;
  return<span style={{fontSize:9,color:c,letterSpacing:'0.07em',fontFamily:MONO}}>{s.toUpperCase()}</span>
}
const TypeBadge=({t}:{t:string})=>{
  const c=t==='autopilot'?PURPLE:t==='monitoring'?GREEN:AMBER;
  return<span style={{fontSize:9,padding:'2px 5px',border:`1px solid ${c}33`,color:c,borderRadius:2}}>{t.toUpperCase()}</span>
}
const StatCard=({label,value,color}:{label:string,value:string|number,color?:string})=>(
  <div style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,padding:'8px 12px',minWidth:90}}>
    <div style={{fontSize:9,color:SUBTLE,letterSpacing:'0.1em',marginBottom:3}}>{label}</div>
    <div style={{fontSize:17,color:color||TEXT,fontFamily:MONO,fontWeight:700}}>{value}</div>
  </div>
)

import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../../../config/api';

interface RunRecord {
  run_id: string;
  type: 'autopilot'|'monitoring'|'manual';
  started_at: string;
  completed_at: string|null;
  status: 'running'|'success'|'warning'|'failed';
  duration_ms: number|null;
  actions_taken: number;
  errors: number;
  summary: string;
}

interface AuditEvent {
  id: string;
  timestamp: string;
  run_id: string|null;
  event_type: string;
  severity: 'info'|'warning'|'error'|'critical';
  message: string;
  details: Record<string, unknown>;
}

const fmtTime=(iso:string)=>new Date(iso).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
const fmtDate=(iso:string)=>new Date(iso).toLocaleDateString('en-US',{month:'short',day:'numeric'});
const fmtDur=(ms:number|null)=>{
  if(ms===null) return 'â€”';
  if(ms<1000) return `${ms}ms`;
  const s=Math.floor(ms/1000);
  if(s<60) return `${s}s`;
  return `${Math.floor(s/60)}m ${s%60}s`;
};

export const RunsAuditView: React.FC = () => {
  const [tab, setTab] = useState<'runs'|'audit'>('runs');
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedRun, setSelectedRun] = useState<RunRecord|null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [rr, ar] = await Promise.all([
        fetch(`${API_BASE}/api/v1/autopilot/runs`),
        fetch(`${API_BASE}/api/v1/autopilot/logs?limit=200`)
      ]);
      if(rr.ok) { const d=await rr.json(); setRuns(d.runs||[]); }
      if(ar.ok) {
        const d=await ar.json();
        const raw=Array.isArray(d.logs) ? d.logs : Array.isArray(d) ? d : [];
        setAuditEvents(raw.map((e: Record<string,unknown>)=>({
          id:e.id||`${e.timestamp}-${e.event_type}`,
          timestamp:String(e.timestamp||e.created_at||new Date().toISOString()),
          run_id:(e.run_id as string|null)||null,
          event_type:String(e.event_type||e.event||'event'),
          severity:String(e.severity||e.level||'info') as 'info'|'warning'|'error'|'critical',
          message:String(e.message||e.msg||''),
          details:(e.details as Record<string,unknown>)||{},
        })));
      }
    } catch(err) {
      console.error('Failed to fetch runs/audit data:',err);
    } finally { setLoading(false); }
  },[]);

  useEffect(()=>{fetchData();const t=setInterval(fetchData,10000);return()=>clearInterval(t);},[fetchData]);

  const SEL:React.CSSProperties={background:BG,border:`1px solid ${BORDER}`,color:TEXT,fontFamily:MONO,fontSize:10,
    padding:'4px 8px',outline:'none',borderRadius:2}

  const tbtn=(a:boolean,col?:string):React.CSSProperties=>({padding:'6px 14px',fontSize:10,fontFamily:MONO,
    letterSpacing:'0.08em',cursor:'pointer',background:'none',border:'none',
    borderBottom:a?`2px solid ${col||GREEN}`:'2px solid transparent',
    color:a?(col||GREEN):SUBTLE,textTransform:'uppercase' as const})

  const filteredRuns=runs.filter(r=>{
    if(typeFilter!=='all'&&r.type!==typeFilter) return false;
    if(statusFilter!=='all'&&r.status!==statusFilter) return false;
    if(search&&!r.run_id.toLowerCase().includes(search.toLowerCase())&&
      !r.summary.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filteredAudit=auditEvents.filter(e=>{
    if(severityFilter!=='all'&&e.severity!==severityFilter) return false;
    if(search&&!e.message.toLowerCase().includes(search.toLowerCase())&&
      !e.event_type.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const running=runs.filter(r=>r.status==='running').length;

  return (
    <div data-testid="runs-audit-view"
      style={{height:'100%',display:'flex',flexDirection:'column' as const,background:BG,fontFamily:MONO}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:12,padding:'6px 14px',
        borderBottom:`1px solid ${BORDER}`,background:PANEL,flexShrink:0,flexWrap:'wrap' as const}}>
        <span style={{fontSize:11,color:PURPLE,letterSpacing:'0.1em'}}>RA</span>
        <span style={{fontSize:12,color:TEXT,fontWeight:700}}>RUNS & AUDIT LOG</span>
        {running>0&&<span style={{fontSize:9,padding:'2px 6px',border:`1px solid ${GREEN}`,color:GREEN,borderRadius:2}}>â— {running} RUNNING</span>}
        <div style={{flex:1}}/>
        {/* Search */}
        <input placeholder="Search runs, events..." value={search} onChange={e=>setSearch(e.target.value)}
          style={{...SEL,width:200,fontSize:11,padding:'4px 8px'}}/>
        <button onClick={fetchData}
          style={{background:PANEL,border:`1px solid ${BORDER}`,color:TEXT,fontFamily:MONO,
            fontSize:10,padding:'4px 10px',cursor:'pointer',borderRadius:2}}>
          REFRESH
        </button>
      </div>

      {/* Stats bar */}
      <div style={{display:'flex',gap:8,padding:'8px 14px',borderBottom:`1px solid ${BORDER}`,
        background:PANEL,flexShrink:0,flexWrap:'wrap' as const}}>
        <StatCard label="TOTAL RUNS" value={runs.length} color={TEXT}/>
        <StatCard label="RUNNING" value={running} color={GREEN}/>
        <StatCard label="SUCCESS" value={runs.filter(r=>r.status==='success').length} color={GREEN}/>
        <StatCard label="FAILED" value={runs.filter(r=>r.status==='failed').length} color={RED}/>
        <StatCard label="WARNINGS" value={runs.filter(r=>r.status==='warning').length} color={AMBER}/>
        <StatCard label="AUDIT EVENTS" value={auditEvents.length} color={BLUE}/>
      </div>

      {/* Tab bar */}
      <div style={{display:'flex',gap:0,borderBottom:`1px solid ${BORDER}`,
        background:PANEL,flexShrink:0,alignItems:'center'}}>
        <button style={tbtn(tab==='runs',PURPLE)} onClick={()=>setTab('runs')}>
          RUNS ({runs.length})
        </button>
        <button style={tbtn(tab==='audit',BLUE)} onClick={()=>setTab('audit')}>
          AUDIT LOG ({auditEvents.length})
        </button>
        <div style={{flex:1}}/>
        {/* Filters */}
        {tab==='runs'&&(
          <div style={{display:'flex',gap:6,padding:'0 12px'}}>
            <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} style={SEL}>
              <option value="all">ALL TYPES</option>
              <option value="autopilot">AUTOPILOT</option>
              <option value="monitoring">MONITORING</option>
              <option value="manual">MANUAL</option>
            </select>
            <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={SEL}>
              <option value="all">ALL STATUS</option>
              <option value="running">RUNNING</option>
              <option value="success">SUCCESS</option>
              <option value="warning">WARNING</option>
              <option value="failed">FAILED</option>
            </select>
          </div>
        )}
        {tab==='audit'&&(
          <div style={{padding:'0 12px'}}>
            <select value={severityFilter} onChange={e=>setSeverityFilter(e.target.value)} style={SEL}>
              <option value="all">ALL SEVERITY</option>
              <option value="info">INFO</option>
              <option value="warning">WARNING</option>
              <option value="error">ERROR</option>
              <option value="critical">CRITICAL</option>
            </select>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{flex:1,overflow:'auto'}}>
        {loading?(
          <div style={{padding:32,textAlign:'center' as const,color:AMBER,fontSize:11}}>LOADING...</div>
        ):tab==='runs'?(
          /* Runs table */
          <table style={{width:'100%',borderCollapse:'collapse' as const}}>
            <thead><tr>
              <Th c="RUN ID"/><Th c="TYPE"/><Th c="STARTED"/><Th c="DURATION"/>
              <Th c="STATUS"/><Th c="ACTIONS"/><Th c="ERRORS"/><Th c="SUMMARY"/>
            </tr></thead>
            <tbody>
              {filteredRuns.length===0&&(
                <tr><td colSpan={8} style={{padding:24,textAlign:'center' as const,color:SUBTLE,fontSize:11}}>No runs found</td></tr>
              )}
              {filteredRuns.map(run=>(
                <tr key={run.run_id} onClick={()=>setSelectedRun(run)}
                  style={{cursor:'pointer',background:'transparent'}}
                  onMouseEnter={e=>(e.currentTarget.style.background=`${BORDER}66`)}
                  onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                  <Td mono color={BLUE}>{run.run_id}</Td>
                  <Td><TypeBadge t={run.type}/></Td>
                  <Td mono>{fmtTime(run.started_at)}<br/><span style={{fontSize:9,color:SUBTLE}}>{fmtDate(run.started_at)}</span></Td>
                  <Td mono color={run.status==='running'?AMBER:TEXT}>
                    {run.status==='running'?'âŸ³ RUNNING':fmtDur(run.duration_ms)}
                  </Td>
                  <Td><StatusBadge s={run.status}/></Td>
                  <Td mono>{run.actions_taken}</Td>
                  <Td mono color={run.errors>0?RED:TEXT}>{run.errors>0?run.errors:'0'}</Td>
                  <Td>{run.summary.length>50?run.summary.slice(0,50)+'â€¦':run.summary}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        ):(
          /* Audit log table */
          <table style={{width:'100%',borderCollapse:'collapse' as const}}>
            <thead><tr>
              <Th c="TIME"/><Th c="SEVERITY"/><Th c="EVENT TYPE"/><Th c="RUN ID"/><Th c="MESSAGE"/>
            </tr></thead>
            <tbody>
              {filteredAudit.length===0&&(
                <tr><td colSpan={5} style={{padding:24,textAlign:'center' as const,color:SUBTLE,fontSize:11}}>No events found</td></tr>
              )}
              {filteredAudit.map(evt=>(
                <tr key={evt.id}
                  style={{background:'transparent'}}
                  onMouseEnter={e=>(e.currentTarget.style.background=`${BORDER}66`)}
                  onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                  <Td mono>{fmtTime(evt.timestamp)}<br/><span style={{fontSize:9,color:SUBTLE}}>{fmtDate(evt.timestamp)}</span></Td>
                  <Td><SevBadge s={evt.severity}/></Td>
                  <Td mono color={PURPLE}>{evt.event_type}</Td>
                  <Td>
                    {evt.run_id?(
                      <span onClick={()=>{setTab('runs');setSearch(evt.run_id||'');}}
                        style={{fontSize:10,color:BLUE,cursor:'pointer',fontFamily:MONO}}>
                        {evt.run_id.slice(-14)}
                      </span>
                    ):<span style={{color:SUBTLE}}>â€”</span>}
                  </Td>
                  <Td>{evt.message}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Run detail drawer */}
      {selectedRun&&(
        <div style={{position:'fixed' as const,inset:0,zIndex:1000,display:'flex'}}>
          <div style={{position:'absolute' as const,inset:0,background:'rgba(0,0,0,0.7)'}} onClick={()=>setSelectedRun(null)}/>
          <div style={{position:'absolute' as const,right:0,top:0,bottom:0,width:440,background:PANEL,
            borderLeft:`1px solid ${BORDER}`,overflow:'auto',fontFamily:MONO}}>
            <div style={{padding:'8px 14px',borderBottom:`1px solid ${BORDER}`,display:'flex',alignItems:'center',gap:8,background:BG}}>
              <span style={{fontSize:11,color:PURPLE}}>RD</span>
              <span style={{fontSize:12,color:TEXT,fontWeight:700,flex:1}}>RUN DETAILS</span>
              <button onClick={()=>setSelectedRun(null)}
                style={{background:'none',border:'none',color:SUBTLE,cursor:'pointer',fontSize:16,padding:2}}>âœ•</button>
            </div>
            <div style={{padding:14}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
                <span style={{fontSize:11,color:BLUE,fontFamily:MONO}}>{selectedRun.run_id}</span>
                <StatusBadge s={selectedRun.status}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
                {[['TYPE',selectedRun.type.toUpperCase(),TEXT],['DURATION',fmtDur(selectedRun.duration_ms),TEXT],
                  ['ACTIONS',String(selectedRun.actions_taken),GREEN],
                  ['ERRORS',String(selectedRun.errors),selectedRun.errors>0?RED:GREEN]
                ].map(([k,v,c])=>(
                  <div key={k} style={{background:BG,border:`1px solid ${BORDER}`,borderRadius:2,padding:'8px 10px'}}>
                    <div style={{fontSize:9,color:SUBTLE,marginBottom:3}}>{k}</div>
                    <div style={{fontSize:13,color:c,fontFamily:MONO,fontWeight:700}}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{background:BG,border:`1px solid ${BORDER}`,borderRadius:2,padding:'10px 12px',marginBottom:12}}>
                <div style={{fontSize:9,color:SUBTLE,marginBottom:4}}>SUMMARY</div>
                <div style={{fontSize:11,color:TEXT}}>{selectedRun.summary}</div>
              </div>
              <div style={{background:BG,border:`1px solid ${BORDER}`,borderRadius:2,padding:'10px 12px',marginBottom:12}}>
                <div style={{fontSize:9,color:SUBTLE,marginBottom:6}}>TIMELINE</div>
                <div style={{display:'flex',flexDirection:'column' as const,gap:4}}>
                  <div style={{fontSize:10,color:TEXT}}>
                    <span style={{color:GREEN}}>â— START: </span>{fmtTime(selectedRun.started_at)}
                    <span style={{color:SUBTLE}}> {fmtDate(selectedRun.started_at)}</span>
                  </div>
                  {selectedRun.completed_at&&(
                    <div style={{fontSize:10,color:TEXT}}>
                      <span style={{color:BLUE}}>â— END: </span>{fmtTime(selectedRun.completed_at)}
                      <span style={{color:SUBTLE}}> {fmtDate(selectedRun.completed_at)}</span>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <div style={{fontSize:9,color:SUBTLE,letterSpacing:'0.1em',marginBottom:8}}>RELATED EVENTS</div>
                {auditEvents.filter(e=>e.run_id===selectedRun.run_id).map(e=>(
                  <div key={e.id} style={{background:BG,border:`1px solid ${BORDER}`,borderRadius:2,
                    padding:'8px 10px',marginBottom:6}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:3}}>
                      <span style={{fontSize:9,color:PURPLE,fontFamily:MONO}}>{e.event_type}</span>
                      <SevBadge s={e.severity}/>
                    </div>
                    <div style={{fontSize:10,color:TEXT}}>{e.message}</div>
                    <div style={{fontSize:9,color:SUBTLE,marginTop:2}}>{fmtTime(e.timestamp)}</div>
                  </div>
                ))}
                {auditEvents.filter(e=>e.run_id===selectedRun.run_id).length===0&&(
                  <div style={{fontSize:10,color:SUBTLE}}>No events linked to this run.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RunsAuditView;

interface RunRecord {
  run_id: string;
  type: 'autopilot' | 'monitoring' | 'manual';
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'success' | 'warning' | 'failed';
  duration_ms: number | null;
  actions_taken: number;
  errors: number;
  summary: string;
}

interface AuditEvent {
  id: string;
  timestamp: string;
  run_id: string | null;
  event_type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  details: Record<string, unknown>;
}

