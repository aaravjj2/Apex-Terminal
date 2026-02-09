/**
 * TickerDisambiguationDialog
 * ==========================
 * Modal dialog shown when a user enters an ambiguous ticker symbol.
 * Offers two choices: confirm it's a stock ticker, or cancel.
 */

import React from 'react';
import type { AmbiguousEntry } from './disambiguator';

export interface TickerDisambiguationDialogProps {
  /** Whether the dialog is visible */
  open: boolean;
  /** The ambiguous symbol */
  symbol: string;
  /** The ambiguity metadata */
  entry: AmbiguousEntry;
  /** Called when user confirms "yes, I mean the ticker" */
  onConfirm: (symbol: string) => void;
  /** Called when user cancels / dismisses */
  onCancel: () => void;
}

export const TickerDisambiguationDialog: React.FC<TickerDisambiguationDialogProps> = ({
  open,
  symbol,
  entry,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div
      data-testid="ticker-disambiguation-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Ticker disambiguation"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
        data-testid="disambiguation-backdrop"
      />

      {/* Dialog */}
      <div className="relative bg-panel-bg border border-border rounded-lg shadow-xl p-6 max-w-md w-full mx-4 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-yellow-500/15 flex items-center justify-center">
            <span className="text-yellow-500 text-lg font-bold">?</span>
          </div>
          <div>
            <h3 className="text-base font-semibold text-text-primary">
              Did you mean the ticker?
            </h3>
            <p className="text-xs text-text-secondary">Ambiguous symbol detected</p>
          </div>
        </div>

        {/* Body */}
        <div className="bg-element-bg rounded-md p-4 mb-5 border border-border/50">
          <div className="flex items-baseline gap-2 mb-2">
            <span
              className="text-xl font-mono font-bold text-brand"
              data-testid="disambiguation-symbol"
            >
              {symbol}
            </span>
            <span className="text-sm text-text-secondary">— {entry.company}</span>
          </div>
          <p className="text-sm text-text-secondary">
            <strong>Note:</strong> {entry.confusion}
          </p>
          <p className="text-xs text-text-tertiary mt-2">
            Tip: prefix with <code className="bg-background px-1 rounded font-mono">$</code> to skip this prompt (e.g., <code className="bg-background px-1 rounded font-mono">${symbol}</code>)
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            data-testid="disambiguation-confirm"
            onClick={() => onConfirm(symbol)}
            className="flex-1 px-4 py-2 rounded-md bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-panel-bg"
          >
            Yes, use ticker {symbol}
          </button>
          <button
            data-testid="disambiguation-cancel"
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-md bg-element-bg text-text-secondary text-sm font-medium border border-border hover:bg-element-bg/80 transition-colors focus:outline-none focus:ring-2 focus:ring-border"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default TickerDisambiguationDialog;
