import { ArbTracker } from '@/arb/components/ArbTracker';
import { useHITLReview } from '@/tcc/hooks/useHITLReview';
import { cn } from '@/tcc/lib/cn';

import '@/tcc/styles/hitl.css';

const INVALIDATION_MESSAGES = {
  drift_exceeded: 'Invalidated — live price drift exceeded 0.5% from 08:01 ET anchor',
  cutoff_expired: 'Invalidated — no authorization by 09:45 ET hard cutoff',
  signal_invalidated: 'Invalidated — operator reject or pipeline signal_invalidated',
} as const;

export interface HITLReviewProps {
  jobId?: string;
  livePrice?: number;
}

export function HITLReview({ jobId, livePrice }: HITLReviewProps) {
  const hitl = useHITLReview({ jobId, livePrice });

  const phaseShort =
    hitl.windows.phase === 'soft_preopen'
      ? 'Soft window'
      : hitl.windows.phase === 'hard_window'
        ? 'Hard window'
        : hitl.windows.phase === 'closed'
          ? 'Closed'
          : 'Pre-review';

  const driftClass =
    hitl.drift === 'critical'
      ? 'hitl-drift--critical'
      : hitl.drift === 'warning'
        ? 'hitl-drift--warning'
        : 'hitl-drift--ok';

  return (
    <div className="hitl-shell hitl-shell--simple" data-testid="hitl-review">
      <header className="hitl-header hitl-header--compact">
        <div className="hitl-header__brand">
          <div className="hitl-header__title">Command Center</div>
          <span className="hitl-phase-short">{phaseShort}</span>
        </div>

        <div className="hitl-status-row">
          <span
            className={cn(
              'hitl-countdown hitl-countdown--sm',
              (hitl.invalidated || !hitl.windows.countdownActive) && 'hitl-countdown--stopped',
            )}
            data-testid="hitl-countdown"
          >
            {hitl.invalidated || !hitl.windows.countdownActive
              ? '—:—'
              : hitl.windows.remainingLabel}
          </span>
          <span className={cn('hitl-drift hitl-drift--sm', driftClass)} data-testid="hitl-drift">
            {hitl.manifest.ticker} · drift {hitl.manifest.anchorPrice > 0 ? hitl.driftPct.toFixed(2) : '—'}% ·
            live {hitl.effectiveLive > 0 ? hitl.effectiveLive.toFixed(2) : '…'}
          </span>
          {hitl.gatesPassed !== null ? (
            <span
              className={cn(
                'hitl-gate-badge',
                hitl.gatesPassed ? 'hitl-gate-badge--pass' : 'hitl-gate-badge--fail',
              )}
              data-testid="hitl-gates-badge"
            >
              Gates {hitl.gatesPassed ? 'PASS' : 'FAIL'}
            </span>
          ) : null}
        </div>
      </header>

      {hitl.invalidated && hitl.invalidationReason ? (
        <div className="hitl-invalidation" data-testid="hitl-invalidation">
          {INVALIDATION_MESSAGES[hitl.invalidationReason]}
        </div>
      ) : null}

      <div className="hitl-main">
        <ArbTracker />
      </div>

      <footer className="hitl-actions hitl-actions--compact">
        <div className="hitl-manifest-compact" aria-label="Order manifest">
          <span>Anchor {hitl.manifest.anchorPrice > 0 ? hitl.manifest.anchorPrice.toFixed(2) : '…'}</span>
          <span>Cost {fmt(hitl.manifest.costEst, 2)}</span>
          <span>μ {fmt(hitl.manifest.bullishAgentRatio)}</span>
        </div>
        <div className="hitl-actions__left">
          <button
            type="button"
            className="hitl-btn hitl-btn--sm"
            disabled={hitl.pipelineBusy}
            onClick={hitl.runDryCycle}
            data-testid="hitl-run-dry-cycle"
          >
            {hitl.pipelineBusy ? 'Running…' : 'Dry Cycle'}
          </button>
        </div>
        <div className="hitl-actions__right">
          <button
            type="button"
            className="hitl-btn hitl-btn--primary hitl-btn--sm"
            disabled={!hitl.preAuthorizeEnabled}
            onClick={hitl.handlePreAuthorize}
            data-testid="hitl-pre-authorize"
          >
            Pre-Auth
          </button>
          <button
            type="button"
            className="hitl-btn hitl-btn--primary hitl-btn--sm"
            disabled={!hitl.authorizeEnabled}
            onClick={hitl.handleAuthorize}
            data-testid="hitl-authorize"
          >
            Authorize
          </button>
          <button
            type="button"
            className="hitl-btn hitl-btn--danger hitl-btn--sm"
            disabled={!hitl.rejectEnabled}
            onClick={hitl.handleReject}
            data-testid="hitl-reject"
          >
            Reject
          </button>
        </div>
      </footer>
    </div>
  );
}

function fmt(value: number | undefined, digits = 4) {
  return value === undefined ? '—' : value.toFixed(digits);
}

export default HITLReview;
