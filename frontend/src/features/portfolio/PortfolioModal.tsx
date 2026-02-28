/**
 * Portfolio Modal â€” Bloomberg Terminal Style
 */

// â”€â”€â”€ Bloomberg palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BG='#0a0a0a',PANEL='#111111',BORDER='#1e1e1e'
const AMBER='#f5a623',GREEN='#26a69a',RED='#ef5350'
const SUBTLE='#555',TEXT='#d1d4dc'
const MONO='"Roboto Mono","Courier New",monospace'

const INPUT_S:React.CSSProperties={width:'100%',background:BG,border:`1px solid ${BORDER}`,color:TEXT,
  fontFamily:MONO,fontSize:12,padding:'7px 10px',borderRadius:2,outline:'none',boxSizing:'border-box' as const}
const LABEL_S:React.CSSProperties={fontSize:9,fontFamily:MONO,color:SUBTLE,textTransform:'uppercase' as const,
  letterSpacing:'0.08em',marginBottom:4,display:'block'}

import React, { useState, useEffect } from 'react';

interface Portfolio {
  portfolio_id: string;
  name: string;
  currency: string;
  cash_balance: string;
}

interface PortfolioModalProps {
  portfolio?: Portfolio | null;
  onClose: () => void;
  onSaved: () => void;
}

export function PortfolioModal({ portfolio, onClose, onSaved }: PortfolioModalProps) {
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [cashBalance, setCashBalance] = useState('0.00');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditMode = !!portfolio;

  useEffect(() => {
    if (portfolio) {
      setName(portfolio.name);
      setCurrency(portfolio.currency);
      setCashBalance(portfolio.cash_balance);
    }
  }, [portfolio]);

  const handleSave = async () => {
    if (!name.trim()) { setError('Portfolio name is required'); return; }
    setSaving(true); setError(null);
    try {
      const body = { name: name.trim(), currency, cash_balance: parseFloat(cashBalance).toFixed(2) };
      const url = isEditMode ? `/api/v1/portfolios/${portfolio!.portfolio_id}` : '/api/v1/portfolios';
      const res = await fetch(url, {
        method: isEditMode ? 'PUT' : 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(body)
      });
      if (!res.ok) { const e=await res.json().catch(()=>({})); throw new Error(e.detail||`HTTP ${res.status}`); }
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save portfolio');
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key==='Escape') onClose();
    else if (e.key==='Enter'&&e.ctrlKey) handleSave();
  };

  const OVERLAY:React.CSSProperties={position:'fixed',inset:0,background:'#000a',display:'flex',
    alignItems:'center',justifyContent:'center',zIndex:1000}
  const MODAL:React.CSSProperties={background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,
    width:'100%',maxWidth:400,margin:'0 16px',boxShadow:'0 8px 32px #0009',fontFamily:MONO}
  const HDR:React.CSSProperties={display:'flex',alignItems:'center',gap:8,padding:'10px 14px',
    borderBottom:`1px solid ${BORDER}`,background:BG}
  const BODY:React.CSSProperties={padding:16,display:'flex',flexDirection:'column' as const,gap:14}
  const FOOTER:React.CSSProperties={display:'flex',justifyContent:'flex-end',gap:8,padding:'10px 14px',
    borderTop:`1px solid ${BORDER}`}
  const CURRENCIES=['USD','EUR','GBP','CAD','JPY','AUD','CHF','HKD','SGD']

  return (
    <div style={OVERLAY} onClick={e=>e.target===e.currentTarget&&onClose()}
      data-testid="portfolio-modal" onKeyDown={handleKeyDown}>
      <div style={MODAL}>
        <div style={HDR}>
          <span style={{fontSize:11,color:GREEN,letterSpacing:'0.1em'}}>PF</span>
          <span style={{fontSize:12,color:TEXT,fontWeight:700}}>
            {isEditMode?'EDIT PORTFOLIO':'CREATE PORTFOLIO'}
          </span>
          <div style={{flex:1}}/>
          <button onClick={onClose} style={{background:'none',border:'none',color:SUBTLE,cursor:'pointer',fontSize:16}}
            data-testid="portfolio-modal-close-btn">âœ•</button>
        </div>
        <div style={BODY} data-testid="portfolio-modal-ready">
          {error&&(
            <div style={{background:`${RED}22`,border:`1px solid ${RED}`,color:RED,padding:'6px 10px',
              borderRadius:2,fontSize:11,fontFamily:MONO}}>{error}</div>
          )}
          <div>
            <label style={LABEL_S}>Portfolio Name *</label>
            <input type="text" value={name} onChange={e=>setName(e.target.value)}
              placeholder="My Growth Portfolio" autoFocus style={INPUT_S}
              data-testid="portfolio-name-input"/>
          </div>
          <div>
            <label style={LABEL_S}>Currency</label>
            <select value={currency} onChange={e=>setCurrency(e.target.value)} style={INPUT_S}
              data-testid="portfolio-currency-input">
              {CURRENCIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {!isEditMode&&(
            <div>
              <label style={LABEL_S}>Initial Cash Balance</label>
              <input type="number" value={cashBalance} onChange={e=>setCashBalance(e.target.value)}
                placeholder="100000.00" step="0.01" min="0" style={INPUT_S}
                data-testid="portfolio-initial-cash-input"/>
            </div>
          )}
          {!isEditMode&&parseFloat(cashBalance)>0&&(
            <div style={{background:BG,border:`1px solid ${BORDER}`,borderRadius:2,padding:'8px 12px'}}>
              <div style={{fontSize:9,color:SUBTLE,textTransform:'uppercase' as const,marginBottom:3}}>Starting Capital</div>
              <div style={{fontSize:14,color:AMBER,fontFamily:MONO,fontWeight:700}}>
                {currency} {parseFloat(cashBalance).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
              </div>
            </div>
          )}
        </div>
        <div style={FOOTER}>
          <button onClick={onClose} disabled={saving}
            style={{padding:'6px 14px',fontSize:10,fontFamily:MONO,background:PANEL,
              border:`1px solid ${BORDER}`,color:SUBTLE,cursor:'pointer',borderRadius:2}}
            data-testid="portfolio-cancel-btn">CANCEL</button>
          <button onClick={handleSave} disabled={saving}
            style={{padding:'6px 16px',fontSize:10,fontFamily:MONO,background:saving?SUBTLE:AMBER,
              border:'none',color:BG,cursor:saving?'not-allowed':'pointer',borderRadius:2,fontWeight:700}}
            data-testid="portfolio-save-btn">{saving?'SAVING...':isEditMode?'SAVE CHANGES':'CREATE'}</button>
        </div>
      </div>
    </div>
  );
}

interface Portfolio {
  portfolio_id: string;
  name: string;
  currency: string;
  cash_balance: string;
}

interface PortfolioModalProps {
  portfolio?: Portfolio | null;
  onClose: () => void;
  onSaved: () => void;
}

