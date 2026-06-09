import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  computeDriftPct,
  computeHITLWindows,
  driftLevel,
  type HITLWindowState,
} from '@/tcc/lib/hitlWindows';
import { usePipelineSSE } from '@/tcc/hooks/usePipelineSSE';
import { RISK_GATE_IDS } from '@/tcc/types/pipeline';
import { useLiveQuote } from '@/ui2/lib/liveQuoteStore';

export interface OrderManifest {
  ticker: string;
  anchorPrice: number;
  weightDelta?: number;
  costEst?: number;
  slippageBudget?: number;
  primaryCatalyst?: string;
  bullishAgentRatio?: number;
  socialPolarizationIndex?: number;
  confidenceIntervalUpper?: number;
  confidenceIntervalLower?: number;
}

export interface ProvenanceEntry {
  id: string;
  timestamp: string;
  message: string;
}

export type InvalidationReason =
  | 'drift_exceeded'
  | 'cutoff_expired'
  | 'signal_invalidated'
  | null;

export interface UseHITLReviewOptions {
  jobId?: string;
  manifest?: Partial<OrderManifest>;
  /** Simulated or live quote; polled externally if not provided */
  livePrice?: number;
  onPreAuthorize?: () => void;
  onAuthorize?: () => void;
  onReject?: () => void;
}

export function useHITLReview(options: UseHITLReviewOptions = {}) {
  const {
    jobId,
    manifest: manifestOverride,
    livePrice: livePriceProp,
    onPreAuthorize,
    onAuthorize,
    onReject,
  } = options;

  const ticker = manifestOverride?.ticker ?? 'AAPL';
  const liveQuote = useLiveQuote(livePriceProp === undefined ? ticker : undefined);
  const sse = usePipelineSSE({ jobId });
  const [windows, setWindows] = useState<HITLWindowState>(() => computeHITLWindows());
  const [anchorPrice, setAnchorPrice] = useState(manifestOverride?.anchorPrice ?? 0);
  const [invalidationReason, setInvalidationReason] = useState<InvalidationReason>(null);
  const [provenance, setProvenance] = useState<ProvenanceEntry[]>([]);
  const [authAction, setAuthAction] = useState<'none' | 'pre' | 'authorize' | 'reject'>('none');
  const [pipelineBusy, setPipelineBusy] = useState(false);
  const [gatesPassed, setGatesPassed] = useState<boolean | null>(null);

  const storeLive = liveQuote?.last ?? liveQuote?.price ?? 0;
  const quoteSource = liveQuote?.source ?? null;

  useEffect(() => {
    if (manifestOverride?.anchorPrice) return;
    if (storeLive > 0) {
      setAnchorPrice((prev) => (prev > 0 ? prev : storeLive));
    }
  }, [storeLive, manifestOverride?.anchorPrice]);

  const manifest: OrderManifest = useMemo(
    () => ({
      ticker,
      anchorPrice: anchorPrice || storeLive || 0,
      weightDelta: sse.execution.weight_delta,
      costEst: sse.execution.cost_est,
      slippageBudget: sse.execution.slippage_budget ?? 0.0015,
      primaryCatalyst: sse.director.primary_catalyst,
      bullishAgentRatio: sse.director.bullish_agent_ratio,
      socialPolarizationIndex: sse.director.sigma_sq,
      confidenceIntervalUpper: sse.quant.confidence_interval_upper,
      confidenceIntervalLower: sse.quant.confidence_interval_lower,
      ...manifestOverride,
    }),
    [manifestOverride, sse, anchorPrice, storeLive, ticker],
  );

  const effectiveLive = livePriceProp ?? storeLive;
  const driftPct = computeDriftPct(manifest.anchorPrice, effectiveLive);
  const drift = driftLevel(driftPct);

  const appendProvenance = useCallback((message: string) => {
    setProvenance((prev) => [
      ...prev.slice(-99),
      {
        id: `${Date.now()}-${prev.length}`,
        timestamp: new Date().toISOString(),
        message,
      },
    ]);
  }, []);

  const hydratePipelineState = useCallback(async (sym: string) => {
    try {
      const res = await fetch(`/api/v1/pipeline/state?ticker=${encodeURIComponent(sym)}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        hydrated?: boolean;
        anchor_price?: number;
        cost_est?: number;
        slippage_budget?: number;
        all_gates_passed?: boolean;
        gate_results?: Record<string, string>;
      };
      if (!data.hydrated) return;
      if (data.anchor_price && data.anchor_price > 0) {
        setAnchorPrice(data.anchor_price);
      }
      if (data.all_gates_passed !== undefined) {
        setGatesPassed(data.all_gates_passed);
      }
      if (data.gate_results) {
        const summary = Object.entries(data.gate_results)
          .filter(([, v]) => v === 'pass' || v === 'fail')
          .map(([k, v]) => `${k}:${v}`)
          .join(' ');
        if (summary) appendProvenance(`Pipeline state — ${summary}`);
      }
    } catch {
      /* non-fatal */
    }
  }, [appendProvenance]);

  useEffect(() => {
    void hydratePipelineState(ticker);
  }, [ticker, hydratePipelineState]);

  const runDryCycle = useCallback(async () => {
    if (pipelineBusy) return;
    setPipelineBusy(true);
    appendProvenance(`Running dry cycle for ${ticker}…`);
    try {
      const res = await fetch('/api/v1/pipeline/run-cycle?position_size=100', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker }),
      });
      if (!res.ok) {
        appendProvenance('Dry cycle failed — check API logs');
        return;
      }
      const data = (await res.json()) as {
        all_passed?: boolean;
        gates?: { cost_est?: number; anchor_price?: number; notional?: number };
      };
      if (data.gates?.anchor_price) setAnchorPrice(data.gates.anchor_price);
      setGatesPassed(data.all_passed ?? null);
      appendProvenance(
        data.all_passed
          ? `Dry cycle complete — gates pass, cost_est=$${data.gates?.cost_est?.toFixed(2) ?? '?'}`
          : 'Dry cycle complete — gate failure',
      );
      sse.reset();
    } catch {
      appendProvenance('Dry cycle request failed');
    } finally {
      setPipelineBusy(false);
    }
  }, [appendProvenance, pipelineBusy, sse, ticker]);

  useEffect(() => {
    const tick = () => setWindows(computeHITLWindows());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (windows.phase === 'expired' && invalidationReason === null) {
      setInvalidationReason('cutoff_expired');
      appendProvenance('Signal auto-deleted — no action by 09:45 ET cutoff');
    }
  }, [windows.phase, invalidationReason, appendProvenance]);

  useEffect(() => {
    if (drift === 'critical' && invalidationReason === null) {
      setInvalidationReason('drift_exceeded');
      appendProvenance(
        `Drift invalidation — live price ${driftPct.toFixed(3)}% from 08:01 ET anchor`,
      );
    }
  }, [drift, driftPct, invalidationReason, appendProvenance]);

  useEffect(() => {
    if (sse.execution.invalidated && invalidationReason === null) {
      setInvalidationReason('signal_invalidated');
      appendProvenance('Signal invalidated via SSE signal_invalidated event');
    }
  }, [sse.execution.invalidated, invalidationReason, appendProvenance]);

  useEffect(() => {
    if (sse.lastEvent === 'mirofish_mc_progress' && sse.director.sigma_sq !== undefined) {
      appendProvenance(`MC σ²=${sse.director.sigma_sq?.toFixed(6)} μ=${sse.director.bullish_agent_ratio?.toFixed(4)}`);
    }
    if (sse.lastEvent === 'spci_applied') {
      appendProvenance(
        `SPCI applied — CI [${sse.quant.confidence_interval_lower}, ${sse.quant.confidence_interval_upper}]`,
      );
    }
    if (sse.lastEvent === 'risk_gate_evaluation') {
      const gates = RISK_GATE_IDS.map(
        (g) => `${g}:${sse.risk.gates[g]}`,
      ).join(' ');
      appendProvenance(`Risk gates — ${gates}`);
    }
  }, [sse.lastEvent, sse.director, sse.quant, sse.risk.gates, appendProvenance]);

  const invalidated = invalidationReason !== null;

  const preAuthorizeEnabled = windows.preAuthorizeEnabled && !invalidated;
  const authorizeEnabled = windows.authorizeEnabled && !invalidated;
  const rejectEnabled = windows.rejectEnabled;

  const handlePreAuthorize = async () => {
    if (!preAuthorizeEnabled) return;
    setAuthAction('pre');
    appendProvenance('Operator PRE-AUTHORIZED (soft window 08:05 ET)');
    if (jobId) {
      try {
        await fetch('/api/v1/orchestration/hitl/pre-authorize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            job_id: jobId,
            ticker: manifest.ticker,
            operator_id: 'dry-run-operator',
          }),
        });
      } catch {
        appendProvenance('Pre-authorize API call failed');
      }
    }
    onPreAuthorize?.();
  };

  const handleAuthorize = () => {
    if (!authorizeEnabled) return;
    setAuthAction('authorize');
    appendProvenance('Operator AUTHORIZED at market open');
    onAuthorize?.();
  };

  const handleReject = () => {
    setAuthAction('reject');
    setInvalidationReason('signal_invalidated');
    appendProvenance('Operator REJECTED manifest');
    onReject?.();
  };

  return {
    sse,
    manifest,
    windows,
    driftPct,
    drift,
    effectiveLive,
    invalidated,
    invalidationReason,
    provenance,
    authAction,
    preAuthorizeEnabled,
    authorizeEnabled,
    rejectEnabled,
    handlePreAuthorize,
    handleAuthorize,
    handleReject,
    quoteSource,
    pipelineBusy,
    gatesPassed,
    runDryCycle,
  };
}
