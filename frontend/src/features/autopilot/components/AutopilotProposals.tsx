/**
 * Autopilot Proposals Component
 * Displays trade candidates and LLM rationale from the autopilot cycle.
 */

import React, { useEffect, useState } from 'react';
import { autopilotApi } from '../api';
import type { TradeCandidate } from '../types';

interface ProposalResponse {
  cycle_id: string;
  candidates_generated: number;
  candidates_by_template: Record<string, number>;
  selected_count: number;
  selection_method: string;
  timestamp: string;
  candidates?: TradeCandidate[];
  llm_rationale?: string;
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercent = (value: number): string => {
  return `${(value * 100).toFixed(1)}%`;
};

interface CandidateCardProps {
  candidate: TradeCandidate;
}

const CandidateCard: React.FC<CandidateCardProps> = ({ candidate }) => {
  const statusColors: Record<string, string> = {
    pending: 'border-gray-500 bg-gray-800',
    selected: 'border-green-500 bg-green-900/20',
    rejected: 'border-red-500 bg-red-900/20',
    executed: 'border-blue-500 bg-blue-900/20',
  };

  const statusBadgeColors: Record<string, string> = {
    pending: 'bg-gray-500',
    selected: 'bg-green-500',
    rejected: 'bg-red-500',
    executed: 'bg-blue-500',
  };

  return (
    <div
      className={`rounded-lg border-2 p-4 ${statusColors[candidate.status] || statusColors.pending}`}
      data-testid={`candidate-card-${candidate.id}`}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-lg font-bold text-white">{candidate.symbol}</h3>
          <p className="text-sm text-gray-400">{candidate.template}</p>
        </div>
        <span
          className={`px-2 py-1 text-xs font-semibold text-white rounded ${statusBadgeColors[candidate.status] || statusBadgeColors.pending}`}
        >
          {candidate.status.toUpperCase()}
        </span>
      </div>

      {/* Legs */}
      <div className="mb-3">
        <h4 className="text-xs text-gray-500 uppercase mb-1">Legs</h4>
        <div className="space-y-1">
          {candidate.legs.map((leg, idx) => (
            <div key={idx} className="text-sm text-gray-300">
              {leg.side.toUpperCase()} {leg.quantity}x {leg.option_type.toUpperCase()} ${leg.strike} @ {leg.expiry.slice(0, 10)}
            </div>
          ))}
        </div>
      </div>


      {/* TTS Button */}
      {
        candidate.rationale && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              // Send to TTS
              fetch('http://localhost:8000/api/v1/tts/speak', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: `Symbol ${candidate.symbol}. ${candidate.rationale}` })
              })
                .then(res => res.blob())
                .then(blob => {
                  const url = URL.createObjectURL(blob);
                  import('../../tts/AudioQueue').then(m => m.audioQueue.enqueue(url));
                })
                .catch(err => console.error("TTS Failed", err));
            }}
            className="mb-3 px-2 py-1 text-xs bg-brand/20 hover:bg-brand/30 text-brand rounded flex items-center gap-1 transition-colors w-full justify-center"
            title="Read Rationale"
          >
            <span>🔊</span> Speak Rationale
          </button>
        )
      }

      {/* Risk/Reward */}
      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
        <div>
          <p className="text-xs text-gray-500">Max Loss</p>
          <p className="text-sm font-semibold text-red-400">{formatCurrency(candidate.max_loss)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Max Profit</p>
          <p className="text-sm font-semibold text-green-400">{formatCurrency(candidate.max_profit)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">POP</p>
          <p className="text-sm font-semibold text-blue-400">{formatPercent(candidate.pop)}</p>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-2 text-center border-t border-gray-700 pt-2">
        <div>
          <p className="text-xs text-gray-500">DTE</p>
          <p className="text-xs text-white">{candidate.dte}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">IV Rank</p>
          <p className="text-xs text-white">{formatPercent(candidate.iv_rank)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Liquidity</p>
          <p className="text-xs text-white">{candidate.liquidity_score.toFixed(1)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Score</p>
          <p className="text-xs text-white">{candidate.adjusted_score.toFixed(2)}</p>
        </div>
      </div>

      {/* Selection/Rejection reason */}
      {
        candidate.status === 'selected' && candidate.selection_reason && (
          <div className="mt-2 p-2 bg-green-900/30 rounded text-xs text-green-300">
            ✓ {candidate.selection_reason}
          </div>
        )
      }
      {
        candidate.status === 'rejected' && candidate.rejection_reasons.length > 0 && (
          <div className="mt-2 p-2 bg-red-900/30 rounded text-xs text-red-300">
            ✗ {candidate.rejection_reasons.join(', ')}
          </div>
        )
      }
    </div >
  );
};

interface TemplateSummaryProps {
  byTemplate: Record<string, number>;
}

const TemplateSummary: React.FC<TemplateSummaryProps> = ({ byTemplate }) => {
  const templateLabels: Record<string, string> = {
    put_credit_spread: 'Put Credit Spread',
    call_credit_spread: 'Call Credit Spread',
    iron_condor: 'Iron Condor',
    call_debit_spread: 'Call Debit Spread',
    put_debit_spread: 'Put Debit Spread',
  };

  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(byTemplate ?? {}).map(([template, count]) => (
        <div
          key={template}
          className="px-3 py-1 bg-gray-700 rounded-full text-sm"
        >
          <span className="text-gray-300">{templateLabels[template] || template}:</span>{' '}
          <span className="font-semibold text-white">{count}</span>
        </div>
      ))}
    </div>
  );
};

export const AutopilotProposals: React.FC = () => {
  const [proposals, setProposals] = useState<ProposalResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'selected' | 'rejected'>('all');

  const fetchProposals = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await autopilotApi.getProposals();
      setProposals(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch proposals');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, []);

  const filteredCandidates = proposals?.candidates?.filter((c) => {
    if (filter === 'all') return true;
    if (filter === 'selected') return c.status === 'selected' || c.status === 'executed';
    if (filter === 'rejected') return c.status === 'rejected';
    return true;
  }) ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-900/50 border border-red-500 rounded-lg">
        <p className="text-red-400">Error loading proposals: {error}</p>
        <button
          onClick={fetchProposals}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!proposals || proposals.candidates_generated === 0) {
    return (
      <div className="p-8 text-center" data-testid="proposals-empty">
        <div className="text-6xl mb-4">🔍</div>
        <h2 className="text-xl font-semibold text-gray-300 mb-2">No Proposals Yet</h2>
        <p className="text-gray-500 mb-4">
          Run an autopilot cycle to generate trade candidates.
        </p>
        <p className="text-gray-600 text-sm">
          Candidates will appear here after scanning the market for opportunities.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="autopilot-proposals">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Trade Proposals</h2>
          <p className="text-gray-400 text-sm">
            Cycle {proposals.cycle_id} • {new Date(proposals.timestamp).toLocaleString()}
          </p>
        </div>
        <button
          onClick={fetchProposals}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
        >
          <span>↻</span> Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-gray-400 text-sm">Candidates Generated</h3>
          <p className="text-3xl font-bold text-white">{proposals.candidates_generated}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-gray-400 text-sm">Selected</h3>
          <p className="text-3xl font-bold text-green-400">{proposals.selected_count}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-gray-400 text-sm">Rejected</h3>
          <p className="text-3xl font-bold text-red-400">
            {proposals.candidates_generated - proposals.selected_count}
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-gray-400 text-sm">Selection Method</h3>
          <p className="text-lg font-semibold text-blue-400 capitalize">
            {(proposals.selection_method ?? 'unknown').replace('_', ' ')}
          </p>
        </div>
      </div>

      {/* Template Breakdown */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-gray-400 text-sm mb-3">Candidates by Strategy Template</h3>
        <TemplateSummary byTemplate={proposals.candidates_by_template} />
      </div>

      {/* LLM Rationale (if available) */}
      {proposals.llm_rationale && (
        <div className="bg-purple-900/30 border border-purple-500 rounded-lg p-4">
          <h3 className="text-purple-300 font-semibold mb-2 flex items-center gap-2">
            <span>🤖</span> LLM Rationale
          </h3>
          <p className="text-gray-300 text-sm whitespace-pre-wrap">
            {proposals.llm_rationale}
          </p>
        </div>
      )}

      {/* Filter Tabs */}
      {proposals.candidates && proposals.candidates.length > 0 && (
        <>
          <div className="flex gap-2 border-b border-gray-700 pb-2">
            {(['all', 'selected', 'rejected'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-t font-medium transition-colors ${filter === f
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white'
                  }`}
              >
                {f === 'all' ? 'All Candidates' : f === 'selected' ? 'Selected' : 'Rejected'}
              </button>
            ))}
          </div>

          {/* Candidate Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCandidates.map((candidate) => (
              <CandidateCard key={candidate.id} candidate={candidate} />
            ))}
          </div>

          {filteredCandidates.length === 0 && (
            <p className="text-center text-gray-500 py-8">
              No candidates match the current filter.
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default AutopilotProposals;
