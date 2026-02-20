/**
 * ReplayUI2 Page
 * Embeds the real ReplayView from UI1
 */
import { ReplayView } from '../../features/layout/views/ReplayView';

export function ReplayUI2() {
  return (
    <div data-testid="replay-ui2-page" style={{ height: '100%', overflow: 'auto' }}>
      <ReplayView />
    </div>
  );
}
