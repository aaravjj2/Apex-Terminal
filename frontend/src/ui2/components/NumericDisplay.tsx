/**
 * UI2 Numeric Components - Wave 12 v1.114
 * Terminal-grade numeric display with tabular alignment
 */

import React from 'react';
import { terminalClasses } from '../design/tokens';

export interface NumericValueProps {
  value: number | string;
  format?: 'currency' | 'percent' | 'number' | 'compact';
  decimals?: number;
  showSign?: boolean;
  colorize?: boolean; // Auto-color based on positive/negative
  className?: string;
  testId?: string;
}

export function NumericValue({
  value,
  format = 'number',
  decimals = 2,
  showSign = false,
  colorize = false,
  className = '',
  testId,
}: NumericValueProps) {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  const formatValue = (val: number): string => {
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(val);
      
      case 'percent':
        return new Intl.NumberFormat('en-US', {
          style: 'percent',
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(val / 100);
      
      case 'compact':
        return new Intl.NumberFormat('en-US', {
          notation: 'compact',
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(val);
      
      default:
        return new Intl.NumberFormat('en-US', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(val);
    }
  };

  const formatted = formatValue(numValue);
  const displayValue = showSign && numValue > 0 ? `+${formatted}` : formatted;

  let colorClass = '';
  if (colorize) {
    if (numValue > 0) colorClass = 'text-green-400';
    else if (numValue < 0) colorClass = 'text-red-400';
    else colorClass = 'text-neutral-400';
  }

  return (
    <span
      className={`${terminalClasses.numericData} ${colorClass} ${className}`}
      data-testid={testId}
    >
      {displayValue}
    </span>
  );
}

export interface KPICardProps {
  label: string;
  value: number | string;
  format?: NumericValueProps['format'];
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  testId?: string;
}

export function KPICard({
  label,
  value,
  format = 'number',
  change,
  changeLabel,
  icon,
  testId,
}: KPICardProps) {
  return (
    <div
      className="bg-neutral-900 border border-neutral-800 rounded-lg p-4"
      data-testid={testId}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="text-xs text-neutral-400 uppercase tracking-wider">
          {label}
        </div>
        {icon && <div className="text-neutral-500">{icon}</div>}
      </div>
      
      <div className="text-2xl font-semibold text-neutral-100 mb-1">
        <NumericValue
          value={value}
          format={format}
          decimals={format === 'currency' ? 2 : 0}
        />
      </div>
      
      {change !== undefined && (
        <div className="flex items-center gap-1.5 text-xs">
          <NumericValue
            value={change}
            format="percent"
            decimals={2}
            showSign
            colorize
          />
          {changeLabel && (
            <span className="text-neutral-500">{changeLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
