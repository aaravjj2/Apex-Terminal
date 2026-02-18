/**
 * Provider Pill — Shows data source and mode (DEMO/LOCAL + replay/cache status)
 * 
 * Requirements (v1.14):
 * - Stable testids
 * - No animated transitions
 * - Deterministic rendering
 */

export interface ProviderPillProps {
  provider: string;  // 'demo', 'yahoo', 'alpaca', 'tradier'
  mode: 'DEMO' | 'LOCAL';
  source: 'replay' | 'cache' | 'demo' | 'live';
  testIdPrefix?: string;
}

export function ProviderPill({ provider, mode, source, testIdPrefix = 'provider-pill' }: ProviderPillProps) {
  // Deterministic color mapping
  const modeColor = mode === 'DEMO' ? 'bg-amber-600' : 'bg-blue-600';
  const sourceColor = 
    source === 'replay' ? 'bg-green-700' :
    source === 'cache' ? 'bg-gray-600' :
    source === 'live' ? 'bg-red-600' :
    'bg-purple-600';  // demo
  
  return (
    <div 
      className="inline-flex items-center gap-1 text-xs font-mono"
      data-testid={testIdPrefix}
    >
      {/* Mode badge */}
      <span 
        className={`${modeColor} text-white px-2 py-0.5 rounded`}
        data-testid={`${testIdPrefix}-mode`}
      >
        {mode}
      </span>
      
      {/* Provider badge */}
      <span 
        className="bg-gray-700 text-gray-200 px-2 py-0.5 rounded"
        data-testid={`${testIdPrefix}-provider`}
      >
        {provider.toUpperCase()}
      </span>
      
      {/* Source badge */}
      <span 
        className={`${sourceColor} text-white px-2 py-0.5 rounded`}
        data-testid={`${testIdPrefix}-source`}
      >
        {source.toUpperCase()}
      </span>
    </div>
  );
}

/**
 * Mode Banner — Persistent banner showing Mode + Replay Status
 * 
 * Requirements:
 * - No animated transitions
 * - Deterministic text
 * - Stable testids
 */

export interface ModeBannerProps {
  mode: 'DEMO' | 'LOCAL';
  replayAvailable: boolean;
  replayEnabled: boolean;
}

export function ModeBanner({ mode, replayAvailable, replayEnabled }: ModeBannerProps) {
  const bgColor = mode === 'DEMO' ? 'bg-amber-50 border-amber-300' : 'bg-blue-50 border-blue-300';
  const textColor = mode === 'DEMO' ? 'text-amber-900' : 'text-blue-900';
  
  let message = '';
  if (mode === 'DEMO') {
    message = replayAvailable 
      ? 'DEMO MODE — Using replay artifacts (100% deterministic)'
      : 'DEMO MODE — Using fixture files (no network calls)';
  } else {
    message = replayEnabled
      ? 'LOCAL MODE — Fetching live data (replays will be saved)'
      : 'LOCAL MODE — Fetching live data (read-only)';
  }
  
  return (
    <div 
      className={`w-full border-l-4 ${bgColor} px-4 py-2`}
      data-testid="mode-banner"
    >
      <div className={`text-sm font-medium ${textColor}`} data-testid="mode-banner-text">
        {message}
      </div>
      {replayAvailable && (
        <div className="text-xs text-gray-600 mt-1" data-testid="mode-banner-detail">
          Replay artifacts available — provider network calls blocked
        </div>
      )}
    </div>
  );
}
