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
  <td style={{padding:'7px 10px',fontSize:11,fontFamily:MONO,borderBottom:`1px solid ${BORDER}`,color:TEXT,...c}}>{ch}</td>
)
function StatCard({label,value,color}:{label:string,value:string,color?:string}){
  return (
    <div style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,padding:'7px 10px',minWidth:90}}>
      <div style={{fontSize:9,fontFamily:MONO,color:SUBTLE,textTransform:'uppercase' as const,letterSpacing:'0.08em',marginBottom:3}}>{label}</div>
      <div style={{fontSize:15,fontFamily:MONO,color:color||AMBER,fontWeight:700}}>{value}</div>
    </div>
  )
}
function TypeBadge({type}:{type:string}){
  const c=type==='performance'?PURPLE:type==='audit'?ORANGE:BLUE
  return <span style={{fontSize:9,color:c,border:`1px solid ${c}`,padding:'1px 5px',borderRadius:2,
    fontFamily:MONO,textTransform:'uppercase' as const,letterSpacing:'0.06em'}}>{type}</span>
}

import React, { useState, useEffect } from 'react';
import { TrendingUp, BarChart3, FileText, PieChart, Download, Calendar, Filter } from 'lucide-react';

const API_BASE = '/api/v1';

interface ReportSummary {
  report_id: string;
  generated_at: string;
  type: string;
  strategy_id?: string;
}

type RVTab='ALL'|'PERFORMANCE'|'AUDIT'|'GENERATE'

const INPUT_S:React.CSSProperties={background:BG,border:`1px solid ${BORDER}`,color:TEXT,
  fontFamily:MONO,fontSize:11,padding:'6px 8px',borderRadius:2,outline:'none',width:'100%',boxSizing:'border-box' as const}

export function ReportsView() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<RVTab>('ALL');
  const [selected, setSelected] = useState<ReportSummary|null>(null);

  // Generate form
  const [rType, setRType] = useState<'performance'|'audit'>('performance');
  const [stratId, setStratId] = useState('');
  const [start, setStart] = useState(() => { const d=new Date();d.setMonth(d.getMonth()-3);return d.toISOString().split('T')[0]; });
  const [end, setEnd] = useState(() => new Date().toISOString().split('T')[0]);
  const [generMsg, setGenerMsg] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => { fetchReports(); }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/reports`);
      if (res.ok) setReports(await res.json());
    } catch (e) { console.error('fetch reports failed', e); }
    finally { setLoading(false); }
  };

  const generateReport = async () => {
    setGenerating(true); setGenerMsg('');
    const ep = rType==='performance' ? '/reports/performance' : '/reports/audit';
    const body = rType==='performance'
      ? {strategy_id:stratId,start_date:start,end_date:end,trades:[],metrics:{sharpe:0,max_drawdown:0,volatility:0}}
      : {start_date:start,end_date:end,orders:[],alerts:[],errors:[]};
    try {
      const res = await fetch(`${API_BASE}${ep}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      if (res.ok) { setGenerMsg('Report generated'); fetchReports(); setTab('ALL'); }
      else setGenerMsg(`Error ${res.status}: ${res.statusText}`);
    } catch (e) { setGenerMsg('Error: '+String(e)); }
    finally { setGenerating(false); }
  };

  const fmtDate = (iso:string) => new Date(iso).toLocaleDateString();
  const fmtDateTime = (iso:string) => new Date(iso).toLocaleString();

  const display = tab==='PERFORMANCE'?reports.filter(r=>r.type==='performance')
    :tab==='AUDIT'?reports.filter(r=>r.type==='audit'):reports;

  const S:React.CSSProperties={height:'100%',display:'flex',flexDirection:'column' as const,background:BG,fontFamily:MONO}
  const HDR:React.CSSProperties={display:'flex',alignItems:'center',gap:8,padding:'8px 14px',
      borderBottom:`1px solid ${BORDER}`,background:PANEL,flexShrink:0}
  const TABBAR:React.CSSProperties={display:'flex',gap:2,padding:'0 14px',borderBottom:`1px solid ${BORDER}`,
      background:PANEL,flexShrink:0}
  const tbtn=(a:boolean):React.CSSProperties=>({padding:'7px 12px',fontSize:10,fontFamily:MONO,letterSpacing:'0.08em',
      cursor:'pointer',background:'none',border:'none',borderBottom:a?`2px solid ${AMBER}`:'2px solid transparent',
      color:a?AMBER:SUBTLE,textTransform:'uppercase' as const})

  return (
    <div style={S} data-testid="reports-view">
      <div style={HDR}>
        <span style={{fontSize:11,color:PURPLE,letterSpacing:'0.1em'}}>RP</span>
        <span style={{fontSize:13,color:TEXT,fontWeight:700}}>REPORTS</span>
        <span style={{fontSize:10,color:SUBTLE}}>APEX REPORTING SUITE</span>
        <div style={{flex:1}}/>
        {loading&&<span style={{fontSize:10,color:AMBER}}>LOADING</span>}
        <button onClick={fetchReports} style={{fontSize:10,fontFamily:MONO,background:PANEL,
            border:`1px solid ${BORDER}`,color:BLUE,padding:'3px 8px',cursor:'pointer',borderRadius:2}}>REFRESH</button>
        <button onClick={()=>setTab('GENERATE')} style={{fontSize:10,fontFamily:MONO,background:AMBER,
            border:'none',color:BG,padding:'3px 10px',cursor:'pointer',borderRadius:2,fontWeight:700}}>+ GENERATE</button>
      </div>

      {/* Stats */}
      <div style={{display:'flex',gap:8,padding:'8px 14px',borderBottom:`1px solid ${BORDER}`,
          background:PANEL,flexShrink:0}}>
        <StatCard label="Total" value={String(reports.length)} color={TEXT}/>
        <StatCard label="Performance" value={String(reports.filter(r=>r.type==='performance').length)} color={PURPLE}/>
        <StatCard label="Audit" value={String(reports.filter(r=>r.type==='audit').length)} color={ORANGE}/>
      </div>

      <div style={TABBAR}>
        {(['ALL','PERFORMANCE','AUDIT','GENERATE'] as RVTab[]).map(t=>(
          <button key={t} style={tbtn(tab===t)} onClick={()=>setTab(t)}>{t}</button>
        ))}
      </div>

      {/* GENERATE tab */}
      {tab==='GENERATE'&&(
        <div style={{flex:1,overflowY:'auto' as const,padding:14}}>
          <div style={{maxWidth:460,display:'flex',flexDirection:'column' as const,gap:14}}>
            <div style={{fontSize:11,color:TEXT,fontWeight:700}}>GENERATE NEW REPORT</div>
            <div>
              <div style={{fontSize:9,color:SUBTLE,textTransform:'uppercase' as const,letterSpacing:'0.08em',marginBottom:6}}>Report Type</div>
              <div style={{display:'flex',gap:6}}>
                {(['performance','audit'] as const).map(t=>(
                  <button key={t} onClick={()=>setRType(t)}
                    style={{padding:'5px 12px',fontSize:10,fontFamily:MONO,cursor:'pointer',borderRadius:2,
                      border:`1px solid ${rType===t?AMBER:BORDER}`,background:rType===t?`${AMBER}22`:PANEL,
                      color:rType===t?AMBER:SUBTLE,textTransform:'uppercase' as const}}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            {rType==='performance'&&(
              <div>
                <div style={{fontSize:9,color:SUBTLE,textTransform:'uppercase' as const,letterSpacing:'0.08em',marginBottom:4}}>Strategy ID</div>
                <input value={stratId} onChange={e=>setStratId(e.target.value)} placeholder="strategy-001" style={INPUT_S}/>
              </div>
            )}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <div>
                <div style={{fontSize:9,color:SUBTLE,textTransform:'uppercase' as const,letterSpacing:'0.08em',marginBottom:4}}>Start Date</div>
                <input type="date" value={start} onChange={e=>setStart(e.target.value)} style={INPUT_S}/>
              </div>
              <div>
                <div style={{fontSize:9,color:SUBTLE,textTransform:'uppercase' as const,letterSpacing:'0.08em',marginBottom:4}}>End Date</div>
                <input type="date" value={end} onChange={e=>setEnd(e.target.value)} style={INPUT_S}/>
              </div>
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <button onClick={generateReport} disabled={generating}
                style={{padding:'7px 18px',fontSize:11,fontFamily:MONO,background:AMBER,border:'none',
                  color:BG,cursor:generating?'not-allowed':'pointer',borderRadius:2,fontWeight:700,opacity:generating?0.6:1}}>
                {generating?'GENERATING...':'GENERATE'}
              </button>
              <button onClick={()=>setTab('ALL')}
                style={{padding:'7px 14px',fontSize:10,fontFamily:MONO,background:PANEL,
                  border:`1px solid ${BORDER}`,color:SUBTLE,cursor:'pointer',borderRadius:2}}>CANCEL</button>
            </div>
            {generMsg&&<div style={{fontSize:11,fontFamily:MONO,color:generMsg.startsWith('Error')?RED:GREEN}}>{generMsg}</div>}
          </div>
        </div>
      )}

      {/* Table tabs */}
      {tab!=='GENERATE'&&(
        <div style={{flex:1,display:'flex',flexDirection:'column' as const,overflow:'hidden'}}>
          <div style={{flex:1,overflowY:'auto' as const}}>
            {display.length===0&&(
              <div style={{padding:40,textAlign:'center' as const,fontSize:12,color:SUBTLE}} data-testid="reports-list">
                {loading?'LOADING...':'NO REPORTS â€” CLICK + GENERATE'}
              </div>
            )}
            {display.length>0&&(
              <table style={{width:'100%',borderCollapse:'collapse'}} data-testid="reports-list">
                <thead style={{position:'sticky' as const,top:0,background:PANEL}}>
                  <tr>
                    <Th ch="Type"/>
                    <Th ch="Report ID"/>
                    <Th ch="Strategy"/>
                    <Th ch="Generated"/>
                    <Th c={{textAlign:'right'}} ch="Export"/>
                  </tr>
                </thead>
                <tbody>
                  {display.map(r=>(
                    <tr key={r.report_id}
                      onClick={()=>setSelected(selected?.report_id===r.report_id?null:r)}
                      style={{cursor:'pointer',background:selected?.report_id===r.report_id?`${AMBER}11`:'transparent'}}
                      data-testid={`report-item-${r.report_id}`}>
                      <Td ch={<TypeBadge type={r.type}/>}/>
                      <Td c={{color:BLUE,fontSize:10}} ch={r.report_id.substring(0,28)}/>
                      <Td c={{fontSize:10,color:SUBTLE}} ch={r.strategy_id||'â€”'}/>
                      <Td c={{fontSize:10}} ch={fmtDate(r.generated_at)}/>
                      <Td c={{textAlign:'right'}} ch={
                        <div style={{display:'flex',gap:6,justifyContent:'flex-end'}} onClick={e=>e.stopPropagation()}>
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
          {selected&&(
            <div style={{borderTop:`1px solid ${BORDER}`,background:PANEL,padding:'10px 14px',flexShrink:0}} data-testid="report-preview">
              <div style={{display:'flex',gap:20,flexWrap:'wrap' as const,alignItems:'flex-start'}}>
                <div><div style={{fontSize:8,color:SUBTLE,textTransform:'uppercase' as const,marginBottom:2}}>Report ID</div>
                  <div style={{fontSize:11,color:BLUE,fontFamily:MONO}}>{selected.report_id}</div></div>
                <div><div style={{fontSize:8,color:SUBTLE,textTransform:'uppercase' as const,marginBottom:2}}>Type</div>
                  <TypeBadge type={selected.type}/></div>
                <div><div style={{fontSize:8,color:SUBTLE,textTransform:'uppercase' as const,marginBottom:2}}>Generated</div>
                  <div style={{fontSize:11,color:TEXT,fontFamily:MONO}}>{fmtDateTime(selected.generated_at)}</div></div>
                {selected.strategy_id&&(
                  <div><div style={{fontSize:8,color:SUBTLE,textTransform:'uppercase' as const,marginBottom:2}}>Strategy</div>
                    <div style={{fontSize:11,color:AMBER,fontFamily:MONO}}>{selected.strategy_id}</div></div>
                )}
                <button onClick={()=>setSelected(null)}
                  style={{marginLeft:'auto',background:'none',border:'none',color:SUBTLE,cursor:'pointer',fontFamily:MONO,fontSize:9}}>CLOSE</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Mock data
const mockReports = [
    { id: 'r1', name: 'Daily P&L Summary', type: 'pnl', date: '2024-01-15', status: 'ready' },
    { id: 'r2', name: 'Strategy Performance', type: 'strategy', date: '2024-01-14', status: 'ready' },
    { id: 'r3', name: 'Trade History Export', type: 'trades', date: '2024-01-13', status: 'ready' },
    { id: 'r4', name: 'Risk Analysis', type: 'risk', date: '2024-01-12', status: 'generating' },
];

const reportTemplates = [
    { id: 't1', name: 'Daily P&L', icon: TrendingUp },
    { id: 't2', name: 'Strategy Report', icon: BarChart3 },
    { id: 't3', name: 'Trade History', icon: FileText },
    { id: 't4', name: 'Portfolio Analysis', icon: PieChart },
];

function ReportsList({
    reports,
    selectedId,
    onSelect
}: {
    reports: typeof mockReports;
    selectedId: string | null;
    onSelect: (id: string) => void;
}) {
    const typeIcons: Record<string, React.ReactNode> = {
        pnl: <TrendingUp size={14} />,
        strategy: <BarChart3 size={14} />,
        trades: <FileText size={14} />,
        risk: <PieChart size={14} />,
    };

    return (
        <div className="h-full flex flex-col bg-panel-bg border-r border-border" data-testid="reports-list">
            {/* Header */}
            <div className="p-4 border-b border-border shrink-0">
                <h2 className="text-sm font-semibold text-text mb-3">Generate Report</h2>
                <div className="grid grid-cols-2 gap-2">
                    {reportTemplates.map(t => (
                        <button
                            key={t.id}
                            className="flex items-center gap-2 p-2.5 bg-element-bg rounded-md border border-border hover:border-brand/40 hover:bg-brand/5 transition-all text-xs group"
                        >
                            <t.icon size={14} className="text-text-secondary group-hover:text-brand transition-colors" />
                            <span className="text-text">{t.name}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* History header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
                <span className="text-xs text-text-secondary uppercase tracking-wider">History</span>
                <IconButton icon={<Filter size={12} />} tooltip="Filter" variant="ghost" size="sm" />
            </div>

            {/* List */}
            <div className="flex-1 overflow-auto">
                {reports.map(report => (
                    <button
                        key={report.id}
                        onClick={() => onSelect(report.id)}
                        data-testid={`report-item-${report.id}`}
                        className={cn(
                            'w-full text-left p-3 border-b border-border/50 transition-all',
                            selectedId === report.id ? 'bg-brand/10 border-l-2 border-l-brand' : 'hover:bg-element-bg/50'
                        )}
                    >
                        <div className="flex items-center gap-2 mb-1">
                            {typeIcons[report.type]}
                            <span className="text-sm text-text">{report.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xxs text-text-muted">
                            <Calendar size={10} />
                            <span>{report.date}</span>
                            <Badge
                                size="sm"
                                variant={report.status === 'ready' ? 'success' : 'warning'}
                            >
                                {report.status}
                            </Badge>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}

function ReportPreview({ report }: { report: typeof mockReports[0] | null }) {
    if (!report) {
        return (
            <EmptyState
                icon={<FileText size={48} />}
                title="Select a report"
                description="Choose a report from the list or generate a new one."
                className="h-full"
            />
        );
    }

    return (
        <div className="h-full flex flex-col" data-testid="report-preview">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0 bg-panel-bg">
                <div>
                    <h2 className="text-lg font-semibold text-text">{report.name}</h2>
                    <div className="flex items-center gap-2 mt-1 text-xs text-text-secondary">
                        <Calendar size={12} />
                        <span>{report.date}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button size="sm" variant="secondary" className="gap-1">
                        <Download size={14} /> Export PDF
                    </Button>
                    <Button size="sm" variant="secondary" className="gap-1">
                        <Download size={14} /> Export CSV
                    </Button>
                </div>
            </div>

            {/* Report content placeholder */}
            <div className="flex-1 overflow-auto p-6">
                <div className="max-w-4xl mx-auto">
                    {/* Summary cards */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="p-4 bg-element-bg rounded-lg border border-border border-l-2 border-l-up">
                            <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-1.5 font-medium">Net P&amp;L</div>
                            <div className="text-xl font-semibold text-up tabular-nums">+$1,247.50</div>
                        </div>
                        <div className="p-4 bg-element-bg rounded-lg border border-border border-l-2 border-l-brand">
                            <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-1.5 font-medium">Total Trades</div>
                            <div className="text-xl font-semibold text-text tabular-nums">42</div>
                        </div>
                        <div className="p-4 bg-element-bg rounded-lg border border-border border-l-2 border-l-warn">
                            <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-1.5 font-medium">Win Rate</div>
                            <div className="text-xl font-semibold text-text tabular-nums">67%</div>
                        </div>
                    </div>

                    {/* Chart placeholder */}
                    <div className="h-64 bg-element-bg rounded flex items-center justify-center mb-6">
                        <span className="text-text-secondary">Equity Curve Chart</span>
                    </div>

                    {/* Table placeholder */}
                    <div className="bg-element-bg rounded p-4">
                        <h3 className="text-sm font-medium text-text mb-3">Trade Summary</h3>
                        <div className="space-y-2 text-xs">
                            <div className="flex justify-between py-2 border-b border-border">
                                <span className="text-text-secondary">Best Trade</span>
                                <span className="text-up">+$342.00 (AAPL)</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-border">
                                <span className="text-text-secondary">Worst Trade</span>
                                <span className="text-down">-$128.50 (MSFT)</span>
                            </div>
                            <div className="flex justify-between py-2">
                                <span className="text-text-secondary">Average Trade</span>
                                <span className="text-text">+$29.70</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

