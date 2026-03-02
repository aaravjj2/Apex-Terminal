/**
 * TradingMultiUI2 — Multi-chart layout page
 * Renders MultiChartLayout for 1/2/4/6 pane grid with shared timeframe
 */
import { MultiChartLayout } from '../../features/chart/MultiChartLayout';

export function TradingMultiUI2() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <MultiChartLayout
        layout={4}
        symbols={['AAPL', 'SPY', 'TSLA', 'QQQ']}
        timeframe="1D"
      />
    </div>
  );
}
