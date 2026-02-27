/**
 * Strategy Diff Panel â€” Bloomberg Terminal Edition
 */
// â”€â”€â”€ Bloomberg palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BG='#0a0a0a',PANEL='#111111',BORDER='#1e1e1e'
const AMBER='#f5a623',GREEN='#26a69a',RED='#ef5350',BLUE='#42a5f5'
const PURPLE='#ab47bc',SUBTLE='#555',TEXT='#d1d4dc'
const MONO='"Roboto Mono","Courier New",monospace'
const API_BASE='/api/v1/strategy-artifacts'

import React, { useState, useEffect, useCallback } from 'react';
import type { StrategyArtifact, DiffResult, LineageEntry } from './artifactTypes';

interface Props { artifacts: StrategyArtifact[]; }

// Diff change op color
const opColor=(op:string)=>op==='added'?GREEN:op==='removed'?RED:AMBER

export function StrategyDiffPanel({ artifacts: propArtifacts }: Props) {
  const [localArtifacts, setLocalArtifacts] = useState<StrategyArtifact[]>([]);
  const [leftId, setLeftId] = useState<string>('');
  const [rightId, setRightId] = useState<string>('');
  const [diffResult, setDiffResult] = useState<DiffResult|null>(null);
  const [lineage, setLineage] = useState<LineageEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [view, setView] = useState<'split'|'changes'|'lineage'>('split');

  const artifacts = propArtifacts.length > 0 ? propArtifacts : localArtifacts;

  useEffect(() => {
    if (propArtifacts.length === 0) {
      fetch(API_BASE).then(r=>r.json()).then((d:StrategyArtifact[])=>setLocalArtifacts(d)).catch(()=>setLocalArtifacts([]));
    }
  }, [propArtifacts]);

  useEffect(() => {
    if (artifacts.length >= 2 && !leftId && !rightId) {
      setLeftId(artifacts[0].id); setRightId(artifacts[1].id);
    }
  }, [artifacts, leftId, rightId]);

  const computeDiff = useCallback(async () => {
    if (!leftId || !rightId) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/diff`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({left_id:leftId, right_id:rightId})
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDiffResult(await res.json());
    } catch(e) {
      setError(String(e)); setDiffResult(null);
    } finally { setLoading(false); }
  }, [leftId, rightId]);

  const fetchLineage = useCallback(async (artifactId: string) => {
    try {
      const res = await fetch(`${API_BASE}/${artifactId}/lineage`);
      if(!res.ok) return;
      const data=await res.json();
      setLineage(Array.isArray(data)?data:(data.lineage||[]));
    } catch { setLineage([]); }
  }, []);

  useEffect(() => {
    if (leftId && rightId) { computeDiff(); fetchLineage(rightId); }
  }, [leftId, rightId, computeDiff, fetchLineage]);

  const SEL:React.CSSProperties={background:BG,border:`1px solid ${BORDER}`,color:TEXT,fontFamily:MONO,
    fontSize:11,padding:'5px 8px',borderRadius:2,outline:'none',width:'100%'}
  const LBL:React.CSSProperties={fontSize:9,color:SUBTLE,letterSpacing:'0.1em',marginBottom:4}
  const JSONPRE:React.CSSProperties={fontSize:10,fontFamily:MONO,color:TEXT,background:BG,padding:10,
    borderRadius:2,overflow:'auto' as const,maxHeight:320,whiteSpace:'pre-wrap' as const,
    border:`1px solid ${BORDER}`,margin:0}

  return (
    <div data-testid="strategy-diff-panel"
      style={{height:'100%',display:'flex',flexDirection:'column' as const,background:BG,fontFamily:MONO}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:12,padding:'6px 14px',
        borderBottom:`1px solid ${BORDER}`,background:PANEL,flexShrink:0}}>
        <span style={{fontSize:11,color:BLUE,letterSpacing:'0.1em'}}>SD</span>
        <span style={{fontSize:12,color:TEXT,fontWeight:700}}>STRATEGY DIFF</span>
        <div style={{flex:1}}/>
        {loading&&<span style={{fontSize:10,color:AMBER}}>COMPUTING...</span>}
        {diffResult&&!loading&&<span style={{fontSize:10,color:GREEN}}>DIFF READY</span>}
      </div>
      {/* Selector bar */}
      <div style={{display:'flex',gap:12,alignItems:'flex-end',padding:'10px 14px',borderBottom:`1px solid ${BORDER}`,background:PANEL}}>
        <div style={{flex:1}}>
          <div style={LBL}>LEFT ARTIFACT</div>
          <select value={leftId} onChange={e=>setLeftId(e.target.value)}
            data-testid="strategy-diff-left-select" style={SEL}>
            <option value="">â€” SELECT â€”</option>
            {artifacts.map(a=><option key={a.id} value={a.id}>{a.name} ({a.id.slice(0,8)})</option>)}
          </select>
        </div>
        <div style={{color:SUBTLE,fontSize:14,paddingBottom:6}}>â‡„</div>
        <div style={{flex:1}}>
          <div style={LBL}>RIGHT ARTIFACT</div>
          <select value={rightId} onChange={e=>setRightId(e.target.value)}
            data-testid="strategy-diff-right-select" style={SEL}>
            <option value="">â€” SELECT â€”</option>
            {artifacts.map(a=><option key={a.id} value={a.id}>{a.name} ({a.id.slice(0,8)})</option>)}
          </select>
        </div>
        <button onClick={computeDiff} disabled={!leftId||!rightId||loading}
          data-testid="strategy-diff-open"
          style={{fontSize:10,padding:'6px 14px',fontFamily:MONO,cursor: !leftId||!rightId?'not-allowed':'pointer',
            border:`1px solid ${BLUE}`,background:`${BLUE}22`,color:BLUE,borderRadius:2,
            opacity: !leftId||!rightId?0.4:1}}>
          â–¶ COMPUTE DIFF
        </button>
      </div>
      {/* View tabs */}
      <div style={{display:'flex',borderBottom:`1px solid ${BORDER}`,background:PANEL}}>
        {(['split','changes','lineage'] as const).map(t=>(
          <button key={t} onClick={()=>setView(t)}
            style={{padding:'6px 14px',fontSize:10,fontFamily:MONO,letterSpacing:'0.08em',
              cursor:'pointer',background:'none',border:'none',
              borderBottom:view===t?`2px solid ${BLUE}`:'2px solid transparent',
              color:view===t?BLUE:SUBTLE,textTransform:'uppercase' as const}}>
            {t==='changes'&&diffResult?`CHANGES (${diffResult.changes.length})`:t.toUpperCase()}
          </button>
        ))}
      </div>
      {error&&<div style={{padding:'6px 14px',fontSize:10,color:RED,borderBottom:`1px solid ${BORDER}`}}>{error}</div>}
      {diffResult&&<div data-testid="strategy-diff-ready" style={{display:'none'}}/>}
      {/* Content */}
      <div style={{flex:1,overflow:'auto',padding:14}}>
        {view==='split'&&diffResult&&(
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div>
              <div style={{fontSize:9,color:SUBTLE,marginBottom:6,letterSpacing:'0.1em'}}>
                LEFT: {diffResult.left_id.slice(0,16)}â€¦
              </div>
              <pre data-testid="strategy-diff-left-json" style={JSONPRE}>
                {JSON.stringify(diffResult.left_canonical,null,2)}
              </pre>
            </div>
            <div>
              <div style={{fontSize:9,color:SUBTLE,marginBottom:6,letterSpacing:'0.1em'}}>
                RIGHT: {diffResult.right_id.slice(0,16)}â€¦
              </div>
              <pre data-testid="strategy-diff-right-json" style={JSONPRE}>
                {JSON.stringify(diffResult.right_canonical,null,2)}
              </pre>
            </div>
          </div>
        )}
        {view==='split'&&!diffResult&&!loading&&(
          <div style={{padding:24,textAlign:'center' as const,color:SUBTLE,fontSize:11}}>
            Select two artifacts and click COMPUTE DIFF.
          </div>
        )}
        {view==='changes'&&diffResult&&(
          <div data-testid="strategy-diff-changes">
            {diffResult.changes.length===0?(
              <div style={{padding:16,color:GREEN,fontSize:11}}>âœ“ No changes detected â€” artifacts are identical.</div>
            ):(
              <div style={{display:'flex',flexDirection:'column' as const,gap:4}}>
                {diffResult.changes.map((c,i)=>(
                  <div key={i} style={{padding:'7px 12px',fontFamily:MONO,fontSize:10,borderRadius:2,
                    border:`1px solid ${opColor(c.op)}33`,background:`${opColor(c.op)}11`,color:opColor(c.op)}}>
                    <span style={{fontWeight:700,marginRight:8}}>{c.op.toUpperCase()}</span>
                    <span style={{color:TEXT}}>{c.path}</span>
                    {c.op==='changed'&&(
                      <span style={{color:SUBTLE,marginLeft:8}}>
                        {JSON.stringify(c.left_value)} â†’ {JSON.stringify(c.right_value)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {diffResult.diff_hash&&(
              <div style={{marginTop:12,fontSize:10,color:SUBTLE}}>
                DIFF HASH: <span style={{fontFamily:MONO,color:PURPLE}}>{diffResult.diff_hash.slice(0,16)}</span>
              </div>
            )}
          </div>
        )}
        {view==='lineage'&&(
          <div data-testid="strategy-lineage-panel">
            {lineage.length===0?(
              <div style={{padding:16,color:SUBTLE,fontSize:11}}>No lineage data available.</div>
            ):(
              <div style={{display:'flex',flexWrap:'wrap' as const,gap:8,alignItems:'center'}}>
                {lineage.map((entry,i)=>(
                  <React.Fragment key={entry.id}>
                    <div data-testid={`strategy-lineage-item-${i}`}
                      style={{padding:'5px 12px',fontSize:10,fontFamily:MONO,borderRadius:2,
                        border:`1px solid ${entry.id===rightId?BLUE:BORDER}`,
                        background:entry.id===rightId?`${BLUE}22`:PANEL,
                        color:entry.id===rightId?BLUE:SUBTLE}}>
                      {entry.name} <span style={{color:SUBTLE}}>d{entry.depth}</span>
                    </div>
                    {i<lineage.length-1&&<span style={{color:SUBTLE}}>â†’</span>}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface Props {
  artifacts: StrategyArtifact[];
}

