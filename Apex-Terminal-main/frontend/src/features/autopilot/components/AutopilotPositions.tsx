/**
 * Autopilot Positions Component
 * Position ledger with Greeks and P&L
 */

import React, { useEffect, useState } from 'react';
import { useAutopilotStore } from '../store';
import type { AutopilotPosition } from '../types';

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
};

const formatPercent = (value: number): string => {
  return `${(value * 100).toFixed(1)}%`;
};

interface PositionRowProps {
  position: AutopilotPosition;
  expanded: boolean;
  onToggle: () => void;
  onClose: (symbol: string) => void;
}

const PositionRow: React.FC<PositionRowProps> = ({ position, expanded, onToggle, onClose }) => {
  const pnlClass = position.unrealized_pnl >= 0 ? 'text-green-400' : 'text-red-400';
  const statusColors: Record<string, string> = {
    open: 'bg-green-600',
    closed: 'bg-gray-600',
    pending: 'bg-yellow-600',
    expired: 'bg-purple-600',
  };

  return (
    <>
      <tr
        className="border-b border-gray-700 hover:bg-gray-750 cursor-pointer"
        onClick={onToggle}
        data-testid={`position-row-${position.position_id}`}
      >
        <td className="px-4 py-3">
          <button className="text-gray-400 hover:text-white">
            {expanded ? '▼' : '▶'}
          </button>
        </td>
        <td className="px-4 py-3 font-mono font-bold">{position.symbol}</td>
        <td className="px-4 py-3">
          <span className={`px-2 py-1 text-xs rounded ${statusColors[position.status]}`}>
            {position.status.toUpperCase()}
          </span>
        </td>
        <td className="px-4 py-3">{position.template}</td>
        <td className="px-4 py-3">{position.legs?.length ?? 0}</td>
        <td className="px-4 py-3 text-right font-mono">{formatCurrency(position.entry_cost)}</td>
        <td className="px-4 py-3 text-right font-mono">{formatCurrency(position.max_risk)}</td>
        <td className={`px-4 py-3 text-right font-mono ${pnlClass}`}>
          {formatCurrency(position.unrealized_pnl)}
        </td>
        <td className={`px-4 py-3 text-right font-mono ${pnlClass}`}>
          {formatPercent(position.unrealized_pnl / position.max_risk)}
        </td>
        <td className="px-4 py-3 text-right text-gray-400">
          {position.days_to_expiry}d
        </td>
        <td className="px-4 py-3 text-right">
          {position.status === 'open' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose(position.symbol);
              }}
              className="px-2 py-1 bg-red-900 border border-red-700 text-red-200 text-xs rounded hover:bg-red-700 transition-colors"
              title="Panic Sell - Close Immediately"
              data-testid={`panic-sell-${position.symbol}`}
            >
              🚨 Close
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-850">
          <td colSpan={10} className="px-4 py-3">
            <PositionDetails position={position} />
          </td>
        </tr>
      )}
    </>
  );
};

interface PositionDetailsProps {
  position: AutopilotPosition;
}

const PositionDetails: React.FC<PositionDetailsProps> = ({ position }) => {
  return (
    <div className="grid grid-cols-2 gap-6" data-testid={`position-details-${position.position_id}`}>
      {/* Legs */}
      <div>
        <h4 className="text-sm font-semibold text-gray-400 mb-2">Legs</h4>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500">
              <th className="text-left pb-1">Side</th>
              <th className="text-left pb-1">Strike</th>
              <th className="text-left pb-1">Type</th>
              <th className="text-right pb-1">Qty</th>
              <th className="text-right pb-1">Entry</th>
            </tr>
          </thead>
          <tbody>
            {position.legs?.map((leg, idx) => (
              <tr key={idx} className="border-t border-gray-700">
                <td className={leg.side === 'buy' ? 'text-green-400' : 'text-red-400'}>
                  {leg.side.toUpperCase()}
                </td>
                <td className="font-mono">${leg.strike}</td>
                <td>{leg.option_type.toUpperCase()}</td>
                <td className="text-right">{leg.quantity}</td>
                <td className="text-right font-mono">{formatCurrency(leg.entry_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Greeks */}
      <div>
        <h4 className="text-sm font-semibold text-gray-400 mb-2">Position Greeks</h4>
        {position.greeks && (
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-gray-800 rounded p-2 text-center">
              <span className="text-xs text-gray-500">Delta</span>
              <p className="font-mono">{position.greeks.delta?.toFixed(2) ?? 'N/A'}</p>
            </div>
            <div className="bg-gray-800 rounded p-2 text-center">
              <span className="text-xs text-gray-500">Gamma</span>
              <p className="font-mono">{position.greeks.gamma?.toFixed(4) ?? 'N/A'}</p>
            </div>
            <div className="bg-gray-800 rounded p-2 text-center">
              <span className="text-xs text-gray-500">Theta</span>
              <p className="font-mono">{position.greeks.theta?.toFixed(2) ?? 'N/A'}</p>
            </div>
            <div className="bg-gray-800 rounded p-2 text-center">
              <span className="text-xs text-gray-500">Vega</span>
              <p className="font-mono">{position.greeks.vega?.toFixed(2) ?? 'N/A'}</p>
            </div>
          </div>
        )}

        <h4 className="text-sm font-semibold text-gray-400 mt-4 mb-2">Trade Info</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-500">Entry Time:</span>
            <span className="ml-2">{new Date(position.entry_time).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-gray-500">Expiration:</span>
            <span className="ml-2">{position.expiration}</span>
          </div>
          <div>
            <span className="text-gray-500">Underlying:</span>
            <span className="ml-2 font-mono">{formatCurrency(position.underlying_price ?? 0)}</span>
          </div>
          <div>
            <span className="text-gray-500">IV Rank:</span>
            <span className="ml-2">{position.iv_rank ? formatPercent(position.iv_rank) : 'N/A'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

type FilterStatus = 'all' | 'open' | 'closed';

export const AutopilotPositions: React.FC = () => {
  const { positions = [], isLoading, fetchPositions, closePosition } = useAutopilotStore();
  const [filter, setFilter] = useState<FilterStatus>('open');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchPositions(filter === 'all' ? undefined : filter);

    // Poll positions every 15 seconds for continuous updates
    const interval = setInterval(() => {
      fetchPositions(filter === 'all' ? undefined : filter);
    }, 15000);

    return () => clearInterval(interval);
  }, [filter, fetchPositions]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const safePositions = positions ?? [];
  const totalPnl = safePositions.reduce((sum, p) => sum + (p.unrealized_pnl ?? 0), 0);
  const totalRisk = safePositions.reduce((sum, p) => sum + (p.max_risk ?? 0), 0);

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white" data-testid="autopilot-positions">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h2 className="text-xl font-bold" data-testid="position-ledger-heading">📊 Position Ledger</h2>
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            {(['open', 'closed', 'all'] as FilterStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-3 py-1 rounded text-sm ${filter === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                data-testid={`filter-${status}`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
          <button
            onClick={() => fetchPositions(filter === 'all' ? undefined : filter)}
            disabled={isLoading}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
            data-testid="refresh-positions"
          >
            {isLoading ? '⏳' : '🔄'} Refresh
          </button>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="flex gap-6 px-4 py-2 bg-gray-800 text-sm">
        <div>
          <span className="text-gray-400">Positions:</span>
          <span className="ml-2 font-bold">{positions.length}</span>
        </div>
        <div>
          <span className="text-gray-400">Total Risk:</span>
          <span className="ml-2 font-bold">{formatCurrency(totalRisk)}</span>
        </div>
        <div>
          <span className="text-gray-400">Total P&L:</span>
          <span className={`ml-2 font-bold ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatCurrency(totalPnl)}
          </span>
        </div>
      </div>

      {/* Positions Table */}
      <div className="flex-1 overflow-auto">
        {safePositions.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            {isLoading ? '⏳ Loading positions...' : 'No positions found'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-800 sticky top-0">
              <tr className="text-gray-400 text-left">
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3">Symbol</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Template</th>
                <th className="px-4 py-3">Legs</th>
                <th className="px-4 py-3 text-right">Entry Cost</th>
                <th className="px-4 py-3 text-right">Max Risk</th>
                <th className="px-4 py-3 text-right">Unrealized P&L</th>
                <th className="px-4 py-3 text-right">% P&L</th>
                <th className="px-4 py-3 text-right">DTE</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {safePositions.map((position) => (
                <PositionRow
                  key={position.position_id}
                  position={position}
                  expanded={expandedIds.has(position.position_id)}
                  onToggle={() => toggleExpand(position.position_id)}
                  onClose={closePosition}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AutopilotPositions;
