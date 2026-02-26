/**
 * Autopilot Dashboard Component
 * Main dashboard showing status, portfolio, and controls
 */

import React, { useEffect, useCallback, useState } from 'react';
import { useAutopilotStore } from '../store';
import { AutopilotThinkLog } from './AutopilotThinkLog';
import { AutopilotPositions } from './AutopilotPositions';
import { UniverseEditor } from './UniverseEditor';
import { IncidentsPanel } from './IncidentsPanel';
import { RunHistory } from './RunHistory';
import { AutopilotAgents } from './AutopilotAgents';
import { AutopilotProposals } from './AutopilotProposals';

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
};

const formatPercent = (value: number): string => {
  return `${(value * 100).toFixed(2)}%`;
};

interface StatusBadgeProps {
  state: string;
  killSwitch: boolean;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ state, killSwitch }) => {
  if (killSwitch) {
    return (
      <span className="px-3 py-1 text-sm font-bold bg-red-600 text-white rounded-full animate-pulse" data-testid="autopilot-status-badge">
        🛑 KILL SWITCH ACTIVE
      </span>
    );
  }

  const colors: Record<string, string> = {
    idle: 'bg-gray-500',
    running: 'bg-green-500',
    paused: 'bg-yellow-500',
    error: 'bg-red-500',
  };

  const safeState = state || 'idle';

  return (
    <span className={`px-3 py-1 text-sm font-semibold text-white rounded-full ${colors[safeState] || colors.idle}`} data-testid="autopilot-status-badge">
      {safeState.toUpperCase()}
    </span>
  );
};

const PaperModeBanner: React.FC = () => (
  <div
    className="w-full bg-amber-500 text-black text-center py-2 font-bold text-lg"
    data-testid="paper-mode-banner"
  >
    📄 PAPER TRADING MODE - NO REAL MONEY AT RISK
  </div>
);

export const AutopilotDashboard: React.FC = () => {
  const {
    config,
    status,
    portfolio,
    isLoading,
    error,
    killSwitchPending,
    fetchConfig,
    fetchStatus,
    fetchPositions,
    triggerRun,
    startLoop,
    stopLoop,
    activateKillSwitch,
    deactivateKillSwitch,
    pause,
    resume,
    clearError,
    connect,
    disconnect,
    connectionStatus,
  } = useAutopilotStore();

  const [showUniverse, setShowUniverse] = useState(false);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  useEffect(() => {
    fetchConfig();
    fetchStatus();
    fetchPositions('open');

    // Poll status and positions continuously every 15 seconds
    const statusInterval = setInterval(() => {
      fetchStatus();
    }, 15000);

    const positionsInterval = setInterval(() => {
      fetchPositions('open');
    }, 15000);

    return () => {
      clearInterval(statusInterval);
      clearInterval(positionsInterval);
    };
  }, [fetchConfig, fetchStatus, fetchPositions]);

  const handleRunCycle = useCallback(async () => {
    await triggerRun(true);
    await fetchPositions('open');
  }, [triggerRun, fetchPositions]);

  const handleStartStopLoop = useCallback(async () => {
    if (status?.state === 'running') {
      await stopLoop();
    } else {
      await startLoop();
    }
  }, [status, startLoop, stopLoop]);

  const handleKillSwitch = useCallback(async () => {
    if (status?.kill_switch) {
      await deactivateKillSwitch();
    } else {
      await activateKillSwitch(true);
    }
  }, [status, activateKillSwitch, deactivateKillSwitch]);

  const handlePauseResume = useCallback(async () => {
    if (status?.state === 'paused') {
      await resume();
    } else {
      await pause();
    }
  }, [status, pause, resume]);

  const pnl = portfolio?.total_pnl ?? 0;
  const equity = (config?.paper_equity ?? 1000) + pnl;

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white" data-testid="autopilot-dashboard">
      <PaperModeBanner />

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold" data-testid="autopilot-heading">🤖 AI Options Autopilot</h1>
          {status && <StatusBadge state={status.state} killSwitch={status.kill_switch} />}
          <div className={`px-2 py-1 rounded-full text-xs font-bold ${connectionStatus === 'CONNECTED' ? 'bg-green-900 text-green-200 border border-green-700' :
            connectionStatus === 'CONNECTING' ? 'bg-yellow-900 text-yellow-200 border border-yellow-700 animate-pulse' :
              'bg-red-900 text-red-200 border border-red-700'
            }`}>
            WS: {connectionStatus}
          </div>

          {status?.sentiment && (
            <div className="flex items-center gap-2 px-3 py-1 bg-gray-700 rounded-full border border-gray-600" title={`Score: ${status.sentiment.sentiment_scores?.MARKET?.toFixed(2) ?? 'N/A'}`}>
              <span className="text-xs text-gray-400" data-testid="sentiment-market-label">MARKET:</span>
              <span data-testid="sentiment-badge" className={`text-xs font-bold ${(status.sentiment.sentiment_scores?.MARKET ?? 0) > 0.4 ? 'text-green-400' :
                (status.sentiment.sentiment_scores?.MARKET ?? 0) < -0.4 ? 'text-red-400' :
                  'text-gray-200'
                }`}>
                {(status.sentiment.sentiment_scores?.MARKET ?? 0) > 0.4 ? '🐂 BULLISH' :
                  (status.sentiment.sentiment_scores?.MARKET ?? 0) < -0.4 ? '🐻 BEARISH' :
                    '⚖️ NEUTRAL'}
              </span>
              <span className="text-xs text-gray-500 border-l border-gray-600 pl-2 ml-1">
                {status.sentiment.news_velocity.toUpperCase()}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="text-sm text-gray-400 mr-4">
            Equity: <span className="text-white font-mono">{formatCurrency(equity)}</span>
            <span className={`ml-2 font-mono ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ({pnl >= 0 ? '+' : ''}{formatCurrency(pnl)})
            </span>
          </div>

          <button
            onClick={() => setShowUniverse(!showUniverse)}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium transition-colors text-sm"
            data-testid="toggle-universe-btn"
          >
            🌎 Universe
          </button>

          <button
            onClick={handlePauseResume}
            disabled={isLoading || status?.kill_switch}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 rounded font-medium transition-colors"
            data-testid="pause-resume-btn"
          >
            {status?.state === 'paused' ? '▶️ Resume' : '⏸️ Pause'}
          </button>

          <button
            onClick={handleStartStopLoop}
            disabled={isLoading || status?.kill_switch}
            className={`px-4 py-2 rounded font-medium transition-colors ${
              status?.state === 'running'
                ? 'bg-red-700 hover:bg-red-800'
                : 'bg-green-700 hover:bg-green-800'
            } disabled:bg-gray-600`}
            data-testid="start-stop-loop-btn"
          >
            {isLoading ? '⏳ Working...' : status?.state === 'running' ? '⏹️ Stop Loop' : '▶️ Start Loop'}
          </button>

          <button
            onClick={handleRunCycle}
            disabled={isLoading || status?.kill_switch}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded font-medium transition-colors"
            data-testid="run-cycle-btn"
          >
            {isLoading ? '⏳ Running...' : '🔄 Run Cycle'}
          </button>

          <button
            onClick={handleKillSwitch}
            disabled={killSwitchPending}
            className={`px-4 py-2 rounded font-medium transition-colors ${status?.kill_switch
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-red-600 hover:bg-red-700'
              }`}
            data-testid="kill-switch-btn"
          >
            {status?.kill_switch ? '✅ Deactivate Kill Switch' : '🛑 Kill Switch'}
          </button>
        </div>
      </div>

      {/* Universe Editor Modal/Drawer */}
      {showUniverse && (
        <div className="absolute top-16 right-4 z-50 w-96 shadow-2xl">
          <UniverseEditor onClose={() => setShowUniverse(false)} />
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="bg-red-900 text-red-200 p-3 flex items-center justify-between" data-testid="error-banner">
          <span>⚠️ {error}</span>
          <button onClick={clearError} className="text-red-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Incidents Panel */}
      <div className="px-4 pt-4">
        <IncidentsPanel />
      </div>

      {/* Mini Chart Area */}
      <div className="px-4 pt-2" data-testid="chart-canvas">
        <div className="h-32 bg-gray-800 rounded border border-gray-700 flex items-center justify-center text-gray-500 text-sm">
          📈 Market Overview
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Positions & Stats (65%) */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-gray-700">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-4 gap-4 p-4 border-b border-gray-700 bg-gray-850" data-testid="autopilot-stats-grid">
            <div className="bg-gray-800 p-3 rounded" data-testid="portfolio-card-paper-equity">
              <span className="text-gray-400 text-xs">Paper Equity</span>
              <p className="font-bold font-mono">{formatCurrency(equity)}</p>
            </div>
            <div className="bg-gray-800 p-3 rounded" data-testid="portfolio-card-total-p&l">
              <span className="text-gray-400 text-xs">Total P&amp;L</span>
              <p className={`font-bold font-mono ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
              </p>
            </div>
            <div className="bg-gray-800 p-3 rounded" data-testid="stat-positions">
              <span className="text-gray-400 text-xs">Open Positions</span>
              <p className="font-bold">{portfolio?.open_positions ?? 0} / {config?.risk_limits?.max_open_positions ?? 10}</p>
            </div>
            <div className="bg-gray-800 p-3 rounded" data-testid="stat-win-rate">
              <span className="text-gray-400 text-xs">Win Rate</span>
              <p className={`font-bold ${(status?.win_rate ?? 0) >= 0.5 ? 'text-green-400' : 'text-red-400'}`}>
                {formatPercent(status?.win_rate ?? 0)}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 px-4 py-2 border-b border-gray-700 bg-gray-850">
            <div className="bg-gray-800 p-3 rounded" data-testid="stat-net-delta">
              <span className="text-gray-400 text-xs">Net Delta</span>
              <p className="font-bold font-mono">{portfolio?.net_delta?.toFixed(2) ?? '0.00'}</p>
            </div>
            <div className="bg-gray-800 p-3 rounded" data-testid="stat-net-theta">
              <span className="text-gray-400 text-xs">Net Theta</span>
              <p className="font-bold font-mono">{portfolio?.net_theta?.toFixed(2) ?? '0.00'}</p>
            </div>
          </div>

          {/* Positions Table */}
          <div className="flex-1 overflow-auto flex flex-col min-h-0">
            <div className="min-h-[200px] border-b border-gray-700">
              <AutopilotPositions />
            </div>
            <div className="min-h-[100px] p-4 bg-gray-900/50">
              <AutopilotProposals />
            </div>
          </div>
        </div>

        {/* Right Column: Activity & Logs (35%) */}
        <div className="w-[400px] flex flex-col bg-gray-850">
          {/* Run History (Top Half) */}
          <div className="h-1/2 border-b border-gray-700 flex flex-col">
            <div className="p-4 pb-0">
              <AutopilotAgents />
            </div>
            <RunHistory />
          </div>

          {/* Think Log (Bottom Half) */}
          <div className="h-1/2 flex flex-col">
            <h3 className="text-sm font-semibold text-gray-300 px-3 py-2 bg-gray-800 border-b border-gray-700">
              🧠 Think Engine
            </h3>
            <div className="flex-1 overflow-hidden">
              <AutopilotThinkLog />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutopilotDashboard;
