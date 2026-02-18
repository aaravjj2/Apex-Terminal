import { useState } from 'react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import {
    FileText, Download, Calendar, Filter,
    TrendingUp, BarChart3, PieChart
} from 'lucide-react';
import { Button } from '../../../ui/Button';
import { Badge } from '../../../ui/Badge';
import { IconButton } from '../../../ui/IconButton';
import { EmptyState } from '../../../ui/EmptyState';
import { cn } from '../../../ui/utils';

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

export function ReportsView() {
    const [selectedId, setSelectedId] = useState<string | null>('r1');
    const selectedReport = mockReports.find(r => r.id === selectedId) || null;

    return (
        <div className="h-full bg-background" data-testid="reports-view">
            <PanelGroup orientation="horizontal">
                <Panel defaultSize={30} minSize={20} maxSize={40}>
                    <ReportsList
                        reports={mockReports}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                    />
                </Panel>
                <PanelResizeHandle className="w-1 bg-border hover:bg-brand transition-colors cursor-col-resize" />
                <Panel defaultSize={70} minSize={40}>
                    <ReportPreview report={selectedReport} />
                </Panel>
            </PanelGroup>
        </div>
    );
}
