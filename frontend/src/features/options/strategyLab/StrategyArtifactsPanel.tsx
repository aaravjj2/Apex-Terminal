/**
 * Strategy Artifacts Panel â€” Bloomberg Terminal Edition
 */
// â”€â”€â”€ Bloomberg palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BG='#0a0a0a',PANEL='#111111',BORDER='#1e1e1e'
const AMBER='#f5a623',GREEN='#26a69a',RED='#ef5350',BLUE='#42a5f5'
const SUBTLE='#555',TEXT='#d1d4dc'
const MONO='"Roboto Mono","Courier New",monospace'

// â”€â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const Th=({c}:{c:string})=><th style={{padding:'5px 10px',fontSize:9,letterSpacing:'0.1em',color:SUBTLE,
  textAlign:'left' as const,borderBottom:`1px solid ${BORDER}`,background:PANEL,fontFamily:MONO}}>{c}</th>
const Td=({children,mono,color}:{children:React.ReactNode,mono?:boolean,color?:string})=>(
  <td style={{padding:'6px 10px',fontSize:11,color:color||TEXT,fontFamily:mono?MONO:'inherit',
    borderBottom:`1px solid ${BORDER}`,whiteSpace:'nowrap' as const}}>{children}</td>
)
const TypeBadge=({t}:{t:string})=>{
  const c=t==='crossover'?BLUE:t==='mean_reversion'?GREEN:t==='momentum'?AMBER:SUBTLE;
  return<span style={{fontSize:9,padding:'2px 6px',border:`1px solid ${c}`,color:c,borderRadius:2,letterSpacing:'0.07em'}}>{t.toUpperCase()}</span>
}

import React, { useState, useEffect, useCallback } from 'react';
import type { StrategyArtifact } from './artifactTypes';
import { useAppStore } from '../../../state/appStore';
import { API_BASE as ROOT_URL } from '../../../config/api';

const API_BASE = `${ROOT_URL}/api/v1/strategy-artifacts`;

interface Props { onArtifactsLoaded?: (artifacts: StrategyArtifact[]) => void; }

export function StrategyArtifactsPanel({ onArtifactsLoaded }: Props) {
  const [artifacts, setArtifacts] = useState<StrategyArtifact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [selected, setSelected] = useState<StrategyArtifact|null>(null);
  const [tab, setTab] = useState<'list'|'detail'>('list');
  const setPendingStrategyArtifactId = useAppStore((s) => s.setPendingStrategyArtifactId);

  const fetchArtifacts = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(API_BASE, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: StrategyArtifact[] = await res.json();
      setArtifacts(data); onArtifactsLoaded?.(data);
    } catch (e) {
      setError(String(e));
      const demo: StrategyArtifact[] = [
        {schema_version:1,id:'demo-artifact-001',checksum:'sha256-demo-001',name:'Momentum Crossover v1',
         type:'crossover',version:'1.0.0',spec:{entry_rule:'SMA(20) > SMA(50)',exit_rule:'SMA(20) < SMA(50)',stop_loss:0.02},
         created_at:new Date().toISOString()},
        {schema_version:1,id:'demo-artifact-002',checksum:'sha256-demo-002',name:'Mean Reversion RSI',
         type:'mean_reversion',version:'1.0.0',spec:{entry_rule:'RSI(14) < 30',exit_rule:'RSI(14) > 70',stop_loss:0.03},
         created_at:new Date().toISOString()},
      ];
      setArtifacts(demo); onArtifactsLoaded?.(demo); setError(null);
    } finally { setLoading(false); }
  }, [onArtifactsLoaded]);

  useEffect(() => { fetchArtifacts(); }, [fetchArtifacts]);

  const handleRunBacktest = (artifactId: string) => {
    setPendingStrategyArtifactId(artifactId);
    window.dispatchEvent(new CustomEvent('navigate-to-backtest', { detail: { artifactId } }));
  };

  const handleSelect = (a: StrategyArtifact) => { setSelected(a); setTab('detail'); };

  const CARD:React.CSSProperties={background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,padding:'12px 16px',marginBottom:10}
  const LBL:React.CSSProperties={fontSize:9,color:SUBTLE,letterSpacing:'0.1em',marginBottom:3}

  return (
    <div data-testid="strategy-artifacts-panel"
      style={{height:'100%',display:'flex',flexDirection:'column' as const,background:BG,fontFamily:MONO}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:12,padding:'6px 14px',
        borderBottom:`1px solid ${BORDER}`,background:PANEL,flexShrink:0}}>
        <span style={{fontSize:11,color:GREEN,letterSpacing:'0.1em'}}>SA</span>
        <span style={{fontSize:12,color:TEXT,fontWeight:700}}>STRATEGY ARTIFACTS</span>
        <div style={{flex:1}}/>
        <button onClick={fetchArtifacts} data-testid="strategy-artifacts-refresh"
          style={{background:PANEL,border:`1px solid ${BORDER}`,color:loading?AMBER:TEXT,fontFamily:MONO,
            fontSize:10,padding:'3px 10px',cursor:'pointer',borderRadius:2}}>
          {loading?'LOADING...':'REFRESH'}
        </button>
      </div>
      {/* Tabs */}
      <div style={{display:'flex',borderBottom:`1px solid ${BORDER}`,background:PANEL}}>
        {(['list','detail'] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            style={{padding:'6px 14px',fontSize:10,fontFamily:MONO,letterSpacing:'0.08em',
              cursor:'pointer',background:'none',border:'none',
              borderBottom:tab===t?`2px solid ${GREEN}`:'2px solid transparent',
              color:tab===t?GREEN:SUBTLE,textTransform:'uppercase' as const}}>
            {t==='list'?`LIST (${artifacts.length})`:'DETAIL'}
          </button>
        ))}
      </div>
      {error&&<div style={{padding:'6px 14px',fontSize:10,color:RED,borderBottom:`1px solid ${BORDER}`}}>{error}</div>}
      {/* Content */}
      <div style={{flex:1,overflow:'auto'}}>
        {tab==='list'&&(
          <table style={{width:'100%',borderCollapse:'collapse' as const}}>
            <thead><tr>
              <Th c="ID"/><Th c="NAME"/><Th c="TYPE"/><Th c="VERSION"/><Th c="CHECKSUM"/><Th c="CREATED"/><Th c="ACTIONS"/>
            </tr></thead>
            <tbody>
              {artifacts.length===0&&!loading&&(
                <tr><td colSpan={7} style={{padding:24,textAlign:'center' as const,color:SUBTLE,fontSize:11}}>No artifacts found</td></tr>
              )}
              {artifacts.map((a)=>(
                <tr key={a.id} data-testid={`strategy-artifact-row-${a.id}`}
                  onClick={()=>handleSelect(a)}
                  style={{cursor:'pointer',background:'transparent',transition:'background 0.1s'}}
                  onMouseEnter={e=>(e.currentTarget.style.background=`${BORDER}88`)}
                  onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                  <Td mono color={BLUE} data-testid={`strategy-artifact-id-${a.id}`}>{a.id.slice(0,12)}â€¦</Td>
                  <Td data-testid={`strategy-artifact-name-${a.id}`}>{a.name}</Td>
                  <Td><TypeBadge t={a.type}/></Td>
                  <Td mono data-testid={`strategy-artifact-version-${a.id}`}>{a.version}</Td>
                  <Td mono color={SUBTLE} data-testid={`strategy-artifact-checksum-${a.id}`}>{a.checksum.slice(0,12)}â€¦</Td>
                  <Td mono>{a.created_at.slice(0,19).replace('T',' ')}</Td>
                  <Td>
                    <button onClick={e=>{e.stopPropagation();handleRunBacktest(a.id)}}
                      data-testid="strategy-run-backtest"
                      style={{fontSize:9,padding:'3px 8px',fontFamily:MONO,cursor:'pointer',border:`1px solid ${GREEN}`,
                        background:`${GREEN}22`,color:GREEN,borderRadius:2,letterSpacing:'0.06em'}}>
                      â–¶ BACKTEST
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab==='detail'&&selected&&(
          <div style={{padding:14}}>
            <div style={CARD}>
              <div style={LBL}>ARTIFACT ID</div>
              <div style={{fontSize:12,color:BLUE,fontFamily:MONO}}>{selected.id}</div>
            </div>
            <div style={CARD}>
              <div style={LBL}>NAME</div>
              <div style={{fontSize:14,color:TEXT,fontWeight:700}}>{selected.name}</div>
            </div>
            <div style={{display:'flex',gap:10,marginBottom:10}}>
              <div style={{...CARD,flex:1}}>
                <div style={LBL}>TYPE</div><TypeBadge t={selected.type}/>
              </div>
              <div style={{...CARD,flex:1}}>
                <div style={LBL}>VERSION</div>
                <div style={{fontSize:12,color:TEXT,fontFamily:MONO}}>{selected.version}</div>
              </div>
              <div style={{...CARD,flex:1}}>
                <div style={LBL}>SCHEMA VERSION</div>
                <div style={{fontSize:12,color:TEXT,fontFamily:MONO}}>v{selected.schema_version}</div>
              </div>
            </div>
            <div style={CARD}>
              <div style={LBL}>CHECKSUM</div>
              <div style={{fontSize:11,color:SUBTLE,fontFamily:MONO}}>{selected.checksum}</div>
            </div>
            <div style={CARD}>
              <div style={LBL}>SPEC</div>
              <pre style={{fontSize:10,color:TEXT,fontFamily:MONO,margin:0,overflow:'auto' as const,
                background:BG,padding:10,borderRadius:2,border:`1px solid ${BORDER}`}}>
                {JSON.stringify(selected.spec,null,2)}
              </pre>
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button onClick={()=>handleRunBacktest(selected.id)} data-testid="strategy-run-backtest"
                style={{fontSize:10,padding:'6px 16px',fontFamily:MONO,cursor:'pointer',border:`1px solid ${GREEN}`,
                  background:`${GREEN}22`,color:GREEN,borderRadius:2}}>
                â–¶ RUN BACKTEST
              </button>
              <button onClick={()=>setTab('list')}
                style={{fontSize:10,padding:'6px 16px',fontFamily:MONO,cursor:'pointer',border:`1px solid ${BORDER}`,
                  background:PANEL,color:SUBTLE,borderRadius:2}}>
                â† BACK TO LIST
              </button>
            </div>
          </div>
        )}
        {tab==='detail'&&!selected&&(
          <div style={{padding:24,textAlign:'center' as const,color:SUBTLE,fontSize:11}}>
            Select an artifact from the list to view details.
          </div>
        )}
      </div>
    </div>
  );
}
