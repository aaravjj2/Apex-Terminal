/**
 * AutopilotExplainUI2 Page - Wave 12 v1.116
 * Autopilot Explainability: Shadow/live indicator, candidate decisions, rejection codes, explanations
 */

import React, { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Eye, CheckCircle, XCircle, AlertTriangle, TrendingUp, Shield } from 'lucide-react';

type AutopilotMode = 'shadow' | 'live';
type DecisionStatus = 'approved' | 'rejected' | 'pending';

interface AutopilotDecision {
  id: string;
  timestamp: string;
  symbol: string;
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  status: DecisionStatus;
  rejectionCode?: string;
  rejectionReason?: string;
  maxProfit?: number;
  maxLoss?: number;
  riskScore?: number;
  explanation?: string;
}

// DEMO data
const demoDecisions: AutopilotDecision[] = [
  {
    id: 'dec-001',
    timestamp: new Date().toISOString(),
    symbol: 'AAPL',
    action: 'buy',
    confidence: 0.85,
    status: 'approved',
    maxProfit: 500,
    maxLoss: 150,
    riskScore: 0.3,
    explanation: 'Strong momentum + high volume breakout above resistance at $175. Risk/reward ratio 3.3:1.',
  },
  {
    id: 'dec-002',
    timestamp: new Date(Date.now() - 60000).toISOString(),
    symbol: 'TSLA',
    action: 'sell',
    confidence: 0.72,
    status: 'rejected',
    rejectionCode: 'RISK_EXCEEDED',
    rejectionReason: 'Portfolio risk limit would be exceeded (current: 45%, limit: 50%)',
    maxProfit: 800,
    maxLoss: 400,
    riskScore: 0.65,
  },
  {
    id: 'dec-003',
    timestamp: new Date(Date.now() - 120000).toISOString(),
    symbol: 'MSFT',
    action: 'buy',
    confidence: 0.68,
    status: 'rejected',
    rejectionCode: 'LOW_CONFIDENCE',
    rejectionReason: 'Decision confidence 0.68 below minimum threshold 0.70',
    maxProfit: 300,
    maxLoss: 120,
    riskScore: 0.4,
  },
  {
    id: 'dec-004',
    timestamp: new Date(Date.now() - 180000).toISOString(),
    symbol: 'GOOGL',
    action: 'buy',
    confidence: 0.91,
    status: 'approved',
    maxProfit: 650,
    maxLoss: 180,
    riskScore: 0.28,
    explanation: 'Earnings beat + analyst upgrades. Strong technical setup.',
  },
];

const statusIcons = {
  approved: CheckCircle,
  rejected: XCircle,
  pending: AlertTriangle,
};

const statusColors = {
  approved: 'text-green-400',
  rejected: 'text-red-400',
  pending: 'text-yellow-400',
};

const statusBgColors = {
  approved: 'bg-green-950/30',
  rejected: 'bg-red-950/30',
  pending: 'bg-yellow-950/30',
};

export function AutopilotExplainUI2() {
  const [mode, setMode] = useState<AutopilotMode>('shadow');
  const [selectedDecision, setSelectedDecision] = useState<AutopilotDecision | null>(null);
  const [killSwitchActive, setKillSwitchActive] = useState(false);

  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleTimeString('en-US', { hour12: false });
  };

  const approvedCount = demoDecisions.filter(d => d.status === 'approved').length;
  const rejectedCount = demoDecisions.filter(d => d.status === 'rejected').length;

  return (
    <div className="h-full flex flex-col bg-neutral-950" data-testid="autopilot-explain-page" data-ready="true">
      <PageHeader
        title="Autopilot Explainability"
        subtitle={`${demoDecisions.length} decisions · ${approvedCount} approved · ${rejectedCount} rejected`}
        badge={
          <div className="flex items-center gap-2">
            {mode === 'shadow' ? (
              <Eye className="w-4 h-4 text-blue-400" />
            ) : (
              <TrendingUp className="w-4 h-4 text-green-400" />
            )}
            <span className={`px-2 py-1 ${mode === 'shadow' ? 'bg-blue-950/30 border-blue-900/50 text-blue-400' : 'bg-green-950/30 border-green-900/50 text-green-400'} border text-xs font-medium rounded uppercase tracking-wider`}>
              {mode} MODE
            </span>
          </div>
        }
        actions={
          <button
            onClick={() => setKillSwitchActive(!killSwitchActive)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              killSwitchActive
                ? 'bg-red-600/20 border border-red-600 text-red-400 hover:bg-red-600/30'
                : 'bg-neutral-800 border border-neutral-700 text-neutral-300 hover:bg-neutral-700'
            }`}
            data-testid="autopilot-killswitch-btn"
          >
            <Shield className="w-4 h-4" />
            {killSwitchActive ? 'Kill Switch: ON' : 'Kill Switch: OFF'}
          </button>
        }
        testId="autopilot-explain-header"
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Decisions list */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-neutral-800">
          {/*Controls */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800 bg-neutral-900/50">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMode('shadow')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  mode === 'shadow'
                    ? 'bg-blue-600 text-white'
                    : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                }`}
                data-testid="mode-shadow-btn"
              >
                <Eye className="w-4 h-4 inline mr-1.5" />
                Shadow
              </button>
              <button
                onClick={() => setMode('live')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  mode === 'live'
                    ? 'bg-green-600 text-white'
                    : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                }`}
                data-testid="mode-live-btn"
              >
                <TrendingUp className="w-4 h-4 inline mr-1.5" />
                Live
              </button>
            </div>

            <div className="flex-1" />

            <div className="text-xs text-neutral-500">
              {mode === 'shadow'
                ? 'Shadow mode: Decisions logged but not executed'
                : 'Live mode: Decisions executed automatically'}
            </div>
          </div>

          {/* Decisions list */}
          <div className="flex-1 overflow-auto" data-testid="decisions-list">
            {demoDecisions.map((decision) => {
              const StatusIcon = statusIcons[decision.status];
              const isSelected = selectedDecision?.id === decision.id;

              return (
                <div
                  key={decision.id}
                  onClick={() => setSelectedDecision(decision)}
                  className={`
                    px-4 py-3 border-b border-neutral-800/50 cursor-pointer transition-colors
                    ${isSelected ? 'bg-blue-950/20 border-l-2 border-l-blue-500' : 'hover:bg-neutral-900/50 border-l-2 border-l-transparent'}
                  `}
                  data-testid={`decision-${decision.id}`}
                >
                  <div className="flex items-start gap-3">
                    <StatusIcon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${statusColors[decision.status]}`} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-semibold text-neutral-100">{decision.symbol}</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${decision.action === 'buy' ? 'bg-green-950/30 text-green-400' : 'bg-red-950/30 text-red-400'}`}>
                          {decision.action.toUpperCase()}
                        </span>
                        <span className="text-xs font-mono text-neutral-500">
                          {formatTimestamp(decision.timestamp)}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mb-1">
                        <div className="text-xs">
                          <span className="text-neutral-500">Confidence:</span>{' '}
                          <span className={`font-mono font-semibold ${decision.confidence >= 0.8 ? 'text-green-400' : decision.confidence >= 0.7 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {(decision.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                        {decision.riskScore !== undefined && (
                          <div className="text-xs">
                            <span className="text-neutral-500">Risk:</span>{' '}
                            <span className={`font-mono font-semibold ${decision.riskScore <= 0.3 ? 'text-green-400' : decision.riskScore <= 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {(decision.riskScore * 100).toFixed(0)}%
                            </span>
                          </div>
                        )}
                      </div>

                      {decision.status === 'rejected' && decision.rejectionCode && (
                        <div className="mt-2 px-2 py-1 bg-red-950/20 border border-red-900/50 rounded text-xs">
                          <span className="font-mono text-red-400">{decision.rejectionCode}</span>
                          {decision.rejectionReason && (
                            <div className="text-neutral-400 mt-0.5">{decision.rejectionReason}</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Decision detail */}
        <div
          className={`w-96 bg-neutral-900 border-l border-neutral-800 transition-all duration-300 ${
            selectedDecision ? 'translate-x-0' : 'translate-x-full'
          }`}
          data-testid="decision-detail-drawer"
        >
          {selectedDecision && (
            <div className="h-full flex flex-col overflow-auto">
              <div className="px-4 py-3 border-b border-neutral-800">
                <h3 className="text-sm font-semibold text-neutral-100">Decision Analysis</h3>
              </div>

              <div className="p-4 space-y-4">
                <div>
                  <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Symbol</div>
                  <div className="text-lg font-semibold text-neutral-100">{selectedDecision.symbol}</div>
                </div>

                <div>
                  <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Action</div>
                  <span className={`px-2 py-1 rounded text-sm font-medium ${selectedDecision.action === 'buy' ? 'bg-green-950/30 text-green-400' : 'bg-red-950/30 text-red-400'}`}>
                    {selectedDecision.action.toUpperCase()}
                  </span>
                </div>

                <div>
                  <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Status</div>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${statusBgColors[selectedDecision.status]} ${statusColors[selectedDecision.status]}`}>
                    {React.createElement(statusIcons[selectedDecision.status], { className: 'w-3.5 h-3.5' })}
                    {selectedDecision.status.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Confidence</div>
                    <div className={`text-lg font-mono font-semibold ${selectedDecision.confidence >= 0.8 ? 'text-green-400' : selectedDecision.confidence >= 0.7 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {(selectedDecision.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                  {selectedDecision.riskScore !== undefined && (
                    <div>
                      <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Risk Score</div>
                      <div className={`text-lg font-mono font-semibold ${selectedDecision.riskScore <= 0.3 ? 'text-green-400' : selectedDecision.riskScore <= 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {(selectedDecision.riskScore * 100).toFixed(0)}%
                      </div>
                    </div>
                  )}
                </div>

                {(selectedDecision.maxProfit !== undefined || selectedDecision.maxLoss !== undefined) && (
                  <div className="grid grid-cols-2 gap-3">
                    {selectedDecision.maxProfit !== undefined && (
                      <div>
                        <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Max Profit</div>
                        <div className="text-sm font-mono text-green-400">${selectedDecision.maxProfit.toFixed(2)}</div>
                      </div>
                    )}
                    {selectedDecision.maxLoss !== undefined && (
                      <div>
                        <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Max Loss</div>
                        <div className="text-sm font-mono text-red-400">${selectedDecision.maxLoss.toFixed(2)}</div>
                      </div>
                    )}
                  </div>
                )}

                {selectedDecision.explanation && (
                  <div>
                    <div className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Explanation</div>
                    <div className="text-sm text-neutral-300 leading-relaxed bg-neutral-950 border border-neutral-800 rounded p-3">
                      {selectedDecision.explanation}
                    </div>
                  </div>
                )}

                {selectedDecision.status === 'rejected' && selectedDecision.rejectionCode && (
                  <div>
                    <div className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Rejection Details</div>
                    <div className="bg-red-950/20 border border-red-900/50 rounded p-3">
                      <div className="font-mono text-sm text-red-400 mb-1">{selectedDecision.rejectionCode}</div>
                      {selectedDecision.rejectionReason && (
                        <div className="text-xs text-neutral-400">{selectedDecision.rejectionReason}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
