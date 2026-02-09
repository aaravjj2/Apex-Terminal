import { useState, useEffect } from 'react';
import { FileText, Download, RefreshCw, Plus, ExternalLink } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000/api/v1';

interface ReportSummary {
    report_id: string;
    generated_at: string;
    type: string;
}

export function ReportBuilder() {
    const [reports, setReports] = useState<ReportSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [reportType, setReportType] = useState<'performance' | 'audit'>('performance');
    const [strategyId, setStrategyId] = useState('demo-strategy');
    const [startDate, setStartDate] = useState('2024-01-01');
    const [endDate, setEndDate] = useState('2024-12-31');

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/reports`);
            if (res.ok) {
                setReports(await res.json());
            }
        } catch (e) {
            console.error('Failed to fetch reports:', e);
        } finally {
            setLoading(false);
        }
    };

    const createReport = async () => {
        try {
            const endpoint = reportType === 'performance' ? '/reports/performance' : '/reports/audit';
            const body = reportType === 'performance'
                ? {
                    strategy_id: strategyId,
                    start_date: startDate,
                    end_date: endDate,
                    trades: [
                        { symbol: 'AAPL', pnl: 150.50, side: 'buy', qty: 10 },
                        { symbol: 'TSLA', pnl: -45.20, side: 'sell', qty: 5 },
                        { symbol: 'MSFT', pnl: 82.30, side: 'buy', qty: 15 }
                    ],
                    metrics: { sharpe: 1.45, max_drawdown: 0.12, volatility: 0.18 }
                }
                : {
                    start_date: startDate,
                    end_date: endDate,
                    orders: [{ id: '1', symbol: 'AAPL', side: 'buy', status: 'filled' }],
                    alerts: [{ id: '1', type: 'price_above', triggered: true }],
                    errors: []
                };

            const res = await fetch(`${API_BASE}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (res.ok) {
                setShowCreate(false);
                fetchReports();
            }
        } catch (e) {
            console.error('Failed to create report:', e);
        }
    };

    const formatDate = (iso: string) => new Date(iso).toLocaleDateString();

    return (
        <div className="h-full flex flex-col bg-[#131722]">
            {/* Header */}
            <div className="h-10 border-b border-[#2a2e39] flex items-center px-4 justify-between bg-[#1e222d]">
                <div className="flex items-center gap-2">
                    <FileText size={16} className="text-purple-400" />
                    <span className="text-sm font-bold text-[#d1d4dc]">Reports</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={fetchReports} className="p-1 hover:bg-[#2a2e39] rounded">
                        <RefreshCw size={14} className={`text-[#787b86] ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={() => setShowCreate(!showCreate)}
                        className="flex items-center gap-1 px-2 py-1 bg-[#2962ff] text-white text-xs rounded"
                    >
                        <Plus size={12} /> Generate
                    </button>
                </div>
            </div>

            {/* Create Form */}
            {showCreate && (
                <div className="p-3 border-b border-[#2a2e39] bg-[#1e222d] space-y-3">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setReportType('performance')}
                            className={`px-3 py-1.5 text-xs rounded ${reportType === 'performance' ? 'bg-[#2962ff] text-white' : 'bg-[#2a2e39] text-[#787b86]'}`}
                        >
                            Performance
                        </button>
                        <button
                            onClick={() => setReportType('audit')}
                            className={`px-3 py-1.5 text-xs rounded ${reportType === 'audit' ? 'bg-[#2962ff] text-white' : 'bg-[#2a2e39] text-[#787b86]'}`}
                        >
                            Audit Trail
                        </button>
                    </div>
                    {reportType === 'performance' && (
                        <input
                            type="text"
                            value={strategyId}
                            onChange={(e) => setStrategyId(e.target.value)}
                            placeholder="Strategy ID"
                            className="w-full bg-[#131722] text-[#d1d4dc] text-xs p-2 rounded border border-[#2a2e39]"
                        />
                    )}
                    <div className="flex gap-2">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="flex-1 bg-[#131722] text-[#d1d4dc] text-xs p-2 rounded border border-[#2a2e39]"
                        />
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="flex-1 bg-[#131722] text-[#d1d4dc] text-xs p-2 rounded border border-[#2a2e39]"
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setShowCreate(false)} className="px-2 py-1 text-xs text-[#787b86]">Cancel</button>
                        <button onClick={createReport} className="px-3 py-1 bg-[#089981] text-white text-xs rounded">Generate Report</button>
                    </div>
                </div>
            )}

            {/* Reports List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {reports.length === 0 ? (
                    <div className="text-center text-[#787b86] text-xs py-8">
                        No reports yet. Click "Generate" to create one.
                    </div>
                ) : (
                    reports.map(report => (
                        <div key={report.report_id} className="bg-[#1e222d] border border-[#2a2e39] rounded p-3 flex items-center justify-between">
                            <div>
                                <div className="font-mono text-xs text-[#d1d4dc]">{report.report_id}</div>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${report.type === 'performance' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                        {report.type}
                                    </span>
                                    <span className="text-[10px] text-[#787b86]">{formatDate(report.generated_at)}</span>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <a
                                    href={`${API_BASE}/reports/${report.report_id}`}
                                    target="_blank"
                                    className="p-1.5 hover:bg-[#2a2e39] rounded text-[#787b86] hover:text-[#d1d4dc]"
                                    title="View JSON"
                                >
                                    <ExternalLink size={14} />
                                </a>
                                <a
                                    href={`${API_BASE}/reports/${report.report_id}/html`}
                                    target="_blank"
                                    className="p-1.5 hover:bg-[#2a2e39] rounded text-[#787b86] hover:text-[#d1d4dc]"
                                    title="Download HTML"
                                >
                                    <Download size={14} />
                                </a>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
