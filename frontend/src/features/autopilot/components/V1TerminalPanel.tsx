/**
 * V1 Terminal Panel
 * Bloomberg-style options terminal with one-click "Start Day" autopilot.
 * 
 * V1 Features:
 * - Start Day button to begin autopilot session
 * - Real-time P&L display
 * - Anti-thrash status display
 * - Position limit indicators
 * - Session recording status
 */

import React, { useCallback, useState, useEffect } from 'react';
import { useAutopilotStore } from '../store';

interface V1TerminalPanelProps {
  onStartDay?: () => void;
  onEndDay?: () => void;
}

interface AntiThrashStatus {
  tickerCooldowns: Record<string, number>; // ticker -> seconds remaining
  consecutiveStopouts: number;
  circuitBreakerActive: boolean;
  circuitBreakerRemaining: number; // seconds
  dailyLossPct: number;
  dailyLossLimit: number;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
};

const formatPct = (value: number): string => {
  return `${(value * 100).toFixed(1)}%`;
};

// V1 Risk Limits Display
const V1RiskLimits: React.FC<{
  positions: number;
  maxPositions: number;
  exposure: number;
  maxExposure: number;
}> = ({ positions, maxPositions, exposure, maxExposure }) => {
  const positionPct = (positions / maxPositions) * 100;
  const exposurePct = (exposure / maxExposure) * 100;

  return (
    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700" data-testid="v1-risk-limits">
      <h4 className="text-xs font-bold text-gray-400 mb-2">V1 RISK LIMITS</h4>
      
      {/* Position Limit */}
      <div className="mb-2">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-400">Positions</span>
          <span className={positions >= maxPositions ? 'text-red-400 font-bold' : 'text-white'}>
            {positions} / {maxPositions}
          </span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all ${positionPct >= 100 ? 'bg-red-500' : positionPct >= 80 ? 'bg-yellow-500' : 'bg-green-500'}`}
            style={{ width: `${Math.min(positionPct, 100)}%` }}
          />
        </div>
      </div>

      {/* Exposure Limit */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-400">Exposure</span>
          <span className={exposure >= maxExposure ? 'text-red-400 font-bold' : 'text-white'}>
            {formatCurrency(exposure)} / {formatCurrency(maxExposure)}
          </span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all ${exposurePct >= 100 ? 'bg-red-500' : exposurePct >= 80 ? 'bg-yellow-500' : 'bg-green-500'}`}
            style={{ width: `${Math.min(exposurePct, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
};

// Anti-Thrash Status Display
const AntiThrashDisplay: React.FC<{ status: AntiThrashStatus }> = ({ status }) => {
  const isBlocked = status.circuitBreakerActive || status.dailyLossPct >= status.dailyLossLimit;
  
  return (
    <div className={`bg-gray-800 rounded-lg p-3 border ${isBlocked ? 'border-red-600' : 'border-gray-700'}`} data-testid="anti-thrash-status">
      <h4 className="text-xs font-bold text-gray-400 mb-2">ANTI-THRASH</h4>
      
      {status.circuitBreakerActive && (
        <div className="bg-red-900 border border-red-600 rounded p-2 mb-2 animate-pulse">
          <div className="flex items-center gap-2">
            <span className="text-red-400 font-bold text-xs">⚡ CIRCUIT BREAKER</span>
            <span className="text-white text-xs">{formatTime(status.circuitBreakerRemaining)}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-gray-400">Stop-outs:</span>
          <span className={`ml-1 ${status.consecutiveStopouts >= 2 ? 'text-yellow-400' : 'text-white'}`}>
            {status.consecutiveStopouts}/3
          </span>
        </div>
        <div>
          <span className="text-gray-400">Daily Loss:</span>
          <span className={`ml-1 ${status.dailyLossPct >= status.dailyLossLimit ? 'text-red-400' : 'text-white'}`}>
            {formatPct(status.dailyLossPct)}
          </span>
        </div>
      </div>

      {Object.keys(status.tickerCooldowns).length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-700">
          <span className="text-xs text-gray-400">Cooldowns:</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.entries(status.tickerCooldowns).slice(0, 5).map(([ticker, secs]) => (
              <span key={ticker} className="px-2 py-0.5 bg-yellow-900 border border-yellow-700 rounded text-xs text-yellow-200">
                {ticker} {formatTime(secs)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Session Timer
const SessionTimer: React.FC<{ startTime: Date | null; isActive: boolean }> = ({ startTime, isActive }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isActive || !startTime) {
      setElapsed(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, startTime]);

  const hours = Math.floor(elapsed / 3600);
  const mins = Math.floor((elapsed % 3600) / 60);
  const secs = elapsed % 60;

  return (
    <div className="font-mono text-2xl text-center" data-testid="session-timer">
      <span className={isActive ? 'text-green-400' : 'text-gray-500'}>
        {hours.toString().padStart(2, '0')}:{mins.toString().padStart(2, '0')}:{secs.toString().padStart(2, '0')}
      </span>
    </div>
  );
};

export const V1TerminalPanel: React.FC<V1TerminalPanelProps> = ({ 
  onStartDay,
  onEndDay,
}) => {
  const {
    config,
    status,
    portfolio,
    isLoading,
    triggerRun,
    activateKillSwitch,
  } = useAutopilotStore();

  const [sessionActive, setSessionActive] = useState(false);
  const [sessionStart, setSessionStart] = useState<Date | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  // Mock anti-thrash status (would come from API in real implementation)
  const [antiThrash, setAntiThrash] = useState<AntiThrashStatus>({
    tickerCooldowns: {},
    consecutiveStopouts: 0,
    circuitBreakerActive: false,
    circuitBreakerRemaining: 0,
    dailyLossPct: 0,
    dailyLossLimit: 0.05,
  });

  const handleStartDay = useCallback(async () => {
    setSessionActive(true);
    setSessionStart(new Date());
    setIsRecording(true);
    
    // Reset daily counters
    setAntiThrash(prev => ({
      ...prev,
      consecutiveStopouts: 0,
      circuitBreakerActive: false,
      dailyLossPct: 0,
      tickerCooldowns: {},
    }));

    onStartDay?.();
    
    // Trigger first cycle
    await triggerRun(true);
  }, [triggerRun, onStartDay]);

  const handleEndDay = useCallback(async () => {
    // Activate kill switch to close all positions
    await activateKillSwitch(true);
    
    setSessionActive(false);
    setSessionStart(null);
    setIsRecording(false);
    
    onEndDay?.();
  }, [activateKillSwitch, onEndDay]);

  const pnl = portfolio?.total_pnl ?? 0;
  const positions = portfolio?.positions?.length ?? 0;
  const exposure = portfolio?.total_exposure ?? 0;
  const maxPositions = config?.risk_limits?.max_open_positions ?? 10;
  const maxExposure = config?.risk_limits?.max_total_exposure_usd ?? 1000;

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-700 p-4" data-testid="v1-terminal-panel">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🖥️</span>
          <div>
            <h2 className="text-lg font-bold text-white">V1 Terminal</h2>
            <span className="text-xs text-gray-400">Long Premium Only • Paper Mode</span>
          </div>
        </div>
        
        {/* Recording Indicator */}
        {isRecording && (
          <div className="flex items-center gap-2 px-3 py-1 bg-red-900 border border-red-600 rounded-full">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs text-red-200 font-bold">REC</span>
          </div>
        )}
      </div>

      {/* Session Timer */}
      <div className="mb-4">
        <SessionTimer startTime={sessionStart} isActive={sessionActive} />
        <div className="text-center text-xs text-gray-500 mt-1">
          {sessionActive ? 'Session Active' : 'Session Inactive'}
        </div>
      </div>

      {/* P&L Display */}
      <div className="bg-gray-800 rounded-lg p-4 mb-4 text-center" data-testid="v1-pnl-display">
        <div className="text-xs text-gray-400 mb-1">SESSION P&L</div>
        <div className={`text-3xl font-mono font-bold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
        </div>
      </div>

      {/* Risk Limits */}
      <div className="mb-4">
        <V1RiskLimits 
          positions={positions}
          maxPositions={maxPositions}
          exposure={exposure}
          maxExposure={maxExposure}
        />
      </div>

      {/* Anti-Thrash Status */}
      <div className="mb-4">
        <AntiThrashDisplay status={antiThrash} />
      </div>

      {/* Action Buttons */}
      <div className="space-y-2">
        {!sessionActive ? (
          <button
            onClick={handleStartDay}
            disabled={isLoading || status?.kill_switch}
            className="w-full py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 
                       rounded-lg font-bold text-xl transition-colors
                       shadow-lg shadow-green-900/50"
            data-testid="start-day-btn"
          >
            {isLoading ? '⏳ Starting...' : '🌅 START DAY'}
          </button>
        ) : (
          <>
            <button
              onClick={() => triggerRun(true)}
              disabled={isLoading || status?.kill_switch}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 
                         rounded-lg font-bold transition-colors"
              data-testid="run-cycle-btn"
            >
              {isLoading ? '⏳ Running...' : '🔄 Run Cycle Now'}
            </button>
            
            <button
              onClick={handleEndDay}
              disabled={isLoading}
              className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 
                         rounded-lg font-bold transition-colors"
              data-testid="end-day-btn"
            >
              🌙 END DAY (Close All)
            </button>
          </>
        )}
      </div>

      {/* V1 Contract Info */}
      <div className="mt-4 pt-3 border-t border-gray-700">
        <div className="text-xs text-gray-500 text-center">
          V1 Contract: ≤10 positions • ≤$1,000 exposure • 10% stop loss
        </div>
        <div className="text-xs text-gray-500 text-center mt-1">
          Templates: LONG_CALL, LONG_PUT only
        </div>
      </div>
    </div>
  );
};

export default V1TerminalPanel;
