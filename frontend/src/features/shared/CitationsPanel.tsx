// Bloomberg CP — Citations Panel  
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const PURPLE = '#ab47bc';
const SUBTLE = '#555';
const TEXT = '#d1d4dc';
const MONO = '"Roboto Mono","Courier New",monospace';

import { useState } from 'react';
import React from 'react';

export interface CitationItem {
  id: string;
  source_type: string;
  source_id: string;
  title: string;
  detail: string;
  timestamp: string;
  confidence?: number | null;
  url?: string | null;
  metadata?: Record<string, unknown>;
}

interface CitationsPanelProps {
  citations: CitationItem[];
  maxVisible?: number;
  loading?: boolean;
}

const SOURCE_COLOR: Record<string, string> = {
  risk_run:   RED,
  backtest:   BLUE,
  validation: GREEN,
  strategy:   PURPLE,
  export:     AMBER,
  provenance: '#26c6da',
};

export function CitationsPanel({ citations, maxVisible = 5, loading }: CitationsPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  if (loading) {
    return (
      <div data-testid="citations-panel"
        style={{ padding:8, background:PANEL, border:`1px solid ${BORDER}`, borderRadius:2, fontFamily:MONO }}>
        <div data-testid="citations-loading">
          {[1,2,3].map(i => (
            <div key={i} style={{ height:28, background:BG, borderRadius:2, marginBottom:4, opacity: 0.6 - i*0.1 }} />
          ))}
        </div>
      </div>
    );
  }

  if (!citations.length) {
    return (
      <div data-testid="citations-panel"
        style={{ padding:12, background:PANEL, border:`1px solid ${BORDER}`, borderRadius:2, fontFamily:MONO }}>
        <div data-testid="citations-empty" style={{ color:SUBTLE, fontSize:10, textAlign:'center', padding:'8px 0' }}>
          NO CITATIONS AVAILABLE
        </div>
      </div>
    );
  }

  const visible = expanded ? citations : citations.slice(0, maxVisible);
  const hasMore = citations.length > maxVisible;

  return (
    <div data-testid="citations-panel"
      style={{ background:PANEL, border:`1px solid ${BORDER}`, borderRadius:2, fontFamily:MONO }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 8px', borderBottom:`1px solid ${BORDER}`, background:BG }}>
        <span style={{ color:AMBER, fontWeight:700, fontSize:10, letterSpacing:1 }}>CITATIONS & EVIDENCE</span>
        <span style={{ color:SUBTLE, fontSize:9 }}>{citations.length} ITEMS</span>
      </div>

      {/* Citation list */}
      <div style={{ padding:4 }}>
        {visible.map((c, idx) => {
          const color = SOURCE_COLOR[c.source_type] ?? SUBTLE;
          const isHov = hovered === c.id;
          return (
            <div key={c.id}
              data-testid={`citation-item-${idx}`}
              onMouseEnter={() => setHovered(c.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                padding:'5px 8px', marginBottom:2, borderRadius:2,
                background: isHov ? '#141414' : BG,
                border:`1px solid ${isHov ? color : BORDER}`,
                borderLeft:`3px solid ${color}`,
              }}
            >
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                <span data-testid={`citation-source-${idx}`}
                  style={{ color, fontSize:8, border:`1px solid ${color}`, padding:'0 3px', borderRadius:1, whiteSpace:'nowrap' }}>
                  {c.source_type.toUpperCase()}
                </span>
                <span style={{ color:TEXT, fontSize:10, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.title}</span>
                {c.confidence != null && (
                  <span data-testid={`citation-confidence-${idx}`}
                    style={{ color: c.confidence >= 0.8 ? GREEN : c.confidence >= 0.5 ? AMBER : RED, fontSize:9, fontFamily:MONO }}>
                    {Math.round(c.confidence * 100)}%
                  </span>
                )}
              </div>
              <div style={{ color:SUBTLE, fontSize:9, lineHeight:1.3, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
                {c.detail}
              </div>
              {c.url && isHov && (
                <div style={{ color:BLUE, fontSize:8, marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {c.url}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Show more */}
      {hasMore && (
        <div style={{ padding:'3px 8px', borderTop:`1px solid ${BORDER}` }}>
          <button data-testid="citations-toggle"
            onClick={() => setExpanded(!expanded)}
            style={{ background:'transparent', border:'none', color:BLUE, fontFamily:MONO, fontSize:9, cursor:'pointer', padding:0 }}>
            {expanded ? '▲ SHOW LESS' : `▼ SHOW ${citations.length - maxVisible} MORE`}
          </button>
        </div>
      )}
    </div>
  );
}
