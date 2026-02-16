/**
 * DashboardUI2 Page
 * Embeds the real EnhancedCommandCenterView from UI1
 */
import { EnhancedCommandCenterView } from '../../features/layout/views/EnhancedCommandCenterView';

export function DashboardUI2() {
  return (
    <div data-testid="dashboard-ui2-page" style={{ height: '100%', overflow: 'auto' }}>
      <EnhancedCommandCenterView />
    </div>
  );
}
