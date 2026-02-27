// â”€â”€â”€ Bloomberg palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BG='#0a0a0a',PANEL='#111111',BORDER='#1e1e1e'
const AMBER='#f5a623',GREEN='#26a69a',RED='#ef5350',BLUE='#42a5f5'
const PURPLE='#ab47bc',SUBTLE='#555',TEXT='#d1d4dc'
const MONO='"Roboto Mono","Courier New",monospace'

// â”€â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const Th=({c}:{c:string})=><th style={{padding:'5px 10px',fontSize:9,letterSpacing:'0.1em',color:SUBTLE,
  textAlign:'left' as const,borderBottom:`1px solid ${BORDER}`,background:PANEL,fontFamily:MONO}}>{c}</th>
const Td=({children,mono,color}:{children:React.ReactNode,mono?:boolean,color?:string})=>(
  <td style={{padding:'6px 10px',fontSize:11,color:color||TEXT,fontFamily:mono?MONO:'inherit',
    borderBottom:`1px solid ${BORDER}33`}}>{children}</td>
)
const StatusDot=({s}:{s:string})=>{
  const c=s==='ACTIVE'?GREEN:s==='PAUSED'?AMBER:SUBTLE;
  return<span style={{display:'inline-block',width:7,height:7,borderRadius:'50%',background:c,marginRight:5}}/>
}
const StatCard=({label,value,color}:{label:string,value:string|number,color?:string})=>(
  <div style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,padding:'8px 12px',minWidth:80}}>
    <div style={{fontSize:9,color:SUBTLE,letterSpacing:'0.1em',marginBottom:3}}>{label}</div>
    <div style={{fontSize:16,color:color||TEXT,fontFamily:MONO,fontWeight:700}}>{value}</div>
  </div>
)

import { useState, useEffect, useCallback } from 'react';
import React from 'react';
import { ApiClient } from '../../../data/ApiClient';

interface AlertRecord {
  id: string;
  name: string;
  symbol: string;
  condition: string;
  status: 'ACTIVE'|'INACTIVE'|'PAUSED';
  delivery?: string[];
  throttle?: string;
  created_at?: string;
}

type AlView = 'list'|'detail'|'create';

export function AlertsView() {
  const [alerts, setAlerts] = useState<AlertRecord[]>([
    {id:'a-1',name:'AAPL Price Alert',symbol:'AAPL',condition:'Price > 190.00',status:'ACTIVE',delivery:['webhook']},
    {id:'a-2',name:'TSLA Volume Alert',symbol:'TSLA',condition:'Volume > 1M',status:'INACTIVE',delivery:['email']},
  ]);
  const [view, setView] = useState<AlView>('list');
  const [selected, setSelected] = useState<AlertRecord|null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{msg:string,ok:boolean}|null>(null);
  // Create form state
  const [cName, setCName] = useState('');
  const [cSymbol, setCSymbol] = useState('');
  const [cValue, setCValue] = useState('');
  const [cField, setCField] = useState('Price');
  const [cOp, setCOp] = useState('Greater Than');
  const [cDelivery, setCDelivery] = useState('webhook');

  const showToast=(msg:string,ok=true)=>{setToast({msg,ok});setTimeout(()=>setToast(null),2800);}

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await ApiClient.listAlerts();
      if(data.length>0) setAlerts(data);
    } catch { console.error('Failed to list alerts'); }
  },[]);

  useEffect(()=>{fetchAlerts();},[fetchAlerts]);

  const handleCreate = async () => {
    try {
      await ApiClient.createAlert({name:cName,symbol:cSymbol.toUpperCase(),
        condition:`${cField} ${cOp==='Greater Than'?'>':'<'} ${cValue}`,
        value:parseFloat(cValue),delivery:[cDelivery]});
      showToast('Alert created');
      setView('list'); setCName(''); setCSymbol(''); setCValue('');
      fetchAlerts();
    } catch { showToast('Failed to create alert',false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await ApiClient.deleteAlert(id);
      showToast('Alert deleted');
      if(selected?.id===id){setSelected(null);setView('list');}
      fetchAlerts();
    } catch { showToast('Failed to delete alert',false); }
  };

  const handleSelect=(a:AlertRecord)=>{setSelected(a);setView('detail');}

  const filteredAlerts=alerts.filter(a=>{
    if(statusFilter!=='all'&&a.status!==statusFilter) return false;
    if(search&&!a.name.toLowerCase().includes(search.toLowerCase())&&
      !a.symbol.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const INP:React.CSSProperties={background:BG,border:`1px solid ${BORDER}`,color:TEXT,fontFamily:MONO,
    fontSize:11,padding:'5px 8px',borderRadius:2,outline:'none',width:'100%',boxSizing:'border-box' as const}
  const SEL:React.CSSProperties={...INP,appearance:'none' as const}
  const tbtn=(a:boolean,col?:string):React.CSSProperties=>({padding:'6px 14px',fontSize:10,fontFamily:MONO,
    letterSpacing:'0.08em',cursor:'pointer',background:'none',border:'none',
    borderBottom:a?`2px solid ${col||GREEN}`:'2px solid transparent',
    color:a?(col||GREEN):SUBTLE,textTransform:'uppercase' as const})

  return (
    <div data-testid="alerts-view"
      style={{height:'100%',display:'flex',flexDirection:'column' as const,background:BG,fontFamily:MONO}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:12,padding:'6px 14px',
        borderBottom:`1px solid ${BORDER}`,background:PANEL,flexShrink:0,flexWrap:'wrap' as const}}>
        <span style={{fontSize:11,color:AMBER,letterSpacing:'0.1em'}}>AL</span>
        <span style={{fontSize:12,color:TEXT,fontWeight:700}}>ALERTS MANAGER</span>
        <div style={{flex:1}}/>
        <input placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)}
          style={{...INP,width:180}}/>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{...SEL,width:120}}>
          <option value="all">ALL</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
          <option value="PAUSED">PAUSED</option>
        </select>
        <button onClick={fetchAlerts}
          style={{background:PANEL,border:`1px solid ${BORDER}`,color:TEXT,fontFamily:MONO,
            fontSize:10,padding:'4px 10px',cursor:'pointer',borderRadius:2}}>REFRESH</button>
      </div>

      {/* Stats */}
      <div style={{display:'flex',gap:8,padding:'8px 14px',borderBottom:`1px solid ${BORDER}`,background:PANEL}}>
        <StatCard label="TOTAL" value={alerts.length}/>
        <StatCard label="ACTIVE" value={alerts.filter(a=>a.status==='ACTIVE').length} color={GREEN}/>
        <StatCard label="INACTIVE" value={alerts.filter(a=>a.status==='INACTIVE').length} color={SUBTLE}/>
        <StatCard label="PAUSED" value={alerts.filter(a=>a.status==='PAUSED').length} color={AMBER}/>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',borderBottom:`1px solid ${BORDER}`,background:PANEL}}>
        <button style={tbtn(view==='list',AMBER)} onClick={()=>{setView('list');setSelected(null);}}>
          LIST ({filteredAlerts.length})
        </button>
        <button style={tbtn(view==='detail',BLUE)} onClick={()=>{if(selected)setView('detail');}}>
          DETAIL
        </button>
        <button style={tbtn(view==='create',GREEN)} onClick={()=>setView('create')}>
          + CREATE ALERT
        </button>
      </div>

      {/* Toast */}
      {toast&&(
        <div style={{padding:'6px 14px',background:toast.ok?`${GREEN}22`:`${RED}22`,
          borderBottom:`1px solid ${toast.ok?GREEN:RED}`,fontSize:10,color:toast.ok?GREEN:RED}}>
          {toast.msg}
        </div>
      )}

      {/* Content */}
      <div style={{flex:1,overflow:'auto'}}>
        {view==='list'&&(
          <table style={{width:'100%',borderCollapse:'collapse' as const}}>
            <thead><tr>
              <Th c="NAME"/><Th c="SYMBOL"/><Th c="CONDITION"/><Th c="STATUS"/><Th c="DELIVERY"/><Th c="ACTIONS"/>
            </tr></thead>
            <tbody>
              {filteredAlerts.length===0&&(
                <tr><td colSpan={6} style={{padding:24,textAlign:'center' as const,color:SUBTLE,fontSize:11}}>No alerts found</td></tr>
              )}
              {filteredAlerts.map(a=>(
                <tr key={a.id} onClick={()=>handleSelect(a)}
                  style={{cursor:'pointer',background:selected?.id===a.id?`${BORDER}99`:'transparent'}}
                  onMouseEnter={e=>{if(selected?.id!==a.id)(e.currentTarget.style.background=`${BORDER}66`)}}
                  onMouseLeave={e=>{if(selected?.id!==a.id)(e.currentTarget.style.background='transparent')}}>
                  <Td><StatusDot s={a.status}/>{a.name}</Td>
                  <Td mono color={BLUE}>{a.symbol}</Td>
                  <Td mono color={AMBER}>{a.condition}</Td>
                  <Td><span style={{fontSize:9,padding:'2px 6px',
                    border:`1px solid ${a.status==='ACTIVE'?GREEN:a.status==='PAUSED'?AMBER:SUBTLE}`,
                    color:a.status==='ACTIVE'?GREEN:a.status==='PAUSED'?AMBER:SUBTLE,borderRadius:2}}>
                    {a.status}
                  </span></Td>
                  <Td>{(a.delivery||[]).join(', ')}</Td>
                  <Td>
                    <button onClick={e=>{e.stopPropagation();handleDelete(a.id);}}
                      style={{fontSize:9,padding:'2px 7px',fontFamily:MONO,cursor:'pointer',border:`1px solid ${RED}`,
                        background:`${RED}22`,color:RED,borderRadius:2}}>DELETE</button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {view==='detail'&&selected&&(
          <div style={{padding:14}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
              <StatusDot s={selected.status}/>
              <span style={{fontSize:14,color:TEXT,fontWeight:700}}>{selected.name}</span>
              <span style={{fontSize:11,color:BLUE,fontFamily:MONO}}>{selected.symbol}</span>
              <span style={{fontSize:9,padding:'2px 6px',border:`1px solid ${selected.status==='ACTIVE'?GREEN:AMBER}`,
                color:selected.status==='ACTIVE'?GREEN:AMBER,borderRadius:2}}>{selected.status}</span>
              <div style={{flex:1}}/>
              <button onClick={()=>handleDelete(selected.id)}
                style={{fontSize:10,padding:'4px 12px',fontFamily:MONO,cursor:'pointer',
                  border:`1px solid ${RED}`,background:`${RED}22`,color:RED,borderRadius:2}}>DELETE</button>
            </div>
            <div style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,padding:'10px 14px',marginBottom:10}}>
              <div style={{fontSize:9,color:SUBTLE,letterSpacing:'0.1em',marginBottom:4}}>CONDITION</div>
              <div style={{fontSize:13,color:AMBER,fontFamily:MONO}}>{selected.condition}</div>
            </div>
            <div style={{display:'flex',gap:8,marginBottom:10}}>
              <div style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,padding:'8px 12px',flex:1}}>
                <div style={{fontSize:9,color:SUBTLE,marginBottom:3}}>DELIVERY</div>
                <div style={{fontSize:12,color:TEXT}}>{(selected.delivery||[]).join(', ')||'â€”'}</div>
              </div>
              <div style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,padding:'8px 12px',flex:1}}>
                <div style={{fontSize:9,color:SUBTLE,marginBottom:3}}>THROTTLE</div>
                <div style={{fontSize:12,color:TEXT}}>{selected.throttle||'NONE'}</div>
              </div>
            </div>
            <div style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,padding:'10px 14px'}}>
              <div style={{fontSize:9,color:SUBTLE,marginBottom:6}}>TRIGGER HISTORY</div>
              <div style={{fontSize:10,color:SUBTLE}}>No history available for this alert.</div>
            </div>
          </div>
        )}
        {view==='detail'&&!selected&&(
          <div style={{padding:32,textAlign:'center' as const,color:SUBTLE,fontSize:11}}>
            Select an alert from the list to view details.
          </div>
        )}
        {view==='create'&&(
          <div style={{maxWidth:480,margin:'20px auto',padding:'0 14px'}}>
            <div style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,padding:18}}>
              <div style={{fontSize:12,color:TEXT,fontWeight:700,marginBottom:14,letterSpacing:'0.05em'}}>CREATE ALERT</div>
              {[['ALERT NAME',cName,(v:string)=>setCName(v),'e.g. Price Breakout'],
                ['SYMBOL',cSymbol,(v:string)=>setCSymbol(v),'AAPL'],
                ['TARGET VALUE',cValue,(v:string)=>setCValue(v),'190.00'],
              ].map(([label,val,cb,ph])=>(
                <div key={label as string} style={{marginBottom:10}}>
                  <div style={{fontSize:9,color:SUBTLE,letterSpacing:'0.1em',marginBottom:4}}>{label}</div>
                  <input value={val as string} onChange={e=>(cb as (v:string)=>void)(e.target.value)}
                    placeholder={ph as string} style={INP}/>
                </div>
              ))}
              <div style={{display:'flex',gap:8,marginBottom:10}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:9,color:SUBTLE,letterSpacing:'0.1em',marginBottom:4}}>FIELD</div>
                  <select value={cField} onChange={e=>setCField(e.target.value)} style={SEL}>
                    <option>Price</option><option>Volume</option><option>RSI(14)</option><option>SMA(20)</option>
                  </select>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:9,color:SUBTLE,letterSpacing:'0.1em',marginBottom:4}}>OPERATOR</div>
                  <select value={cOp} onChange={e=>setCOp(e.target.value)} style={SEL}>
                    <option>Greater Than</option><option>Less Than</option><option>Crosses Above</option><option>Crosses Below</option>
                  </select>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:9,color:SUBTLE,letterSpacing:'0.1em',marginBottom:4}}>DELIVERY</div>
                  <select value={cDelivery} onChange={e=>setCDelivery(e.target.value)} style={SEL}>
                    <option value="webhook">WEBHOOK</option><option value="email">EMAIL</option><option value="sms">SMS</option>
                  </select>
                </div>
              </div>
              {cField&&cOp&&cValue&&(
                <div style={{fontSize:10,color:AMBER,fontFamily:MONO,marginBottom:10,
                  background:BG,border:`1px solid ${AMBER}33`,borderRadius:2,padding:'6px 10px'}}>
                  PREVIEW: {cField} {cOp==='Greater Than'?'> ':'< '}{cValue}
                </div>
              )}
              <button onClick={handleCreate} disabled={!cName||!cSymbol||!cValue}
                style={{width:'100%',padding:'8px 0',fontFamily:MONO,fontSize:11,letterSpacing:'0.08em',
                  cursor:!cName||!cSymbol||!cValue?'not-allowed':'pointer',border:`1px solid ${GREEN}`,
                  background:`${GREEN}22`,color:GREEN,borderRadius:2,fontWeight:700,
                  opacity:!cName||!cSymbol||!cValue?0.4:1}}>
                CREATE ALERT
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
