// Bloomberg TDD — Ticker Disambiguation Dialog
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const SUBTLE = '#555';
const TEXT = '#d1d4dc';
const MONO = '"Roboto Mono","Courier New",monospace';

import React from 'react';
import type { AmbiguousEntry } from './disambiguator';

export interface TickerDisambiguationDialogProps {
  open: boolean;
  symbol: string;
  entry: AmbiguousEntry;
  onConfirm: (symbol: string) => void;
  onCancel: () => void;
}

export const TickerDisambiguationDialog: React.FC<TickerDisambiguationDialogProps> = ({
  open, symbol, entry, onConfirm, onCancel,
}) => {
  if (!open) return null;

  return (
    <div
      data-testid="ticker-disambiguation-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="Ticker disambiguation"
      style={{
        position:'fixed', inset:0, zIndex:9000,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontFamily:MONO,
      }}>
      {/* Backdrop */}
      <div
        data-testid="disambiguation-backdrop"
        onClick={onCancel}
        style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.75)' }}
      />

      {/* Dialog box */}
      <div style={{
        position:'relative', background:PANEL, border:`1px solid ${BORDER}`,
        borderRadius:2, width:420, maxWidth:'90vw', boxShadow:'0 8px 32px rgba(0,0,0,0.6)',
        overflow:'hidden',
      }}>
        {/* Title bar */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 12px', background:BG, borderBottom:`1px solid ${BORDER}` }}>
          <span style={{ color:AMBER, fontWeight:700, fontSize:10, letterSpacing:1 }}>TICKER DISAMBIGUATION</span>
          <button onClick={onCancel} style={{ background:'none', border:'none', color:SUBTLE, cursor:'pointer', fontSize:12, padding:'0 2px' }}>✕</button>
        </div>

        {/* Warning strip */}
        <div style={{ background: AMBER + '11', borderBottom:`1px solid ${AMBER}33`, padding:'6px 12px', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ color:AMBER, fontSize:14, fontWeight:700 }}>⚠</span>
          <div>
            <div style={{ color:AMBER, fontSize:10, fontWeight:700 }}>AMBIGUOUS SYMBOL DETECTED</div>
            <div style={{ color:SUBTLE, fontSize:9 }}>Please confirm your intent</div>
          </div>
        </div>

        {/* Symbol info */}
        <div style={{ padding:12, borderBottom:`1px solid ${BORDER}` }}>
          <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:8 }}>
            <span
              data-testid="disambiguation-symbol"
              style={{ color:BLUE, fontSize:20, fontWeight:700, fontFamily:MONO }}
            >{symbol}</span>
            <span style={{ color:SUBTLE, fontSize:11 }}>— {entry.company}</span>
          </div>
          <div style={{ background:BG, border:`1px solid ${BORDER}`, borderRadius:2, padding:'6px 10px' }}>
            <div style={{ color:TEXT, fontSize:10, lineHeight:1.5 }}>
              <strong style={{ color:AMBER }}>NOTE:</strong>{' '}{entry.confusion}
            </div>
            <div style={{ color:SUBTLE, fontSize:9, marginTop:4 }}>
              TIP: Prefix with <code style={{ color:GREEN, background:'#0a0a0a', padding:'0 3px' }}>${'$'}</code> to skip this prompt (e.g., <code style={{ color:GREEN }}>${'$'}{symbol}</code>)
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display:'flex', gap:8, padding:12 }}>
          <button
            data-testid="disambiguation-confirm"
            onClick={() => onConfirm(symbol)}
            style={{
              flex:1, padding:'7px 0', background: GREEN + '22',
              border:`1px solid ${GREEN}`, color:GREEN,
              fontFamily:MONO, fontSize:10, fontWeight:700,
              letterSpacing:0.5, cursor:'pointer', borderRadius:2,
            }}>
            YES — USE TICKER {symbol}
          </button>
          <button
            data-testid="disambiguation-cancel"
            onClick={onCancel}
            style={{
              flex:1, padding:'7px 0', background:BG,
              border:`1px solid ${BORDER}`, color:SUBTLE,
              fontFamily:MONO, fontSize:10, fontWeight:700,
              letterSpacing:0.5, cursor:'pointer', borderRadius:2,
            }}>
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
};

export default TickerDisambiguationDialog;
