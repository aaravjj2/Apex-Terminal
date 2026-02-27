// â”€â”€â”€ Bloomberg palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BG='#0a0a0a',PANEL='#111111',BORDER='#1e1e1e'
const AMBER='#f5a623',GREEN='#26a69a',RED='#ef5350',BLUE='#42a5f5'
const SUBTLE='#555',TEXT='#d1d4dc'
const MONO='"Roboto Mono","Courier New",monospace'

const Th=({c}:{c:string})=><th style={{padding:'5px 10px',fontSize:9,letterSpacing:'0.1em',color:SUBTLE,
  textAlign:'left' as const,borderBottom:`1px solid ${BORDER}`,background:PANEL,fontFamily:MONO}}>{c}</th>
const Td=({children,mono,color,colSpan}:{children:React.ReactNode,mono?:boolean,color?:string,colSpan?:number})=>(
  <td colSpan={colSpan} style={{padding:'6px 10px',fontSize:11,color:color||TEXT,fontFamily:mono?MONO:'inherit',
    borderBottom:`1px solid ${BORDER}33`}}>{children}</td>
)
const SevBadge=({s}:{s:string})=>{
  const c=s==='critical'?RED:s==='error'?RED:s==='warning'?AMBER:BLUE
  return<span style={{fontSize:9,padding:'2px 6px',border:`1px solid ${c}`,color:c,borderRadius:2}}>{s.toUpperCase()}</span>
}
const StatCard=({label,value,color}:{label:string,value:string|number,color?:string})=>(
  <div style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,padding:'8px 12px',minWidth:80}}>
    <div style={{fontSize:9,color:SUBTLE,letterSpacing:'0.1em',marginBottom:3}}>{label}</div>
    <div style={{fontSize:16,color:color||TEXT,fontFamily:MONO,fontWeight:700}}>{value}</div>
  </div>
)

import { useState, useEffect } from 'react';
import React from 'react';
import { API_BASE } from '../../../config/api';

// ==========================================
// TYPES
// ==========================================

interface IncidentBundle {
    id: string;
    name: string;
    recordedAt: string;
    durationSeconds: number;
    tickCount: number;
    hash: string;
    status: 'recording' | 'completed' | 'verified';
    symbols: string[];
}

interface SystemAlert {
    id: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    category: string;
    title: string;
    description: string;
    run_id: string | null;
    created_at: string;
    resolved: boolean;
    resolved_at: string | null;
    resolution_note: string | null;
}

const mockBundles: IncidentBundle[] = [
    {
        id: 'bundle_001',
        name: 'AAPL_2026-01-12_morning',
        recordedAt: '2026-01-12T09:30:00Z',
        durationSeconds: 7200,
        tickCount: 45000,
        hash: 'sha256:abc123def456...',
        status: 'verified',
        symbols: ['AAPL'],
    },
];

export function IncidentsView() {
  const [tab, setTab] = useState<'alerts'|'bundles'|'replay'>('alerts');
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [bundles, setBundles] = useState<IncidentBundle[]>(mockBundles);
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [selected, setSelected] = useState<IncidentBundle|null>(null);
  const [recTime, setRecTime] = useState(0);
  const [sevFilter, setSevFilter] = useState('all');
  const [resolvedFilter, setResolvedFilter] = useState('unresolved');
  const [toast, setToast] = useState<{msg:string,ok:boolean}|null>(null);

  const showToast=(msg:string,ok=true)=>{setToast({msg,ok});setTimeout(()=>setToast(null),2800);}

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/alerts?limit=50`);
      if(res.ok) setAlerts(await res.json());
    } catch { console.error('Failed to fetch alerts'); }
    finally { setLoading(false); }
  };

  useEffect(()=>{
    if(tab==='alerts'){
      fetchAlerts();
      const iv=setInterval(fetchAlerts,10000);
      return()=>clearInterval(iv);
    }
  },[tab]);

  useEffect(()=>{
    if(!isRecording){setRecTime(0);return;}
    const iv=setInterval(()=>setRecTime(t=>t+1),1000);
    return()=>clearInterval(iv);
  },[isRecording]);

  const handleResolve = async(id:string)=>{
    try {
      await fetch(`${API_BASE}/api/v1/alerts/${id}/resolve?note=Manual+resolution`,{method:'POST'});
      showToast('Alert resolved'); fetchAlerts();
    } catch { showToast('Failed to resolve',false); }
  };

  const handleStartRec=()=>setIsRecording(true);
  const handleStopRec=()=>{
    setIsRecording(false);
    const nb:IncidentBundle={id:`bundle_${Date.now()}`,name:`Recording_${new Date().toISOString().slice(0,10)}`,
      recordedAt:new Date().toISOString(),durationSeconds:recTime,tickCount:0,
      hash:'pending...',status:'completed',symbols:['AAPL']};
    setBundles(p=>[nb,...p]);
    showToast('Recording stopped â€” bundle created');
  };

  const fmtDur=(s:number)=>`${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m ${s%60}s`;
  const fmtRecTime=(s:number)=>{
    const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;
    return`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  }

  const filteredAlerts=alerts.filter(a=>{
    if(sevFilter!=='all'&&a.severity!==sevFilter)return false;
    if(resolvedFilter==='unresolved'&&a.resolved)return false;
    if(resolvedFilter==='resolved'&&!a.resolved)return false;
    return true;
  });

  const INP:React.CSSProperties={background:BG,border:`1px solid ${BORDER}`,color:TEXT,fontFamily:MONO,
    fontSize:11,padding:'5px 8px',borderRadius:2,outline:'none',appearance:'none' as const}
  const tbtn=(a:boolean,col?:string):React.CSSProperties=>({padding:'6px 14px',fontSize:10,fontFamily:MONO,
    letterSpacing:'0.08em',cursor:'pointer',background:'none',border:'none',
    borderBottom:a?`2px solid ${col||GREEN}`:'2px solid transparent',
    color:a?(col||GREEN):SUBTLE,textTransform:'uppercase' as const})

  const unresolved=alerts.filter(a=>!a.resolved).length;

  return (
    <div data-testid="incidents-view"
      style={{height:'100%',display:'flex',flexDirection:'column' as const,background:BG,fontFamily:MONO}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:12,padding:'6px 14px',
        borderBottom:`1px solid ${BORDER}`,background:PANEL,flexShrink:0}}>
        <span style={{fontSize:11,color:RED,letterSpacing:'0.1em'}}>IF</span>
        <span style={{fontSize:12,color:TEXT,fontWeight:700}}>INCIDENTS &amp; FORENSICS</span>
        {unresolved>0&&(
          <span style={{fontSize:9,padding:'2px 8px',background:`${RED}22`,border:`1px solid ${RED}`,
            color:RED,borderRadius:2}}>{unresolved} UNRESOLVED</span>
        )}
        <div style={{flex:1}}/>
        {tab==='alerts'&&(
          <>
            <select value={sevFilter} onChange={e=>setSevFilter(e.target.value)} style={{...INP,width:110}}>
              <option value="all">ALL SEV</option>
              <option value="critical">CRITICAL</option>
              <option value="error">ERROR</option>
              <option value="warning">WARNING</option>
              <option value="info">INFO</option>
            </select>
            <select value={resolvedFilter} onChange={e=>setResolvedFilter(e.target.value)} style={{...INP,width:120}}>
              <option value="all">ALL</option>
              <option value="unresolved">UNRESOLVED</option>
              <option value="resolved">RESOLVED</option>
            </select>
          </>
        )}
        {tab==='bundles'&&(
          <button onClick={isRecording?handleStopRec:handleStartRec}
            style={{fontSize:10,padding:'4px 12px',fontFamily:MONO,cursor:'pointer',
              border:`1px solid ${isRecording?RED:GREEN}`,background:`${isRecording?RED:GREEN}22`,
              color:isRecording?RED:GREEN,borderRadius:2,letterSpacing:'0.08em'}}>
            {isRecording?'â–  STOP RECORDING':'â— START RECORDING'}
          </button>
        )}
        <button onClick={fetchAlerts}
          style={{background:PANEL,border:`1px solid ${BORDER}`,color:TEXT,fontFamily:MONO,
            fontSize:10,padding:'4px 10px',cursor:'pointer',borderRadius:2}}>REFRESH</button>
      </div>

      {/* Stats */}
      <div style={{display:'flex',gap:8,padding:'8px 14px',borderBottom:`1px solid ${BORDER}`,background:PANEL}}>
        <StatCard label="TOTAL ALERTS" value={alerts.length}/>
        <StatCard label="UNRESOLVED" value={unresolved} color={unresolved>0?RED:GREEN}/>
        <StatCard label="CRITICAL" value={alerts.filter(a=>a.severity==='critical'&&!a.resolved).length} color={RED}/>
        <StatCard label="WARNING" value={alerts.filter(a=>a.severity==='warning'&&!a.resolved).length} color={AMBER}/>
        <StatCard label="BUNDLES" value={bundles.length} color={BLUE}/>
        <StatCard label="RECORDING" value={isRecording?fmtRecTime(recTime):'OFF'} color={isRecording?RED:SUBTLE}/>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',borderBottom:`1px solid ${BORDER}`,background:PANEL}}>
        <button style={tbtn(tab==='alerts',RED)} onClick={()=>setTab('alerts')}>
          ALERTS {unresolved>0?`(${unresolved})`:''}
        </button>
        <button style={tbtn(tab==='bundles',BLUE)} onClick={()=>setTab('bundles')}>
          REPLAY BUNDLES ({bundles.length})
        </button>
        <button style={tbtn(tab==='replay',AMBER)} onClick={()=>setTab('replay')}>
          REPLAY PLAYER
        </button>
      </div>

      {/* Toast */}
      {toast&&(
        <div style={{padding:'6px 14px',background:toast.ok?`${GREEN}22`:`${RED}22`,
          borderBottom:`1px solid ${toast.ok?GREEN:RED}`,fontSize:10,color:toast.ok?GREEN:RED}}>
          {toast.msg}
        </div>
      )}

      {/* Recording banner */}
      {isRecording&&(
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 14px',
          background:`${RED}11`,borderBottom:`1px solid ${RED}33`}}>
          <span style={{width:8,height:8,borderRadius:'50%',background:RED,display:'inline-block',
            animation:'pulse 1s infinite'}}/>
          <span style={{fontSize:11,color:RED}}>RECORDING ACTIVE â€” {fmtRecTime(recTime)}</span>
          <span style={{fontSize:10,color:SUBTLE}}>Capturing live market data for replay bundle</span>
        </div>
      )}

      {/* Content */}
      <div style={{flex:1,overflow:'auto'}}>
        {/* ALERTS TAB */}
        {tab==='alerts'&&(
          loading&&alerts.length===0?(
            <div style={{padding:32,textAlign:'center' as const,color:SUBTLE,fontSize:11}}>Loading alerts...</div>
          ):filteredAlerts.length===0?(
            <div style={{padding:32,textAlign:'center' as const,color:GREEN,fontSize:11}}>
              <div style={{fontSize:24,marginBottom:8}}>âœ“</div>
              <div>ALL CLEAR â€” No active incidents</div>
            </div>
          ):(
            <table style={{width:'100%',borderCollapse:'collapse' as const}}>
              <thead><tr>
                <Th c="SEVERITY"/><Th c="TITLE"/><Th c="CATEGORY"/>
                <Th c="CREATED"/><Th c="RUN ID"/><Th c="STATUS"/><Th c="ACTIONS"/>
              </tr></thead>
              <tbody>
                {filteredAlerts.map(a=>(
                  <tr key={a.id}
                    style={{background:a.resolved?'transparent':(a.severity==='critical'||a.severity==='error')?`${RED}08`:`${AMBER}06`}}
                    onMouseEnter={e=>{e.currentTarget.style.background=`${BORDER}88`}}
                    onMouseLeave={e=>{e.currentTarget.style.background=a.resolved?'transparent':(a.severity==='critical'||a.severity==='error')?`${RED}08`:`${AMBER}06`}}>
                    <Td><SevBadge s={a.severity}/></Td>
                    <Td color={a.resolved?SUBTLE:TEXT}>{a.title}</Td>
                    <Td color={SUBTLE}>{a.category}</Td>
                    <Td mono color={SUBTLE}>{new Date(a.created_at).toLocaleString()}</Td>
                    <Td mono color={BLUE}>{a.run_id||'â€”'}</Td>
                    <Td>{a.resolved?
                      <span style={{fontSize:9,color:GREEN}}>âœ“ RESOLVED</span>:
                      <span style={{fontSize:9,color:RED}}>OPEN</span>}
                    </Td>
                    <Td>{!a.resolved&&(
                      <button onClick={()=>handleResolve(a.id)}
                        style={{fontSize:9,padding:'2px 7px',fontFamily:MONO,cursor:'pointer',
                          border:`1px solid ${GREEN}`,background:`${GREEN}22`,color:GREEN,borderRadius:2}}>RESOLVE</button>
                    )}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {/* BUNDLES TAB */}
        {tab==='bundles'&&(
          <div style={{display:'flex',height:'100%'}}>
            {/* List */}
            <div style={{width:320,borderRight:`1px solid ${BORDER}`,overflow:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse' as const}}>
                <thead><tr><Th c="NAME"/><Th c="STATUS"/></tr></thead>
                <tbody>
                  {bundles.map(b=>(
                    <tr key={b.id} onClick={()=>setSelected(b)}
                      style={{cursor:'pointer',background:selected?.id===b.id?`${BLUE}18`:'transparent'}}
                      onMouseEnter={e=>{if(selected?.id!==b.id)e.currentTarget.style.background=`${BORDER}66`}}
                      onMouseLeave={e=>{if(selected?.id!==b.id)e.currentTarget.style.background='transparent'}}>
                      <td style={{padding:'8px 10px',borderBottom:`1px solid ${BORDER}33`}}>
                        <div style={{fontSize:11,color:TEXT}}>{b.name}</div>
                        <div style={{fontSize:9,color:SUBTLE,marginTop:2}}>{new Date(b.recordedAt).toLocaleDateString()}</div>
                      </td>
                      <Td><span style={{fontSize:9,padding:'2px 5px',
                        border:`1px solid ${b.status==='verified'?GREEN:b.status==='recording'?RED:AMBER}`,
                        color:b.status==='verified'?GREEN:b.status==='recording'?RED:AMBER,borderRadius:2}}>
                        {b.status.toUpperCase()}
                      </span></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Detail */}
            {selected?(
              <div style={{flex:1,padding:16,overflow:'auto'}}>
                <div style={{fontSize:13,color:TEXT,fontWeight:700,marginBottom:12}}>{selected.name}</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
                  {[['ID',selected.id],['STATUS',selected.status.toUpperCase()],
                    ['DURATION',fmtDur(selected.durationSeconds)],['TICK COUNT',selected.tickCount.toLocaleString()],
                    ['SYMBOLS',selected.symbols.join(', ')],['RECORDED',new Date(selected.recordedAt).toLocaleString()],
                  ].map(([k,v])=>(
                    <div key={k} style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,padding:'8px 10px'}}>
                      <div style={{fontSize:9,color:SUBTLE,marginBottom:3}}>{k}</div>
                      <div style={{fontSize:11,color:TEXT,fontFamily:MONO}}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,padding:'8px 10px',marginBottom:12}}>
                  <div style={{fontSize:9,color:SUBTLE,marginBottom:3}}>CONTENT HASH</div>
                  <div style={{fontSize:10,color:AMBER,fontFamily:MONO,wordBreak:'break-all' as const}}>{selected.hash}</div>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={()=>setTab('replay')}
                    style={{flex:1,padding:'8px 0',fontFamily:MONO,fontSize:10,letterSpacing:'0.08em',
                      cursor:'pointer',border:`1px solid ${GREEN}`,background:`${GREEN}22`,color:GREEN,borderRadius:2}}>
                    â–¶ LOAD REPLAY
                  </button>
                  <button style={{padding:'8px 12px',fontFamily:MONO,fontSize:10,cursor:'pointer',
                    border:`1px solid ${BORDER}`,background:PANEL,color:TEXT,borderRadius:2}}>â¬‡ DL</button>
                </div>
              </div>
            ):(
              <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:SUBTLE,fontSize:11}}>
                Select a bundle to view details
              </div>
            )}
          </div>
        )}

        {/* REPLAY TAB */}
        {tab==='replay'&&(
          <div style={{padding:20}}>
            <div style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,padding:16,marginBottom:12}}>
              <div style={{fontSize:12,color:TEXT,fontWeight:700,marginBottom:10}}>REPLAY PLAYER</div>
              <div style={{display:'flex',gap:8,marginBottom:10}}>
                <select style={{...INP,flex:1}}>
                  <option value="">Select bundle...</option>
                  {bundles.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <select style={{...INP,width:120}}>
                  <option>1x SPEED</option><option>2x SPEED</option><option>4x SPEED</option><option>8x SPEED</option>
                </select>
              </div>
              {/* Timeline */}
              <div style={{background:BG,border:`1px solid ${BORDER}`,borderRadius:2,padding:'20px 14px',marginBottom:10}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:SUBTLE,marginBottom:4}}>
                  <span>09:30:00</span><span>12:00:00</span><span>16:00:00</span>
                </div>
                <div style={{height:8,background:`${BORDER}`,borderRadius:4,overflow:'hidden',cursor:'pointer',position:'relative'}}>
                  <div style={{width:'35%',height:'100%',background:AMBER,borderRadius:4}}/>
                </div>
                <div style={{fontSize:9,color:SUBTLE,marginTop:4}}>35% complete â€” 11:01:30 / 16:00:00</div>
              </div>
              {/* Controls */}
              <div style={{display:'flex',gap:8,justifyContent:'center'}}>
                {['â® RESET','âª -10s','â¯ PLAY','â© +10s','â­ END'].map(lbl=>(
                  <button key={lbl} style={{padding:'6px 12px',fontFamily:MONO,fontSize:10,cursor:'pointer',
                    border:`1px solid ${BORDER}`,background:lbl.includes('PLAY')?`${GREEN}22`:PANEL,
                    color:lbl.includes('PLAY')?GREEN:TEXT,borderRadius:2}}>{lbl}</button>
                ))}
              </div>
            </div>
            {/* Events */}
            <div style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,padding:'10px 14px'}}>
              <div style={{fontSize:9,color:SUBTLE,marginBottom:8}}>REPLAY EVENT STREAM</div>
              {['09:30:01 AAPL TRADE 189.50 x 100','09:30:02 AAPL BID 189.48 x 200','09:30:02 AAPL ASK 189.52 x 150'].map((e,i)=>(
                <div key={i} style={{fontSize:10,fontFamily:MONO,color:i===2?AMBER:TEXT,
                  padding:'3px 0',borderBottom:`1px solid ${BORDER}33`}}>{e}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
