/**
 * Multi-Portfolio Selector (v1.25)
 *
 * Allows selecting multiple portfolios simultaneously.
 * Used in Risk Desk and Backtest for multi-portfolio analysis.
 *
 * Requirements:
 * - DEMO mode: deterministic default selection (DEMO-PORT-001)
 * - Stable ordering: by portfolio_id ascending
 * - All selectors ONLY use data-testid
 * - "Select All" / "Deselect All" convenience buttons
 */

import { useState, useEffect } from 'react';
import { Wallet, Check } from 'lucide-react';
import { API_BASE } from '../../config/api';

interface Portfolio {
  portfolio_id: string;
  name: string;
  currency: string;
  cash_balance: string;
  content_hash: string | null;
}

interface MultiPortfolioSelectorProps {
  /** Callback when selection changes */
  onSelectionChange: (portfolioIds: string[]) => void;
  /** Currently selected portfolio IDs */
  selectedIds?: string[];
}

export function MultiPortfolioSelector({
  onSelectionChange,
  selectedIds = [],
}: MultiPortfolioSelectorProps) {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    loadPortfolios();
  }, []);

  const loadPortfolios = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/portfolios?sort_by=portfolio_id`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const portfolioList: Portfolio[] = data.portfolios || [];
      setPortfolios(portfolioList);

      // Deterministic default: select DEMO-PORT-001 if nothing selected
      if (selectedIds.length === 0 && portfolioList.length > 0) {
        const defaultId = portfolioList.find(p => p.portfolio_id === 'DEMO-PORT-001')?.portfolio_id
          || portfolioList[0].portfolio_id;
        onSelectionChange([defaultId]);
      }
    } catch (e) {
      console.warn('Failed to load portfolios:', e);
      const demoList: Portfolio[] = [{ portfolio_id: 'DEMO-PORT-001', name: 'Demo Portfolio', currency: 'USD', cash_balance: '100000', content_hash: null }];
      setPortfolios(demoList);
      // Deterministic default: select demo portfolio
      if (selectedIds.length === 0) {
        onSelectionChange(['DEMO-PORT-001']);
      }
    } finally {
      setLoading(false);
    }
  };

  const togglePortfolio = (portfolioId: string) => {
    const isSelected = selectedIds.includes(portfolioId);
    const next = isSelected
      ? selectedIds.filter(id => id !== portfolioId)
      : [...selectedIds, portfolioId].sort(); // Sort for determinism
    onSelectionChange(next);
  };

  const selectAll = () => {
    onSelectionChange(portfolios.map(p => p.portfolio_id).sort());
  };

  const deselectAll = () => {
    onSelectionChange([]);
  };

  if (error) {
    return (
      <div data-testid="multi-portfolio-selector-error" className="text-red-500 text-sm">
        {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div data-testid="multi-portfolio-selector-loading" className="animate-pulse">
        <div className="h-10 bg-gray-700 rounded w-48"></div>
      </div>
    );
  }

  return (
    <div data-testid="multi-portfolio-selector" className="relative">
      {/* Toggle Button */}
      <button
        data-testid="multi-portfolio-toggle"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded border border-gray-600 transition-colors text-sm"
      >
        <Wallet size={16} className="text-blue-400" />
        <span className="font-medium">
          {selectedIds.length === 0
            ? 'Select Portfolios'
            : `${selectedIds.length} portfolio${selectedIds.length > 1 ? 's' : ''} selected`}
        </span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-80 bg-gray-800 border border-gray-600 rounded shadow-lg z-50">
          {/* Actions Row */}
          <div className="flex gap-2 p-2 border-b border-gray-700">
            <button
              data-testid="multi-portfolio-select-all"
              onClick={selectAll}
              className="text-xs text-blue-400 hover:underline"
            >
              Select All
            </button>
            <button
              data-testid="multi-portfolio-deselect-all"
              onClick={deselectAll}
              className="text-xs text-gray-400 hover:underline"
            >
              Deselect All
            </button>
          </div>

          {/* Portfolio List */}
          <div className="max-h-64 overflow-y-auto">
            {portfolios.map((portfolio) => {
              const isSelected = selectedIds.includes(portfolio.portfolio_id);
              return (
                <button
                  key={portfolio.portfolio_id}
                  data-testid={`multi-portfolio-option-${portfolio.portfolio_id}`}
                  onClick={() => togglePortfolio(portfolio.portfolio_id)}
                  className={`w-full text-left px-3 py-2 hover:bg-gray-700 transition-colors border-b border-gray-700 last:border-b-0 flex items-center gap-2 ${
                    isSelected ? 'bg-gray-700/50' : ''
                  }`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                    isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-500'
                  }`}>
                    {isSelected && <Check size={12} className="text-white" />}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{portfolio.name}</div>
                    <div className="text-xs text-gray-400">{portfolio.portfolio_id}</div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {portfolio.currency} {parseFloat(portfolio.cash_balance).toFixed(2)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Summary */}
      {selectedIds.length > 0 && (
        <div data-testid="multi-portfolio-summary" className="mt-2 text-xs text-gray-400">
          <span>Selected: </span>
          <span className="font-mono">{selectedIds.join(', ')}</span>
        </div>
      )}
    </div>
  );
}
