/**
 * Multi-Portfolio Valuation Cards (v1.25)
 *
 * Fetches and renders combined valuation for multiple portfolios
 * using POST /api/v1/portfolios/multi-valuation endpoint.
 */

import { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Briefcase } from 'lucide-react';
import { API_BASE } from '../../config/api';

interface PortfolioValuation {
  portfolio_id: string;
  net_value: number;
  unrealised_pnl: number;
  positions: number;
}

interface MultiValuationData {
  valuations: PortfolioValuation[];
  total_net_value: number;
  total_pnl: number;
}

interface MultiValuationCardsProps {
  portfolioIds: string[];
}

export function MultiValuationCards({ portfolioIds }: MultiValuationCardsProps) {
  const [data, setData] = useState<MultiValuationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (portfolioIds.length === 0) {
      setData(null);
      return;
    }
    fetchValuations();
  }, [portfolioIds.join(',')]);

  const fetchValuations = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/portfolios/multi-valuation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolio_ids: portfolioIds }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.warn('Multi-valuation fetch failed:', e);
      setError('Failed to fetch multi-valuation');
    } finally {
      setLoading(false);
    }
  };

  if (portfolioIds.length === 0) {
    return (
      <div data-testid="multi-valuation-empty" className="text-gray-500 text-sm">
        No portfolios selected
      </div>
    );
  }

  if (loading) {
    return (
      <div data-testid="multi-valuation-loading" className="animate-pulse flex gap-3">
        <div className="h-20 bg-gray-700 rounded flex-1"></div>
        <div className="h-20 bg-gray-700 rounded flex-1"></div>
        <div className="h-20 bg-gray-700 rounded flex-1"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="multi-valuation-error" className="text-red-500 text-sm">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const pnlColor = data.total_pnl >= 0 ? 'text-green-400' : 'text-red-400';

  return (
    <div data-testid="multi-valuation-cards" className="space-y-3">
      {/* Summary Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-800 rounded p-3 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <Briefcase size={14} />
            Portfolios
          </div>
          <div data-testid="multi-valuation-count" className="text-lg font-semibold">
            {data.valuations.length}
          </div>
        </div>

        <div className="bg-gray-800 rounded p-3 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <DollarSign size={14} />
            Total Value
          </div>
          <div data-testid="multi-valuation-total" className="text-lg font-semibold">
            ${data.total_net_value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-gray-800 rounded p-3 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <TrendingUp size={14} />
            Total P&L
          </div>
          <div data-testid="multi-valuation-pnl" className={`text-lg font-semibold ${pnlColor}`}>
            ${data.total_pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Individual Portfolios */}
      {data.valuations.length > 1 && (
        <div data-testid="multi-valuation-breakdown" className="space-y-1">
          {data.valuations.map((v) => (
            <div
              key={v.portfolio_id}
              data-testid={`multi-valuation-row-${v.portfolio_id}`}
              className="flex items-center justify-between text-sm px-2 py-1 bg-gray-800/50 rounded"
            >
              <span className="font-mono text-gray-300">{v.portfolio_id}</span>
              <div className="flex gap-4">
                <span className="text-gray-400">
                  ${v.net_value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
                <span className={v.unrealised_pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                  ${v.unrealised_pnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-gray-500">{v.positions} pos</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
