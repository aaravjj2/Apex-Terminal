// Bloomberg HLD — Hash Ledger Display
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const BLUE = '#42a5f5';
const SUBTLE = '#555';
const TEXT = '#d1d4dc';
const MONO = '"Roboto Mono","Courier New",monospace';

import { useState } from 'react';
import React from 'react';

interface LedgerEntry {
  step: string;
  hash: string;
  source: string;
}

interface HashLedger {
  run_id: string;
  strategy_artifact_id: string;
  created_at: string;
  chain: LedgerEntry[];
  ledger_checksum: string;
}

interface HashLedgerDisplayProps {
  ledger: HashLedger | null;
  loading?: boolean;
}

export function HashLedgerDisplay({ ledger, loading }: HashLedgerDisplayProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  if (loading) {
    return (
      <div data-testid="hash-ledger-loading"
        style={{ padding:8, background:PANEL, border:`1px solid ${BORDER}`, borderRadius:2, fontFamily:MONO }}>
        {[1,2,3].map(i => (
          <div key={i} style={{ height:20, background:BG, borderRadius:2, marginBottom:4, opacity:0.6 - i*0.1 }} />
        ))}
      </div>
    );
  }

  if (!ledger) {
    return (
      <div data-testid="hash-ledger-empty"
        style={{ padding:12, background:PANEL, border:`1px solid ${BORDER}`, borderRadius:2, color:SUBTLE, fontSize:10, fontFamily:MONO }}>
        NO HASH LEDGER AVAILABLE
      </div>
    );
  }

  return (
    <div data-testid="hash-ledger"
      style={{ background:PANEL, border:`1px solid ${BORDER}`, borderRadius:2, fontFamily:MONO }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'5px 10px', borderBottom:`1px solid ${BORDER}`, background:BG }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ color:GREEN, fontSize:12 }}>⛨</span>
          <span style={{ color:AMBER, fontWeight:700, fontSize:10, letterSpacing:1 }}>HASH LEDGER</span>
        </div>
        <span data-testid="hash-ledger-run-id" style={{ color:SUBTLE, fontSize:8 }}>{ledger.run_id}</span>
      </div>

      {/* Chain */}
      <div data-testid="hash-ledger-chain" style={{ padding:6 }}>
        {ledger.chain.map((entry, idx) => (
          <div key={entry.step}
            data-testid={`hash-ledger-entry-${idx}`}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 6px', marginBottom:2, background:BG, border:`1px solid ${BORDER}`, borderRadius:2 }}>
            {idx > 0 && <span style={{ color:BLUE, fontSize:10, flexShrink:0 }}>↳</span>}
            <span style={{ color:SUBTLE, fontSize:8, width:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flexShrink:0 }} title={entry.step}>
              {entry.step}
            </span>
            <code style={{ flex:1, color:GREEN, fontSize:8, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:MONO }} title={entry.hash}>
              {entry.hash}
            </code>
            <button data-testid={`hash-ledger-copy-${idx}`}
              onClick={() => handleCopy(entry.hash, entry.step)}
              title="Copy hash"
              style={{ background:'none', border:'none', color: copied===entry.step ? GREEN : SUBTLE, cursor:'pointer', fontSize:10, padding:'0 2px', flexShrink:0 }}>
              {copied === entry.step ? '✓' : '⧉'}
            </button>
          </div>
        ))}
      </div>

      {/* Checksum */}
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 10px', borderTop:`1px solid ${BORDER}` }}>
        <span style={{ color:SUBTLE, fontSize:8, flexShrink:0 }}>LEDGER CHECKSUM:</span>
        <code data-testid="hash-ledger-checksum"
          style={{ flex:1, color:AMBER, fontSize:8, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:MONO }}
          title={ledger.ledger_checksum}>
          {ledger.ledger_checksum}
        </code>
        <button data-testid="hash-ledger-copy-checksum"
          onClick={() => handleCopy(ledger.ledger_checksum, 'checksum')}
          style={{ background:'none', border:'none', color: copied==='checksum' ? GREEN : SUBTLE, cursor:'pointer', fontSize:10, padding:'0 2px', flexShrink:0 }}>
          {copied === 'checksum' ? '✓' : '⧉'}
        </button>
      </div>
    </div>
  );
}
