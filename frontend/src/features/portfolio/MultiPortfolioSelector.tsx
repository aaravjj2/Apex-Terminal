// â”€â”€â”€ Bloomberg palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BG='#0a0a0a',PANEL='#111111',BORDER='#1e1e1e'
const AMBER='#f5a623',GREEN='#26a69a',RED='#ef5350',BLUE='#42a5f5'
const SUBTLE='#555',TEXT='#d1d4dc'
const MONO='"Roboto Mono","Courier New",monospace'

import { useState, useEffect } from 'react';
import React from 'react';
import { API_BASE } from '../../config/api';

interface Portfolio {
  portfolio_id: string; name: string; currency: string;
  cash_balance: string; content_hash: string|null;
}
interface MultiPortfolioSelectorProps {
  onSelectionChange: (portfolioIds: string[]) => void;
  selectedIds?: string[];
}

export function MultiPortfolioSelector({onSelectionChange,selectedIds=[]}:MultiPortfolioSelectorProps) {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(()=>{ loadPortfolios(); },[]);

  const loadPortfolios=async()=>{
    setLoading(true);
    try {
      const res=await fetch(`${API_BASE}/api/v1/portfolios?sort_by=portfolio_id`,{signal:AbortSignal.timeout(3000)});
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const data=await res.json();
      const list:Portfolio[]=data.portfolios||[];
      setPortfolios(list);
      if(selectedIds.length===0&&list.length>0){
        const def=list.find(p=>p.portfolio_id==='DEMO-PORT-001')?.portfolio_id||list[0].portfolio_id;
        onSelectionChange([def]);
      }
    } catch {
      const demo:Portfolio[]=[{portfolio_id:'DEMO-PORT-001',name:'Demo Portfolio',currency:'USD',cash_balance:'100000',content_hash:null}];
      setPortfolios(demo);
      if(selectedIds.length===0) onSelectionChange(['DEMO-PORT-001']);
    } finally { setLoading(false); }
  };

  const togglePortfolio=(id:string)=>{
    const next=selectedIds.includes(id)?selectedIds.filter(x=>x!==id):[...selectedIds,id].sort();
    onSelectionChange(next);
  };
  const selectAll=()=>onSelectionChange(portfolios.map(p=>p.portfolio_id).sort());
  const deselectAll=()=>onSelectionChange([]);

  if(loading) return(
    <div data-testid="multi-portfolio-selector-loading"
      style={{height:32,width:200,background:PANEL,borderRadius:2,border:`1px solid ${BORDER}`,animation:'pulse 1s infinite'}}/>
  );

  return (
    <div data-testid="multi-portfolio-selector" style={{position:'relative',fontFamily:MONO}}>
      {/* Toggle */}
      <button data-testid="multi-portfolio-toggle" onClick={()=>setIsOpen(!isOpen)}
        style={{display:'flex',alignItems:'center',gap:8,padding:'6px 12px',background:isOpen?`${BLUE}22`:PANEL,
          border:`1px solid ${isOpen?BLUE:BORDER}`,borderRadius:2,cursor:'pointer',
          color:isOpen?BLUE:TEXT,fontSize:10,letterSpacing:'0.06em'}}>
        <span style={{fontSize:12}}>â˜°</span>
        <span>
          {selectedIds.length===0?'SELECT PORTFOLIOS':
            `${selectedIds.length} PORTFOLIO${selectedIds.length>1?'S':''} SELECTED`}
        </span>
        <span style={{color:SUBTLE,fontSize:9}}>{isOpen?'â–²':'â–¼'}</span>
      </button>

      {/* Dropdown */}
      {isOpen&&(
        <div style={{position:'absolute',top:'100%',left:0,marginTop:2,width:340,
          background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,zIndex:50,boxShadow:'0 8px 24px #000a'}}>
          {/* Actions */}
          <div style={{display:'flex',gap:10,padding:'6px 10px',borderBottom:`1px solid ${BORDER}`}}>
            <button data-testid="multi-portfolio-select-all" onClick={selectAll}
              style={{fontSize:9,color:BLUE,background:'none',border:'none',cursor:'pointer',fontFamily:MONO}}>
              SELECT ALL
            </button>
            <button data-testid="multi-portfolio-deselect-all" onClick={deselectAll}
              style={{fontSize:9,color:SUBTLE,background:'none',border:'none',cursor:'pointer',fontFamily:MONO}}>
              DESELECT ALL
            </button>
            <div style={{flex:1}}/>
            <span style={{fontSize:9,color:SUBTLE}}>{portfolios.length} PORTFOLIOS</span>
          </div>
          {/* List */}
          <div style={{maxHeight:240,overflowY:'auto' as const}}>
            {portfolios.map(p=>{
              const sel=selectedIds.includes(p.portfolio_id);
              return(
                <button key={p.portfolio_id} data-testid={`multi-portfolio-option-${p.portfolio_id}`}
                  onClick={()=>togglePortfolio(p.portfolio_id)}
                  style={{width:'100%',textAlign:'left' as const,padding:'7px 10px',display:'flex',alignItems:'center',
                    gap:8,background:sel?`${BLUE}18`:'transparent',border:'none',
                    borderBottom:`1px solid ${BORDER}33`,cursor:'pointer'}}
                  onMouseEnter={e=>{if(!sel)e.currentTarget.style.background=`${BORDER}66`}}
                  onMouseLeave={e=>{if(!sel)e.currentTarget.style.background='transparent'}}>
                  <div style={{width:14,height:14,border:`1px solid ${sel?BLUE:SUBTLE}`,
                    background:sel?BLUE:'transparent',borderRadius:2,flexShrink:0,
                    display:'flex',alignItems:'center',justifyContent:'center'}}>
                    {sel&&<span style={{color:BG,fontSize:10,lineHeight:1}}>âœ“</span>}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,color:sel?BLUE:TEXT,fontFamily:MONO}}>{p.name}</div>
                    <div style={{fontSize:9,color:SUBTLE,fontFamily:MONO}}>{p.portfolio_id}</div>
                  </div>
                  <div style={{fontSize:9,color:SUBTLE,fontFamily:MONO}}>
                    {p.currency} {parseFloat(p.cash_balance).toLocaleString()}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary row */}
      {selectedIds.length>0&&(
        <div data-testid="multi-portfolio-summary"
          style={{marginTop:4,fontSize:9,color:SUBTLE,fontFamily:MONO}}>
          SELECTED: <span style={{color:BLUE}}>{selectedIds.join(', ')}</span>
        </div>
      )}
    </div>
  );
}
