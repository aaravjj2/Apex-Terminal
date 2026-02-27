const BG='#0a0a0a'; const PANEL='#111111'; const BORDER='#1e1e1e';
const AMBER='#f5a623'; const GREEN='#26a69a'; const RED='#ef5350';
const BLUE='#42a5f5'; const PURPLE='#ab47bc'; const SUBTLE='#555';
const TEXT='#d1d4dc'; const MONO='"Roboto Mono","Courier New",monospace';

import React, { useEffect, useState } from 'react';
import { autopilotApi } from '../api';
import type { TradeCandidate } from '../types';

interface ProposalResponse {
  cycle_id: string; candidates_generated: number;
  candidates_by_template: Record<string, number>; selected_count: number;
  selection_method: string; timestamp: string;
  candidates?: TradeCandidate[]; llm_rationale?: string;
}

const fmt$ = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(v);
const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

const TEMPLATE_LABELS: Record<string, string> = {
  put_credit_spread: 'Put Credit Spread', call_credit_spread: 'Call Credit Spread',
  iron_condor: 'Iron Condor', call_debit_spread: 'Call Debit Spread', put_debit_spread: 'Put Debit Spread',
};

function CandidateCard({ candidate }: { candidate: TradeCandidate }) {
  const sc: Record<string, string> = { pending: SUBTLE, selected: GREEN, rejected: RED, executed: BLUE };
  const col = sc[candidate.status] || SUBTLE;
  const speakRationale = (e: React.MouseEvent) => {
    e.stopPropagation();
    fetch('/api/v1/tts/speak', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: `Symbol ${candidate.symbol}. ${candidate.rationale}` }) })
      .then(r => r.blob()).then(b => { const u = URL.createObjectURL(b); import('../../tts/AudioQueue').then(m => m.audioQueue.enqueue(u)); })
      .catch(err => console.error('TTS Failed', err));
  };
  return (
    <div data-testid={`candidate-card-${candidate.id}`} style={{ background: PANEL, border: `2px solid ${col}44`, borderRadius: 3, padding: '12px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{candidate.symbol}</div>
          <div style={{ fontSize: 10, color: SUBTLE, marginTop: 2 }}>{candidate.template}</div>
        </div>
        <span style={{ fontSize: 9, padding: '2px 7px', background: col + '22', color: col, border: `1px solid ${col}44`, borderRadius: 2, fontWeight: 700 }}>{candidate.status.toUpperCase()}</span>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: '0.1em', marginBottom: 4 }}>LEGS</div>
        {candidate.legs.map((leg: any, i: number) => (
          <div key={i} style={{ fontSize: 10, color: TEXT, padding: '1px 0' }}>
            {leg.side.toUpperCase()} {leg.quantity}x {leg.option_type.toUpperCase()} ${leg.strike} @ {leg.expiry.slice(0, 10)}
          </div>
        ))}
      </div>

      {candidate.rationale && (
        <button data-testid="speak-rationale-btn" onClick={speakRationale}
          style={{ width: '100%', marginBottom: 10, padding: '4px 0', fontSize: 10, background: PURPLE + '22', color: PURPLE, border: `1px solid ${PURPLE}44`, borderRadius: 2, cursor: 'pointer', fontFamily: MONO, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
           Speak Rationale
        </button>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 8, textAlign: 'center' }}>
        <div><div style={{ fontSize: 9, color: SUBTLE }}>MAX LOSS</div><div style={{ fontSize: 12, fontWeight: 700, color: RED, fontFamily: MONO }}>{fmt$(candidate.max_loss)}</div></div>
        <div><div style={{ fontSize: 9, color: SUBTLE }}>MAX PROFIT</div><div style={{ fontSize: 12, fontWeight: 700, color: GREEN, fontFamily: MONO }}>{fmt$(candidate.max_profit)}</div></div>
        <div><div style={{ fontSize: 9, color: SUBTLE }}>POP</div><div style={{ fontSize: 12, fontWeight: 700, color: BLUE, fontFamily: MONO }}>{fmtPct(candidate.pop)}</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4, textAlign: 'center', borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>
        {[
          { label: 'DTE', value: candidate.dte },
          { label: 'IV RANK', value: fmtPct(candidate.iv_rank) },
          { label: 'LIQUIDITY', value: candidate.liquidity_score.toFixed(1) },
          { label: 'SCORE', value: candidate.adjusted_score.toFixed(2) },
        ].map(m => <div key={m.label}><div style={{ fontSize: 9, color: SUBTLE }}>{m.label}</div><div style={{ fontSize: 10, color: TEXT, fontFamily: MONO }}>{m.value}</div></div>)}
      </div>

      {candidate.status === 'selected' && candidate.selection_reason && (
        <div style={{ marginTop: 8, padding: '5px 8px', background: GREEN + '11', border: `1px solid ${GREEN}44`, borderRadius: 2, fontSize: 10, color: GREEN }}> {candidate.selection_reason}</div>
      )}
      {candidate.status === 'rejected' && candidate.rejection_reasons?.length > 0 && (
        <div style={{ marginTop: 8, padding: '5px 8px', background: RED + '11', border: `1px solid ${RED}44`, borderRadius: 2, fontSize: 10, color: RED }}> {candidate.rejection_reasons.join(', ')}</div>
      )}
    </div>
  );
}

export const AutopilotProposals: React.FC = () => {
  const [proposals, setProposals] = useState<ProposalResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'selected' | 'rejected'>('all');

  const fetchProposals = async () => {
    setIsLoading(true); setError(null);
    try { setProposals(await autopilotApi.getProposals()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to fetch proposals'); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchProposals(); }, []);

  const filtered = proposals?.candidates?.filter(c => {
    if (filter === 'all') return true;
    if (filter === 'selected') return c.status === 'selected' || c.status === 'executed';
    if (filter === 'rejected') return c.status === 'rejected';
    return true;
  }) ?? [];

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160, color: SUBTLE, fontSize: 11, fontFamily: MONO }}>
       Loading proposals
    </div>
  );

  if (error) return (
    <div style={{ margin: 16, padding: '12px 16px', background: RED + '11', border: `1px solid ${RED}44`, borderRadius: 2 }}>
      <div style={{ color: RED, fontSize: 11, marginBottom: 8 }}>Error: {error}</div>
      <button onClick={fetchProposals} style={{ fontSize: 10, background: RED, color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 2, cursor: 'pointer', fontFamily: MONO }}>RETRY</button>
    </div>
  );

  if (!proposals || proposals.candidates_generated === 0) return (
    <div data-testid="proposals-empty" style={{ padding: '40px 20px', textAlign: 'center', fontFamily: MONO }}>
      <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.3 }}></div>
      <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, marginBottom: 6 }}>No Proposals Yet</div>
      <div style={{ fontSize: 11, color: SUBTLE }}>Run an autopilot cycle to generate trade candidates.</div>
    </div>
  );

  return (
    <div data-testid="autopilot-proposals" style={{ padding: 16, fontFamily: MONO }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>TRADE PROPOSALS</div>
          <div style={{ fontSize: 10, color: SUBTLE, marginTop: 2 }}>Cycle {proposals.cycle_id}  {new Date(proposals.timestamp).toLocaleString()}</div>
        </div>
        <button onClick={fetchProposals} style={{ fontSize: 10, background: BLUE, color: '#000', border: 'none', padding: '5px 12px', borderRadius: 2, cursor: 'pointer', fontFamily: MONO, fontWeight: 700 }}> REFRESH</button>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 12 }}>
        {[
          { label: 'GENERATED', value: proposals.candidates_generated, color: TEXT },
          { label: 'SELECTED', value: proposals.selected_count, color: GREEN },
          { label: 'REJECTED', value: proposals.candidates_generated - proposals.selected_count, color: RED },
          { label: 'METHOD', value: (proposals.selection_method ?? 'unknown').replace('_', ' ').toUpperCase(), color: BLUE },
        ].map(m => (
          <div key={m.label} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '8px 12px' }}>
            <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: '0.1em', marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: m.color, fontFamily: MONO }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Template Breakdown */}
      <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '10px 14px', marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: SUBTLE, letterSpacing: '0.1em', marginBottom: 8 }}>CANDIDATES BY TEMPLATE</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {Object.entries(proposals.candidates_by_template ?? {}).map(([t, count]) => (
            <span key={t} style={{ fontSize: 10, padding: '2px 8px', background: BORDER, color: TEXT, borderRadius: 12 }}>
              {TEMPLATE_LABELS[t] || t}: <strong>{String(count)}</strong>
            </span>
          ))}
        </div>
      </div>

      {/* LLM Rationale */}
      {proposals.llm_rationale && (
        <div style={{ background: PURPLE + '11', border: `1px solid ${PURPLE}44`, borderRadius: 2, padding: '10px 14px', marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: PURPLE, marginBottom: 6 }}> LLM RATIONALE</div>
          <div style={{ fontSize: 11, color: TEXT, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{proposals.llm_rationale}</div>
        </div>
      )}

      {/* Filter */}
      {proposals.candidates && proposals.candidates.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 2, borderBottom: `1px solid ${BORDER}`, marginBottom: 12 }}>
            {(['all', 'selected', 'rejected'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 14px', fontSize: 10, fontWeight: 700, background: 'none', border: 'none', borderBottom: `2px solid ${filter === f ? AMBER : 'transparent'}`, color: filter === f ? AMBER : SUBTLE, cursor: 'pointer', fontFamily: MONO, letterSpacing: '0.06em' }}>
                {f === 'all' ? 'ALL CANDIDATES' : f.toUpperCase()}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {filtered.map(c => <CandidateCard key={c.id} candidate={c} />)}
          </div>
          {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '24px 0', color: SUBTLE, fontSize: 11 }}>No candidates match the current filter.</div>}
        </>
      )}
    </div>
  );
};

export default AutopilotProposals;