/**
 * Greeks Display Component
 * Shows delta, gamma, theta, vega for positions
 */

import React from 'react';
import type { Greeks, StrategyAnalysis } from '../types';

interface GreekItemProps {
  label: string;
  value: number;
  format?: 'decimal' | 'currency' | 'percent';
  size?: 'sm' | 'md';
  showSign?: boolean;
}

const GreekItem: React.FC<GreekItemProps> = ({ 
  label, 
  value, 
  format = 'decimal',
  size = 'sm',
  showSign = true,
}) => {
  const formatValue = (): string => {
    const sign = showSign && value > 0 ? '+' : '';
    switch (format) {
      case 'currency':
        return `${sign}$${Math.abs(value).toFixed(2)}`;
      case 'percent':
        return `${sign}${(value * 100).toFixed(2)}%`;
      default:
        return `${sign}${value.toFixed(4)}`;
    }
  };

  const getColor = (): string => {
    if (value > 0) return 'text-green-400';
    if (value < 0) return 'text-red-400';
    return 'text-gray-400';
  };

  const sizeClasses = size === 'md' ? 'text-sm' : 'text-xs';

  return (
    <div className="flex justify-between items-center">
      <span className={`text-gray-400 ${sizeClasses}`}>{label}</span>
      <span className={`font-mono ${sizeClasses} ${getColor()}`}>
        {formatValue()}
      </span>
    </div>
  );
};

interface GreeksPanelProps {
  greeks: Greeks;
  title?: string;
  className?: string;
}

export const GreeksPanel: React.FC<GreeksPanelProps> = ({ 
  greeks, 
  title = 'Greeks',
  className = '',
}) => {
  return (
    <div className={`bg-gray-800 rounded-lg p-3 ${className}`}>
      {title && (
        <h4 className="text-xs font-semibold text-gray-300 mb-2">{title}</h4>
      )}
      <div className="space-y-1">
        <GreekItem label="Delta" value={greeks.delta} />
        <GreekItem label="Gamma" value={greeks.gamma} />
        <GreekItem label="Theta" value={greeks.theta} />
        <GreekItem label="Vega" value={greeks.vega} />
        {greeks.rho !== undefined && (
          <GreekItem label="Rho" value={greeks.rho} />
        )}
      </div>
    </div>
  );
};

interface PositionGreeksPanelProps {
  strategy: StrategyAnalysis;
  className?: string;
}

export const PositionGreeksPanel: React.FC<PositionGreeksPanelProps> = ({
  strategy,
  className = '',
}) => {
  return (
    <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-300 mb-3">Position Greeks</h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <GreekItem 
            label="Net Delta" 
            value={strategy.netDelta} 
            size="md"
          />
          <div className="text-xs text-gray-500">
            {strategy.netDelta > 0 ? 'Bullish bias' : strategy.netDelta < 0 ? 'Bearish bias' : 'Neutral'}
          </div>
        </div>
        
        <div className="space-y-2">
          <GreekItem 
            label="Net Gamma" 
            value={strategy.netGamma}
            size="md"
          />
          <div className="text-xs text-gray-500">
            {strategy.netGamma > 0 ? 'Long gamma' : 'Short gamma'}
          </div>
        </div>
        
        <div className="space-y-2">
          <GreekItem 
            label="Net Theta" 
            value={strategy.netTheta}
            format="currency"
            size="md"
          />
          <div className="text-xs text-gray-500">
            {strategy.netTheta > 0 ? 'Earns daily' : 'Decays daily'}
          </div>
        </div>
        
        <div className="space-y-2">
          <GreekItem 
            label="Net Vega" 
            value={strategy.netVega}
            format="currency"
            size="md"
          />
          <div className="text-xs text-gray-500">
            {strategy.netVega > 0 ? 'Long vol' : 'Short vol'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GreeksPanel;
