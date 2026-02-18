/**
 * RunControls — "Validate" button + status indicator.
 */

interface Props {
  onValidate: () => void;
  loading: boolean;
  disabled: boolean;
}

export function RunControls({ onValidate, loading, disabled }: Props) {
  return (
    <div className="flex items-center gap-3" data-testid="run-controls">
      <button
        onClick={onValidate}
        disabled={disabled || loading}
        className={`
          px-6 py-2.5 rounded font-semibold text-sm transition-colors
          ${disabled || loading
            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
            : 'bg-brand hover:bg-brand/90 text-white'
          }
        `}
        data-testid="validate-btn"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Validating…
          </span>
        ) : (
          'Validate'
        )}
      </button>
    </div>
  );
}
