/**
 * UI2 ProgressBar Component
 * Progress indicators for order fills, processing status, etc.
 */

export interface ProgressBarProps {
  value: number; // 0-100
  variant?: 'default' | 'success' | 'danger' | 'warning';
  showLabel?: boolean;
  testId?: string;
  height?: string;
}

export function ProgressBar({
  value,
  variant = 'default',
  showLabel = false,
  testId,
  height = '4px',
}: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));
  const barClassName =
    variant === 'default'
      ? 'ui2-progress-bar'
      : `ui2-progress-bar ui2-progress-bar-${variant}`;

  return (
    <div data-testid={testId} style={{ position: 'relative' }}>
      <div className="ui2-progress" style={{ height }}>
        <div
          className={barClassName}
          style={{ width: `${clampedValue}%` }}
          role="progressbar"
          aria-valuenow={clampedValue}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      {showLabel && (
        <div
          className="ui2-micro"
          style={{
            marginTop: '4px',
            color: 'var(--ui2-text-tertiary)',
            textAlign: 'right',
          }}
        >
          {clampedValue.toFixed(0)}%
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */

export interface ConfidenceBarProps {
  confidence: number; // 0-1
  label?: string;
  testId?: string;
}

export function ConfidenceBar({ confidence, label, testId }: ConfidenceBarProps) {
  const clampedValue = Math.min(1, Math.max(0, confidence));
  const percentage = clampedValue * 100;

  // Determine confidence level
  let levelClass = 'ui2-confidence-fill-low';
  if (confidence >= 0.7) {
    levelClass = 'ui2-confidence-fill-high';
  } else if (confidence >= 0.4) {
    levelClass = 'ui2-confidence-fill-medium';
  }

  return (
    <div data-testid={testId} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {label && (
        <div className="ui2-micro" style={{ color: 'var(--ui2-text-tertiary)' }}>
          {label}
        </div>
      )}
      <div className="ui2-confidence-bar">
        <div
          className={`ui2-confidence-fill ${levelClass}`}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}
