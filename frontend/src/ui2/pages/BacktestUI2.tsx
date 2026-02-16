/**
 * BacktestUI2 Page
 * Embeds the real BacktestPanel from UI1
 */
import { BacktestPanel } from '../../features/backtest/BacktestPanel';

export function BacktestUI2() {
  return (
    <div data-testid="backtest-ui2-page" style={{ height: '100%', overflow: 'auto' }}>
      <BacktestPanel />
    </div>
  );
}
