/**
 * Position Modal â€” Bloomberg Terminal Style
 */

// â”€â”€â”€ Bloomberg palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BG='#0a0a0a',PANEL='#111111',BORDER='#1e1e1e'
const AMBER='#f5a623',GREEN='#26a69a',RED='#ef5350',BLUE='#42a5f5'
const SUBTLE='#555',TEXT='#d1d4dc'
const MONO='"Roboto Mono","Courier New",monospace'

const INPUT_S:React.CSSProperties={width:'100%',background:BG,border:`1px solid ${BORDER}`,color:TEXT,
  fontFamily:MONO,fontSize:12,padding:'7px 10px',borderRadius:2,outline:'none',boxSizing:'border-box' as const}
const LABEL_S:React.CSSProperties={fontSize:9,fontFamily:MONO,color:SUBTLE,textTransform:'uppercase' as const,
  letterSpacing:'0.08em',marginBottom:4,display:'block'}

import React, { useState } from 'react';
import { API_BASE } from '../../config/api';

interface Portfolio {
  portfolio_id: string;
  name: string;
}

interface PositionModalProps {
  portfolio: Portfolio;
  onClose: () => void;
  onSaved: () => void;
}

export function PositionModal({ portfolio, onClose, onSaved }: PositionModalProps) {
  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [price, setPrice] = useState('0.00');
  const [acquisitionDate, setAcquisitionDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!symbol.trim()) { setError('Symbol is required'); return; }
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) { setError('Quantity must be positive'); return; }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) { setError('Price must be non-negative'); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/portfolios/${portfolio.portfolio_id}/positions`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          symbol: symbol.trim().toUpperCase(),
          quantity: qty.toString(),
          cost_basis_per_unit: priceNum.toFixed(2),
          acquisition_date: acquisitionDate
        })
      });
      if (!res.ok) { const e=await res.json().catch(()=>({})); throw new Error(e.detail||`HTTP ${res.status}`); }
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save position');
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
    width:'100%',maxWidth:420,margin:'0 16px',boxShadow:'0 8px 32px #0009',fontFamily:MONO}
  const HDR:React.CSSProperties={display:'flex',alignItems:'center',gap:8,padding:'10px 14px',
    borderBottom:`1px solid ${BORDER}`,background:BG}
  const BODY:React.CSSProperties={padding:16,display:'flex',flexDirection:'column' as const,gap:14}
  const FOOTER:React.CSSProperties={display:'flex',justifyContent:'flex-end',gap:8,padding:'10px 14px',
    borderTop:`1px solid ${BORDER}`}

  return (
    <div style={OVERLAY} onClick={e=>e.target===e.currentTarget&&onClose()}
      data-testid="position-modal" onKeyDown={handleKeyDown}>
      <div style={MODAL}>
        <div style={HDR}>
          <span style={{fontSize:11,color:GREEN,letterSpacing:'0.1em'}}>POS</span>
          <span style={{fontSize:12,color:TEXT,fontWeight:700}}>ADD POSITION</span>
          <span style={{fontSize:10,color:SUBTLE,flex:1}}>{portfolio.name}</span>
          <button onClick={onClose} style={{background:'none',border:'none',color:SUBTLE,cursor:'pointer',fontSize:16}}
            data-testid="position-modal-close-btn">âœ•</button>
        </div>
        <div style={BODY} data-testid="position-modal-ready">
          {error&&(
            <div style={{background:`${RED}22`,border:`1px solid ${RED}`,color:RED,padding:'6px 10px',
              borderRadius:2,fontSize:11,fontFamily:MONO}}>{error}</div>
          )}
          <div>
            <label style={LABEL_S}>Symbol *</label>
            <input type="text" value={symbol} onChange={e=>setSymbol(e.target.value.toUpperCase())}
              placeholder="AAPL" autoFocus style={INPUT_S} data-testid="position-symbol-input"/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div>
              <label style={LABEL_S}>Quantity *</label>
              <input type="number" value={quantity} onChange={e=>setQuantity(e.target.value)}
                placeholder="100" step="0.01" min="0.01" style={INPUT_S} data-testid="position-qty-input"/>
            </div>
            <div>
              <label style={LABEL_S}>Cost Basis / Share *</label>
              <input type="number" value={price} onChange={e=>setPrice(e.target.value)}
                placeholder="150.00" step="0.01" min="0" style={INPUT_S} data-testid="position-price-input"/>
            </div>
          </div>
          <div>
            <label style={LABEL_S}>Acquisition Date</label>
            <input type="date" value={acquisitionDate} onChange={e=>setAcquisitionDate(e.target.value)}
              style={INPUT_S} data-testid="position-acquisition-date-input"/>
          </div>
          {symbol&&parseFloat(quantity)>0&&parseFloat(price)>0&&(
            <div style={{background:BG,border:`1px solid ${BORDER}`,borderRadius:2,padding:'8px 12px'}}>
              <div style={{fontSize:9,color:SUBTLE,textTransform:'uppercase' as const,marginBottom:4}}>Preview</div>
              <div style={{fontSize:11,color:TEXT,fontFamily:MONO}}>
                {symbol.trim().toUpperCase()} Ã— {parseFloat(quantity).toLocaleString()} @ $
                {parseFloat(price).toFixed(2)} =&nbsp;
                <span style={{color:AMBER,fontWeight:700}}>
                  ${(parseFloat(quantity)*parseFloat(price)).toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>
        <div style={FOOTER}>
          <button onClick={onClose} disabled={saving}
            style={{padding:'6px 14px',fontSize:10,fontFamily:MONO,background:PANEL,
              border:`1px solid ${BORDER}`,color:SUBTLE,cursor:'pointer',borderRadius:2}}
            data-testid="position-cancel-btn">CANCEL</button>
          <button onClick={handleSave} disabled={saving}
            style={{padding:'6px 16px',fontSize:10,fontFamily:MONO,background:saving?SUBTLE:AMBER,
              border:'none',color:BG,cursor:saving?'not-allowed':'pointer',borderRadius:2,fontWeight:700}}
            data-testid="position-save-btn">{saving?'SAVING...':'ADD POSITION'}</button>
        </div>
      </div>
    </div>
  );
}

interface Portfolio {
  portfolio_id: string;
  name: string;
}

interface PositionModalProps {
  portfolio: Portfolio;
  onClose: () => void;
  onSaved: () => void;
}

