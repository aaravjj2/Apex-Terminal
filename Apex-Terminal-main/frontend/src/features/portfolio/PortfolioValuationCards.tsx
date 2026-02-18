/**
 * Portfolio Valuation Cards (v1.21)
 * 
 * Displays Net Value and Total P&L for an attached portfolio.
 * Fetches valuation from API endpoint using deterministic pricing.
 * 
 * Requirements:
 * - DEMO mode: uses fixture-based pricing (no live market data)
 * - Deterministic: same portfolio → same valuation
 * - Format: $ prefix, 2 decimals
 * - Color-code P&L: green (positive), red (negative), gray (zero)
 * - All selectors ONLY use data-testid
 */

import { useState, useEffect } from 'react';
import { TrendingUp, DollarSign } from 'lucide-react';
import { API_BASE } from '../../config/api';

interface ValuationSnapshot {
  snapshot_id: string;
  portfolio_id: string;
  as_of: string;
  net_value: string;
  pnl_total: string;
  cash_balance: string;
  positions_market_value: string;
  valuation_inputs: {
    pricing_source: string;
    source_checksum: string;
    rounding_policy: string;
    as_of: string;
  };
}

interface PortfolioValuationCardsProps {
  /** Portfolio ID to fetch valuation for */
  portfolioId: string;
}

export function PortfolioValuationCards({ portfolioId }: PortfolioValuationCardsProps) {
  const [valuation, setValuation] = useState<ValuationSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (portfolioId) {
      fetchValuation();
    }
  }, [portfolioId]);

  const fetchValuation = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/portfolios/${portfolioId}/valuation`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Portfolio not found');
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setValuation(data);
    } catch (e) {
      console.warn('Failed to fetch valuation:', e);
      setError(e instanceof Error ? e.message : 'Failed to fetch valuation');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex gap-3">
        <div className="flex-1 animate-pulse">
          <div className="h-20 bg-gray-800 rounded"></div>
        </div>
        <div className="flex-1 animate-pulse">
          <div className="h-20 bg-gray-800 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="portfolio-valuation-error" className="text-red-500 text-sm">
        {error}
      </div>
    );
  }

  if (!valuation) {
    return null;
  }

  const netValue = parseFloat(valuation.net_value);
  const pnlTotal = parseFloat(valuation.pnl_total);

  // Color-code P&L: green (positive), red (negative), gray (zero)
  const pnlColor = pnlTotal > 0 ? 'text-green-400' : pnlTotal < 0 ? 'text-red-400' : 'text-gray-400';
  const pnlSign = pnlTotal > 0 ? '+' : '';

  return (
    <div className="flex gap-3">
      {/* Net Value Card */}
      <div
        data-testid="portfolio-valuation-net"
        className="flex-1 bg-gray-800 rounded border border-gray-700 p-3"
      >
        <div className="flex items-center gap-2 mb-1">
          <DollarSign size={16} className="text-blue-400" />
          <span className="text-xs text-gray-400 font-medium">Net Value</span>
        </div>
        <div className="text-lg font-bold">
          ${netValue.toFixed(2)}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Cash: ${parseFloat(valuation.cash_balance).toFixed(2)} | 
          Positions: ${parseFloat(valuation.positions_market_value).toFixed(2)}
        </div>
      </div>

      {/* Total P&L Card */}
      <div
        data-testid="portfolio-valuation-pnl"
        className="flex-1 bg-gray-800 rounded border border-gray-700 p-3"
      >
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp size={16} className="text-purple-400" />
          <span className="text-xs text-gray-400 font-medium">Total P&L</span>
        </div>
        <div className={`text-lg font-bold ${pnlColor}`}>
          {pnlSign}${Math.abs(pnlTotal).toFixed(2)}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Unrealized • {valuation.valuation_inputs.pricing_source}
        </div>
      </div>
    </div>
  );
}
