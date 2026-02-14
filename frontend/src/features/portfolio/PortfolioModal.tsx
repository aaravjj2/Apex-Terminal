/**
 * Portfolio Modal (v1.19 + v1.20)
 * Create and edit portfolio dialog
 */

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface Portfolio {
  portfolio_id: string;
  name: string;
  currency: string;
  cash_balance: string;
}

interface PortfolioModalProps {
  portfolio?: Portfolio | null;
  onClose: () => void;
  onSaved: () => void;
}

export function PortfolioModal({ portfolio, onClose, onSaved }: PortfolioModalProps) {
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [cashBalance, setCashBalance] = useState('0.00');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditMode = !!portfolio;

  useEffect(() => {
    if (portfolio) {
      setName(portfolio.name);
      setCurrency(portfolio.currency);
      setCashBalance(portfolio.cash_balance);
    }
  }, [portfolio]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Portfolio name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const body = {
        name: name.trim(),
        currency,
        cash_balance: parseFloat(cashBalance).toFixed(2)
      };

      const url = isEditMode
        ? `/api/v1/portfolios/${portfolio.portfolio_id}`
        : '/api/v1/portfolios';

      const method = isEditMode ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP ${res.status}`);
      }

      onSaved();
    } catch (e: any) {
      console.error('Failed to save portfolio:', e);
      setError(e.message || 'Failed to save portfolio');
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      data-testid="portfolio-modal"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-panel-bg border border-border rounded-lg shadow-lg w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-lg font-semibold text-text">
            {isEditMode ? 'Edit Portfolio' : 'Create Portfolio'}
          </h3>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text"
            data-testid="portfolio-modal-close-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4" data-testid="portfolio-modal-ready">
          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-500 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-text mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Portfolio"
              data-testid="portfolio-name-input"
              className="w-full px-3 py-2 bg-element-bg border border-border rounded text-text placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand"
              autoFocus
            />
          </div>

          {/* Currency */}
          <div>
            <label className="block text-sm font-medium text-text mb-1">
              Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              data-testid="portfolio-currency-input"
              className="w-full px-3 py-2 bg-element-bg border border-border rounded text-text focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="CAD">CAD</option>
              <option value="JPY">JPY</option>
            </select>
          </div>

          {/* Cash Balance */}
          {!isEditMode && (
            <div>
              <label className="block text-sm font-medium text-text mb-1">
                Initial Cash Balance
              </label>
              <input
                type="number"
                value={cashBalance}
                onChange={(e) => setCashBalance(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                data-testid="portfolio-initial-cash-input"
                className="w-full px-3 py-2 bg-element-bg border border-border rounded text-text placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button
            onClick={onClose}
            disabled={saving}
            data-testid="portfolio-cancel-btn"
            className="px-4 py-2 text-sm bg-element-bg hover:bg-element-bg/80 disabled:opacity-50 text-text rounded border border-border"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            data-testid="portfolio-save-btn"
            className="px-4 py-2 text-sm bg-brand hover:bg-brand/90 disabled:opacity-50 text-white rounded"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
