// â”€â”€â”€ Bloomberg palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BG='#0a0a0a',PANEL='#111111',BORDER='#1e1e1e'
const AMBER='#f5a623',GREEN='#26a69a',RED='#ef5350',BLUE='#42a5f5'
const PURPLE='#ab47bc',ORANGE='#ff8a65',SUBTLE='#555',TEXT='#d1d4dc'
const MONO='"Roboto Mono","Courier New",monospace'

const INPUT_S:React.CSSProperties={width:'100%',background:BG,border:`1px solid ${BORDER}`,color:TEXT,
  fontFamily:MONO,fontSize:11,padding:'6px 8px',borderRadius:2,outline:'none',boxSizing:'border-box' as const}
const LABEL_S:React.CSSProperties={fontSize:9,color:SUBTLE,fontFamily:MONO,textTransform:'uppercase' as const,
  letterSpacing:'0.08em',marginBottom:4,display:'block'}

function SectionHeader({title,color}:{title:string,color?:string}){
  return (
    <div style={{fontSize:10,color:color||TEXT,fontFamily:MONO,fontWeight:700,textTransform:'uppercase' as const,
      letterSpacing:'0.1em',borderBottom:`1px solid ${BORDER}`,padding:'4px 0',marginBottom:12}}>{title}</div>
  )
}
function Row({label,children}:{label:string,children:React.ReactNode}){
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',
      borderBottom:`1px solid ${BORDER}`}}>
      <div style={{fontSize:11,color:TEXT,fontFamily:MONO}}>{label}</div>
      <div>{children}</div>
    </div>
  )
}
function Toggle({value,onChange}:{value:boolean,onChange:(v:boolean)=>void}){
  return (
    <button onClick={()=>onChange(!value)}
      style={{width:40,height:20,borderRadius:10,background:value?GREEN:BORDER,border:'none',cursor:'pointer',
        position:'relative' as const,transition:'background 0.2s'}}>
      <div style={{position:'absolute',top:2,left:value?20:2,width:16,height:16,borderRadius:'50%',
        background:TEXT,transition:'left 0.2s'}}/>
    </button>
  )
}

import React, { useState, useEffect } from 'react';

type SVTab='API KEYS'|'PREFERENCES'|'SHORTCUTS'|'SYSTEM'

interface ApiProvider {
  id: string; name: string; connected: boolean; hasKey: boolean;
}

const SHORTCUTS=[
  {key:'âŒ˜ K',action:'Command Palette'},
  {key:'âŒ˜ 1â€“5',action:'Switch Views'},
  {key:'Space',action:'Play/Pause Replay'},
  {key:'â† / â†’',action:'Step Bar'},
  {key:'Esc',action:'Close Overlays'},
  {key:'âŒ˜ Z',action:'Undo Drawing'},
  {key:'âŒ˜ /',action:'Toggle Help'},
  {key:'F',action:'Focus Symbol Search'},
  {key:'T',action:'Cycle Timeframe'},
  {key:'D',action:'Toggle Dark/Terminal Mode'},
]

export function SettingsView() {
  const [tab, setTab] = useState<SVTab>('API KEYS');
  const [showKeys, setShowKeys] = useState<Record<string,boolean>>({});
  const [providers, setProviders] = useState<ApiProvider[]>([
    {id:'finnhub',name:'Finnhub',connected:false,hasKey:false},
    {id:'alpaca',name:'Alpaca',connected:false,hasKey:false},
    {id:'yahoo',name:'Yahoo Finance',connected:true,hasKey:true},
    {id:'polygon',name:'Polygon.io',connected:false,hasKey:false},
  ]);
  const [keyInputs, setKeyInputs] = useState<Record<string,string>>({});
  const [keyMsg, setKeyMsg] = useState('');

  // Preferences
  const [density, setDensity] = useState<'compact'|'normal'|'comfortable'>('normal');
  const [animations, setAnimations] = useState(true);
  const [polling, setPolling] = useState(5000);
  const [timezone, setTimezone] = useState('America/New_York');

  // System info
  const [sysInfo, setSysInfo] = useState<Record<string,string>>({});

  useEffect(() => {
    // Fetch system info
    fetch('/api/v1/health').then(r=>r.json()).then(d=>{
      setSysInfo({status:d.status||'ok',version:d.version||'â€”',uptime:d.uptime||'â€”'});
    }).catch(()=>setSysInfo({status:'unknown',version:'â€”',uptime:'â€”'}));
  },[]);

  const saveKey = async (id: string) => {
    const k = keyInputs[id]; if (!k) return;
    setKeyMsg('');
    try {
      const res = await fetch(`/api/v1/settings/keys/${id}`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({key:k})
      });
      if (res.ok) {
        setProviders(prev=>prev.map(p=>p.id===id?{...p,hasKey:true}:p));
        setKeyMsg(`Saved ${id} key`);
        setKeyInputs(prev=>({...prev,[id]:''}));
      } else { setKeyMsg(`Error saving ${id} key`); }
    } catch (e) { setKeyMsg('API error: '+String(e)); }
  };

  const testConnection = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/settings/keys/${id}/test`, {method:'POST'});
      const d = await res.json().catch(()=>({ok:false}));
      setProviders(prev=>prev.map(p=>p.id===id?{...p,connected:d.ok||res.ok}:p));
    } catch (e) { console.error('test failed',e); }
  };

  const S:React.CSSProperties={height:'100%',display:'flex',flexDirection:'column' as const,background:BG,fontFamily:MONO}
  const HDR:React.CSSProperties={display:'flex',alignItems:'center',gap:8,padding:'8px 14px',
      borderBottom:`1px solid ${BORDER}`,background:PANEL,flexShrink:0}
  const TABBAR:React.CSSProperties={display:'flex',gap:2,padding:'0 14px',borderBottom:`1px solid ${BORDER}`,
      background:PANEL,flexShrink:0}
  const tbtn=(a:boolean):React.CSSProperties=>({padding:'7px 12px',fontSize:10,fontFamily:MONO,letterSpacing:'0.08em',
      cursor:'pointer',background:'none',border:'none',borderBottom:a?`2px solid ${AMBER}`:'2px solid transparent',
      color:a?AMBER:SUBTLE,textTransform:'uppercase' as const})
  const CONTENT:React.CSSProperties={flex:1,overflowY:'auto' as const,padding:16,maxWidth:560}

  return (
    <div style={S} data-testid="settings-view">
      <div style={HDR}>
        <span style={{fontSize:11,color:BLUE,letterSpacing:'0.1em'}}>ST</span>
        <span style={{fontSize:13,color:TEXT,fontWeight:700}}>SETTINGS</span>
        <span style={{fontSize:10,color:SUBTLE}}>APEX TERMINAL CONFIGURATION</span>
      </div>

      <div style={TABBAR}>
        {(['API KEYS','PREFERENCES','SHORTCUTS','SYSTEM'] as SVTab[]).map(t=>(
          <button key={t} style={tbtn(tab===t)} onClick={()=>setTab(t)}>{t}</button>
        ))}
      </div>

      {/* API KEYS */}
      {tab==='API KEYS'&&(
        <div style={CONTENT} data-testid="settings-header">
          <SectionHeader title="API Key Configuration" color={BLUE}/>
          {keyMsg&&<div style={{fontSize:11,color:GREEN,fontFamily:MONO,marginBottom:10}}>{keyMsg}</div>}
          <div style={{display:'flex',flexDirection:'column' as const,gap:16}}>
            {providers.map(p=>(
              <div key={p.id} style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,padding:'12px 14px'}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                  <span style={{fontSize:11,color:TEXT,fontWeight:700}}>{p.name}</span>
                  <span style={{fontSize:9,fontFamily:MONO,color:p.connected?GREEN:RED,border:`1px solid ${p.connected?GREEN:RED}`,
                    padding:'1px 5px',borderRadius:2}}>{p.connected?'CONNECTED':'DISCONNECTED'}</span>
                  {p.hasKey&&<span style={{fontSize:9,fontFamily:MONO,color:PURPLE,border:`1px solid ${PURPLE}`,
                    padding:'1px 5px',borderRadius:2}}>KEY SET</span>}
                  <div style={{flex:1}}/>
                  <button onClick={()=>testConnection(p.id)}
                    style={{fontSize:9,fontFamily:MONO,background:PANEL,border:`1px solid ${BORDER}`,
                      color:SUBTLE,padding:'2px 8px',cursor:'pointer',borderRadius:2}}>TEST</button>
                </div>
                <div style={{display:'flex',gap:6}}>
                  <input type={showKeys[p.id]?'text':'password'}
                    value={p.hasKey&&!keyInputs[p.id]?'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢':keyInputs[p.id]||''}
                    onChange={e=>setKeyInputs(prev=>({...prev,[p.id]:e.target.value}))}
                    placeholder={`Enter ${p.name} API key...`}
                    style={{...INPUT_S,flex:1,letterSpacing:p.hasKey&&!keyInputs[p.id]?'0.1em':'normal'}}/>
                  <button onClick={()=>setShowKeys(prev=>({...prev,[p.id]:!prev[p.id]}))}
                    style={{background:PANEL,border:`1px solid ${BORDER}`,color:SUBTLE,cursor:'pointer',
                      padding:'4px 8px',borderRadius:2,fontSize:11,fontFamily:MONO}}>
                    {showKeys[p.id]?'HIDE':'SHOW'}
                  </button>
                  <button onClick={()=>saveKey(p.id)}
                    style={{fontSize:9,fontFamily:MONO,background:AMBER,border:'none',color:BG,
                      padding:'4px 10px',cursor:'pointer',borderRadius:2,fontWeight:700}}>SAVE</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PREFERENCES */}
      {tab==='PREFERENCES'&&(
        <div style={CONTENT}>
          <SectionHeader title="UI Preferences" color={ORANGE}/>
          <Row label="Density">
            <div style={{display:'flex',gap:4}}>
              {(['compact','normal','comfortable'] as const).map(d=>(
                <button key={d} onClick={()=>setDensity(d)}
                  style={{fontSize:9,fontFamily:MONO,padding:'2px 8px',borderRadius:2,cursor:'pointer',
                    border:`1px solid ${density===d?AMBER:BORDER}`,background:density===d?`${AMBER}22`:PANEL,
                    color:density===d?AMBER:SUBTLE,textTransform:'capitalize' as const}}>{d}</button>
              ))}
            </div>
          </Row>
          <Row label="Animations"><Toggle value={animations} onChange={setAnimations}/></Row>
          <Row label="Poll Interval (ms)">
            <select value={polling} onChange={e=>setPolling(Number(e.target.value))}
              style={{background:BG,border:`1px solid ${BORDER}`,color:TEXT,fontFamily:MONO,fontSize:10,
                padding:'3px 6px',borderRadius:2,outline:'none'}}>
              {[1000,2000,5000,10000,30000].map(v=><option key={v} value={v}>{v/1000}s</option>)}
            </select>
          </Row>
          <Row label="Timezone">
            <select value={timezone} onChange={e=>setTimezone(e.target.value)}
              style={{background:BG,border:`1px solid ${BORDER}`,color:TEXT,fontFamily:MONO,fontSize:10,
                padding:'3px 6px',borderRadius:2,outline:'none'}}>
              {['America/New_York','America/Chicago','America/Los_Angeles','Europe/London','Asia/Tokyo','UTC'].map(tz=>(
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </Row>
        </div>
      )}

      {/* SHORTCUTS */}
      {tab==='SHORTCUTS'&&(
        <div style={CONTENT}>
          <SectionHeader title="Keyboard Shortcuts" color={GREEN}/>
          <div style={{display:'flex',flexDirection:'column' as const,gap:0}}>
            {SHORTCUTS.map((s,i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                padding:'8px 0',borderBottom:`1px solid ${BORDER}`}}>
                <span style={{fontSize:11,color:TEXT,fontFamily:MONO}}>{s.action}</span>
                <kbd style={{fontSize:10,fontFamily:MONO,color:AMBER,background:BG,
                  border:`1px solid ${AMBER}`,padding:'2px 8px',borderRadius:2}}>{s.key}</kbd>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SYSTEM */}
      {tab==='SYSTEM'&&(
        <div style={CONTENT}>
          <SectionHeader title="System Information" color={PURPLE}/>
          <div style={{display:'flex',flexDirection:'column' as const,gap:0}}>
            {[
              ['API Status', sysInfo.status, sysInfo.status==='ok'?GREEN:RED],
              ['Backend Version', sysInfo.version, BLUE],
              ['Uptime', sysInfo.uptime, TEXT],
              ['Frontend Build', 'Vite + React 19', SUBTLE],
              ['UI Framework', 'Bloomberg Terminal Style', AMBER],
            ].map(([label,value,color])=>(
              <div key={String(label)} style={{display:'flex',justifyContent:'space-between',
                padding:'8px 0',borderBottom:`1px solid ${BORDER}`}}>
                <span style={{fontSize:11,color:SUBTLE,fontFamily:MONO}}>{label}</span>
                <span style={{fontSize:11,fontFamily:MONO,color:color as string}}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

