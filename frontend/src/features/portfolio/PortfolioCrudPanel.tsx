/**
 * Portfolio CRUD Panel â€” Bloomberg Terminal Style
 */

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
  <td style={{padding:'7px 10px',fontSize:11,fontFamily:MONO,borderBottom:`1px solid ${BORDER}`,color:TEXT,...c}}>{ch}</td>
)
function StatCard({label,value,color}:{label:string,value:string,color?:string}){
  return (
    <div style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,padding:'7px 10px',minWidth:90}}>
      <div style={{fontSize:9,fontFamily:MONO,color:SUBTLE,textTransform:'uppercase' as const,letterSpacing:'0.08em',marginBottom:3}}>{label}</div>
      <div style={{fontSize:15,fontFamily:MONO,color:color||AMBER,fontWeight:700}}>{value}</div>
    </div>
  )
}

import React, { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../../config/api';
import { PortfolioModal } from './PortfolioModal';
import { PositionModal } from './PositionModal';

interface Position {
  symbol: string;
  quantity: string;
  average_cost_basis: string;
  current_price: string | null;
  lots: unknown[];
}

interface Portfolio {
  portfolio_id: string;
  name: string;
  currency: string;
  cash_balance: string;
  positions: Position[];
  created_at: string;
  updated_at: string;
  schema_version: string;
  content_hash: string | null;
}

const TABS=['PORTFOLIOS','POSITIONS'] as const
type PCTab=typeof TABS[number]

export function PortfolioCrudPanel() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{text:string,type:'ok'|'err'}|null>(null);
  const [tab, setTab] = useState<PCTab>('PORTFOLIOS');

  const [portfolioModalOpen, setPortfolioModalOpen] = useState(false);
  const [positionModalOpen, setPositionModalOpen] = useState(false);
  const [editingPortfolio, setEditingPortfolio] = useState<Portfolio | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadPortfolios(); }, []);

  const loadPortfolios = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/portfolios?sort_by=portfolio_id`, {signal: AbortSignal.timeout(2000)});
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPortfolios(data.portfolios || []);
    } catch (e) {
      console.warn('Failed to load portfolios:', e);
    } finally { setLoading(false); }
  };

  const handleLoadDemo = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/portfolios/reset`, {method:'POST',signal:AbortSignal.timeout(5000)});
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await loadPortfolios();
      setMsg({text:'Demo portfolios loaded',type:'ok'});
    } catch (e) {
      setMsg({text:'Failed to load demo: '+String(e),type:'err'});
    } finally { setLoading(false); }
  };

  const handleExport = async (portfolioId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/portfolios/${portfolioId}/export`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href=url; a.download=`portfolio-${portfolioId}.json`; a.click();
      URL.revokeObjectURL(url);
      setMsg({text:`Exported ${portfolioId}`,type:'ok'});
    } catch (e) { setMsg({text:'Export failed: '+String(e),type:'err'}); }
  };

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const res = await fetch(`${API_BASE}/api/v1/portfolios/import`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)
      });
      if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.detail||`HTTP ${res.status}`); }
      await loadPortfolios();
      setMsg({text:'Portfolio imported',type:'ok'});
    } catch (e) { setMsg({text:e instanceof Error?e.message:'Import failed',type:'err'}); }
    if (importFileRef.current) importFileRef.current.value='';
  };

  const computeMarketValue = (p: Portfolio) => {
    const posVal = p.positions.reduce((s,pos)=>pos.current_price
      ?s+parseFloat(pos.quantity)*parseFloat(pos.current_price):s, 0);
    return (posVal+parseFloat(p.cash_balance)).toFixed(2);
  };

  const computeUnrealizedPnl = (p: Portfolio) => {
    return p.positions.reduce((s,pos)=>{
      if(!pos.current_price) return s;
      const cost=parseFloat(pos.quantity)*parseFloat(pos.average_cost_basis);
      const mkt=parseFloat(pos.quantity)*parseFloat(pos.current_price);
      return s+(mkt-cost);
    },0);
  };

  const totalValue = portfolios.reduce((s,p)=>s+parseFloat(computeMarketValue(p)),0);
  const totalCash = portfolios.reduce((s,p)=>s+parseFloat(p.cash_balance),0);

  const S:React.CSSProperties={height:'100%',display:'flex',flexDirection:'column' as const,background:BG,fontFamily:MONO}
  const HDR:React.CSSProperties={display:'flex',alignItems:'center',gap:8,padding:'8px 14px',
      borderBottom:`1px solid ${BORDER}`,background:PANEL,flexShrink:0}
  const TABBAR:React.CSSProperties={display:'flex',gap:2,padding:'0 14px',borderBottom:`1px solid ${BORDER}`,
      background:PANEL,flexShrink:0}
  const tbtn=(a:boolean):React.CSSProperties=>({padding:'7px 12px',fontSize:10,fontFamily:MONO,letterSpacing:'0.08em',
      cursor:'pointer',background:'none',border:'none',borderBottom:a?`2px solid ${AMBER}`:'2px solid transparent',
      color:a?AMBER:SUBTLE,textTransform:'uppercase' as const})
  const btnSm=(color:string):React.CSSProperties=>({fontSize:9,fontFamily:MONO,background:PANEL,cursor:'pointer',
      borderRadius:2,border:`1px solid ${color}`,color,padding:'2px 6px'})

  return (
    <div style={S} data-testid="portfolio-panel">
      <div style={HDR}>
        <span style={{fontSize:11,color:GREEN,letterSpacing:'0.1em'}}>PF</span>
        <span style={{fontSize:13,color:TEXT,fontWeight:700}}>PORTFOLIO MANAGER</span>
        <span style={{fontSize:10,color:SUBTLE}}>CRUD ENGINE</span>
        <div style={{flex:1}}/>
        {loading&&<span style={{fontSize:10,color:AMBER}}>LOADING</span>}
        <button onClick={handleLoadDemo} style={btnSm(ORANGE)} data-testid="portfolio-load-demo-btn">DEMO</button>
        <input ref={importFileRef} type="file" accept=".json" style={{display:'none'}}
          data-testid="portfolio-import-file-input"
          onChange={e=>{const f=e.target.files?.[0];if(f)handleImport(f);}}/>
        <button onClick={()=>importFileRef.current?.click()} style={btnSm(PURPLE)}
          data-testid="portfolio-import-btn">IMPORT</button>
        <button onClick={()=>{setEditingPortfolio(null);setPortfolioModalOpen(true);}}
          style={{...btnSm(AMBER),fontWeight:700}} data-testid="portfolio-create-btn">+ CREATE</button>
      </div>

      {/* Message banner */}
      {msg&&(
        <div style={{padding:'6px 14px',background:msg.type==='ok'?`${GREEN}22`:`${RED}22`,
          borderBottom:`1px solid ${msg.type==='ok'?GREEN:RED}`,fontSize:11,color:msg.type==='ok'?GREEN:RED,
          display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          {msg.text}
          <button onClick={()=>setMsg(null)} style={{background:'none',border:'none',color:SUBTLE,cursor:'pointer',fontSize:12}}>âœ•</button>
        </div>
      )}

      {/* Stats */}
      <div style={{display:'flex',gap:8,padding:'8px 14px',borderBottom:`1px solid ${BORDER}`,
          background:PANEL,flexShrink:0}}>
        <StatCard label="Portfolios" value={String(portfolios.length)} color={TEXT}/>
        <StatCard label="Total Value" value={`$${totalValue.toLocaleString('en-US',{maximumFractionDigits:0})}`} color={GREEN}/>
        <StatCard label="Cash" value={`$${totalCash.toLocaleString('en-US',{maximumFractionDigits:0})}`} color={BLUE}/>
        <StatCard label="Positions" value={String(portfolios.reduce((s,p)=>s+p.positions.length,0))} color={PURPLE}/>
      </div>

      <div style={TABBAR}>
        {TABS.map(t=><button key={t} style={tbtn(tab===t)} onClick={()=>setTab(t)}>{t}</button>)}
      </div>

      {/* PORTFOLIOS tab */}
      {tab==='PORTFOLIOS'&&(
        <div style={{flex:1,overflowY:'auto' as const}}>
          {portfolios.length===0&&!loading&&(
            <div style={{padding:40,textAlign:'center' as const,fontSize:12,color:SUBTLE}} data-testid="portfolio-empty">
              NO PORTFOLIOS â€” CLICK + CREATE OR DEMO
            </div>
          )}
          {portfolios.length>0&&(
            <table style={{width:'100%',borderCollapse:'collapse'}} data-testid="portfolio-table">
              <thead style={{position:'sticky' as const,top:0,background:PANEL}}>
                <tr>
                  <Th ch="Name"/>
                  <Th ch="Currency"/>
                  <Th c={{textAlign:'right'}} ch="Cash Balance"/>
                  <Th c={{textAlign:'right'}} ch="Positions"/>
                  <Th c={{textAlign:'right'}} ch="Market Value"/>
                  <Th c={{textAlign:'right'}} ch="Unreal. P&L"/>
                  <Th ch="Actions"/>
                </tr>
              </thead>
              <tbody>
                {portfolios.map(p=>{
                  const pnl=computeUnrealizedPnl(p);
                  return (
                    <tr key={p.portfolio_id}
                      onClick={()=>{setSelectedPortfolio(p);setTab('POSITIONS');}}
                      style={{cursor:'pointer',background:selectedPortfolio?.portfolio_id===p.portfolio_id?`${AMBER}11`:'transparent'}}
                      data-testid={`portfolio-row-${p.portfolio_id}`}>
                      <Td c={{color:TEXT,fontWeight:700}} ch={<span data-testid={`portfolio-name-cell-${p.portfolio_id}`}>{p.name}</span>}/>
                      <Td c={{color:SUBTLE}} ch={p.currency}/>
                      <Td c={{textAlign:'right',color:GREEN}} ch={`$${parseFloat(p.cash_balance).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`}/>
                      <Td c={{textAlign:'right'}} ch={p.positions.length}/>
                      <Td c={{textAlign:'right',color:BLUE}} ch={`$${parseFloat(computeMarketValue(p)).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`}/>
                      <Td c={{textAlign:'right',color:pnl>=0?GREEN:RED}} ch={`${pnl>=0?'+':''}$${pnl.toFixed(2)}`}/>
                      <Td ch={
                        <div style={{display:'flex',gap:4}} onClick={e=>e.stopPropagation()}>
                          <button onClick={()=>{setEditingPortfolio(p);setPortfolioModalOpen(true);}}
                            style={btnSm(BLUE)} data-testid={`portfolio-edit-btn-${p.portfolio_id}`}>EDIT</button>
                          <button onClick={()=>{setSelectedPortfolio(p);setPositionModalOpen(true);}}
                            style={btnSm(GREEN)} data-testid={`portfolio-add-position-btn-${p.portfolio_id}`}>+ POS</button>
                          <button onClick={()=>handleExport(p.portfolio_id)}
                            style={btnSm(PURPLE)} data-testid={`portfolio-export-btn-${p.portfolio_id}`}>EXPORT</button>
                        </div>
                      }/>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* POSITIONS tab */}
      {tab==='POSITIONS'&&(
        <div style={{flex:1,overflowY:'auto' as const}}>
          <div style={{padding:'6px 14px',borderBottom:`1px solid ${BORDER}`,background:PANEL,
              fontSize:10,color:SUBTLE,display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
            <span>POSITIONS</span>
            {selectedPortfolio&&<span style={{color:AMBER}}>{selectedPortfolio.name}</span>}
            {selectedPortfolio&&(
              <button onClick={()=>{setPositionModalOpen(true);}}
                style={{marginLeft:'auto',...btnSm(GREEN)}} data-testid={`portfolio-add-position-btn-${selectedPortfolio?.portfolio_id}`}>+ ADD POSITION</button>
            )}
          </div>
          {!selectedPortfolio&&(
            <div style={{padding:40,textAlign:'center' as const,color:SUBTLE,fontSize:12}}>
              SELECT A PORTFOLIO FROM THE PORTFOLIOS TAB
            </div>
          )}
          {selectedPortfolio&&selectedPortfolio.positions.length===0&&(
            <div style={{padding:40,textAlign:'center' as const,color:SUBTLE,fontSize:12}}>NO POSITIONS IN THIS PORTFOLIO</div>
          )}
          {selectedPortfolio&&selectedPortfolio.positions.length>0&&(
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead style={{position:'sticky' as const,top:0,background:PANEL}}>
                <tr>
                  <Th ch="Symbol"/>
                  <Th c={{textAlign:'right'}} ch="Quantity"/>
                  <Th c={{textAlign:'right'}} ch="Avg Cost"/>
                  <Th c={{textAlign:'right'}} ch="Current Price"/>
                  <Th c={{textAlign:'right'}} ch="Market Value"/>
                  <Th c={{textAlign:'right'}} ch="Unreal. P&L"/>
                  <Th c={{textAlign:'right'}} ch="Return %"/>
                </tr>
              </thead>
              <tbody>
                {selectedPortfolio.positions.map((pos,i)=>{
                  const qty=parseFloat(pos.quantity);
                  const cost=parseFloat(pos.average_cost_basis);
                  const price=pos.current_price?parseFloat(pos.current_price):null;
                  const mktVal=price?qty*price:null;
                  const pnl=price?qty*(price-cost):null;
                  const ret=price?((price-cost)/cost*100):null;
                  return (
                    <tr key={i} style={{background:'transparent'}}>
                      <Td c={{color:AMBER,fontWeight:700}} ch={pos.symbol}/>
                      <Td c={{textAlign:'right'}} ch={qty.toLocaleString()}/>
                      <Td c={{textAlign:'right',color:SUBTLE}} ch={`$${cost.toFixed(4)}`}/>
                      <Td c={{textAlign:'right'}} ch={price?`$${price.toFixed(4)}`:'â€”'}/>
                      <Td c={{textAlign:'right',color:BLUE}} ch={mktVal?`$${mktVal.toFixed(2)}`:'â€”'}/>
                      <Td c={{textAlign:'right',color:pnl===null?SUBTLE:pnl>=0?GREEN:RED}} ch={pnl===null?'â€”':`${pnl>=0?'+':''}$${pnl.toFixed(2)}`}/>
                      <Td c={{textAlign:'right',color:ret===null?SUBTLE:ret>=0?GREEN:RED}} ch={ret===null?'â€”':`${ret>=0?'+':''}${ret.toFixed(2)}%`}/>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modals */}
      {portfolioModalOpen && (
        <PortfolioModal
          portfolio={editingPortfolio}
          onClose={() => { setPortfolioModalOpen(false); setEditingPortfolio(null); }}
          onSaved={() => { setPortfolioModalOpen(false); setEditingPortfolio(null); loadPortfolios(); setMsg({text:'Portfolio saved',type:'ok'}); }}
        />
      )}
      {positionModalOpen && selectedPortfolio && (
        <PositionModal
          portfolio={selectedPortfolio}
          onClose={() => setPositionModalOpen(false)}
          onSaved={() => { setPositionModalOpen(false); loadPortfolios(); setMsg({text:'Position saved',type:'ok'}); }}
        />
      )}
    </div>
  );
}

interface Position {
  symbol: string;
  quantity: string;
  average_cost_basis: string;
  current_price: string | null;
  lots: any[];
}

interface Portfolio {
  portfolio_id: string;
  name: string;
  currency: string;
  cash_balance: string;
  positions: Position[];
  created_at: string;
  updated_at: string;
  schema_version: string;
  content_hash: string | null;
}

