import { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Percent, Activity } from 'lucide-react';

interface FundamentalsData {
  symbol: string;
  timestamp: string;
  profitability: {
    roic: string | number;
    gross_margin: string | number;
    operating_margin: string | number;
    net_margin: string | number;
  };
  cash_flow: {
    fcf: string | number;
    fcf_yield: string | number;
    operating_cash_flow: string | number;
  };
  leverage: {
    debt_to_equity: string | number;
    current_ratio: string | number;
    quick_ratio: string | number;
  };
  quality: {
    roe: string | number;
    roa: string | number;
    asset_turnover: string | number;
  };
  valuation: {
    pe_ratio: string | number;
    pb_ratio: string | number;
    ps_ratio: string | number;
  };
  growth: {
    revenue_growth: string | number;
    earnings_growth: string | number;
  };
  additional: {
    market_cap: string | number;
    enterprise_value: string | number;
    shares_outstanding: string | number;
  };
}

interface FundamentalsPanelProps {
  symbol: string;
}

export const FundamentalsPanel = ({ symbol }: FundamentalsPanelProps) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<FundamentalsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFundamentals();
  }, [symbol]);

  const fetchFundamentals = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/v1/fundamentals/${symbol}`);
      if (!response.ok) throw new Error('Failed to fetch fundamentals');
      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Fundamentals fetch error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const formatValue = (value: string | number, suffix: string = ''): string => {
    if (value === 'unavailable' || value === null || value === undefined) {
      return 'N/A';
    }
    if (typeof value === 'number') {
      if (suffix === '%') {
        return `${(value * 100).toFixed(2)}%`;
      }
      if (suffix === 'B') {
        return `$${(value / 1e9).toFixed(2)}B`;
      }
      if (suffix === 'M') {
        return `$${(value / 1e6).toFixed(2)}M`;
      }
      return value.toFixed(2) + suffix;
    }
    return String(value);
  };

  const getValueColor = (value: string | number, higherIsBetter: boolean = true): string => {
    if (value === 'unavailable' || typeof value !== 'number') return 'text-gray-400';
    if (higherIsBetter) {
      return value > 0 ? 'text-green-400' : 'text-red-400';
    } else {
      return value < 0 ? 'text-green-400' : 'text-red-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="text-gray-400 text-sm">Loading fundamentals...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="text-red-400 text-sm">{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="text-gray-400 text-sm">No data available</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Activity className="w-4 h-4" />
          {symbol} Fundamentals
        </h2>
        <button
          onClick={fetchFundamentals}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Profitability */}
        <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
          <h3 className="text-xs font-semibold text-gray-400 mb-3 flex items-center gap-2">
            <DollarSign className="w-3 h-3" />
            PROFITABILITY
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-gray-500">ROIC</div>
              <div className={`text-sm font-mono ${getValueColor(data.profitability.roic)}`}>
                {formatValue(data.profitability.roic, '%')}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Gross Margin</div>
              <div className={`text-sm font-mono ${getValueColor(data.profitability.gross_margin)}`}>
                {formatValue(data.profitability.gross_margin, '%')}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Operating Margin</div>
              <div className={`text-sm font-mono ${getValueColor(data.profitability.operating_margin)}`}>
                {formatValue(data.profitability.operating_margin, '%')}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Net Margin</div>
              <div className={`text-sm font-mono ${getValueColor(data.profitability.net_margin)}`}>
                {formatValue(data.profitability.net_margin, '%')}
              </div>
            </div>
          </div>
        </div>

        {/* Cash Flow */}
        <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
          <h3 className="text-xs font-semibold text-gray-400 mb-3 flex items-center gap-2">
            <TrendingUp className="w-3 h-3" />
            CASH FLOW
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-gray-500">Free Cash Flow</div>
              <div className={`text-sm font-mono ${getValueColor(data.cash_flow.fcf)}`}>
                {formatValue(data.cash_flow.fcf, 'B')}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">FCF Yield</div>
              <div className={`text-sm font-mono ${getValueColor(data.cash_flow.fcf_yield)}`}>
                {formatValue(data.cash_flow.fcf_yield, '%')}
              </div>
            </div>
            <div className="col-span-2">
              <div className="text-xs text-gray-500">Operating Cash Flow</div>
              <div className={`text-sm font-mono ${getValueColor(data.cash_flow.operating_cash_flow)}`}>
                {formatValue(data.cash_flow.operating_cash_flow, 'B')}
              </div>
            </div>
          </div>
        </div>

        {/* Leverage */}
        <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
          <h3 className="text-xs font-semibold text-gray-400 mb-3 flex items-center gap-2">
            <Percent className="w-3 h-3" />
            LEVERAGE
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-gray-500">Debt/Equity</div>
              <div className={`text-sm font-mono ${getValueColor(data.leverage.debt_to_equity, false)}`}>
                {formatValue(data.leverage.debt_to_equity)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Current Ratio</div>
              <div className={`text-sm font-mono ${getValueColor(data.leverage.current_ratio)}`}>
                {formatValue(data.leverage.current_ratio)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Quick Ratio</div>
              <div className={`text-sm font-mono ${getValueColor(data.leverage.quick_ratio)}`}>
                {formatValue(data.leverage.quick_ratio)}
              </div>
            </div>
          </div>
        </div>

        {/* Quality */}
        <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
          <h3 className="text-xs font-semibold text-gray-400 mb-3">QUALITY</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-gray-500">ROE</div>
              <div className={`text-sm font-mono ${getValueColor(data.quality.roe)}`}>
                {formatValue(data.quality.roe, '%')}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">ROA</div>
              <div className={`text-sm font-mono ${getValueColor(data.quality.roa)}`}>
                {formatValue(data.quality.roa, '%')}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Asset Turnover</div>
              <div className={`text-sm font-mono ${getValueColor(data.quality.asset_turnover)}`}>
                {formatValue(data.quality.asset_turnover)}
              </div>
            </div>
          </div>
        </div>

        {/* Valuation */}
        <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
          <h3 className="text-xs font-semibold text-gray-400 mb-3">VALUATION</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-xs text-gray-500">P/E</div>
              <div className="text-sm font-mono text-gray-200">
                {formatValue(data.valuation.pe_ratio)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">P/B</div>
              <div className="text-sm font-mono text-gray-200">
                {formatValue(data.valuation.pb_ratio)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">P/S</div>
              <div className="text-sm font-mono text-gray-200">
                {formatValue(data.valuation.ps_ratio)}
              </div>
            </div>
          </div>
        </div>

        {/* Growth */}
        <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
          <h3 className="text-xs font-semibold text-gray-400 mb-3 flex items-center gap-2">
            <TrendingUp className="w-3 h-3" />
            GROWTH
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-gray-500">Revenue Growth</div>
              <div className={`text-sm font-mono ${getValueColor(data.growth.revenue_growth)}`}>
                {formatValue(data.growth.revenue_growth, '%')}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Earnings Growth</div>
              <div className={`text-sm font-mono ${getValueColor(data.growth.earnings_growth)}`}>
                {formatValue(data.growth.earnings_growth, '%')}
              </div>
            </div>
          </div>
        </div>

        {/* Additional */}
        <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
          <h3 className="text-xs font-semibold text-gray-400 mb-3">ADDITIONAL</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs text-gray-500">Market Cap</span>
              <span className="text-sm font-mono text-gray-200">
                {formatValue(data.additional.market_cap, 'B')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-gray-500">Enterprise Value</span>
              <span className="text-sm font-mono text-gray-200">
                {formatValue(data.additional.enterprise_value, 'B')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-gray-500">Shares Outstanding</span>
              <span className="text-sm font-mono text-gray-200">
                {formatValue(data.additional.shares_outstanding, 'M')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
