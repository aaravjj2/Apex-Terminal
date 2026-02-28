// â”€â”€â”€ Bloomberg palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BG='#0a0a0a',PANEL='#111111',BORDER='#1e1e1e'
const AMBER='#f5a623',GREEN='#26a69a',RED='#ef5350',BLUE='#42a5f5'
const SUBTLE='#555',TEXT='#d1d4dc'
const MONO='"Roboto Mono","Courier New",monospace'

import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../../../config/api';

interface UniverseEditorProps { onClose?: () => void; }

const DEFAULT_UNIVERSE=['AAPL','SPY','QQQ','NVDA','TSLA','MSFT','AMD','META','AMZN','GOOG','BTC','ETH'];

export const UniverseEditor: React.FC<UniverseEditorProps> = ({ onClose }) => {
  const [symbols, setSymbols] = useState<string[]>(DEFAULT_UNIVERSE);
  const [newSymbol, setNewSymbol] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(()=>{
    (async()=>{
      try {
        const res=await fetch(`${API_BASE}/api/v1/autopilot/config`);
        if(res.ok){const c=await res.json();if(c.universe?.length>0)setSymbols(c.universe);}
      } catch { console.warn('Failed to load universe'); }
    })();
  },[]);

  const addSymbol=useCallback(()=>{
    const sym=newSymbol.toUpperCase().trim();
    if(sym&&!symbols.includes(sym)){setSymbols([...symbols,sym]);setNewSymbol('');setSaved(false);}
  },[newSymbol,symbols]);

  const removeSymbol=useCallback((sym:string)=>{setSymbols(symbols.filter(s=>s!==sym));setSaved(false);},[symbols]);

  const saveUniverse=useCallback(async()=>{
    setLoading(true); setError(null);
    try {
      const res=await fetch(`${API_BASE}/api/v1/autopilot/config`,{method:'PATCH',
        headers:{'Content-Type':'application/json'},body:JSON.stringify({universe:symbols})});
      if(!res.ok) throw new Error('Failed to save universe');
      setSaved(true); setTimeout(()=>setSaved(false),2000);
    } catch(e) { setError(e instanceof Error?e.message:'Failed to save'); }
    finally { setLoading(false); }
  },[symbols]);

  const INP:React.CSSProperties={background:BG,border:`1px solid ${BORDER}`,color:TEXT,fontFamily:MONO,
    fontSize:11,padding:'6px 10px',borderRadius:2,outline:'none',flex:1}

  return (
    <div data-testid="universe-editor"
      style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,padding:16}}>
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <div>
          <span style={{fontSize:10,color:AMBER,letterSpacing:'0.1em',fontFamily:MONO}}>UE</span>
          <span style={{fontSize:12,color:TEXT,fontWeight:700,fontFamily:MONO,marginLeft:6}}>UNIVERSE EDITOR</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:9,color:SUBTLE,fontFamily:MONO}}>Autopilot scans these symbols</span>
          {onClose&&(
            <button onClick={onClose} data-testid="universe-editor-close"
              style={{background:'none',border:'none',color:SUBTLE,cursor:'pointer',fontSize:14,fontFamily:MONO}}>
              âœ•
            </button>
          )}
        </div>
      </div>

      {/* Count badge */}
      <div style={{marginBottom:10}}>
        <span style={{fontSize:9,color:SUBTLE,fontFamily:MONO}}>SYMBOLS IN UNIVERSE â€” </span>
        <span style={{fontSize:10,color:GREEN,fontFamily:MONO,fontWeight:700}}>{symbols.length}</span>
      </div>

      {/* Symbol chips */}
      <div data-testid="universe-symbols"
        style={{display:'flex',flexWrap:'wrap' as const,gap:6,marginBottom:12,
          background:BG,border:`1px solid ${BORDER}`,borderRadius:2,padding:10,minHeight:60}}>
        {symbols.map(sym=>(
          <span key={sym} data-testid={`universe-symbol-${sym}`}
            style={{display:'inline-flex',alignItems:'center',gap:4,fontFamily:MONO,
              padding:'3px 8px 3px 10px',border:`1px solid ${BLUE}66`,background:`${BLUE}18`,
              borderRadius:2,fontSize:11,color:BLUE}}>
            {sym}
            <button onClick={()=>removeSymbol(sym)} data-testid={`remove-${sym}`}
              title={`Remove ${sym}`}
              style={{background:'none',border:'none',color:`${RED}88`,cursor:'pointer',fontSize:12,
                padding:0,lineHeight:1,marginLeft:2}}>Ã—</button>
          </span>
        ))}
        {symbols.length===0&&(
          <span style={{fontSize:10,color:SUBTLE,fontFamily:MONO}}>No symbols in universe</span>
        )}
      </div>

      {/* Add row */}
      <div style={{display:'flex',gap:6,marginBottom:10}}>
        <input value={newSymbol} onChange={e=>setNewSymbol(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter')addSymbol();}}
          placeholder="Add symbol... (e.g. NVDA)" style={INP}
          data-testid="universe-add-input"/>
        <button onClick={addSymbol} disabled={!newSymbol.trim()} data-testid="universe-add-btn"
          style={{padding:'6px 14px',fontFamily:MONO,fontSize:10,cursor:'pointer',
            border:`1px solid ${BLUE}`,background:`${BLUE}22`,color:BLUE,borderRadius:2,
            opacity:!newSymbol.trim()?0.4:1,letterSpacing:'0.06em'}}>ADD</button>
      </div>

      {/* Recommended presets */}
      <div style={{marginBottom:10}}>
        <div style={{fontSize:9,color:SUBTLE,marginBottom:4,fontFamily:MONO}}>QUICK ADD SECTORS</div>
        <div style={{display:'flex',flexWrap:'wrap' as const,gap:4}}>
          {[['TECH','AAPL,MSFT,NVDA,AMD,GOOG'],['ETF','SPY,QQQ,IWM,VTI'],['EV','TSLA,RIVN,LCID'],['CRYPTO','BTC,ETH,SOL']].map(([label,syms])=>(
            <button key={label} onClick={()=>{
              syms.split(',').forEach(s=>{if(!symbols.includes(s))setSymbols(p=>[...p,s]);});setSaved(false);
            }}
              style={{fontSize:9,padding:'2px 7px',fontFamily:MONO,cursor:'pointer',
                border:`1px solid ${AMBER}66`,background:`${AMBER}11`,color:AMBER,borderRadius:2}}>
              +{label}
            </button>
          ))}
          <button onClick={()=>{setSymbols([]);setSaved(false);}}
            style={{fontSize:9,padding:'2px 7px',fontFamily:MONO,cursor:'pointer',
              border:`1px solid ${RED}66`,background:`${RED}11`,color:RED,borderRadius:2}}>CLR</button>
        </div>
      </div>

      {/* Save */}
      <button onClick={saveUniverse} disabled={loading} data-testid="universe-save-btn"
        style={{width:'100%',padding:'8px 0',fontFamily:MONO,fontSize:11,letterSpacing:'0.08em',
          cursor:loading?'wait':'pointer',border:`1px solid ${saved?GREEN:AMBER}`,
          background:saved?`${GREEN}22`:`${AMBER}22`,color:saved?GREEN:AMBER,borderRadius:2,fontWeight:700}}>
        {loading?'SAVING...' : saved?`âœ“ SAVED â€” ${symbols.length} SYMBOLS`:`SAVE UNIVERSE (${symbols.length} SYMBOLS)`}
      </button>

      {error&&(
        <div style={{marginTop:6,fontSize:10,color:RED,fontFamily:MONO}}>âš  {error}</div>
      )}
    </div>
  );
};

export default UniverseEditor;
