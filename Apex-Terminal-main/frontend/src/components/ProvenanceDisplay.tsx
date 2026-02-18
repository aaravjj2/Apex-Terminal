/**
 * ProvenanceDisplay Component
 * Shows market data provenance (source, cache_key, timestamp) for transparency
 */

import React from 'react';

export interface ProvenanceInfo {
  source: 'DEMO' | 'LOCAL_CACHE' | 'LOCAL_REPLAY' | 'LOCAL_FETCH';
  cache_key?: string;
  checksum?: string;
  fetched_at?: string;
  provider?: string;
}

interface ProvenanceDisplayProps {
  provenance: ProvenanceInfo | null;
  className?: string;
}

export const ProvenanceDisplay: React.FC<ProvenanceDisplayProps> = ({ 
  provenance, 
  className = '' 
}) => {
  if (!provenance) return null;

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'DEMO':
        return 'text-blue-400';
      case 'LOCAL_CACHE':
      case 'LOCAL_REPLAY':
        return 'text-green-400';
      case 'LOCAL_FETCH':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'DEMO':
        return '🎭';
      case 'LOCAL_CACHE':
      case 'LOCAL_REPLAY':
        return '💾';
      case 'LOCAL_FETCH':
        return '🌐';
      default:
        return '📊';
    }
  };

  return (
    <div 
      className={`bg-gray-800 border border-gray-700 rounded px-3 py-2 text-xs ${className}`}
      data-testid="provenance-display"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="font-semibold text-gray-400">Data Provenance</span>
      </div>
      
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span>{getSourceIcon(provenance.source)}</span>
          <span className="text-gray-500">Source:</span>
          <span 
            className={`font-mono ${getSourceColor(provenance.source)}`}
            data-testid="provenance-source"
          >
            {provenance.source}
          </span>
        </div>

        {provenance.provider && (
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Provider:</span>
            <span 
              className="font-mono text-gray-300"
              data-testid="provenance-provider"
            >
              {provenance.provider}
            </span>
          </div>
        )}

        {provenance.cache_key && (
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Cache Key:</span>
            <span 
              className="font-mono text-gray-400 text-[10px] truncate max-w-[200px]"
              title={provenance.cache_key}
              data-testid="provenance-cache-key"
            >
              {provenance.cache_key.slice(0, 16)}...
            </span>
          </div>
        )}

        {provenance.checksum && (
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Checksum:</span>
            <span 
              className="font-mono text-gray-400 text-[10px] truncate max-w-[200px]"
              title={provenance.checksum}
              data-testid="provenance-checksum"
            >
              {provenance.checksum.slice(0, 16)}...
            </span>
          </div>
        )}

        {provenance.fetched_at && (
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Fetched:</span>
            <span 
              className="font-mono text-gray-400 text-[10px]"
              data-testid="provenance-fetched-at"
            >
              {new Date(provenance.fetched_at).toLocaleString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProvenanceDisplay;
