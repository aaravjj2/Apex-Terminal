/**
 * useReporting — React hook wiring lib/reporting → PortfolioUI2, BacktestEngineUI2, RiskDashboardUI2
 *
 * Provides: report generation (CSV, PDF, Excel, JSON), scheduled reports,
 * compliance snapshots, performance tear sheets, risk executive summaries,
 * backtest reports, audit logs.
 */
import { useState, useCallback, useMemo } from 'react';
// ── Lib stubs (self-contained mode) ──
type CSVConfig = any;
type PDFConfig = any;
type ExcelConfig = any;
type ScheduleConfig = any;
type ReportMetadata = any;
const CSVExporter = class { constructor(..._a: any[]) {} } as any;
const PDFGenerator = class { constructor(..._a: any[]) {} } as any;
const ExcelExporter = class { constructor(..._a: any[]) {} } as any;
const ReportScheduler = class { constructor(..._a: any[]) {} } as any;


// ── Types ────────────────────────────────────────────────────────────────────

export type ReportFormat = 'csv' | 'pdf' | 'excel' | 'json' | 'html';
export type ReportType =
  | 'portfolio_summary' | 'performance_tearsheet' | 'risk_report'
  | 'backtest_report' | 'trade_log' | 'compliance_snapshot'
  | 'tax_report' | 'attribution_report' | 'position_report'
  | 'pnl_report' | 'exposure_report' | 'transaction_history'
  | 'custom';
export type ReportStatus = 'pending' | 'generating' | 'completed' | 'failed' | 'scheduled';

export interface ReportConfig {
  id: string;
  name: string;
  type: ReportType;
  format: ReportFormat;
  dateRange: { from: string; to: string };
  filters: Record<string, any>;
  sections: string[];
  includeCharts: boolean;
  includeRawData: boolean;
  template?: string;
  footer?: string;
  watermark?: string;
}

export interface GeneratedReport {
  id: string;
  config: ReportConfig;
  status: ReportStatus;
  createdAt: number;
  completedAt?: number;
  fileSize?: number;
  fileName: string;
  downloadUrl?: string;
  error?: string;
  pages?: number;
  rows?: number;
}

export interface ScheduledReport {
  id: string;
  config: ReportConfig;
  schedule: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    time: string;          // HH:mm
    dayOfWeek?: number;    // 0-6
    dayOfMonth?: number;   // 1-31
    timezone: string;
  };
  enabled: boolean;
  lastRun?: number;
  nextRun: number;
  recipients: string[];
}

export interface ReportTemplate {
  id: string;
  name: string;
  type: ReportType;
  description: string;
  defaultSections: string[];
  defaultFormat: ReportFormat;
  isSystem: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  action: string;
  user: string;
  details: string;
  reportId?: string;
}

export interface ReportingState {
  /** Generated reports */
  reports: GeneratedReport[];
  /** Scheduled reports */
  scheduled: ScheduledReport[];
  /** Templates */
  templates: ReportTemplate[];
  /** Audit log */
  auditLog: AuditLogEntry[];
  /** Currently generating */
  isGenerating: boolean;
  /** Active report config */
  activeConfig: ReportConfig | null;
  /** Report count */
  reportCount: number;
  /** Total storage used */
  storageUsed: number;
  /** Storage limit */
  storageLimit: number;
}

export interface ReportingActions {
  // ── Report Generation ────
  createReport: (config: Partial<ReportConfig>) => string;
  generateReport: (id: string) => void;
  cancelGeneration: (id: string) => void;
  deleteReport: (id: string) => void;
  downloadReport: (id: string) => void;
  duplicateReport: (id: string) => string;

  // ── Quick Reports ────
  generatePortfolioSummary: (dateRange?: { from: string; to: string }) => string;
  generatePerformanceTearsheet: (dateRange?: { from: string; to: string }) => string;
  generateRiskReport: () => string;
  generateBacktestReport: (backtestId?: string) => string;
  generateTradeLog: (dateRange?: { from: string; to: string }) => string;
  generateComplianceSnapshot: () => string;
  generateTaxReport: (year?: number) => string;
  generateExposureReport: () => string;

  // ── Scheduling ────
  scheduleReport: (config: ReportConfig, schedule: ScheduledReport['schedule'], recipients: string[]) => string;
  updateSchedule: (id: string, patch: Partial<ScheduledReport>) => void;
  deleteScheduledReport: (id: string) => void;
  toggleSchedule: (id: string) => void;
  runScheduledNow: (id: string) => void;

  // ── Templates ────
  createTemplate: (template: Omit<ReportTemplate, 'id' | 'isSystem'>) => string;
  deleteTemplate: (id: string) => void;
  applyTemplate: (templateId: string) => void;

  // ── Config ────
  setActiveConfig: (config: ReportConfig | null) => void;
  updateActiveConfig: (patch: Partial<ReportConfig>) => void;

  // ── Audit ────
  getAuditLog: (reportId?: string) => AuditLogEntry[];
  clearAuditLog: () => void;

  // ── Export ────
  exportAllData: (format: ReportFormat) => void;
}

// ── Data ─────────────────────────────────────────────────────────────────────

let reportCounter = 0;
function newId(prefix: string) { return `${prefix}_${++reportCounter}_${Date.now().toString(36)}`; }

const DEFAULT_TEMPLATES: ReportTemplate[] = [
  { id: 'tpl_portfolio', name: 'Portfolio Summary', type: 'portfolio_summary', description: 'Complete portfolio overview with allocations, P&L, and performance metrics', defaultSections: ['overview', 'allocations', 'positions', 'performance', 'risk'], defaultFormat: 'pdf', isSystem: true },
  { id: 'tpl_tearsheet', name: 'Performance Tearsheet', type: 'performance_tearsheet', description: 'Quantitative performance analysis with return/risk statistics', defaultSections: ['returns', 'drawdowns', 'ratios', 'distribution', 'monthly_table', 'benchmark'], defaultFormat: 'pdf', isSystem: true },
  { id: 'tpl_risk', name: 'Risk Report', type: 'risk_report', description: 'Comprehensive risk analysis including VaR, stress tests, and limits', defaultSections: ['var', 'stress', 'concentration', 'factor', 'limits', 'tail_risk'], defaultFormat: 'pdf', isSystem: true },
  { id: 'tpl_backtest', name: 'Backtest Report', type: 'backtest_report', description: 'Full backtest results with equity curve, trades, and statistics', defaultSections: ['strategy', 'equity', 'trades', 'statistics', 'monthly', 'drawdowns', 'optimization'], defaultFormat: 'pdf', isSystem: true },
  { id: 'tpl_tradelog', name: 'Trade Log', type: 'trade_log', description: 'Detailed trade-by-trade log with execution details', defaultSections: ['trades', 'summary', 'by_symbol', 'by_side'], defaultFormat: 'csv', isSystem: true },
  { id: 'tpl_compliance', name: 'Compliance Snapshot', type: 'compliance_snapshot', description: 'Regulatory compliance check with limit breaches and exposures', defaultSections: ['limits', 'breaches', 'exposure', 'concentration', 'restricted'], defaultFormat: 'pdf', isSystem: true },
  { id: 'tpl_tax', name: 'Tax Report', type: 'tax_report', description: 'Capital gains/losses for tax reporting purposes', defaultSections: ['gains_losses', 'wash_sales', 'dividends', 'interest', 'summary'], defaultFormat: 'excel', isSystem: true },
  { id: 'tpl_attribution', name: 'Attribution Report', type: 'attribution_report', description: 'Performance attribution by sector, factor, and strategy', defaultSections: ['sector', 'factor', 'security', 'interaction', 'residual'], defaultFormat: 'pdf', isSystem: true },
  { id: 'tpl_position', name: 'Position Report', type: 'position_report', description: 'Current positions with market values and unrealized P&L', defaultSections: ['positions', 'allocations', 'exposure', 'hedges'], defaultFormat: 'excel', isSystem: true },
  { id: 'tpl_pnl', name: 'P&L Report', type: 'pnl_report', description: 'Profit and loss breakdown by period, strategy, and asset', defaultSections: ['daily', 'weekly', 'monthly', 'by_strategy', 'by_asset'], defaultFormat: 'excel', isSystem: true },
  { id: 'tpl_exposure', name: 'Exposure Report', type: 'exposure_report', description: 'Net and gross exposure by country, sector, and currency', defaultSections: ['gross', 'net', 'country', 'sector', 'currency', 'factor'], defaultFormat: 'pdf', isSystem: true },
  { id: 'tpl_txn', name: 'Transaction History', type: 'transaction_history', description: 'Full transaction history with fees and settlement details', defaultSections: ['transactions', 'fees', 'settlement', 'reconciliation'], defaultFormat: 'csv', isSystem: true },
];

const emptyConfig = (type: ReportType, format: ReportFormat = 'pdf'): ReportConfig => ({
  id: newId('cfg'),
  name: '',
  type,
  format,
  dateRange: {
    from: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
  },
  filters: {},
  sections: DEFAULT_TEMPLATES.find(t => t.type === type)?.defaultSections || [],
  includeCharts: true,
  includeRawData: false,
});

function simulateGeneration(report: GeneratedReport): GeneratedReport {
  const pages = Math.floor(5 + Math.random() * 30);
  const rows = Math.floor(100 + Math.random() * 5000);
  const fileSize = Math.floor(50000 + Math.random() * 2000000);
  return {
    ...report,
    status: 'completed',
    completedAt: Date.now(),
    fileSize,
    pages: report.config.format === 'csv' ? undefined : pages,
    rows,
    downloadUrl: `/reports/${report.fileName}`,
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

const INITIAL_STATE: ReportingState = {
  reports: [],
  scheduled: [],
  templates: DEFAULT_TEMPLATES,
  auditLog: [],
  isGenerating: false,
  activeConfig: null,
  reportCount: 0,
  storageUsed: 0,
  storageLimit: 500 * 1024 * 1024, // 500 MB
};

export function useReporting(): [ReportingState, ReportingActions] {
  const [state, setState] = useState<ReportingState>(INITIAL_STATE);

  const addAudit = useCallback((action: string, details: string, reportId?: string) => {
    const entry: AuditLogEntry = {
      id: newId('audit'),
      timestamp: Date.now(),
      action,
      user: 'system',
      details,
      reportId,
    };
    setState(prev => ({ ...prev, auditLog: [entry, ...prev.auditLog].slice(0, 500) }));
  }, []);

  // Report Generation
  const createReport = useCallback((config: Partial<ReportConfig>): string => {
    const id = newId('rpt');
    const tpl = config.type ? DEFAULT_TEMPLATES.find(t => t.type === config.type) : null;
    const fullConfig: ReportConfig = {
      ...emptyConfig(config.type || 'portfolio_summary', config.format || tpl?.defaultFormat || 'pdf'),
      ...config,
      id,
      name: config.name || (tpl?.name || 'Custom Report') + ` ${new Date().toLocaleDateString()}`,
    };
    const ext = fullConfig.format === 'excel' ? 'xlsx' : fullConfig.format;
    const report: GeneratedReport = {
      id,
      config: fullConfig,
      status: 'pending',
      createdAt: Date.now(),
      fileName: `${fullConfig.type}_${id}.${ext}`,
    };
    setState(prev => ({
      ...prev,
      reports: [report, ...prev.reports],
      reportCount: prev.reportCount + 1,
      activeConfig: fullConfig,
    }));
    addAudit('create', `Created report: ${fullConfig.name}`, id);
    return id;
  }, [addAudit]);

  const generateReport = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      reports: prev.reports.map(r => r.id === id ? { ...r, status: 'generating' as ReportStatus } : r),
      isGenerating: true,
    }));
    // Simulate async generation
    setTimeout(() => {
      setState(prev => {
        const report = prev.reports.find(r => r.id === id);
        if (!report) return prev;
        const completed = simulateGeneration(report);
        return {
          ...prev,
          reports: prev.reports.map(r => r.id === id ? completed : r),
          isGenerating: false,
          storageUsed: prev.storageUsed + (completed.fileSize || 0),
        };
      });
    }, 500 + Math.random() * 1500);
    addAudit('generate', `Started generating report: ${id}`, id);
  }, [addAudit]);

  const cancelGeneration = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      reports: prev.reports.map(r => r.id === id && r.status === 'generating' ? { ...r, status: 'failed' as ReportStatus, error: 'Cancelled' } : r),
      isGenerating: false,
    }));
  }, []);

  const deleteReport = useCallback((id: string) => {
    setState(prev => {
      const report = prev.reports.find(r => r.id === id);
      return {
        ...prev,
        reports: prev.reports.filter(r => r.id !== id),
        storageUsed: Math.max(0, prev.storageUsed - (report?.fileSize || 0)),
      };
    });
    addAudit('delete', `Deleted report: ${id}`, id);
  }, [addAudit]);

  const downloadReport = useCallback((id: string) => {
    addAudit('download', `Downloaded report: ${id}`, id);
  }, [addAudit]);

  const duplicateReport = useCallback((id: string): string => {
    const original = state.reports.find(r => r.id === id);
    if (!original) return '';
    return createReport({ ...original.config, name: `${original.config.name} (Copy)` });
  }, [state.reports, createReport]);

  // Quick reports
  const quickReport = useCallback((type: ReportType, dateRange?: { from: string; to: string }, extra?: Record<string, any>): string => {
    const tpl = DEFAULT_TEMPLATES.find(t => t.type === type);
    const id = createReport({
      type,
      format: tpl?.defaultFormat || 'pdf',
      name: `${tpl?.name || type} - ${new Date().toLocaleDateString()}`,
      sections: tpl?.defaultSections || [],
      dateRange: dateRange || emptyConfig(type).dateRange,
      ...extra,
    });
    generateReport(id);
    return id;
  }, [createReport, generateReport]);

  const generatePortfolioSummary = useCallback((dr?: { from: string; to: string }) => quickReport('portfolio_summary', dr), [quickReport]);
  const generatePerformanceTearsheet = useCallback((dr?: { from: string; to: string }) => quickReport('performance_tearsheet', dr), [quickReport]);
  const generateRiskReport = useCallback(() => quickReport('risk_report'), [quickReport]);
  const generateBacktestReport = useCallback((backtestId?: string) => quickReport('backtest_report', undefined, backtestId ? { filters: { backtestId } } : {}), [quickReport]);
  const generateTradeLog = useCallback((dr?: { from: string; to: string }) => quickReport('trade_log', dr), [quickReport]);
  const generateComplianceSnapshot = useCallback(() => quickReport('compliance_snapshot'), [quickReport]);
  const generateTaxReport = useCallback((year?: number) => quickReport('tax_report', year ? { from: `${year}-01-01`, to: `${year}-12-31` } : undefined), [quickReport]);
  const generateExposureReport = useCallback(() => quickReport('exposure_report'), [quickReport]);

  // Scheduling
  const scheduleReport = useCallback((config: ReportConfig, schedule: ScheduledReport['schedule'], recipients: string[]): string => {
    const id = newId('sched');
    const nextRun = Date.now() + 86400000;
    const scheduled: ScheduledReport = { id, config, schedule, enabled: true, nextRun, recipients };
    setState(prev => ({ ...prev, scheduled: [...prev.scheduled, scheduled] }));
    addAudit('schedule', `Scheduled report: ${config.name} (${schedule.frequency})`);
    return id;
  }, [addAudit]);

  const updateSchedule = useCallback((id: string, patch: Partial<ScheduledReport>) => {
    setState(prev => ({ ...prev, scheduled: prev.scheduled.map(s => s.id === id ? { ...s, ...patch } : s) }));
  }, []);

  const deleteScheduledReport = useCallback((id: string) => {
    setState(prev => ({ ...prev, scheduled: prev.scheduled.filter(s => s.id !== id) }));
    addAudit('delete_schedule', `Deleted scheduled report: ${id}`);
  }, [addAudit]);

  const toggleSchedule = useCallback((id: string) => {
    setState(prev => ({ ...prev, scheduled: prev.scheduled.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s) }));
  }, []);

  const runScheduledNow = useCallback((id: string) => {
    const sched = state.scheduled.find(s => s.id === id);
    if (sched) quickReport(sched.config.type);
  }, [state.scheduled, quickReport]);

  // Templates
  const createTemplate = useCallback((template: Omit<ReportTemplate, 'id' | 'isSystem'>): string => {
    const id = newId('tpl');
    setState(prev => ({ ...prev, templates: [...prev.templates, { ...template, id, isSystem: false }] }));
    return id;
  }, []);

  const deleteTemplate = useCallback((id: string) => {
    setState(prev => ({ ...prev, templates: prev.templates.filter(t => t.id !== id || t.isSystem) }));
  }, []);

  const applyTemplate = useCallback((templateId: string) => {
    const tpl = state.templates.find(t => t.id === templateId);
    if (!tpl) return;
    setState(prev => ({ ...prev, activeConfig: emptyConfig(tpl.type, tpl.defaultFormat) }));
  }, [state.templates]);

  // Config
  const setActiveConfig = useCallback((config: ReportConfig | null) => {
    setState(prev => ({ ...prev, activeConfig: config }));
  }, []);

  const updateActiveConfig = useCallback((patch: Partial<ReportConfig>) => {
    setState(prev => prev.activeConfig ? { ...prev, activeConfig: { ...prev.activeConfig, ...patch } } : prev);
  }, []);

  // Audit
  const getAuditLog = useCallback((reportId?: string): AuditLogEntry[] => {
    return reportId ? state.auditLog.filter(e => e.reportId === reportId) : state.auditLog;
  }, [state.auditLog]);

  const clearAuditLog = useCallback(() => {
    setState(prev => ({ ...prev, auditLog: [] }));
  }, []);

  // Export All
  const exportAllData = useCallback((format: ReportFormat) => {
    addAudit('export_all', `Exported all data as ${format}`);
  }, [addAudit]);

  const actions: ReportingActions = useMemo(() => ({
    createReport, generateReport, cancelGeneration, deleteReport, downloadReport, duplicateReport,
    generatePortfolioSummary, generatePerformanceTearsheet, generateRiskReport, generateBacktestReport,
    generateTradeLog, generateComplianceSnapshot, generateTaxReport, generateExposureReport,
    scheduleReport, updateSchedule, deleteScheduledReport, toggleSchedule, runScheduledNow,
    createTemplate, deleteTemplate, applyTemplate,
    setActiveConfig, updateActiveConfig,
    getAuditLog, clearAuditLog,
    exportAllData,
  }), [
    createReport, generateReport, cancelGeneration, deleteReport, downloadReport, duplicateReport,
    generatePortfolioSummary, generatePerformanceTearsheet, generateRiskReport, generateBacktestReport,
    generateTradeLog, generateComplianceSnapshot, generateTaxReport, generateExposureReport,
    scheduleReport, updateSchedule, deleteScheduledReport, toggleSchedule, runScheduledNow,
    createTemplate, deleteTemplate, applyTemplate,
    setActiveConfig, updateActiveConfig,
    getAuditLog, clearAuditLog,
    exportAllData,
  ]);

  return [state, actions];
}
