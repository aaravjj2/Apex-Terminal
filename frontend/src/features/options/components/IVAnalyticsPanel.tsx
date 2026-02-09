/**
 * IV Analytics Component
 * Displays IV Rank, Percentile, Current IV
 */

import React from 'react';
import { useOptionsStore } from '../store';
import { ProvenanceDisplay } from '../../../components/ProvenanceDisplay';

interface IVGaugeProps {
  label: string;
  value: number | null;
  min?: number;
  max?: number;
  colorScale?: 'default' | 'inverted';
  suffix?: string;
}

const IVGauge: React.FC<IVGaugeProps> = ({ 
  label, 
  value, 
  min = 0, 
  max = 100,
  colorScale = 'default',
  suffix = '%',
}) => {
  const getColor = (val: number): string => {
    const pct = (val - min) / (max - min);
    if (colorScale === 'inverted') {
      if (pct > 0.7) return 'text-green-400';
      if (pct > 0.3) return 'text-yellow-400';
      return 'text-red-400';
    }
    if (pct > 0.7) return 'text-red-400';
    if (pct > 0.3) return 'text-yellow-400';
    return 'text-green-400';
  };

  const displayValue = value !== null ? value.toFixed(1) : 'N/A';
  const fillPct = value !== null ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 0;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        <span className={value !== null ? getColor(value) : 'text-gray-500'}>
          {displayValue}{value !== null ? suffix : ''}
        </span>
      </div>
      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-300 ${
            value !== null ? getColor(value).replace('text-', 'bg-') : 'bg-gray-600'
          }`}
          style={{ width: `${fillPct}%` }}
        />
      </div>
    </div>
  );
};

interface IVAnalyticsPanelProps {
  className?: string;
}

export const IVAnalyticsPanel: React.FC<IVAnalyticsPanelProps> = ({ className = '' }) => {
  const { ivAnalytics, ivLoading, ivError, symbol } = useOptionsStore();

  if (ivLoading) {
    return (
      <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
        <h3 className="text-sm font-semibold text-gray-300 mb-3">IV Analytics</h3>
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-gray-700 rounded"></div>
          <div className="h-6 bg-gray-700 rounded"></div>
          <div className="h-6 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (ivError || ivAnalytics?.unavailable) {
    return (
      <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
        <h3 className="text-sm font-semibold text-gray-300 mb-3">IV Analytics</h3>
        <div className="text-xs text-gray-500">
          {ivError || ivAnalytics?.unavailable || 'Data unavailable'}
        </div>
      </div>
    );
  }

  if (!ivAnalytics) {
    return (
      <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
        <h3 className="text-sm font-semibold text-gray-300 mb-3">IV Analytics</h3>
        <div className="text-xs text-gray-500">Select a symbol to view IV analytics</div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-gray-300">IV Analytics</h3>
        <span className="text-xs text-gray-500">{symbol}</span>
      </div>

      <div className="space-y-3">
        <IVGauge 
          label="IV Rank" 
          value={ivAnalytics.ivRank} 
        />
        
        <IVGauge 
          label="IV Percentile" 
          value={ivAnalytics.ivPercentile} 
        />
        
        <IVGauge 
          label="Current IV" 
          value={ivAnalytics.currentIv !== null ? ivAnalytics.currentIv * 100 : null}
          min={0}
          max={150}
        />

        <div className="pt-2 border-t border-gray-700">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">52W Range</span>
            <span className="text-gray-300">
              {ivAnalytics.ivLow !== null ? (ivAnalytics.ivLow * 100).toFixed(1) : '-'}% - {' '}
              {ivAnalytics.ivHigh !== null ? (ivAnalytics.ivHigh * 100).toFixed(1) : '-'}%
            </span>
          </div>
        </div>
        
        {/* Data Provenance */}
        <div className="mt-3">
          <ProvenanceDisplay 
            provenance={{
              source: 'DEMO',
              cache_key: undefined,
              provider: 'Demo Data',
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default IVAnalyticsPanel;
