/**
 * TelemetryUI2 Page - Wave 12 v1.115
 * Operator-grade telemetry timeline with filters, detail drawer, copy JSON
 */

import { useState, useSyncExternalStore } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Copy, Filter, RefreshCw, ChevronRight, CheckCircle, AlertCircle, Info, XCircle } from 'lucide-react';

interface TelemetryEvent {
  sequence: number;
  timestamp: string;
  level: 'debug' | 'info' | 'warning' | 'error';
  category: string;
  message: string;
  metadata?: Record<string, unknown>;
  testId?: string;
}

// Simple telemetry store for DEMO mode
const telemetryEvents: TelemetryEvent[] = [
  {
    sequence: 100,
    timestamp: new Date().toISOString(),
    level: 'info',
    category: 'trading',
    message: 'Order executed successfully',
    metadata: { order_id: 'ORD-001', symbol: 'AAPL', quantity: 100 },
  },
  {
    sequence: 99,
    timestamp: new Date(Date.now() - 5000).toISOString(),
    level: 'info',
    category: 'telemetry',
    message: 'Telemetry system initialized',
    metadata: { version: '1.103', max_events: 500 },
  },
  {
    sequence: 98,
    timestamp: new Date(Date.now() - 10000).toISOString(),
    level: 'warning',
    category: 'market_data',
    message: 'Market data feed reconnected after brief interruption',
    metadata: { duration_ms: 1234, feed: 'demo' },
  },
  {
    sequence: 97,
    timestamp: new Date(Date.now() - 15000).toISOString(),
    level: 'info',
    category: 'autopilot_v3',
    message: 'Autopilot cycle completed',
    metadata: { decisions: 3, candidates: 5, rejections: 2 },
  },
  {
    sequence: 96,
    timestamp: new Date(Date.now() - 20000).toISOString(),
    level: 'debug',
    category: 'search',
    message: 'Search index updated',
    metadata: { backend: 'local', document_count: 150 },
  },
];

let listeners = new Set<() => void>();
const telemetryStore = {
  getEvents: () => telemetryEvents,
  getSequence: () => telemetryEvents[0]?.sequence || 0,
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

const levelIcons = {
  debug: Info,
  info: CheckCircle,
  warning: AlertCircle,
  error: XCircle,
};

const levelColors = {
  debug: 'text-neutral-400',
  info: 'text-blue-400',
  warning: 'text-yellow-400',
  error: 'text-red-400',
};

const levelBgColors = {
  debug: 'bg-neutral-800/50',
  info: 'bg-blue-950/30',
  warning: 'bg-yellow-950/30',
  error: 'bg-red-950/30',
};

export function TelemetryUI2() {
  const events = useSyncExternalStore(telemetryStore.subscribe, telemetryStore.getEvents);
  const lastSequence = useSyncExternalStore(telemetryStore.subscribe, telemetryStore.getSequence);

  const [selectedEvent, setSelectedEvent] = useState<TelemetryEvent | null>(null);
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [copied, setCopied] = useState<number | null>(null);

  // Filter events
  const filteredEvents = events.filter(event => {
    if (levelFilter !== 'all' && event.level !== levelFilter) return false;
    if (categoryFilter !== 'all' && event.category !== categoryFilter) return false;
    return true;
  });

  // Get unique levels and categories for filters
  const levels = ['all', ...Array.from(new Set(events.map(e => e.level)))];
  const categories = ['all', ...Array.from(new Set(events.map(e => e.category)))];

  const handleCopyEvent = (event: TelemetryEvent) => {
    const json = JSON.stringify(event, null, 2);
    navigator.clipboard.writeText(json);
    setCopied(event.sequence);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="h-full flex flex-col bg-neutral-950" data-testid="telemetry-page" data-ready="true">
      <PageHeader
        title="Telemetry Timeline"
        subtitle={`${filteredEvents.length} events · Last seq: ${lastSequence}`}
        badge={
          <span className="px-2 py-1 bg-blue-950/30 border border-blue-900/50 text-blue-400 text-xs font-medium rounded">
            LIVE
          </span>
        }
        testId="telemetry-header"
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Event timeline */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-neutral-800">
          {/* Filters */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800 bg-neutral-900/50">
            <Filter className="w-4 h-4 text-neutral-500" />
            
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded text-sm text-neutral-300 focus:outline-none focus:border-blue-500"
              data-testid="telemetry-level-filter"
            >
              {levels.map(level => (
                <option key={level} value={level}>
                  {level === 'all' ? 'All Levels' : level.charAt(0).toUpperCase() + level.slice(1)}
                </option>
              ))}
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded text-sm text-neutral-300 focus:outline-none focus:border-blue-500"
              data-testid="telemetry-category-filter"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </option>
              ))}
            </select>

            <div className="flex-1" />

            <button
              className="p-1.5 hover:bg-neutral-800 rounded transition-colors text-neutral-400 hover:text-neutral-200"
              title="Refresh"
              data-testid="telemetry-refresh-btn"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Timeline feed */}
          <div className="flex-1 overflow-auto" data-testid="telemetry-timeline">
            {filteredEvents.length === 0 && (
              <div className="flex items-center justify-center h-64 text-neutral-500 text-sm">
                No events match current filters
              </div>
            )}
            
            {filteredEvents.map((event) => {
              const Icon = levelIcons[event.level];
              const isSelected = selectedEvent?.sequence === event.sequence;

              return (
                <div
                  key={event.sequence}
                  onClick={() => setSelectedEvent(event)}
                  className={`
                    px-4 py-3 border-b border-neutral-800/50 cursor-pointer transition-colors
                    ${isSelected ? 'bg-blue-950/20 border-l-2 border-l-blue-500' : 'hover:bg-neutral-900/50 border-l-2 border-l-transparent'}
                  `}
                  data-testid={`telemetry-event-${event.sequence}`}
                >
                  <div className="flex items-start gap-3">
                    <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${levelColors[event.level]}`} />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-neutral-500">
                          #{event.sequence}
                        </span>
                        <span className="text-xs font-mono text-neutral-500">
                          {formatTimestamp(event.timestamp)}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${levelBgColors[event.level]} ${levelColors[event.level]}`}>
                          {event.level}
                        </span>
                        <span className="px-1.5 py-0.5 bg-neutral-800 text-neutral-400 rounded text-xs font-medium">
                          {event.category}
                        </span>
                      </div>
                      
                      <div className="text-sm text-neutral-200">
                        {event.message}
                      </div>
                    </div>

                    <ChevronRight className={`w-4 h-4 text-neutral-600 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Detail drawer */}
        <div
          className={`w-96 bg-neutral-900 border-l border-neutral-800 transition-all duration-300 ${
            selectedEvent ? 'translate-x-0' : 'translate-x-full'
          }`}
          data-testid="telemetry-detail-drawer"
        >
          {selectedEvent && (
            <div className="h-full flex flex-col">
              <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-neutral-100">Event Details</h3>
                <button
                  onClick={() => handleCopyEvent(selectedEvent)}
                  className="p-1.5 hover:bg-neutral-800 rounded transition-colors text-neutral-400 hover:text-neutral-200"
                  title="Copy JSON"
                  data-testid="telemetry-copy-json-btn"
                >
                  {copied === selectedEvent.sequence ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>

              <div className="flex-1 overflow-auto p-4 space-y-4">
                <div>
                  <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Sequence</div>
                  <div className="text-sm font-mono text-neutral-100">#{selectedEvent.sequence}</div>
                </div>

                <div>
                  <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Timestamp</div>
                  <div className="text-sm font-mono text-neutral-100">{selectedEvent.timestamp}</div>
                </div>

                <div>
                  <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Level</div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${levelBgColors[selectedEvent.level]} ${levelColors[selectedEvent.level]}`}>
                    {selectedEvent.level.toUpperCase()}
                  </span>
                </div>

                <div>
                  <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Category</div>
                  <div className="text-sm font-mono text-neutral-100">{selectedEvent.category}</div>
                </div>

                <div>
                  <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Message</div>
                  <div className="text-sm text-neutral-200 leading-relaxed">
                    {selectedEvent.message}
                  </div>
                </div>

                {selectedEvent.metadata && Object.keys(selectedEvent.metadata).length > 0 && (
                  <div>
                    <div className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Metadata</div>
                    <div className="bg-neutral-950 border border-neutral-800 rounded p-3 font-mono text-xs overflow-auto">
                      <pre className="text-neutral-300">
                        {JSON.stringify(selectedEvent.metadata, null, 2)}
                      </pre>
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
