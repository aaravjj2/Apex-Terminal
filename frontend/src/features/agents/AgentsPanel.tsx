// â”€â”€â”€ Bloomberg palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BG='#0a0a0a',PANEL='#111111',BORDER='#1e1e1e'
const AMBER='#f5a623',GREEN='#26a69a',RED='#ef5350',BLUE='#42a5f5'
const PURPLE='#ab47bc',SUBTLE='#555',TEXT='#d1d4dc'
const MONO='"Roboto Mono","Courier New",monospace'

/**
 * v1.40 â€” Agents Panel
 * DEMO-first multi-step agent runner UI.
 */
import { useState, useCallback } from 'react';
import React from 'react';
import { API_BASE } from '../../config/api';
import { CitationsPanel, type CitationItem } from '../shared/CitationsPanel';

interface AgentStep {
  step_id: string; tool: string;
  inputs: Record<string, unknown>; outputs: Record<string, unknown>;
  citations: string[]; duration_ms: number;
}
interface AgentRun {
  run_id: string; status: string; query: string;
  steps: AgentStep[]; final_output: string; total_duration_ms: number;
}

const TOOL_COLORS:Record<string,string>={
  search:BLUE,backtest:PURPLE,risk_analysis:RED,citations:GREEN,synthesize:AMBER
};

export function AgentsPanel() {
  const [run, setRun] = useState<AgentRun|null>(null);
  const [allCitations, setAllCitations] = useState<CitationItem[]>([]);
  const [loading, setLoading] = useState(false);

  const executeAgent=useCallback(async()=>{
    setLoading(true);
    try {
      const [runRes,citRes]=await Promise.all([
        fetch(`${API_BASE}/api/v1/agents/run`,{method:'POST'}).then(r=>r.json()),
        fetch(`${API_BASE}/api/v1/citations/`).then(r=>r.json()),
      ]);
      setRun(runRes);
      setAllCitations(Array.isArray(citRes)?citRes:[]);
    } catch { setRun(null); setAllCitations([]); }
    finally { setLoading(false); }
  },[]);

  return (
    <div data-testid="agents-panel"
      style={{height:'100%',display:'flex',flexDirection:'column' as const,background:BG,fontFamily:MONO}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 14px',
        borderBottom:`1px solid ${BORDER}`,background:PANEL,flexShrink:0}}>
        <span style={{fontSize:11,color:AMBER,letterSpacing:'0.1em'}}>AG</span>
        <span style={{fontSize:12,color:TEXT,fontWeight:700}}>AGENT RUNNER</span>
        <span style={{fontSize:8,padding:'1px 6px',border:`1px solid ${BLUE}55`,color:BLUE,borderRadius:2}}>v1.40 DEMO</span>
        <div style={{flex:1}}/>
        <button data-testid="agent-run-btn" onClick={executeAgent} disabled={loading}
          style={{padding:'5px 14px',fontFamily:MONO,fontSize:10,letterSpacing:'0.08em',
            cursor:loading?'wait':'pointer',border:`1px solid ${GREEN}`,
            background:loading?`${SUBTLE}22`:`${GREEN}22`,color:loading?SUBTLE:GREEN,borderRadius:2}}>
          {loading?'RUNNING...':'â–¶ RUN AGENT'}
        </button>
      </div>

      {/* Content */}
      <div style={{flex:1,overflowY:'auto' as const,padding:10}}>
        {loading&&(
          <div data-testid="agents-loading" style={{display:'flex',flexDirection:'column' as const,gap:8}}>
            {[1,2,3,4,5].map(i=>(
              <div key={i} style={{height:70,background:PANEL,borderRadius:2,border:`1px solid ${BORDER}`,opacity:0.5}}/>
            ))}
          </div>
        )}
        {!loading&&!run&&(
          <div data-testid="agents-empty"
            style={{textAlign:'center' as const,padding:'40px 0',color:SUBTLE,fontSize:10}}>
            <div style={{fontSize:24,marginBottom:8}}>âš™</div>
            No agent runs yet.<br/>
            Click <span style={{color:GREEN}}>â–¶ RUN AGENT</span> to execute a multi-step analysis.
          </div>
        )}
        {!loading&&run&&(
          <>
            {/* Run header */}
            <div style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,padding:'10px 12px',marginBottom:10}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                <span style={{fontSize:9,color:SUBTLE,fontFamily:MONO}}>{run.run_id}</span>
                <span style={{fontSize:8,padding:'1px 6px',border:`1px solid ${run.status==='completed'?GREEN:AMBER}`,
                  color:run.status==='completed'?GREEN:AMBER,borderRadius:2}}>{run.status.toUpperCase()}</span>
                <div style={{flex:1}}/>
                <span style={{fontSize:9,color:SUBTLE,fontFamily:MONO}}>{run.total_duration_ms}ms</span>
              </div>
              <p style={{fontSize:11,color:TEXT,margin:0}}>{run.query}</p>
            </div>

            {/* Steps */}
            <div style={{marginBottom:10}}>
              <div style={{fontSize:9,color:SUBTLE,letterSpacing:'0.1em',marginBottom:6}}>STEPS ({run.steps.length})</div>
              {run.steps.map((step,idx)=>(
                <div key={step.step_id} data-testid={`agent-step-${idx}`}
                  style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,padding:'8px 10px',
                    marginBottom:4,borderLeft:`3px solid ${TOOL_COLORS[step.tool]||SUBTLE}`}}>
                  <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                    <span style={{fontSize:9,color:SUBTLE,fontFamily:MONO}}>{step.step_id}</span>
                    <span data-testid={`agent-tool-${idx}`}
                      style={{fontSize:8,padding:'1px 6px',border:`1px solid ${TOOL_COLORS[step.tool]||SUBTLE}55`,
                        color:TOOL_COLORS[step.tool]||SUBTLE,borderRadius:2}}>{step.tool.toUpperCase()}</span>
                    <div style={{flex:1}}/>
                    <span style={{fontSize:8,color:SUBTLE}}>{step.duration_ms}ms</span>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    {[['INPUTS',step.inputs],['OUTPUTS',step.outputs]].map(([label,data])=>(
                      <div key={label as string}>
                        <div style={{fontSize:8,color:SUBTLE,marginBottom:2}}>{label}</div>
                        <pre style={{fontSize:9,color:BLUE,background:BG,border:`1px solid ${BORDER}`,
                          borderRadius:2,padding:'4px 6px',overflowX:'auto' as const,margin:0,fontFamily:MONO,whiteSpace:'pre-wrap' as const}}>
                          {JSON.stringify(data,null,1)}
                        </pre>
                      </div>
                    ))}
                  </div>
                  {step.citations.length>0&&(
                    <div style={{display:'flex',gap:4,marginTop:6,flexWrap:'wrap' as const}}>
                      {step.citations.map(c=>(
                        <span key={c} style={{fontSize:8,padding:'1px 5px',border:`1px solid ${AMBER}55`,
                          color:AMBER,borderRadius:2,fontFamily:MONO}}>{c}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Final output */}
            <div data-testid="agent-final-output"
              style={{background:`${GREEN}11`,border:`1px solid ${GREEN}33`,borderRadius:2,padding:'10px 12px',marginBottom:10}}>
              <div style={{fontSize:9,color:GREEN,letterSpacing:'0.1em',marginBottom:4}}>FINAL OUTPUT</div>
              <p style={{fontSize:11,color:TEXT,margin:0}}>{run.final_output}</p>
            </div>

            {/* Citations */}
            {allCitations.length>0&&<CitationsPanel citations={allCitations} maxVisible={4}/>}
          </>
        )}
      </div>
      <div data-testid="agents-panel-ready" style={{position:'absolute' as const,width:1,height:1,overflow:'hidden'}}>ready</div>
    </div>
  );
}

