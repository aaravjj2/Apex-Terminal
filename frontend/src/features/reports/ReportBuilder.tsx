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
  <td style={{padding:'6px 10px',fontSize:11,fontFamily:MONO,borderBottom:`1px solid ${BORDER}`,color:TEXT,...c}}>{ch}</td>
)
function ReportTypeBadge({type}:{type:string}){
  const c=type==='performance'?PURPLE:ORANGE
  return <span style={{fontSize:9,fontFamily:MONO,color:c,border:`1px solid ${c}`,
    padding:'2px 6px',borderRadius:2,textTransform:'uppercase' as const,letterSpacing:'0.08em'}}>{type}</span>
}
function Field({label,children}:{label:string,children:React.ReactNode}){
  return (
    <div style={{display:'flex',flexDirection:'column' as const,gap:3}}>
      <label style={{fontSize:9,fontFamily:MONO,color:SUBTLE,textTransform:'uppercase' as const,letterSpacing:'0.08em'}}>{label}</label>
      {children}
    </div>
  )
}
const INPUT:React.CSSProperties={background:BG,border:`1px solid ${BORDER}`,color:TEXT,
  fontFamily:MONO,fontSize:11,padding:'5px 8px',borderRadius:2,outline:'none',width:'100%'}

import React, { useState, useEffect } from 'react';

const API_BASE = '/api/v1';

interface ReportSummary {
    report_id: string;
    generated_at: string;
    type: string;
    strategy_id?: string;
}

interface PerformanceReportData {
    sharpe?: number;
    max_drawdown?: number;
    volatility?: number;
    total_return?: number;
    total_trades?: number;
    win_rate?: number;
}

const TABS=['ALL REPORTS','PERFORMANCE','AUDIT','GENERATE'] as const
type RTab=typeof TABS[number]

export function ReportBuilder() {
    const [reports, setReports] = useState<ReportSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [tab, setTab] = useState<RTab>('ALL REPORTS');
    const [selectedReport, setSelectedReport] = useState<ReportSummary|null>(null);

    // Generate form state
    const [strategyId, setStrategyId] = useState('');
    const [reportType, setReportType] = useState<'performance' | 'audit'>('performance');
    const [startDate, setStartDate] = useState(() => {
        const d = new Date(); d.setMonth(d.getMonth() - 3);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [generating, setGenerating] = useState(false);
    const [genMsg, setGenMsg] = useState('');

    useEffect(() => { fetchReports(); }, []);

    const fetchReports = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/reports`);
            if (res.ok) setReports(await res.json());
        } catch (e) {
            console.error('Failed to fetch reports:', e);
        } finally {
            setLoading(false);
        }
    };

    const createReport = async () => {
        setGenerating(true);
        setGenMsg('');
        const endpoint = reportType === 'performance'
            ? `/reports/performance` : `/reports/audit`;
        const body = reportType === 'performance'
            ? {
                strategy_id: strategyId,
                start_date: startDate,
                end_date: endDate,
                trades: [],
                metrics: { sharpe: 0, max_drawdown: 0, volatility: 0 }
              }
            : {
                start_date: startDate,
                end_date: endDate,
                orders: [],
                alerts: [],
                errors: []
              };
        try {
            const res = await fetch(`${API_BASE}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (res.ok) {
                setGenMsg('Report generated successfully');
                fetchReports();
                setTab('ALL REPORTS');
            } else {
                setGenMsg(`Error: ${res.status} ${res.statusText}`);
            }
        } catch (e) {
            setGenMsg(`Error: ${String(e)}`);
        } finally {
            setGenerating(false);
        }
    };

    const fmtDate=(iso:string)=>new Date(iso).toLocaleDateString();
    const fmtDateTime=(iso:string)=>new Date(iso).toLocaleString();

    const displayReports=tab==='PERFORMANCE'?reports.filter(r=>r.type==='performance')
        :tab==='AUDIT'?reports.filter(r=>r.type==='audit')
        :reports;

    const S:React.CSSProperties={height:'100%',display:'flex',flexDirection:'column' as const,background:BG,fontFamily:MONO}
    const HDR:React.CSSProperties={display:'flex',alignItems:'center',gap:8,padding:'8px 14px',
        borderBottom:`1px solid ${BORDER}`,background:PANEL,flexShrink:0}
    const TABBAR:React.CSSProperties={display:'flex',gap:2,padding:'0 14px',borderBottom:`1px solid ${BORDER}`,
        background:PANEL,flexShrink:0}
    const tbtn=(a:boolean):React.CSSProperties=>({padding:'7px 12px',fontSize:10,fontFamily:MONO,
        letterSpacing:'0.08em',cursor:'pointer',background:'none',border:'none',
        borderBottom:a?`2px solid ${AMBER}`:'2px solid transparent',
        color:a?AMBER:SUBTLE,textTransform:'uppercase' as const})

    return (
        <div style={S}>
            <div style={HDR}>
                <span style={{fontSize:11,color:PURPLE,letterSpacing:'0.1em'}}>RB</span>
                <span style={{fontSize:13,color:TEXT,fontWeight:700}}>REPORT BUILDER</span>
                <span style={{fontSize:10,color:SUBTLE}}>APEX REPORTING ENGINE</span>
                <div style={{flex:1}}/>
                {loading&&<span style={{fontSize:10,color:AMBER}}>LOADING</span>}
                <button onClick={fetchReports} style={{fontSize:10,fontFamily:MONO,background:PANEL,
                    border:`1px solid ${BORDER}`,color:BLUE,padding:'3px 8px',cursor:'pointer',borderRadius:2}}>
                    REFRESH
                </button>
                <button onClick={()=>setTab('GENERATE')} style={{fontSize:10,fontFamily:MONO,background:AMBER,
                    border:'none',color:BG,padding:'3px 10px',cursor:'pointer',borderRadius:2,fontWeight:700}}>
                    + GENERATE
                </button>
            </div>

            {/* Stats strip */}
            <div style={{display:'flex',gap:12,padding:'6px 14px',borderBottom:`1px solid ${BORDER}`,
                background:PANEL,flexShrink:0}}>
                {[['TOTAL',reports.length,TEXT],['PERFORMANCE',reports.filter(r=>r.type==='performance').length,PURPLE],
                  ['AUDIT',reports.filter(r=>r.type==='audit').length,ORANGE]].map(([l,v,c])=>(
                    <div key={String(l)} style={{display:'flex',gap:6,alignItems:'baseline'}}>
                        <span style={{fontSize:9,fontFamily:MONO,color:SUBTLE,textTransform:'uppercase' as const}}>{l}</span>
                        <span style={{fontSize:14,fontFamily:MONO,color:c as string,fontWeight:700}}>{v}</span>
                    </div>
                ))}
            </div>

            <div style={TABBAR}>
                {TABS.map(t=><button key={t} style={tbtn(tab===t)} onClick={()=>setTab(t)}>{t}</button>)}
            </div>

            {/* GENERATE tab */}
            {tab==='GENERATE'&&(
                <div style={{flex:1,overflowY:'auto' as const,padding:14}}>
                    <div style={{maxWidth:480,display:'flex',flexDirection:'column' as const,gap:14}}>
                        <div style={{fontSize:11,color:TEXT,fontWeight:700,marginBottom:4}}>GENERATE REPORT</div>

                        <Field label="Report Type">
                            <div style={{display:'flex',gap:6}}>
                                {(['performance','audit'] as const).map(t=>(
                                    <button key={t} onClick={()=>setReportType(t)}
                                        style={{padding:'5px 12px',fontSize:10,fontFamily:MONO,cursor:'pointer',
                                            borderRadius:2,border:`1px solid ${reportType===t?AMBER:BORDER}`,
                                            background:reportType===t?`${AMBER}22`:PANEL,
                                            color:reportType===t?AMBER:SUBTLE,textTransform:'uppercase' as const}}>
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </Field>

                        {reportType==='performance'&&(
                            <Field label="Strategy ID">
                                <input value={strategyId} onChange={e=>setStrategyId(e.target.value)}
                                    placeholder="e.g. strategy-001"
                                    style={INPUT}/>
                            </Field>
                        )}

                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                            <Field label="Start Date">
                                <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} style={INPUT}/>
                            </Field>
                            <Field label="End Date">
                                <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} style={INPUT}/>
                            </Field>
                        </div>

                        <div style={{display:'flex',gap:8,alignItems:'center'}}>
                            <button onClick={createReport} disabled={generating}
                                style={{padding:'7px 18px',fontSize:11,fontFamily:MONO,background:AMBER,
                                    border:'none',color:BG,cursor:generating?'not-allowed':'pointer',
                                    borderRadius:2,fontWeight:700,opacity:generating?0.6:1}}>
                                {generating?'GENERATING...':'GENERATE REPORT'}
                            </button>
                            <button onClick={()=>setTab('ALL REPORTS')}
                                style={{padding:'7px 14px',fontSize:10,fontFamily:MONO,background:PANEL,
                                    border:`1px solid ${BORDER}`,color:SUBTLE,cursor:'pointer',borderRadius:2}}>
                                CANCEL
                            </button>
                        </div>
                        {genMsg&&<div style={{fontSize:11,fontFamily:MONO,
                            color:genMsg.startsWith('Error')?RED:GREEN,marginTop:4}}>{genMsg}</div>}
                    </div>
                </div>
            )}

            {/* Reports list tabs */}
            {tab!=='GENERATE'&&(
                <div style={{flex:1,display:'flex',flexDirection:'column' as const,overflow:'hidden'}}>
                    <div style={{flex:1,overflowY:'auto' as const}}>
                        {displayReports.length===0&&(
                            <div style={{padding:40,textAlign:'center' as const,fontSize:12,color:SUBTLE}}>
                                {loading?'LOADING...':'NO REPORTS â€” CLICK + GENERATE'}
                            </div>
                        )}
                        {displayReports.length>0&&(
                            <table style={{width:'100%',borderCollapse:'collapse'}}>
                                <thead style={{position:'sticky' as const,top:0,background:PANEL}}>
                                    <tr>
                                        <Th ch="Type"/>
                                        <Th ch="Report ID"/>
                                        <Th ch="Strategy"/>
                                        <Th ch="Generated"/>
                                        <Th c={{textAlign:'right'}} ch="Actions"/>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayReports.map(r=>(
                                        <tr key={r.report_id}
                                            onClick={()=>setSelectedReport(selectedReport?.report_id===r.report_id?null:r)}
                                            style={{cursor:'pointer',background:selectedReport?.report_id===r.report_id?`${AMBER}11`:'transparent'}}>
                                            <Td ch={<ReportTypeBadge type={r.type}/>}/>
                                            <Td c={{color:BLUE,fontSize:10}} ch={r.report_id.substring(0,28)}/>
                                            <Td c={{fontSize:10,color:SUBTLE}} ch={r.strategy_id||'â€”'}/>
                                            <Td c={{fontSize:10}} ch={fmtDate(r.generated_at)}/>
                                            <Td c={{textAlign:'right'}} ch={
                                                <div style={{display:'flex',gap:6,justifyContent:'flex-end'}}
                                                    onClick={e=>e.stopPropagation()}>
                                                    <a href={`${API_BASE}/reports/${r.report_id}`} target="_blank"
                                                        style={{fontSize:9,fontFamily:MONO,color:BLUE,border:`1px solid ${BLUE}`,
                                                            padding:'2px 6px',borderRadius:2,textDecoration:'none'}}>JSON</a>
                                                    <a href={`${API_BASE}/reports/${r.report_id}/html`} target="_blank"
                                                        style={{fontSize:9,fontFamily:MONO,color:GREEN,border:`1px solid ${GREEN}`,
                                                            padding:'2px 6px',borderRadius:2,textDecoration:'none'}}>HTML</a>
                                                </div>
                                            }/>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                    {/* Detail strip */}
                    {selectedReport&&(
                        <div style={{borderTop:`1px solid ${BORDER}`,background:PANEL,padding:'10px 14px',flexShrink:0}}>
                            <div style={{display:'flex',gap:24,alignItems:'flex-start'}}>
                                <div>
                                    <div style={{fontSize:9,color:SUBTLE,fontFamily:MONO,textTransform:'uppercase' as const, marginBottom:2}}>Report ID</div>
                                    <div style={{fontSize:11,color:BLUE,fontFamily:MONO}}>{selectedReport.report_id}</div>
                                </div>
                                <div>
                                    <div style={{fontSize:9,color:SUBTLE,fontFamily:MONO,textTransform:'uppercase' as const, marginBottom:2}}>Type</div>
                                    <ReportTypeBadge type={selectedReport.type}/>
                                </div>
                                <div>
                                    <div style={{fontSize:9,color:SUBTLE,fontFamily:MONO,textTransform:'uppercase' as const, marginBottom:2}}>Generated</div>
                                    <div style={{fontSize:11,color:TEXT,fontFamily:MONO}}>{fmtDateTime(selectedReport.generated_at)}</div>
                                </div>
                                {selectedReport.strategy_id&&(
                                    <div>
                                        <div style={{fontSize:9,color:SUBTLE,fontFamily:MONO,textTransform:'uppercase' as const,marginBottom:2}}>Strategy</div>
                                        <div style={{fontSize:11,color:AMBER,fontFamily:MONO}}>{selectedReport.strategy_id}</div>
                                    </div>
                                )}
                                <button onClick={()=>setSelectedReport(null)}
                                    style={{marginLeft:'auto',background:'none',border:'none',color:SUBTLE,cursor:'pointer',fontFamily:MONO,fontSize:9}}>
                                    CLOSE
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
