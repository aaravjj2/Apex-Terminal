// â”€â”€â”€ Bloomberg palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BG='#0a0a0a',PANEL='#111111',BORDER='#1e1e1e'
const AMBER='#f5a623',GREEN='#26a69a',RED='#ef5350',BLUE='#42a5f5'
const PURPLE='#ab47bc',SUBTLE='#555',TEXT='#d1d4dc'
const MONO='"Roboto Mono","Courier New",monospace'

function RunBadge({status}:{status:'idle'|'running'|'paused'}){
  const cfg={idle:{c:SUBTLE,t:'IDLE'},running:{c:GREEN,t:'RUNNING'},paused:{c:AMBER,t:'PAUSED'}}
  const x=cfg[status]
  return <span style={{fontSize:9,fontFamily:MONO,color:x.c,letterSpacing:'0.1em',border:`1px solid ${x.c}`,
    padding:'2px 6px',borderRadius:2}}>{x.t}</span>
}

import { useState, useEffect, useRef } from 'react';

const API_BASE = '/api/v1';

interface Version {
    id: number;
    strategy_id: string;
    version: number;
    content_hash: string;
    message: string;
    author: string;
    created_at: string;
}

interface StrategyIDEProps {
    strategyId?: string;
    onClose?: () => void;
}

const DEFAULT_CODE=`# SMA Crossover Strategy
# Define your trading logic here

def on_bar(bar, portfolio, params):
    """Called on each new bar."""
    sma_fast = params.get('sma_fast', 10)
    sma_slow = params.get('sma_slow', 20)
    
    # Your strategy logic here
    if portfolio.sma(sma_fast) > portfolio.sma(sma_slow):
        return {'action': 'buy', 'size': 100}
    elif portfolio.sma(sma_fast) < portfolio.sma(sma_slow):
        return {'action': 'sell', 'size': 100}
    
    return None
`

const TABS=['EDITOR','VERSIONS','PARAMETERS','CONSOLE'] as const
type IDETab=typeof TABS[number]

export function StrategyIDE({ strategyId, onClose }: StrategyIDEProps) {
    const [code, setCode] = useState<string>(DEFAULT_CODE);
    const [strategyName, setStrategyName] = useState('My Strategy');
    const [versions, setVersions] = useState<Version[]>([]);
    const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'paused'>('idle');
    const [logs, setLogs] = useState<string[]>([]);
    const [tab, setTab] = useState<IDETab>('EDITOR');
    const [params, setParams] = useState({sma_fast:10,sma_slow:20,stop_loss:2.0,take_profit:5.0});
    const [currentRunId, setCurrentRunId] = useState<string|null>(null);
    const editorRef = useRef<HTMLTextAreaElement>(null);
    const currentStrategyId = strategyId || 'new-strategy';

    useEffect(() => { if (strategyId) fetchVersions(); }, [strategyId]);

    const fetchVersions = async () => {
        try {
            const res = await fetch(`${API_BASE}/strategies/${currentStrategyId}/versions`);
            if (res.ok) {
                const data = await res.json();
                setVersions(data);
                if (data.length > 0 && !selectedVersion) {
                    const latest = data[0];
                    const fullVersion = await fetch(`${API_BASE}/strategies/${currentStrategyId}/versions/${latest.version}`);
                    if (fullVersion.ok) {
                        const vData = await fullVersion.json();
                        const content = JSON.parse(vData.content);
                        setCode(content.code || code);
                        setStrategyName(content.name || strategyName);
                    }
                }
            }
        } catch (e) { addLog('error', `Fetch versions failed: ${e}`); }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const content = {name: strategyName, code, params, updated_at: new Date().toISOString()};
            const res = await fetch(`${API_BASE}/strategies/${currentStrategyId}/versions`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({content, message: `Saved at ${new Date().toLocaleTimeString()}`, author: 'user'})
            });
            if (res.ok) {
                const nv = await res.json();
                setVersions(prev => [nv, ...prev]);
                addLog('info', `Saved as version ${nv.version}`);
            } else { addLog('error', `Save failed: HTTP ${res.status}`); }
        } catch (e) { addLog('error', `Save error: ${e}`); }
        finally { setSaving(false); }
    };

    const handleRun = async (mode: 'backtest' | 'paper') => {
        try {
            const res = await fetch(`${API_BASE}/runs`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({strategy_id: currentStrategyId, run_type: mode, config: {...params, code}})
            });
            if (res.ok) {
                const {run_id} = await res.json();
                await fetch(`${API_BASE}/runs/${run_id}/start`, {method: 'POST'});
                setCurrentRunId(run_id);
                setRunStatus('running');
                addLog('info', `Started ${mode.toUpperCase()} run: ${run_id}`);
                setTab('CONSOLE');
            } else { addLog('error', `Run failed: HTTP ${res.status}`); }
        } catch (e) { addLog('error', `Run error: ${e}`); }
    };

    const handleStop = async () => {
        if (currentRunId) {
            try {
                await fetch(`${API_BASE}/runs/${currentRunId}/stop`, {method: 'POST'});
                addLog('info', `Stopped run: ${currentRunId}`);
            } catch(e) { addLog('warn', `Stop error: ${e}`); }
        }
        setRunStatus('idle');
        setCurrentRunId(null);
    };

    const handlePause = async () => {
        if (currentRunId) {
            const endpoint = runStatus==='paused'?'resume':'pause';
            try {
                await fetch(`${API_BASE}/runs/${currentRunId}/${endpoint}`, {method: 'POST'});
            } catch(e) { /* ignore */ }
        }
        setRunStatus(runStatus === 'paused' ? 'running' : 'paused');
        addLog('info', runStatus === 'paused' ? 'Resumed' : 'Paused');
    };

    const loadVersion = async (version: number) => {
        try {
            const res = await fetch(`${API_BASE}/strategies/${currentStrategyId}/versions/${version}`);
            if (res.ok) {
                const data = await res.json();
                const content = JSON.parse(data.content);
                setCode(content.code || '');
                setStrategyName(content.name || strategyName);
                setParams(content.params || params);
                setSelectedVersion(version);
                addLog('info', `Loaded version ${version}`);
                setTab('EDITOR');
            }
        } catch (e) { addLog('error', `Version load error: ${e}`); }
    };

    const addLog = (level: string, message: string) => {
        const ts = new Date().toLocaleTimeString();
        setLogs(prev => [...prev.slice(-199), `[${ts}] [${level.toUpperCase().padEnd(5)}] ${message}`]);
    };

    const S:React.CSSProperties={position:'fixed' as const,inset:0,zIndex:50,background:BG,display:'flex',
        flexDirection:'column' as const,fontFamily:MONO}
    const HDR:React.CSSProperties={display:'flex',alignItems:'center',gap:8,padding:'8px 14px',
        borderBottom:`1px solid ${BORDER}`,background:PANEL,flexShrink:0}
    const TABBAR:React.CSSProperties={display:'flex',gap:2,padding:'0 14px',borderBottom:`1px solid ${BORDER}`,
        background:PANEL,flexShrink:0}
    const tbtn=(a:boolean):React.CSSProperties=>({padding:'7px 12px',fontSize:10,fontFamily:MONO,
        letterSpacing:'0.08em',cursor:'pointer',background:'none',border:'none',
        borderBottom:a?`2px solid ${AMBER}`:'2px solid transparent',
        color:a?AMBER:SUBTLE,textTransform:'uppercase' as const})
    const body:React.CSSProperties={flex:1,overflow:'hidden',display:'flex'}
    const btn=(col:string):React.CSSProperties=>({padding:'4px 12px',fontSize:10,fontFamily:MONO,
        background:col,border:'none',color:BG,cursor:'pointer',letterSpacing:'0.06em',
        textTransform:'uppercase' as const,borderRadius:2})
    const inp:React.CSSProperties={background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,
        padding:'3px 8px',fontSize:11,fontFamily:MONO,color:TEXT}

    return (
        <div style={S}>
            <div style={HDR}>
                <span style={{fontSize:10,color:PURPLE,letterSpacing:'0.1em'}}>IDE</span>
                <input value={strategyName} onChange={e=>setStrategyName(e.target.value)}
                    style={{...inp,fontSize:13,fontWeight:700,minWidth:200,background:'none',border:`1px solid ${BORDER}`}}/>
                <RunBadge status={runStatus}/>
                <div style={{flex:1}}/>
                <button onClick={()=>handleRun('backtest')} disabled={runStatus==='running'}
                    style={btn(PURPLE)}>BACKTEST</button>
                <button onClick={()=>handleRun('paper')} disabled={runStatus==='running'}
                    style={btn(AMBER)}>PAPER</button>
                {runStatus!=='idle'&&(
                    <>
                        <button onClick={handlePause} style={btn(BLUE)}>
                            {runStatus==='paused'?'RESUME':'PAUSE'}
                        </button>
                        <button onClick={handleStop} style={btn(RED)}>STOP</button>
                    </>
                )}
                <button onClick={handleSave} disabled={saving} style={btn(GREEN)}>
                    {saving?'SAVING...':'SAVE'}
                </button>
                {onClose&&<button onClick={onClose} style={{...inp,cursor:'pointer',color:SUBTLE}}>âœ•</button>}
            </div>

            <div style={TABBAR}>
                {TABS.map(t=><button key={t} style={tbtn(tab===t)} onClick={()=>setTab(t)}>{t}</button>)}
            </div>

            <div style={body}>
                {/* EDITOR */}
                {tab==='EDITOR'&&(
                    <div style={{flex:1,display:'flex',flexDirection:'column' as const}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,padding:'4px 14px',
                            borderBottom:`1px solid ${BORDER}`,background:PANEL,fontSize:10,color:SUBTLE}}>
                            <span>{strategyName}.py</span>
                            <span style={{color:BORDER}}>|</span>
                            <span>{code.split('\n').length} lines</span>
                            {runStatus==='running'&&<span style={{color:GREEN}}>â— RUNNING</span>}
                        </div>
                        <textarea ref={editorRef} value={code} onChange={e=>setCode(e.target.value)}
                            spellCheck={false}
                            style={{flex:1,background:BG,color:TEXT,padding:'12px 16px',fontFamily:MONO,
                                fontSize:12,resize:'none' as const,border:'none',outline:'none',
                                lineHeight:1.6,tabSize:4}}/>
                    </div>
                )}

                {/* VERSIONS */}
                {tab==='VERSIONS'&&(
                    <div style={{flex:1,overflowY:'auto' as const,padding:'12px 16px'}}>
                        <div style={{fontSize:10,color:SUBTLE,marginBottom:10,textTransform:'uppercase' as const,letterSpacing:'0.08em'}}>
                            VERSION HISTORY â€” {currentStrategyId}
                        </div>
                        {versions.length===0&&(
                            <div style={{fontSize:12,color:SUBTLE}}>NO VERSIONS SAVED YET</div>
                        )}
                        {versions.map(v=>(
                            <div key={v.id} onClick={()=>loadVersion(v.version)}
                                style={{background:selectedVersion===v.version?`${AMBER}15`:PANEL,
                                    border:`1px solid ${selectedVersion===v.version?AMBER:BORDER}`,
                                    borderRadius:2,padding:'8px 12px',marginBottom:6,cursor:'pointer'}}>
                                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                                    <span style={{fontSize:12,color:AMBER,fontFamily:MONO}}>v{v.version}</span>
                                    <span style={{fontSize:10,color:SUBTLE}}>{v.author}</span>
                                </div>
                                <div style={{fontSize:11,color:TEXT,fontFamily:MONO,marginBottom:2}}>{v.message}</div>
                                <div style={{fontSize:10,color:SUBTLE,fontFamily:MONO}}>{v.content_hash.substring(0,16)}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* PARAMETERS */}
                {tab==='PARAMETERS'&&(
                    <div style={{flex:1,overflowY:'auto' as const,padding:'12px 16px',maxWidth:400}}>
                        <div style={{fontSize:10,color:SUBTLE,marginBottom:10,textTransform:'uppercase' as const,letterSpacing:'0.08em'}}>
                            STRATEGY PARAMETERS
                        </div>
                        {[
                            {k:'sma_fast',label:'SMA Fast Period',min:3,max:50,step:1},
                            {k:'sma_slow',label:'SMA Slow Period',min:10,max:200,step:1},
                            {k:'stop_loss',label:'Stop Loss %',min:0.5,max:20,step:0.5},
                            {k:'take_profit',label:'Take Profit %',min:1,max:50,step:0.5},
                        ].map(({k,label,min,max,step})=>(
                            <div key={k} style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,
                                padding:'10px 12px',marginBottom:8}}>
                                <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                                    <span style={{fontSize:11,color:TEXT,fontFamily:MONO}}>{label}</span>
                                    <span style={{fontSize:12,color:AMBER,fontFamily:MONO}}>{(params as any)[k]}</span>
                                </div>
                                <input type="range" min={min} max={max} step={step}
                                    value={(params as any)[k]}
                                    onChange={e=>setParams(p=>({...p,[k]:parseFloat(e.target.value)}))}
                                    style={{width:'100%',accentColor:AMBER}}/>
                                <div style={{display:'flex',justifyContent:'space-between',marginTop:2}}>
                                    <span style={{fontSize:9,color:SUBTLE,fontFamily:MONO}}>{min}</span>
                                    <span style={{fontSize:9,color:SUBTLE,fontFamily:MONO}}>{max}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* CONSOLE */}
                {tab==='CONSOLE'&&(
                    <div style={{flex:1,display:'flex',flexDirection:'column' as const}}>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
                            padding:'4px 14px',borderBottom:`1px solid ${BORDER}`,background:PANEL}}>
                            <span style={{fontSize:10,color:SUBTLE}}>CONSOLE OUTPUT</span>
                            <button onClick={()=>setLogs([])} style={{fontSize:9,fontFamily:MONO,
                                background:'none',border:'none',color:SUBTLE,cursor:'pointer'}}>CLEAR</button>
                        </div>
                        <div style={{flex:1,overflowY:'auto' as const,padding:'8px 14px',fontSize:11,fontFamily:MONO,lineHeight:1.5}}>
                            {logs.length===0&&<span style={{color:SUBTLE}}>No output yet â€” run a strategy to see logs</span>}
                            {logs.map((log,i)=>(
                                <div key={i} style={{color:log.includes('[ERROR]')?RED:log.includes('[WARN]')?AMBER:TEXT,
                                    padding:'1px 0',whiteSpace:'pre' as const}}>{log}</div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
