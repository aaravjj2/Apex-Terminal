/**
 * Options Feature Main Dashboard Component
 */

import React, { useEffect, useState } from 'react';
import { useOptionsStore } from './store';
import { useTickerInput } from '../ticker/useTickerInput';
import { TickerDisambiguationDialog } from '../ticker/TickerDisambiguationDialog';
import {
  IVAnalyticsPanel,
  PutCallRatioPanel,
  PayoffChart,
  StrategyMetrics,
  PositionGreeksPanel,
} from './components';
import type { StrategyAnalysis } from './types';

interface OptionsDashboardProps {
  symbol?: string;
  className?: string;
}

export const OptionsDashboard: React.FC<OptionsDashboardProps> = ({
  symbol: initialSymbol,
  className = '',
}) => {
  const {
    symbol,
    fetchAll,
    chain,
    selectedExpiration,
    setSelectedExpiration,
    strategyTemplates,
    loadStrategyTemplates,
  } = useOptionsStore();

  const [strategy] = useState<StrategyAnalysis | null>(null);

  // Ticker disambiguation
  const tickerInput = useTickerInput({
    initialValue: initialSymbol || '',
    onResolved: (resolvedSymbol) => fetchAll(resolvedSymbol),
    watchlist: [],
  });

  // Load templates on mount
  useEffect(() => {
    loadStrategyTemplates();
  }, [loadStrategyTemplates]);

  // Load data when initial symbol provided
  useEffect(() => {
    if (initialSymbol && initialSymbol !== symbol) {
      tickerInput.onChange(initialSymbol);
      fetchAll(initialSymbol);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSymbol]);

  const handleSymbolSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    tickerInput.submit();
  };

  return (
    <div className={`bg-gray-900 text-white p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">Options Analytics</h2>
        <form onSubmit={handleSymbolSubmit} className="flex gap-2">
          <input
            type="text"
            value={tickerInput.value}
            onChange={(e) => tickerInput.onChange(e.target.value)}
            placeholder="Symbol (e.g., AAPL)"
            className="bg-gray-800 border border-gray-600 rounded px-3 py-1 text-sm w-32"
            data-testid="analytics-symbol-input"
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm"
          >
            Load
          </button>
        </form>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* IV Analytics */}
        <IVAnalyticsPanel />

        {/* Put/Call Ratio */}
        <PutCallRatioPanel />

        {/* Quick Actions */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Strategy Templates ({strategyTemplates.length})</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
            {strategyTemplates.map((template) => (
              <button
                key={template.name}
                onClick={() => {
                  // For now, just log - can be extended to build each strategy
                  console.log('Selected template:', template.name);
                }}
                disabled={!chain}
                className="w-full bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 
                           px-3 py-2 rounded text-sm transition text-left"
              >
                <div className="font-medium">{template.name}</div>
                <div className="text-xs text-gray-400 truncate">{template.description}</div>
              </button>
            ))}
            {strategyTemplates.length === 0 && (
              <div className="text-xs text-gray-500 italic">Loading templates...</div>
            )}
          </div>

          {chain && (
            <div className="mt-4 pt-3 border-t border-gray-700">
              <div className="text-xs text-gray-400 space-y-1">
                <div>Underlying: ${chain.underlyingPrice.toFixed(2)}</div>
                <div>Contracts: {chain.totalContracts}</div>
                <div>Expirations: {chain.expirations.length}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Strategy Analysis Section */}
      {strategy && (
        <div className="mt-4 bg-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">
            {strategy.name} Analysis
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <PayoffChart strategy={strategy} width={400} height={250} />
              <div className="mt-2 flex gap-4 text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-green-500"></span> Expiration
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-blue-500"></span> Theoretical
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-yellow-500"></span> Breakeven
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <StrategyMetrics strategy={strategy} />
              <PositionGreeksPanel strategy={strategy} />
            </div>
          </div>
        </div>
      )}

      {/* Expiration Selector */}
      {chain && chain.expirations.length > 0 && (
        <div className="mt-4">
          <label className="text-xs text-gray-400 block mb-1">Expiration</label>
          <select
            value={selectedExpiration || ''}
            onChange={(e) => setSelectedExpiration(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded px-3 py-1 text-sm"
          >
            {chain.expirations.map(exp => (
              <option key={exp} value={exp}>{exp}</option>
            ))}
          </select>
        </div>
      )}

      {/* Ticker Disambiguation Dialog */}
      <TickerDisambiguationDialog {...tickerInput.dialogProps} />
    </div>
  );
};

export default OptionsDashboard;
