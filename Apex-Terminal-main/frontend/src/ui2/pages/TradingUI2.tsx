/**
 * TradingUI2 Page
 * Full trading workspace: real chart + watchlist + orders + positions
 * Embeds real UI1 components for feature parity
 */

import { ChartHeaderStrip } from '../../features/chart/ChartHeaderStrip';
import { ChartCanvas } from '../../features/chart/ChartCanvas';
import { WatchlistPanel } from '../../features/watchlist/WatchlistPanel';
import { OrdersBlotter } from '../../features/orders/OrdersBlotter';
import { TradesLedger } from '../../features/trades/TradesLedger';
import { PageHeader, Pill } from '../components';

export function TradingUI2() {
  return (
    <div data-testid="trading-ui2-page" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px 0 16px' }}>
        <PageHeader
          title="Trading"
          subtitle="Live market data and order execution"
          icon="📈"
          badge={<Pill variant="success" size="xs">LIVE</Pill>}
          testId="trading-header"
        />
      </div>

      {/* Chart Header Strip — symbol selector, timeframe, indicators */}
      <div data-testid="trading-chart-strip" style={{ padding: '0 16px' }}>
        <ChartHeaderStrip />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '12px', flex: 1, overflow: 'hidden', padding: '8px 16px' }}>
        {/* Left: Chart + Orders/Trades tabs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflow: 'hidden' }}>
          <div data-testid="trading-chart-container" style={{ flex: 2, minHeight: '300px', borderRadius: 'var(--ui2-radius-md)', overflow: 'hidden', border: '1px solid var(--ui2-border)' }}>
            <ChartCanvas />
          </div>
          <div data-testid="trading-blotter-container" style={{ flex: 1, minHeight: '180px', display: 'flex', gap: '8px', overflow: 'hidden' }}>
            <div style={{ flex: 1, overflow: 'auto', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-md)' }}>
              <OrdersBlotter embedded />
            </div>
            <div style={{ flex: 1, overflow: 'auto', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-md)' }}>
              <TradesLedger embedded />
            </div>
          </div>
        </div>

        {/* Right: Watchlist */}
        <div data-testid="trading-watchlist-container" style={{ overflow: 'auto', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-md)' }}>
          <WatchlistPanel />
        </div>
      </div>
    </div>
  );
}
