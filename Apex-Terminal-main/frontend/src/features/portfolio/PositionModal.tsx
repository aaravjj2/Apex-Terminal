/**
 * Position Modal (v1.19 + v1.20)
 * Add position to portfolio dialog
 */

import { useState } from 'react';
import { X } from 'lucide-react';
import { API_BASE } from '../../config/api';

interface Portfolio {
  portfolio_id: string;
  name: string;
}

interface PositionModalProps {
  portfolio: Portfolio;
  onClose: () => void;
  onSaved: () => void;
}

export function PositionModal({ portfolio, onClose, onSaved }: PositionModalProps) {
  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [price, setPrice] = useState('0.00');
  const [acquisitionDate, setAcquisitionDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!symbol.trim()) {
      setError('Symbol is required');
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      setError('Quantity must be a positive number');
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      setError('Price must be a non-negative number');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const body = {
        symbol: symbol.trim().toUpperCase(),
        quantity: qty.toString(),
        cost_basis_per_unit: priceNum.toFixed(2),
        acquisition_date: acquisitionDate
      };

      const res = await fetch(`${API_BASE}/api/v1/portfolios/${portfolio.portfolio_id}/positions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP ${res.status}`);
      }

      onSaved();
    } catch (e: any) {
      console.error('Failed to save position:', e);
      setError(e.message || 'Failed to save position');
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
      data-testid="position-modal"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-panel-bg border border-border rounded-lg shadow-lg w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-lg font-semibold text-text">
            Add Position to {portfolio.name}
          </h3>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text"
            data-testid="position-modal-close-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4" data-testid="position-modal-ready">
          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-500 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          {/* Symbol */}
          <div>
            <label className="block text-sm font-medium text-text mb-1">
              Symbol <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="AAPL"
              data-testid="position-symbol-input"
              className="w-full px-3 py-2 bg-element-bg border border-border rounded text-text placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand uppercase"
              autoFocus
            />
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-text mb-1">
              Quantity <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="100"
              step="0.01"
              min="0.01"
              data-testid="position-qty-input"
              className="w-full px-3 py-2 bg-element-bg border border-border rounded text-text placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          {/* Price (Cost Basis) */}
          <div>
            <label className="block text-sm font-medium text-text mb-1">
              Cost Basis (per share) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="150.00"
              step="0.01"
              min="0"
              data-testid="position-price-input"
              className="w-full px-3 py-2 bg-element-bg border border-border rounded text-text placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          {/* Acquisition Date */}
          <div>
            <label className="block text-sm font-medium text-text mb-1">
              Acquisition Date
            </label>
            <input
              type="date"
              value={acquisitionDate}
              onChange={(e) => setAcquisitionDate(e.target.value)}
              data-testid="position-acquisition-date-input"
              className="w-full px-3 py-2 bg-element-bg border border-border rounded text-text focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button
            onClick={onClose}
            disabled={saving}
            data-testid="position-cancel-btn"
            className="px-4 py-2 text-sm bg-element-bg hover:bg-element-bg/80 disabled:opacity-50 text-text rounded border border-border"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            data-testid="position-save-btn"
            className="px-4 py-2 text-sm bg-brand hover:bg-brand/90 disabled:opacity-50 text-white rounded"
          >
            {saving ? 'Saving...' : 'Add Position'}
          </button>
        </div>
      </div>
    </div>
  );
}
