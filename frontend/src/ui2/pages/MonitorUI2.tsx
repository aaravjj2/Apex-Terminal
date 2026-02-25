/**
 * W01 — Monitor Page
 * Multi-panel trading monitor with ContextBus-driven symbol sync.
 * Layout persists to localStorage. Panels show chart, watchlist, blotter, positions.
 */

import { MonitorGrid } from '../components/MonitorGrid';

export function MonitorUI2() {
  return (
    <div data-testid="monitor-ui2-page" style={{ height: '100%' }}>
      <MonitorGrid testId="monitor-grid" />
    </div>
  );
}
