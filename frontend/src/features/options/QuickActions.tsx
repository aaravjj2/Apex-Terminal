/**
 * Quick Actions Strip - Contextual actions for Options workstation
 * Appears in Options header (NOT in global navigation)
 */

import { useState } from 'react';
import { Play, Download, AlertCircle } from 'lucide-react';

interface QuickActionsProps {
  onStartDemo?: () => void;
  onRunBacktest?: () => void;
  onExportLastRun?: () => void;
}

export function QuickActions({ onStartDemo, onRunBacktest, onExportLastRun }: QuickActionsProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!onExportLastRun) return;
    
    setIsExporting(true);
    try {
      await onExportLastRun();
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div 
      className="flex items-center gap-2 border-l border-border pl-4"
      data-testid="quick-actions-strip"
    >
      <span className="text-xs text-text-muted font-medium uppercase tracking-wider">Quick Actions</span>
      
      <button
        onClick={onStartDemo}
        data-testid="quick-action-start-demo"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-brand/10 hover:bg-brand/20 text-brand rounded transition-colors"
        title="Start Demo (Risk Desk)"
      >
        <Play size={14} />
        Start Demo
      </button>

      <button
        onClick={onRunBacktest}
        data-testid="quick-action-run-backtest"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-element-bg hover:bg-element-bg/80 text-text-secondary hover:text-text border border-border rounded transition-colors"
        title="Run Backtest (last used config)"
      >
        <AlertCircle size={14} />
        Run Backtest
      </button>

      <button
        onClick={handleExport}
        disabled={isExporting}
        data-testid="quick-action-export-bundle"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-element-bg hover:bg-element-bg/80 text-text-secondary hover:text-text border border-border rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Export Last Run Bundle"
      >
        <Download size={14} />
        {isExporting ? 'Exporting...' : 'Export Bundle'}
      </button>
    </div>
  );
}
