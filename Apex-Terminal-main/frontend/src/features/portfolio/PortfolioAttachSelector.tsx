/**
 * Portfolio Attach Selector (v1.21)
 * 
 * Provides a dropdown to attach/select a portfolio in session-only mode.
 * Used in Risk Desk and Backtest panels to associate a portfolio with analysis runs.
 * 
 * Requirements:
 * - DEMO mode: defaults to DEMO-PORT-001 deterministically
 * - Session-only: no persistence, React state only
 * - Stable ordering: by portfolio_id ascending
 * - All selectors ONLY use data-testid
 */

import { useState, useEffect } from 'react';
import { Wallet, ChevronDown } from 'lucide-react';
import { API_BASE } from '../../config/api';

interface Portfolio {
  portfolio_id: string;
  name: string;
  currency: string;
  cash_balance: string;
  content_hash: string | null;
}

interface PortfolioAttachSelectorProps {
  /** Callback when portfolio selection changes */
  onPortfolioChange: (portfolioId: string) => void;
  /** Currently selected portfolio ID */
  currentPortfolioId?: string;
}

export function PortfolioAttachSelector({
  onPortfolioChange,
  currentPortfolioId,
}: PortfolioAttachSelectorProps) {
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
      const portfolioList = data.portfolios || [];
      setPortfolios(portfolioList);

      // Deterministic default: DEMO-PORT-001 if available and no current selection
      if (!currentPortfolioId && portfolioList.length > 0) {
        const defaultPortfolio = portfolioList.find((p: Portfolio) => p.portfolio_id === 'DEMO-PORT-001') || portfolioList[0];
        onPortfolioChange(defaultPortfolio.portfolio_id);
      }
    } catch (e) {
      console.warn('Failed to load portfolios:', e);
      const demoList = [{ portfolio_id: 'DEMO-PORT-001', name: 'Demo Portfolio', currency: 'USD', cash_balance: '100000', content_hash: null }];
      setPortfolios(demoList);
      // Deterministic default
      if (!currentPortfolioId) {
        onPortfolioChange('DEMO-PORT-001');
      }
    } finally {
      setLoading(false);
    }
  };

  const currentPortfolio = portfolios.find(p => p.portfolio_id === currentPortfolioId);

  const handleSelect = (portfolioId: string) => {
    onPortfolioChange(portfolioId);
    setIsOpen(false);
  };

  if (error) {
    return (
      <div data-testid="portfolio-attach-selector-error" className="text-red-500 text-sm">
        {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div data-testid="portfolio-attach-selector-loading" className="animate-pulse">
        <div className="h-10 bg-gray-700 rounded w-48"></div>
      </div>
    );
  }

  return (
    <div data-testid="portfolio-attach-selector" className="relative">
      {/* Current Selection Display */}
      <button
        data-testid="portfolio-attach-current"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded border border-gray-600 transition-colors"
      >
        <Wallet size={16} className="text-blue-400" />
        <span className="text-sm font-medium">
          {currentPortfolio ? currentPortfolio.name : 'Select Portfolio'}
        </span>
        <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-gray-800 border border-gray-600 rounded shadow-lg z-50">
          <div className="max-h-64 overflow-y-auto">
            {portfolios.map((portfolio) => (
              <button
                key={portfolio.portfolio_id}
                data-testid={`portfolio-attach-option-${portfolio.portfolio_id}`}
                onClick={() => handleSelect(portfolio.portfolio_id)}
                className={`w-full text-left px-3 py-2 hover:bg-gray-700 transition-colors border-b border-gray-700 last:border-b-0 ${
                  portfolio.portfolio_id === currentPortfolioId ? 'bg-gray-700' : ''
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-sm font-medium">{portfolio.name}</div>
                    <div className="text-xs text-gray-400">{portfolio.portfolio_id}</div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {portfolio.currency} {parseFloat(portfolio.cash_balance).toFixed(2)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Attached Summary (below selector) */}
      {currentPortfolio && (
        <div data-testid="portfolio-attached-summary" className="mt-2 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <span>Attached:</span>
            <span className="font-mono">{currentPortfolio.portfolio_id}</span>
          </div>
          {currentPortfolio.content_hash && (
            <div data-testid="portfolio-attached-checksum" className="font-mono text-gray-500 truncate">
              {currentPortfolio.content_hash.substring(0, 16)}...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
