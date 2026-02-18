/**
 * Put/Call Ratio Display
 */

import React from 'react';
import { useOptionsStore } from '../store';

interface PCRBarProps {
  label: string;
  value: number;
  putValue: number;
  callValue: number;
}

const PCRBar: React.FC<PCRBarProps> = ({ label, value, putValue, callValue }) => {
  const total = putValue + callValue;
  const putPct = total > 0 ? (putValue / total) * 100 : 50;
  const callPct = total > 0 ? (callValue / total) * 100 : 50;

  const getValueColor = (): string => {
    if (value > 1.2) return 'text-red-400';   // Bearish
    if (value > 0.8) return 'text-yellow-400'; // Neutral
    return 'text-green-400';                  // Bullish
  };

  const getSentiment = (): string => {
    if (value > 1.2) return 'Bearish';
    if (value > 0.8) return 'Neutral';
    return 'Bullish';
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        <span className={getValueColor()}>
          {value.toFixed(2)} ({getSentiment()})
        </span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden">
        <div 
          className="bg-red-500 transition-all"
          style={{ width: `${putPct}%` }}
          title={`Puts: ${putValue.toLocaleString()}`}
        />
        <div 
          className="bg-green-500 transition-all"
          style={{ width: `${callPct}%` }}
          title={`Calls: ${callValue.toLocaleString()}`}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>Puts: {putValue.toLocaleString()}</span>
        <span>Calls: {callValue.toLocaleString()}</span>
      </div>
    </div>
  );
};

interface PutCallRatioPanelProps {
  className?: string;
}

export const PutCallRatioPanel: React.FC<PutCallRatioPanelProps> = ({ className = '' }) => {
  const { pcr, pcrLoading, pcrError, symbol } = useOptionsStore();

  if (pcrLoading) {
    return (
      <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Put/Call Ratio</h3>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded"></div>
          <div className="h-8 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (pcrError || pcr?.unavailable) {
    return (
      <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Put/Call Ratio</h3>
        <div className="text-xs text-gray-500">
          {pcrError || pcr?.unavailable || 'Data unavailable'}
        </div>
      </div>
    );
  }

  if (!pcr) {
    return (
      <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Put/Call Ratio</h3>
        <div className="text-xs text-gray-500">Select a symbol</div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-gray-300">Put/Call Ratio</h3>
        <span className="text-xs text-gray-500">{symbol}</span>
      </div>

      <div className="space-y-4">
        <PCRBar
          label="Volume PCR"
          value={pcr.volumePcr}
          putValue={pcr.totalPutVolume}
          callValue={pcr.totalCallVolume}
        />

        <PCRBar
          label="Open Interest PCR"
          value={pcr.oiPcr}
          putValue={pcr.totalPutOi}
          callValue={pcr.totalCallOi}
        />
      </div>

      <div className="mt-3 pt-3 border-t border-gray-700">
        <div className="text-xs text-gray-500">
          PCR {'>'} 1.0 = More puts (bearish) | PCR {'<'} 1.0 = More calls (bullish)
        </div>
      </div>
    </div>
  );
};

export default PutCallRatioPanel;
