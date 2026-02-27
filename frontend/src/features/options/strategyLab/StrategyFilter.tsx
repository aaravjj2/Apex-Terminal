// â”€â”€â”€ Bloomberg palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BG='#0a0a0a',PANEL='#111111',BORDER='#1e1e1e'
const AMBER='#f5a623',GREEN='#26a69a',RED='#ef5350',BLUE='#42a5f5'
const SUBTLE='#555',TEXT='#d1d4dc'
const MONO='"Roboto Mono","Courier New",monospace'

import { useState, useEffect, useCallback } from 'react';
import React from 'react';
import { API_BASE } from '../../../config/api';

interface Artifact {
  id: string; name: string; type: string; version: string; checksum: string;
  spec: Record<string, unknown>;
}
interface FilterState { tag: string; type: string; sortBy: string; sortOrder: string; }
interface FilteredResult { artifacts: Artifact[]; count: number; filter: { tag: string|null; type: string|null }; sort: { key: string; order: string }; }
interface StrategyFilterProps { onResults: (artifacts: Artifact[]) => void; }

const SORT_OPTIONS=[{value:'id',label:'ID (Default)'},{value:'name',label:'NAME'},{value:'type',label:'TYPE'},{value:'version',label:'VERSION'}];
const TYPE_OPTIONS=[{value:'',label:'ALL TYPES'},{value:'crossover',label:'CROSSOVER'},{value:'signal',label:'SIGNAL'},{value:'mean_reversion',label:'MEAN REVERSION'},{value:'breakout',label:'BREAKOUT'},{value:'momentum',label:'MOMENTUM'},{value:'volatility',label:'VOLATILITY'}];

export function StrategyFilter({onResults}:StrategyFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<FilterState>({tag:'',type:'',sortBy:'id',sortOrder:'asc'});
  const [loading, setLoading] = useState(false);

  const applyFilter=useCallback(async(f:FilterState)=>{
    setLoading(true);
    try {
      const p=new URLSearchParams();
      if(f.tag) p.set('tag',f.tag);
      if(f.type) p.set('type',f.type);
      p.set('sort_by',f.sortBy); p.set('sort_order',f.sortOrder);
      const res=await fetch(`${API_BASE}/api/v1/strategy-artifacts/filter/list?${p}`,{signal:AbortSignal.timeout(5000)});
      if(res.ok){const d:FilteredResult=await res.json();onResults(d.artifacts);}
    } catch { console.error('Filter failed'); }
    finally { setLoading(false); }
  },[onResults]);

  useEffect(()=>{applyFilter(filter);},[]);

  const handleReset=()=>{
    const def:FilterState={tag:'',type:'',sortBy:'id',sortOrder:'asc'};
    setFilter(def); applyFilter(def);
  };

  const INP:React.CSSProperties={background:BG,border:`1px solid ${BORDER}`,color:TEXT,fontFamily:MONO,
    fontSize:10,padding:'5px 8px',borderRadius:2,outline:'none',width:'100%',boxSizing:'border-box' as const,appearance:'none' as const}
  const hasFilter=filter.tag||filter.type||filter.sortBy!=='id'||filter.sortOrder!=='asc';

  return (
    <div data-testid="strategy-filter" style={{position:'relative' as const,fontFamily:MONO}}>
      <button data-testid="strategy-filter-toggle" onClick={()=>setIsOpen(!isOpen)}
        style={{display:'flex',alignItems:'center',gap:6,padding:'5px 10px',
          background:isOpen||hasFilter?`${BLUE}22`:PANEL,
          border:`1px solid ${isOpen||hasFilter?BLUE:BORDER}`,borderRadius:2,
          cursor:'pointer',color:isOpen||hasFilter?BLUE:TEXT,fontSize:9,letterSpacing:'0.06em'}}>
        <span>âš™</span>
        <span>FILTER &amp; SORT</span>
        {hasFilter&&<span style={{fontSize:8,background:AMBER,color:BG,borderRadius:10,padding:'0 4px',fontWeight:700}}>â€¢</span>}
        <span style={{color:SUBTLE,fontSize:9}}>{isOpen?'â–²':'â–¼'}</span>
      </button>

      {isOpen&&(
        <div style={{position:'absolute' as const,top:'100%',left:0,marginTop:2,width:280,
          background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,zIndex:50,
          padding:10,boxShadow:'0 8px 24px #000a'}}>
          {/* Tag */}
          <div style={{marginBottom:8}}>
            <div style={{fontSize:9,color:SUBTLE,marginBottom:3,letterSpacing:'0.1em'}}>TAG</div>
            <input data-testid="strategy-filter-tag-input" type="text"
              value={filter.tag} onChange={e=>setFilter({...filter,tag:e.target.value})}
              placeholder="e.g., trend, oscillator" style={INP}/>
          </div>
          {/* Type */}
          <div style={{marginBottom:8}}>
            <div style={{fontSize:9,color:SUBTLE,marginBottom:3,letterSpacing:'0.1em'}}>TYPE</div>
            <select data-testid="strategy-filter-type-select"
              value={filter.type} onChange={e=>setFilter({...filter,type:e.target.value})} style={INP}>
              {TYPE_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {/* Sort */}
          <div style={{marginBottom:10}}>
            <div style={{fontSize:9,color:SUBTLE,marginBottom:3,letterSpacing:'0.1em'}}>SORT</div>
            <div style={{display:'flex',gap:6}}>
              <select data-testid="strategy-filter-sort-select"
                value={filter.sortBy} onChange={e=>setFilter({...filter,sortBy:e.target.value})}
                style={{...INP,flex:1}}>
                {SORT_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button data-testid="strategy-filter-sort-order"
                onClick={()=>setFilter({...filter,sortOrder:filter.sortOrder==='asc'?'desc':'asc'})}
                style={{padding:'5px 10px',background:BG,border:`1px solid ${BORDER}`,
                  color:TEXT,fontFamily:MONO,fontSize:10,cursor:'pointer',borderRadius:2,
                  flexShrink:0}}>
                {filter.sortOrder==='asc'?'â–²ASC':'â–¼DESC'}
              </button>
            </div>
          </div>
          {/* Actions */}
          <div style={{display:'flex',gap:6}}>
            <button data-testid="strategy-filter-apply"
              onClick={()=>applyFilter(filter)} disabled={loading}
              style={{flex:1,padding:'6px 0',fontFamily:MONO,fontSize:10,letterSpacing:'0.08em',
                cursor:'pointer',border:`1px solid ${GREEN}`,background:`${GREEN}22`,color:GREEN,borderRadius:2}}>
              {loading?'LOADING...':'APPLY'}
            </button>
            <button data-testid="strategy-filter-reset" onClick={handleReset}
              style={{padding:'6px 10px',fontFamily:MONO,fontSize:10,cursor:'pointer',
                border:`1px solid ${RED}`,background:`${RED}22`,color:RED,borderRadius:2}}>
              RESET
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
